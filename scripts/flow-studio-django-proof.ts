import { deepStrictEqual } from 'node:assert';
import { readRawSeed } from '../src/flow-studio/data/seed-files';
import { buildSeed } from '../src/flow-studio/model/load';
import { expectedOf, normDeep } from '../tests/support/acceptance-doc';

/*
 * Run by flow-studio-django-proof.sh. Drives `next start` the way a browser does, against a real Django session on the
 * local Postgres. Every check throws on failure, so reaching the end means all of them held.
 */
const NEXT_URL = process.env.NEXT_URL as string;
const BACKEND = process.env.FLOW_STUDIO_BACKEND_URL as string;
const PASSWORD = process.env.PROOF_PASSWORD as string;
const STORE_TOKEN = process.env.FLOW_STUDIO_STORE_TOKEN as string;

const TEST_DATE = '2026-10-20';
const CONFLICT = 'This workflow changed since you opened it. Reload to see the latest.';

function check(condition: unknown, what: string): void {
  if (!condition) throw new Error(`FAILED: ${what}`);
  console.log(`ok  ${what}`);
}

interface Session { cookie: string; csrf: string; name: string }

async function logIn(email: string, name: string): Promise<Session> {
  const response = await fetch(`${BACKEND}/auth/password/login-user`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
    redirect: 'manual',
  });
  if (response.status !== 200) throw new Error(`Login as ${email} answered ${response.status}: ${await response.text()}`);
  const cookies = response.headers.getSetCookie().map((line) => line.split(';')[0]);
  const csrf = cookies.find((cookie) => cookie.startsWith('csrftoken='))?.split('=')[1];
  if (!csrf) throw new Error('Login set no csrftoken');
  return { cookie: cookies.join('; '), csrf, name };
}

interface Result { status: number; body: any } // JSON from the app under test

async function next(session: Session | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Result> {
  const response = await fetch(`${NEXT_URL}${path}`, {
    method,
    headers: {
      ...(session ? { cookie: session.cookie } : {}),
      ...(session && method !== 'GET' ? { 'x-csrftoken': session.csrf, origin: NEXT_URL } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function main(): Promise<void> {
  const admin = await logIn(process.env.ADMIN_EMAIL as string, 'Local Admin');
  const second = await logIn(process.env.SECOND_EMAIL as string, 'Samira Khan');
  const seed = buildSeed(readRawSeed());

  // ── Decision 5: linking accounts is a required step per tenant. An admin who is nobody yet can do it. ─────
  const accounts = await next(admin, 'GET', '/api/flow-studio/account-links');
  check(accounts.status === 200 && accounts.body.links.length === 0, 'no account is linked to a person until someone links it');
  for (const [email, person] of [[process.env.SECOND_EMAIL, 'Samira Khan'], [process.env.RAJ_EMAIL, 'Raj Patel']] as const) {
    const accountId = accounts.body.members.find((member: { email: string }) => member.email === email)?.id;
    const linked = await next(admin, 'POST', '/api/flow-studio/account-links', { accountId, person });
    check(linked.status === 200 && linked.body.person === person, `${email} is linked to ${person}, by id`);
  }

  // ── Reading through a real session ────────────────────────────────────────
  check((await next(null, 'GET', '/api/flow-studio/workflows')).status === 401, 'no session: 401');
  const list = await next(admin, 'GET', '/api/flow-studio/workflows');
  check(list.status === 200 && list.body.length === 15, 'the seeded tenant lists 15 workflows through Next and Django');
  check(list.body[0].id === 'wf-jp' && list.body[2].isVariationOf === 'wf-wo-sub', 'in picker order');

  // ── Key order: every draft.nodes in the seed comes back in stored order ───
  for (const workflow of seed.workflows) {
    const { body } = await next(admin, 'GET', `/api/flow-studio/workflows/${workflow.id}`);
    const stored = Object.keys(body.workflow.draft.nodes).join();
    if (stored !== Object.keys(workflow.draft.nodes).join()) throw new Error(`FAILED: key order of ${workflow.id}: ${stored}`);
    if (JSON.stringify(body.workflow.draft) !== JSON.stringify(workflow.draft)) throw new Error(`FAILED: draft of ${workflow.id} differs`);
  }
  check(true, 'all 15 drafts come back byte-identical, draft.nodes in stored key order');

  // ── Simulate on Django gives the 06 A.1 result ────────────────────────────
  const simulated = await next(admin, 'POST', '/api/flow-studio/workflows/wf-wo-sub-wo-uk-tech/simulate', { recordId: 'WO-2214' });
  check(simulated.status === 200, 'simulate WO-2214 on wf-wo-sub-wo-uk-tech answers 200');
  deepStrictEqual(normDeep(simulated.body), normDeep(expectedOf('EN-022')));
  check(true, 'and equals the expected result of 06 EN-022, with the seed read back from Postgres');

  // ── Save a draft; a stale draftRev gets 409; key order survives ───────────
  const id = 'wf-onboard';
  const loaded = await next(admin, 'GET', `/api/flow-studio/workflows/${id}`);
  check(loaded.body.draftRev === 1, 'a freshly seeded workflow is at draftRev 1');
  const reversed = Object.fromEntries(Object.entries(loaded.body.workflow.draft.nodes).reverse());
  const order = Object.keys(reversed);
  const saved = await next(admin, 'PUT', `/api/flow-studio/workflows/${id}/draft`, { draft: { ...loaded.body.workflow, draft: { nodes: reversed } }, draftRev: 1 });
  check(saved.status === 200 && saved.body.draftRev === 2, 'saving a draft moves draftRev to 2');
  const stale = await next(admin, 'PUT', `/api/flow-studio/workflows/${id}/draft`, { draft: { ...loaded.body.workflow, name: 'Stale' }, draftRev: 1 });
  check(stale.status === 409 && stale.body.error.message === CONFLICT, `a stale draftRev gets 409 with "${CONFLICT}"`);
  const reloaded = await next(admin, 'GET', `/api/flow-studio/workflows/${id}`);
  check(reloaded.body.draftRev === 2 && reloaded.body.workflow.name === loaded.body.workflow.name, 'the stale save changed nothing');
  check(Object.keys(reloaded.body.workflow.draft.nodes).join() === order.join(), `a new key order survives the round trip (${order.slice(0, 4).join(', ')}, …)`);

  // ── The race itself: ten saves with the same draftRev, one wins ───────────
  const racing = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      next(admin, 'PUT', `/api/flow-studio/workflows/${id}/draft`, { draft: { ...reloaded.body.workflow, name: `Race ${i}` }, draftRev: 2 }),
    ),
  );
  const statuses = racing.map((result) => result.status).sort();
  check(statuses.filter((status) => status === 200).length === 1 && statuses.filter((status) => status === 409).length === 9, `ten concurrent saves at one draftRev: one 200, nine 409 (${statuses.join()})`);
  check((await next(admin, 'GET', `/api/flow-studio/workflows/${id}`)).body.draftRev === 3, 'draftRev moved exactly once');

  // ── CSRF is Django's check, on the forwarded session ──────────────────────
  const current = (await next(admin, 'GET', `/api/flow-studio/workflows/${id}`)).body;
  const noCsrf = await fetch(`${NEXT_URL}/api/flow-studio/workflows/${id}/draft`, {
    method: 'PUT',
    headers: { cookie: admin.cookie, 'content-type': 'application/json', origin: NEXT_URL },
    body: JSON.stringify({ draft: { ...current.workflow, name: 'No CSRF' }, draftRev: current.draftRev }),
  });
  check(noCsrf.status === 403, 'a write with the session but no CSRF header gets 403 from Django');
  const crossSite = await next(admin, 'PUT', `/api/flow-studio/workflows/${id}/draft`, { draft: { ...current.workflow, name: 'Cross site' }, draftRev: current.draftRev }, { origin: 'https://evil.example' });
  check(crossSite.status === 403, 'a write from another origin gets 403');
  check((await next(admin, 'GET', `/api/flow-studio/workflows/${id}`)).body.workflow.name === current.workflow.name, 'neither was written');

  // ── The store itself refuses a member without the token ───────────────────
  const direct = await fetch(`${BACKEND}/flowstudio-store/c/workflows/`, { headers: { cookie: admin.cookie, 'x-forwarded-host': 'localhost' } });
  check(direct.status === 403, 'a member calling the store directly without the token gets 403');
  const wrongToken = await fetch(`${BACKEND}/flowstudio-store/c/workflows/`, { headers: { 'x-levv-store-token': 'wrong', 'x-forwarded-host': 'localhost' } });
  check(wrongToken.status === 403, 'a wrong token gets 403');

  // ── Tenant isolation through the real server ──────────────────────────────
  const elsewhere = await fetch(`${BACKEND}/flowstudio-store/c/workflows/wf-onboard/`, { headers: { 'x-levv-store-token': STORE_TOKEN, 'x-forwarded-host': 'fsproof.localhost' } });
  check(elsewhere.status === 404, 'the other tenant has no wf-onboard');
  // Django logs a session out when it is used on the wrong tenant, so this one gets its own login.
  const throwaway = await logIn(process.env.ADMIN_EMAIL as string, 'Local Admin');
  const crossTenant = await fetch(`${BACKEND}/flowstudio-store/c/workflows/`, { headers: { cookie: throwaway.cookie, 'x-levv-store-token': STORE_TOKEN, 'x-forwarded-host': 'fsproof.localhost' } });
  check(crossTenant.status === 403, 'a session of one tenant cannot read another, even with the token');

  // ── Publish, on Django, between two real admins ───────────────────────────
  const blocked = await next(admin, 'POST', '/api/flow-studio/workflows/wf-wo-sub-wo-data/publish-requests', { goLive: '2026-10-19' });
  check(blocked.status === 422 && blocked.body.error.message === 'Pick today or a later date.', 'a past goLive gets 422');
  const sent = await next(admin, 'POST', '/api/flow-studio/workflows/wf-wo-sub-wo-data/publish-requests', {
    goLive: TEST_DATE,
    precedence: [{ otherId: 'wf-wo-sub-wo-uk-tech', winner: 'self' }],
  });
  check(sent.status === 201, 'sent for approval');
  const own = await next(admin, 'POST', `/api/flow-studio/publish-requests/${sent.body.id}/approve`, {});
  check(own.status === 403 && own.body.error.message === 'You can’t approve your own change.', 'the author gets 403');
  const pendingList = await next(second, 'GET', '/api/flow-studio/publish-requests?status=pending');
  check(pendingList.body.length === 1 && pendingList.body[0].id === sent.body.id, 'the other admin sees it pending');
  const approved = await next(second, 'POST', `/api/flow-studio/publish-requests/${sent.body.id}/approve`, {});
  check(approved.status === 200 && approved.body.version === 1 && approved.body.approvedBy === 'Samira Khan', 'the first publish of "Data and AI hires" becomes v1');
  const published = await next(admin, 'GET', '/api/flow-studio/workflows/wf-wo-sub-wo-data');
  check(published.body.workflow.status === 'live' && published.body.workflow.priority === 1, 'it is live with priority 1');
  check(published.body.publishedNotice?.version === 1, 'the author gets the published notice, written through the service context');
  const again = await next(admin, 'GET', '/api/flow-studio/workflows/wf-wo-sub-wo-data');
  check(again.body.publishedNotice === undefined, 'once');
  const other = await next(admin, 'GET', '/api/flow-studio/workflows/wf-wo-sub-wo-uk-tech');
  check(other.body.workflow.priority === 2, 'the overlap choice reached the other workflow');

  // ── Create, active, import ────────────────────────────────────────────────
  const created = await next(admin, 'POST', '/api/flow-studio/workflows', {});
  check(created.status === 201 && created.body.id === 'nf101', 'a new workflow is nf101');
  const secondNew = await next(admin, 'POST', '/api/flow-studio/workflows', {});
  check(secondNew.body.id === 'nf102', 'the next one does not collide');
  const off = await next(admin, 'POST', '/api/flow-studio/workflows/wf-jp/active', { active: false });
  check(off.status === 200 && off.body.workflow.status === 'inactive' && off.body.warning !== null, 'switching off works, with its warning');
  const imported = await next(admin, 'POST', '/api/flow-studio/reference/import', { key: 'approval-rules', data: readRawSeed()['approval-rules'] });
  check(imported.status === 204, 'reference import answers 204');

  // ── Runtime stub, auth first ──────────────────────────────────────────────
  const noRuns = await next(admin, 'GET', '/api/runtime/runs');
  check(noRuns.status === 200 && Array.isArray(noRuns.body.runs), 'the runs route answers a signed-in admin');
  check((await next(null, 'POST', '/api/runtime/tick', {})).status === 403, 'tick without the secret gets 403');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

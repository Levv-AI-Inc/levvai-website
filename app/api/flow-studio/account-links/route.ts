import { z } from 'zod';
import { copy } from '@flow-studio/engine/copy';
import { ApiError } from '@flow-studio/server/errors';
import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Decision 5: who an account is in this tenant. Only someone with reference.import sets it, and it is a required step per tenant. */
export const GET = signedIn({ permission: 'reference.import' }, async ({ store }) => {
  const [members, links] = await Promise.all([store.members(), store.links.list()]);
  return json({ members, links });
});

const SetLink = z.object({
  accountId: z.string().min(1),
  person: z.string().min(1).nullable(),
  teams: z.array(z.string().min(1)).optional(),
});

export const POST = signedIn<Record<string, never>, z.infer<typeof SetLink>>({ permission: 'reference.import', body: SetLink }, async ({ store, actor, body, clock }) => {
  const member = (await store.members()).find((candidate) => candidate.id === body.accountId);
  if (!member) throw new ApiError(422, 'NOT_A_MEMBER', copy.linkNotAMember);
  const [{ people }, workflows, existing] = await Promise.all([store.reference.getAll(), store.workflows.all(), store.links.get(body.accountId)]);
  if (body.person !== null && !people.PEOPLE.includes(body.person)) throw new ApiError(422, 'NOT_A_PERSON', copy.linkNotAPerson);
  const teams = body.teams ?? existing?.teams ?? [];
  const owners = new Set(workflows.flatMap((workflow) => [workflow.owner, ...(workflow.versions ?? []).map((version) => version.owner)]));
  if (teams.some((team) => !owners.has(team))) throw new ApiError(422, 'NOT_A_TEAM', copy.linkNotATeam);
  const saved = await store.links.set({ accountId: body.accountId, email: member.email, person: body.person, teams, linkedBy: actor.id ?? actor.name, linkedAt: clock.now() });
  if ('conflict' in saved) throw new ApiError(409, 'PERSON_ALREADY_LINKED', copy.linkTaken);
  return json(saved);
});

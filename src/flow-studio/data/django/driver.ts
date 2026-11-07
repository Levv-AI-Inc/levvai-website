import type { BackendClient } from '../../server/backend-client';
import { ApiError } from '../../server/errors';
import type { AccountLink } from '../../model/runtime';
import type { ActingUserRow, MemberRow, Row, StoreDriver, TxResult, Where, WriteResult } from '../driver';

function queryOf(where: Where): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(where)) {
    for (const one of Array.isArray(value) ? value : [value]) query.append(key, one);
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

const tenantNotFound = (): ApiError => new ApiError(404, 'TENANT_NOT_FOUND', 'This tenant doesn’t exist.');

function storeFailure(status: number, detail: string): ApiError {
  if (status === 403) return new ApiError(403, 'FORBIDDEN', 'Your session can’t do this. Reload the page and sign in again.');
  return new ApiError(503, 'STORE_UNAVAILABLE', `The Flow Studio store answered ${status}${detail ? `: ${detail}` : ''}`);
}

/** apps.flowstudio over HTTP. All logic stays on this side: Django stores rows and enforces revs atomically. */
export function createDjangoDriver(client: BackendClient): StoreDriver {
  const read = async <T>(path: string): Promise<T> => {
    const response = await client.store('GET', path);
    if (response.status === 404) throw tenantNotFound();
    if (response.status !== 200) throw storeFailure(response.status, await response.text());
    return (await response.json()) as T;
  };

  return {
    async list(collection, where = {}) {
      const { rows } = await read<{ rows: Row[] }>(`c/${collection}/${queryOf(where)}`);
      return rows;
    },
    async get(collection, id) {
      const response = await client.store('GET', `c/${collection}/${encodeURIComponent(id)}/`);
      if (response.status === 404) {
        const body = await response.text();
        // Django's own 404 for a missing row is JSON; anything else means the tenant host itself is unknown.
        if (!body.startsWith('{')) throw tenantNotFound();
        return null;
      }
      if (response.status !== 200) throw storeFailure(response.status, await response.text());
      return (await response.json()) as Row;
    },
    async tx(writes): Promise<TxResult> {
      const response = await client.store('POST', 'tx/', { writes });
      if (response.status === 200) {
        const { results } = (await response.json()) as { results: WriteResult[] };
        return { ok: true, results };
      }
      if (response.status === 409) {
        const conflict = (await response.json()) as { index: number; reason: Extract<TxResult, { ok: false }>['reason']; current?: unknown };
        return { ok: false, index: conflict.index, reason: conflict.reason, current: conflict.current };
      }
      throw storeFailure(response.status, await response.text());
    },
    /** Decision 5: an admin with no link to a person can't approve anything, so only linked ones are returned. */
    async actingUsers(): Promise<ActingUserRow[]> {
      const [{ actors }, { rows }] = await Promise.all([read<{ actors: MemberRow[] }>('actors/'), read<{ rows: Row[] }>('c/links/')]);
      const personOf = new Map(rows.map((row) => [row.id, (row.doc as AccountLink).person]));
      return actors.flatMap((actor) => {
        const person = personOf.get(actor.id);
        return person ? [{ id: actor.id, name: person, permissions: ['admin'] }] : [];
      });
    },
    async members(): Promise<MemberRow[]> {
      return (await read<{ members: MemberRow[] }>('members/')).members;
    },
  };
}

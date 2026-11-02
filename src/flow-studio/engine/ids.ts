import type { IdGen } from '../model/context';

const PREFIX = { workflow: 'nf', node: 'n', path: 'p', branch: 'b' } as const;
const RESERVED_ID = /^(nf|n|p|b)(\d+)$/;

/** Engine §16.0: one counter shared by new workflow ids, node ids and added path and branch keys. */
export function createIdGen(start = 101): IdGen {
  let counter = start;
  return {
    next(kind) {
      const id = `${PREFIX[kind]}${counter}`;
      counter += 1;
      return id;
    },
    reserve(ids) {
      for (const id of ids) {
        const match = RESERVED_ID.exec(id);
        if (match) counter = Math.max(counter, Number(match[2]) + 1);
      }
    },
  };
}

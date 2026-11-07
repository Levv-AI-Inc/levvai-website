/**
 * M8's 40-step workflow, as plain data so the browser tests can send it without importing engine code. Eight runs of five
 * boxes: a Task or a check, an Approve, an If, the Approve on the If's path, a Notify. Start and End are extra.
 */
export function fortySteps(): Record<string, Record<string, unknown>> {
  const nodes: Record<string, Record<string, unknown>> = {};
  const approve = (id: string, label: string, roles: string[], to: string): Record<string, unknown> => ({
    id,
    kind: 'appr',
    label,
    roles,
    who: 'roles',
    mode: 'all',
    authority: false,
    material: ['total_value'],
    reaskOnDecrease: true,
    remind: 24,
    sla: 48,
    reject: 'requester',
    outs: [{ key: 'next', to }],
  });

  nodes.T = { id: 'T', kind: 'trigger', label: '', outs: [{ key: 'next', to: 'S0a' }] };
  for (let i = 0; i < 8; i += 1) {
    const next = i === 7 ? 'END' : `S${i + 1}a`;
    nodes[`S${i}a`] =
      i % 2 === 0
        ? { id: `S${i}a`, kind: 'task', label: `Prepare part ${i + 1}`, role: 'hm', title: `Prepare part ${i + 1}`, remind: 24, sla: 48, outs: [{ key: 'next', to: `S${i}b` }] }
        : { id: `S${i}a`, kind: 'dw', label: `Budget check ${i + 1}`, worker: 'budget', threshold: 80, fallback: 'proc', flagDo: 'note', outs: [{ key: 'flag', to: `S${i}b`, label: 'Flagged' }, { key: 'pass', to: `S${i}b`, label: 'Passed' }] };
    nodes[`S${i}b`] = approve(`S${i}b`, `Sign-off ${i + 1}`, ['cco'], `S${i}c`);
    nodes[`S${i}c`] = {
      id: `S${i}c`,
      kind: 'cond',
      label: `Over band ${i + 1}?`,
      mergeAt: `S${i}e`,
      outs: [
        { key: 'p1', to: `S${i}d`, label: 'Over', join: 'all', rows: [{ f: 'total_value', op: '>=', v: 10000 * (i + 1) }] },
        { key: 'else', to: `S${i}e`, label: 'Otherwise' },
      ],
    };
    nodes[`S${i}d`] = approve(`S${i}d`, `Band review ${i + 1}`, ['proc'], `S${i}e`);
    nodes[`S${i}e`] = { id: `S${i}e`, kind: 'notify', label: `Tell the team ${i + 1}`, recipients: ['hm'], channel: 'Email', outs: [{ key: 'next', to: next }] };
  }
  nodes.END = { id: 'END', kind: 'end', label: '', outcome: 'completed', outs: [] };
  return nodes;
}

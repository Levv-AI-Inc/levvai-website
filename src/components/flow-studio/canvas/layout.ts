import type { Out, WfNode } from '@flow-studio/model/workflow';

/** 04 §4.1. Pure: the canvas draws what this returns, and the tests compare it with Appendix A and the prototype. */

export const NODE_SIZE = 88;
export const IF_WIDTH = 176;
const LEVEL_STEP = 220;
const ROW_STEP = 176;
const LEFT = 70;
const TOP = 90;
const IF_EXTRA = 88;
const LANE_GAP = 18;
const LANE_STAGGER = 8;
const LANE_MIN = 14;

type Nodes = Record<string, WfNode>;

export interface PlacedNode {
  id: string;
  x: number;
  y: number;
  level: number;
  row: number;
}

export interface PlacedEdge {
  from: string;
  key: string;
  to: string;
  d: string;
  mid: { x: number; y: number };
  lane: boolean;
}

export interface CanvasLayout {
  nodes: PlacedNode[];                     // layout order: level, then row (04 §4.7 tab order)
  byId: Record<string, PlacedNode>;
  edges: PlacedEdge[];
  width: number;
  height: number;
}

/**
 * Top to bottom as drawn; the last one stays on the node's row. A `fail` exit is added after the normal one, so it
 * is moved in front of it (04 §4.1 rule 6: Done keeps the main row, Failed goes above).
 */
export function visualOuts(node: WfNode): Out[] {
  const outs = (node.outs ?? []) as Out[];
  return [...outs.filter((out) => out.key === 'fail'), ...outs.filter((out) => out.key !== 'fail')];
}

/** 04 §4.2: exit `i` of `k` on a square. */
export const squarePortY = (i: number, k: number): number => (NODE_SIZE * (i + 1)) / (k + 1);

/** 04 §4.4: exit `i` of `k` on an If card, the last row on the main line. */
export const ifPortY = (i: number, k: number): number => 44 - 26 * (k - 1 - i);

/** 04 §4.4: the card's top, relative to the node's y. */
export const ifCardTop = (k: number): number => -9 - 26 * (k - 1);

const portY = (node: WfNode, i: number, k: number): number => (node.kind === 'cond' ? ifPortY(i, k) : squarePortY(i, k));
const nodeWidth = (node: WfNode): number => (node.kind === 'cond' ? IF_WIDTH : NODE_SIZE);

function levelsOf(nodes: Nodes, ids: string[]): Record<string, number> {
  const level: Record<string, number> = {};
  const incoming: Record<string, number> = {};
  const targets = (id: string): string[] => ((nodes[id].outs ?? []) as Out[]).map((out) => out.to).filter((to) => !!nodes[to]);
  for (const id of ids) {
    level[id] = 0;
    incoming[id] = 0;
  }
  for (const id of ids) for (const to of targets(id)) incoming[to] += 1;
  const queue = ids.filter((id) => incoming[id] === 0);
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const to of targets(id)) {
      level[to] = Math.max(level[to], level[id] + 1);
      incoming[to] -= 1;
      if (incoming[to] === 0) queue.push(to);
    }
  }
  if (nodes.END) level.END = Math.max(...ids.map((id) => level[id]));
  return level;
}

function rowsOf(nodes: Nodes, ids: string[], level: Record<string, number>): Record<string, number> {
  const row: Record<string, number> = {};
  const taken = new Set<string>();
  const place = (id: string, wanted: number): void => {
    let candidate = wanted;
    while (taken.has(`${level[id]}:${candidate}`)) candidate -= 1;
    row[id] = candidate;
    taken.add(`${level[id]}:${candidate}`);
  };
  const visit = (id: string, wanted: number): void => {
    if (!nodes[id] || row[id] !== undefined) return;
    place(id, wanted);
    const outs = visualOuts(nodes[id]);
    const k = outs.length;
    if (k === 0) return;
    visit(outs[k - 1].to, row[id]);
    outs.slice(0, -1).forEach((out, i) => visit(out.to, row[id] - (k - 1 - i)));
  };
  visit('T', 0);
  // An edit can leave a step with no way in (lint L13). It still has to be drawn, or Nova's "Show me" has nothing to show.
  for (const id of ids) {
    if (row[id] !== undefined) continue;
    visit(id, Math.max(...Object.values(row)) + 1);
  }
  return row;
}

export function layoutWorkflow(nodes: Nodes): CanvasLayout {
  const ids = Object.keys(nodes);
  const level = levelsOf(nodes, ids);
  const row = rowsOf(nodes, ids, level);

  const ifNodes = ids.filter((id) => nodes[id].kind === 'cond');
  const ifLevels = Array.from(new Set(ifNodes.map((id) => level[id])));
  const ifPad = Math.max(0, ...ifNodes.map((id) => 26 * (nodes[id].outs.length - 2) + 8));
  const minRow = Math.min(...Object.values(row));

  const byId: Record<string, PlacedNode> = {};
  for (const id of ids) {
    byId[id] = {
      id,
      level: level[id],
      row: row[id],
      x: LEFT + level[id] * LEVEL_STEP + IF_EXTRA * ifLevels.filter((l) => l < level[id]).length,
      y: TOP + ifPad + (row[id] - minRow) * ROW_STEP,
    };
  }
  const placed = Object.values(byId);
  const width = Math.max(...placed.map((p) => p.x)) + 260;
  const height = Math.max(...placed.map((p) => p.y)) + 220;

  const top = (p: PlacedNode): number => (nodes[p.id].kind === 'cond' ? p.y + ifCardTop(nodes[p.id].outs.length) : p.y);

  const edges: PlacedEdge[] = [];
  for (const id of ids) {
    const node = nodes[id];
    const from = byId[id];
    const outs = visualOuts(node);
    outs.forEach((out, i) => {
      const to = byId[out.to];
      if (!to) return;
      const k = outs.length;
      const x1 = from.x + nodeWidth(node);
      const y1 = from.y + portY(node, i, k);
      const x2 = to.x;
      const y2 = to.y + NODE_SIZE / 2;
      const lo = Math.min(from.row, to.row);
      const hi = Math.max(from.row, to.row);
      const blockers = placed.filter((p) => p.level > from.level && p.level < to.level && p.row >= lo && p.row <= hi);
      if (blockers.length > 0) {
        // 04 §4.1 rule 5, as improved: the lane runs just above the highest obstruction.
        const laneY = Math.max(LANE_MIN, Math.min(...blockers.map(top)) - LANE_GAP - (k - 1 - i) * LANE_STAGGER);
        edges.push({
          from: id,
          key: out.key,
          to: out.to,
          d: `M${x1},${y1} C${x1 + 60},${y1} ${x1 + 20},${laneY} ${x1 + 90},${laneY} L${x2 - 90},${laneY} C${x2 - 20},${laneY} ${x2 - 60},${y2} ${x2},${y2}`,
          mid: { x: (x1 + x2) / 2, y: laneY },
          lane: true,
        });
        return;
      }
      const dx = Math.max(40, (x2 - x1) / 2);
      edges.push({
        from: id,
        key: out.key,
        to: out.to,
        d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`,
        mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
        lane: false,
      });
    });
  }

  const ordered = [...placed].sort((a, b) => a.level - b.level || a.row - b.row);
  return { nodes: ordered, byId, edges, width, height };
}

/** 04 §4.9. `minimum` is 0.35 for the Fit button and 0.5 when a workflow opens. */
export function fitZoom(viewportWidth: number, viewportHeight: number, layout: Pick<CanvasLayout, 'width' | 'height'>, minimum: number): number {
  return Math.max(minimum, Math.min(1, (viewportWidth - 30) / layout.width, (viewportHeight - 80) / layout.height));
}

export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 1.4;
export const ZOOM_OPEN_MIN = 0.5;
/**
 * Not 04 §4.9's 0.5, which is the full page's: in the app's content column (856 wide at 1440, /admin/workflows and the run
 * page) that leaves box text at 6.5 px. 0.7 is the smallest zoom with a 9 px title. Fit keeps 04's rule, for the whole picture.
 */
export const ZOOM_OPEN_COLUMN = 0.7;
export const clampZoom = (zoom: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom * 100) / 100));

/**
 * 04 §4.8, 03 §15 item 4: "A branch that ends on its own does not hold anything up." These are the lines of every Parallel
 * branch that shares no step with another branch. An End does not count as meeting: it is where such a branch stops.
 */
export function softEdges(nodes: Record<string, WfNode>): Set<string> {
  const soft = new Set<string>();
  const reachFrom = (start: string): Set<string> => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (seen.has(id) || !nodes[id] || nodes[id].kind === 'end') continue;
      seen.add(id);
      for (const out of nodes[id].outs ?? []) stack.push(out.to);
    }
    return seen;
  };
  for (const node of Object.values(nodes)) {
    if (node.kind !== 'parallel') continue;
    const branches = (node.outs ?? []).map((out) => ({ out, reach: reachFrom(out.to) }));
    for (const branch of branches) {
      const meets = branches.some((other) => other !== branch && Array.from(branch.reach).some((id) => other.reach.has(id)));
      if (meets) continue;
      soft.add(`${node.id}:${branch.out.key}`);
      for (const id of Array.from(branch.reach)) for (const out of nodes[id].outs ?? []) soft.add(`${id}:${out.key}`);
    }
  }
  return soft;
}

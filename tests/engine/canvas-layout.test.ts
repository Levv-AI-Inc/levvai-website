import { describe, expect, it } from 'vitest';
import { clampZoom, fitZoom, ifCardTop, ifPortY, layoutWorkflow, squarePortY, visualOuts } from '@flow-studio-ui/canvas/layout';
import type { WfNode } from '@flow-studio/model/workflow';
import { makeContext, workflowById } from '../support/context';

/** 04 §4.1. Numbers worked by hand from the formulas, not read off the function. */

const node = (id: string, outs: [string, string, string?][], kind: WfNode['kind'] = 'task'): WfNode =>
  ({ id, kind, label: id, outs: outs.map(([key, to, label]) => ({ key, to, label })) }) as unknown as WfNode;

describe('layoutWorkflow on Work order submitted', () => {
  const layout = () => layoutWorkflow(workflowById(makeContext(), 'wf-wo-sub').draft.nodes);

  it('columns: longest path, x = 70 + level × 220 + 88 × If levels to the left', () => {
    const { byId } = layout();
    // T0, Budget 1, Duplicate 2, escalation 3, Business 4, If 5, Rate review 6, If 7, sign-offs 8, Tell 9, End 10.
    expect(byId.T.x).toBe(70);
    expect(byId.RA_CD.x).toBe(510);
    expect(byId.RA_A1.x).toBe(950);
    expect(byId.RA_C1.x).toBe(1170);
    expect(byId.RA_A2.x).toBe(1478);
    expect(byId.RA_C2.x).toBe(1698);
    expect(byId.RA_A3.x).toBe(2006);
    expect(byId.RW.x).toBe(2226);
    expect(byId.END.x).toBe(2446);
  });

  it('rows: y = 90 + ifPad + (row − minRow) × 176, ifPad 34 for the three-exit If', () => {
    const { byId } = layout();
    expect(byId.T.y).toBe(476);
    expect(byId.RA_C2.y).toBe(476);
    expect(byId.RA_CDe.y).toBe(300);
    expect(byId.RA_A3.y).toBe(300); // Over $250K: exit 1 of 3
    expect(byId.RA_A4.y).toBe(124); // Over $1M: exit 0 of 3
  });

  it('canvas size: W = max(x) + 260, H = max(y) + 220', () => {
    expect(layout().width).toBe(2706);
    expect(layout().height).toBe(696);
  });

  it('tab order: level, then row', () => {
    const ids = layout().nodes.map((place) => place.id);
    expect(ids.indexOf('RA_A4')).toBeLessThan(ids.indexOf('RA_A3'));
    expect(ids[0]).toBe('T');
    expect(ids[ids.length - 1]).toBe('END');
  });

  it('every edge is a cubic from the out-port to the in-port, with the "+" at its midpoint', () => {
    const edge = layout().edges.find((candidate) => candidate.from === 'T');
    // x1 = 70 + 88, y1 = 476 + 44; x2 = 290, y2 = 520; dx = max(40, 66).
    expect(edge?.d).toBe('M158,520 C224,520 224,520 290,520');
    expect(edge?.mid).toEqual({ x: 224, y: 520 });
  });
});

describe('port and card geometry', () => {
  it('square ports: y = 88 × (i + 1)/(k + 1)', () => {
    expect(squarePortY(0, 1)).toBe(44);
    expect(squarePortY(0, 2)).toBeCloseTo(29.33, 2);
    expect(squarePortY(1, 2)).toBeCloseTo(58.67, 2);
  });

  it('If ports: the last row is on the main line', () => {
    expect(ifPortY(2, 3)).toBe(44);
    expect(ifPortY(1, 3)).toBe(18);
    expect(ifPortY(0, 3)).toBe(-8);
    expect(ifCardTop(3)).toBe(-61);
  });
});

describe('04 §4.1 rule 6: a Failed exit does not take the main row', () => {
  const nodes = {
    T: node('T', [['next', 'S']], 'trigger'),
    S: node('S', [['next', 'N', 'Done'], ['fail', 'F', 'Failed']], 'system'),
    F: node('F', [['next', 'N']]),
    N: node('N', [['next', 'END']]),
    END: node('END', [], 'end'),
  };

  it('keeps Done on the row and puts Failed above', () => {
    const { byId } = layoutWorkflow(nodes);
    expect(byId.N.row).toBe(0);
    expect(byId.F.row).toBe(-1);
    expect(visualOuts(nodes.S).map((out) => out.key)).toEqual(['fail', 'next']);
  });

  it('does not reorder anything else', () => {
    const check = node('C', [['flag', 'F', 'Flagged'], ['pass', 'N', 'Passed']], 'dw');
    expect(visualOuts(check).map((out) => out.key)).toEqual(['flag', 'pass']);
  });
});

describe('04 §4.1 rule 5: blocked edges', () => {
  // T → A → B → C → END on the main row, and an exit from A straight to END, over B and C.
  const nodes = {
    T: node('T', [['next', 'A']], 'trigger'),
    A: node('A', [['skip', 'END', 'Skip'], ['next', 'B', 'Go']], 'parallel'),
    B: node('B', [['next', 'C']]),
    C: node('C', [['next', 'END']]),
    END: node('END', [], 'end'),
  };

  it('runs in a lane just above the highest obstruction, not at the top of the canvas', () => {
    const { edges, byId } = layoutWorkflow(nodes);
    const skip = edges.find((edge) => edge.key === 'skip');
    expect(skip?.lane).toBe(true);
    // B and C obstruct on row 0. Exit 0 of 2: y − 18 − 8.
    expect(skip?.mid.y).toBe(byId.B.y - 26);
    expect(skip?.d).toContain(`L${byId.END.x - 90},${byId.B.y - 26}`);
  });

  it('counts an If card’s height when it is the obstruction', () => {
    const withIf = {
      T: node('T', [['next', 'A']], 'trigger'),
      A: node('A', [['skip', 'END', 'Skip'], ['next', 'I', 'Go']], 'parallel'),
      I: node('I', [['p1', 'B', 'One'], ['p2', 'B', 'Two'], ['else', 'B', 'Otherwise']], 'cond'),
      B: node('B', [['next', 'END']]),
      END: node('END', [], 'end'),
    };
    const { edges, byId } = layoutWorkflow(withIf);
    const skip = edges.find((edge) => edge.key === 'skip');
    expect(skip?.mid.y).toBe(byId.I.y + ifCardTop(3) - 26);
  });
});

it('a step with no way in is still placed (lint L13 must be able to show it)', () => {
  const { byId } = layoutWorkflow({
    T: node('T', [['next', 'END']], 'trigger'),
    LOST: node('LOST', [['next', 'END']]),
    END: node('END', [], 'end'),
  });
  expect(byId.LOST).toBeDefined();
  expect(byId.LOST.row).toBeGreaterThan(byId.T.row);
});

describe('04 §4.9 zoom', () => {
  const size = { width: 2000, height: 1000 };

  it('fit: min(1, (w − 30)/W, (h − 80)/H), floored', () => {
    expect(fitZoom(1030, 2000, size, 0.35)).toBe(0.5);
    expect(fitZoom(3000, 580, size, 0.35)).toBe(0.5);
    expect(fitZoom(5000, 5000, size, 0.35)).toBe(1);
    expect(fitZoom(100, 100, size, 0.35)).toBe(0.35);
    expect(fitZoom(100, 100, size, 0.5)).toBe(0.5);
  });

  it('− and + stay within 0.35 to 1.4', () => {
    expect(clampZoom(0.2)).toBe(0.35);
    expect(clampZoom(1.6)).toBe(1.4);
    expect(clampZoom(0.5 + 0.1)).toBe(0.6);
  });
});

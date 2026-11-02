import { checkResult } from '../engine/checks';
import type { Rec } from '../engine/conditions';
import type { EngineContext } from '../model/context';
import type { RecordData } from '../model/records';
import type { WfNode } from '../model/workflow';
import { simulatedOutcome } from '../engine/walk';
import { runtimeCopy } from './copy';

/** 05 §5.1. This build ships deterministic mocks only (00 §4.2), and every result says so. */

export type SystemResult =
  | { status: 'done'; ref: string; values: Record<string, unknown> }
  | { status: 'pending'; ref: string }
  | { status: 'failed'; error: string; retryable: boolean };

export interface SystemRequest {
  action: 'create' | 'update' | 'read' | 'wait' | 'close' | 'check';
  object: string;
  fields: Record<string, unknown>;
  match: { key: string; value: unknown };
  bringBack: string[];
  idempotencyKey: string;
}

export interface SystemAdapter {
  system: string;
  status(): Promise<{ connected: boolean; lastChecked: string }>;
  execute(req: SystemRequest): Promise<SystemResult>;
  confirm(ref: string): Promise<{ status: 'done'; values: Record<string, unknown> } | { status: 'pending' } | { status: 'failed'; error: string }>;
}

export interface Verifier {
  provider: string;
  /** `step` is additive: the mock answers "for that record and step" (05 §5.2). */
  verify(req: { items: string[]; record: RecordData; pkg?: string; step: Pick<WfNode, 'id' | 'kind' | 'label'> }): Promise<{ result: 'verified' | 'unsure' | 'fail'; message: string }>;
}

export interface CheckService {
  run(check: string, record: RecordData, settings: object): Promise<{ ok: boolean; m: string }>;
}

export interface Notifier {
  send(msg: { to: string; channel: string; subject: string; body: string }): Promise<void>;
}

export interface InboundPoll { recordType: string; recordId: string; event: string; data: object }
export interface EventSource {
  system: string;
  poll(since: string): Promise<InboundPoll[]>;
}

/** What a run calls. `isMock` is what makes a simulated result visible on the run: it has to be answered honestly by whatever is plugged in. */
export interface Adapters {
  isMock: boolean;
  system(name: string, record: Rec): SystemAdapter;
  verifier(checker: string, record: Rec): Verifier;
  checks: CheckService;
}

const READ_BACK: Record<string, (id: string) => string> = {
  'Workday worker ID': (id) => `WD-${id}`,
  'Hire status': () => 'Hired',
  'Fieldglass worker ID': (id) => `FG-${id}`,
  'Work order status': () => 'Completed',
  'PO number': (id) => `PO-${id}`,
  'Posting status': () => 'Posted',
  'Ticket number': (id) => `TKT-${id}`,
  'Ticket status': () => 'Completed',
  'Okta user ID': (id) => `OKTA-${id}`,
  'Entra object ID': (id) => `ENTRA-${id}`,
  'Account status': () => 'Active',
  'Coupa PO number': (id) => `COUPA-${id}`,
  'Badge number': (id) => `B-${id}`,
  'Badge status': () => 'Active',
};

const refFor = (system: string, recordId: unknown, key: string): string =>
  `${system.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${String(recordId)}-${key.split(':').pop()}`;

/** 05 §5.2 System mock: done with a generated ref and read-back values; failed for `fail_system`; not connected stays failed. */
export function mockSystem(name: string, record: Rec, ctx: Pick<EngineContext, 'systems' | 'now'>): SystemAdapter {
  const connected = ctx.systems.SYS[name]?.st !== 'off';
  return {
    system: name,
    status: async () => ({ connected, lastChecked: ctx.now }),
    async execute(req) {
      if (!connected) return { status: 'failed', error: runtimeCopy.notConnected, retryable: false };
      if (record.fail_system === name) return { status: 'failed', error: `${name} is not responding`, retryable: true };
      const values: Record<string, unknown> = {};
      for (const field of req.bringBack) values[field] = (READ_BACK[field] ?? ((id: string) => `${field}-${id}`))(String(record.id));
      return { status: 'done', ref: refFor(name, record.id, req.idempotencyKey), values };
    },
    confirm: async () => ({ status: 'done', values: {} }),
  };
}

/** 05 §5.2: the Test-simulated result for that record and step (03 §10.2, §10.3). */
export const mockVerifier = (checker: string, label: string): Verifier => ({
  provider: checker,
  async verify({ record, step }) {
    const outcome = simulatedOutcome(record as Rec, step as WfNode);
    if (outcome === 'fail') return { result: 'fail', message: `${label} failed` };
    if (outcome === 'unsure') return { result: 'unsure', message: `${label} wasn’t sure` };
    return { result: 'verified', message: `Verified by ${label}` };
  },
});

/** 05 §3.4.2: what 03 §5 computes from the record. */
export const mockChecks = (ctx: Pick<EngineContext, 'dws'>): CheckService => ({
  run: async (check, record) => checkResult(check, record as Rec, ctx),
});

export function mockAdapters(ctx: Pick<EngineContext, 'systems' | 'dws' | 'presets' | 'now'>): Adapters {
  return {
    isMock: true,
    system: (name, record) => mockSystem(name, record, ctx),
    verifier: (checker) => mockVerifier(checker, ctx.presets.CHECKERS[checker] ?? checker),
    checks: mockChecks(ctx),
  };
}

export interface QueuedEvent extends InboundPoll { at: string }

/** 05 §5.2: reads queued events from a list (a JSON file in a demo). Production polls Fieldglass every 15 minutes. */
export const mockFieldglass = (queued: QueuedEvent[]): EventSource => ({
  system: 'SAP Fieldglass',
  poll: async (since) =>
    queued
      .filter((event) => Date.parse(event.at) > Date.parse(since))
      .map(({ recordType, recordId, event, data }) => ({ recordType, recordId, event, data })),
});

/**
 * 05 §5.2 "on in e2e and development, off in production". It never defaults on, and a production process ignores the
 * flag unless it is the LEVV_E2E test app (which refuses the Django store, so it can't touch real data). A stray
 * LEVV_MOCK_AUTOCOMPLETE=1 on a real deployment therefore can't hand over a real worker's documents.
 */
export function mockAutocomplete(env: Record<string, string | undefined> = process.env): boolean {
  if (env.LEVV_MOCK_AUTOCOMPLETE !== '1') return false;
  return env.NODE_ENV !== 'production' || env.LEVV_E2E === '1';
}

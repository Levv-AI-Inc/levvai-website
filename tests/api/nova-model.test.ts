import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as novaRoute } from '../../app/api/flow-studio/nova/condition/route';
import { call, resetApp, setE2EEnv, signIn } from '../support/api';

const callGPT = vi.hoisted(() => vi.fn());
vi.mock('@/lib/intelligence/gpt/callGPT', () => ({ callGPT }));

setE2EEnv();

const ask = (text: string) =>
  call(novaRoute, '/api/flow-studio/nova/condition', { user: 'Flow Admin', body: { text, workflowId: 'wf-wo-sub', nodeId: 'T' } });

beforeEach(async () => {
  await resetApp();
  await signIn('Flow Admin');
});

afterEach(() => callGPT.mockReset());

describe('POST /api/flow-studio/nova/condition with the model (01 §7)', () => {
  it('uses a valid answer and says it came from the model', async () => {
    callGPT.mockResolvedValue(JSON.stringify({ join: 'all', rows: [{ f: 'total_value', op: '>', v: 300000 }] }));
    const result = await ask('total value over $250K');
    expect(result.body).toEqual({ rows: [{ f: 'total_value', op: '>', v: 300000 }], join: 'all', source: 'gpt' });
  });

  it('asks at temperature 0 with a way to cancel, and sends only the sentence and the catalog', async () => {
    callGPT.mockResolvedValue('{"join":"all","rows":[{"f":"total_value","op":">","v":1}]}');
    await ask('total value over $250K');
    const [messages, options] = callGPT.mock.calls[0];
    expect(options.temperature).toBe(0);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(messages[1]).toEqual({ role: 'user', content: 'total value over $250K' });
    const sent = JSON.stringify(messages);
    for (const name of ['Raj Patel', 'Samira Khan', 'WO-2214']) expect(sent).not.toContain(name);
  });

  it.each([
    ['text that is not JSON', 'Sure! Here you go'],
    ['an unknown field', '{"join":"all","rows":[{"f":"nope","op":">","v":1}]}'],
    ['a value of the wrong type', '{"join":"all","rows":[{"f":"total_value","op":">","v":"lots"}]}'],
    ['no rows', '{"join":"all","rows":[]}'],
  ])('falls back to the parser on %s', async (_name, answer) => {
    callGPT.mockResolvedValue(answer);
    const result = await ask('total value over $250K');
    expect(result.body).toEqual({ rows: [{ f: 'total_value', op: '>', v: 250000 }], join: 'all', source: 'parser' });
  });

  it('falls back to the parser when the call fails', async () => {
    callGPT.mockRejectedValue(new Error('OPENAI_API_KEY is not configured.'));
    expect((await ask('total value over $250K')).body.source).toBe('parser');
  });

  it('does not call the model for empty text', async () => {
    expect((await ask('  ')).status).toBe(422);
    expect(callGPT).not.toHaveBeenCalled();
  });
});

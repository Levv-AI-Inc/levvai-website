import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { freshApp, signIn } from './helpers';

/** 06 §5.1, in the browser. Runs start through POST /api/runtime/events with the service token, and time moves through POST /api/test/clock. */

const FIXTURE = resolve(__dirname, '../fixtures/seed/runtime-records.json');
const records = (JSON.parse(readFileSync(FIXTURE, 'utf8')) as { records: (Record<string, unknown> & { id: string; record: string; event: string; source: string })[] }).records;

export const SERVICE_TOKEN = { 'x-levv-service-token': 'e2e-service-token' };
export const CRON_SECRET = { 'x-levv-cron-secret': 'e2e-cron-secret' };

export function eventFor(id: string, data: Record<string, unknown> = {}) {
  const record = records.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`No runtime record ${id}`);
  return { source: record.source, recordType: record.record, recordId: id, event: record.event, data: { ...record, ...data } };
}

export async function postEvent(request: APIRequestContext, id: string, data: Record<string, unknown> = {}): Promise<{ runIds: string[]; outcome: string }> {
  const response = await request.post('/api/runtime/events', { headers: SERVICE_TOKEN, data: eventFor(id, data) });
  expect(response.status()).toBe(200);
  return (await response.json()) as { runIds: string[]; outcome: string };
}

export async function startRun(page: Page, id: string, data: Record<string, unknown> = {}): Promise<string> {
  const result = await postEvent(page.request, id, data);
  expect(result.outcome).toBe('started');
  return result.runIds[0];
}

export async function setClock(page: Page, now: string): Promise<void> {
  const response = await page.request.post('/api/test/clock', { data: { now } });
  expect(response.status()).toBe(200);
}

export async function openRun(page: Page, runId: string): Promise<void> {
  await page.goto(`/runs/${runId}`);
  await expect(page.getByRole('region', { name: 'History' })).toBeVisible();
}

export const button = (page: Page | Locator, name: string): Locator => page.getByRole('button', { name, exact: true });

/** The page's content, without the app's sidebar. */
export const content = (page: Page): Locator => page.locator('main').last();

export const chip = (page: Page, status: string): Locator => page.getByRole('group', { name: 'Status', exact: true }).getByText(status, { exact: true });

export const historyLine = (page: Page, text: string): Locator => page.getByRole('region', { name: 'History' }).getByText(text, { exact: true });

/** Fills the dialog's text box and presses its confirming button. */
export async function confirmDialog(page: Page, title: string, field: string | null, value: string, confirm: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  if (field) await dialog.getByRole('textbox', { name: field, exact: true }).fill(value);
  await button(dialog, confirm).click();
  await expect(dialog).toHaveCount(0);
}

export async function pauseWith(page: Page, reason: string): Promise<void> {
  await button(page, 'Pause').click();
  await confirmDialog(page, 'Pause this workflow?', 'Reason (optional)', reason, 'Pause workflow');
}

export async function stopWith(page: Page, reason: string): Promise<void> {
  await button(page, 'Stop').click();
  await confirmDialog(page, 'Stop this workflow?', 'Reason', reason, 'Stop workflow');
}

export const inboxCard = (page: Page, name: string | RegExp): Locator => page.getByRole('article', { name });

export async function freshRuntime(page: Page, user = 'Owen Clarke'): Promise<void> {
  await freshApp(page, user);
}

/** LEVV_SHOTS_DIR saves the screens for a person to look at; they are never committed. */
export async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.LEVV_SHOTS_DIR;
  if (dir) await page.screenshot({ path: resolve(dir, `${name}.png`), fullPage: true });
}

/** A work item's id, as an approval link carries it. */
export async function itemIdOf(page: Page, user: string, kind: 'approvals' | 'tasks' | 'flowChanges', match: (item: Record<string, unknown>) => boolean = () => true): Promise<string> {
  await signIn(page, user);
  const inbox = (await (await page.request.get('/api/runtime/inbox')).json()) as Record<string, Record<string, unknown>[]>;
  const found = inbox[kind].find(match);
  if (!found) throw new Error(`No ${kind} item for ${user}: ${JSON.stringify(inbox)}`);
  return (kind === 'flowChanges' ? (found.item as { id: string }).id : found.id) as string;
}

export async function publishEdited(page: Page, workflowId: string, change: (workflow: Record<string, any>) => void): Promise<void> {
  await signIn(page, 'Flow Admin');
  const loaded = (await (await page.request.get(`/api/flow-studio/workflows/${workflowId}`)).json()) as { workflow: Record<string, any>; draftRev: number };
  change(loaded.workflow);
  const saved = await page.request.put(`/api/flow-studio/workflows/${workflowId}/draft`, { data: { draft: loaded.workflow, draftRev: loaded.draftRev } });
  expect(saved.status()).toBe(200);
  const sent = await page.request.post(`/api/flow-studio/workflows/${workflowId}/publish-requests`, { data: { goLive: '2026-10-20' } });
  expect(sent.status()).toBe(201);
  const { id } = (await sent.json()) as { id: string };
  await signIn(page, 'Samira Khan');
  expect((await page.request.post(`/api/flow-studio/publish-requests/${id}/approve`, { data: {} })).status()).toBe(200);
}

'use client';

import { draftHash } from '@flow-studio/data/draft-fields';
import type { Workflow } from '@flow-studio/model/workflow';
import { ApiFailure, apiGet, apiWrite } from './api';
import { uiCopy } from './copy';

/**
 * 01 §3.2 autosaves, and a page can go while a save is out or a keepalive request fails. What it was holding is written here
 * on the way out, and the next load of that workflow settles it: nothing is lost silently, and nothing overwrites someone else.
 */
export interface JournalEntry {
  draft: Workflow;
  /** The draftRev the page knew. */
  baseRev: number;
  /** The save that was running when the page left, which may or may not have landed. */
  inFlightHash: string | null;
}

export interface LoadedDetail {
  workflow: Workflow;
  draftRev: number;
  publishedNotice?: { version: number; effective: string };
}

const keyFor = (id: string): string => `levv.flowStudio.unsaved.${id}`;

export function writeJournal(entry: JournalEntry): void {
  try {
    window.localStorage.setItem(keyFor(entry.draft.id), JSON.stringify(entry));
  } catch {
    // A blocked or full store only loses this safety net; the save itself is still on its way.
  }
}

export function clearJournal(id: string): void {
  try {
    window.localStorage.removeItem(keyFor(id));
  } catch {
    // Nothing to clean up in a blocked store.
  }
}

function readJournal(id: string): JournalEntry | null {
  try {
    const text = window.localStorage.getItem(keyFor(id));
    return text ? (JSON.parse(text) as JournalEntry) : null;
  } catch {
    return null;
  }
}

/** How long the requests the last page sent get to arrive before this one decides they did not. */
const IN_TRANSIT_MS = 1200;

const wait = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/** Holds the workflow back from the screen until the journal is settled, so no edit can start from a copy about to change. */
export async function reconcileJournal(id: string, first: LoadedDetail, signal: AbortSignal): Promise<{ detail: LoadedDetail; journalNotice: string | null }> {
  const entry = readJournal(id);
  if (!entry) return { detail: first, journalNotice: null };
  const path = `/api/flow-studio/workflows/${encodeURIComponent(id)}`;
  const target = draftHash(entry.draft);
  const keepNotice = (detail: LoadedDetail): LoadedDetail => ({ ...detail, publishedNotice: first.publishedNotice ?? detail.publishedNotice });

  let latest = first;
  if (draftHash(latest.workflow) !== target) {
    await wait(IN_TRANSIT_MS, signal);
    latest = keepNotice(await apiGet<LoadedDetail>(path, signal));
  }
  const held = draftHash(latest.workflow);
  if (held === target) {
    clearJournal(id);
    return { detail: latest, journalNotice: null };
  }
  const onlyOurs = latest.draftRev === entry.baseRev || held === entry.inFlightHash;
  if (!onlyOurs) {
    clearJournal(id);
    return { detail: latest, journalNotice: uiCopy.lastEditLost };
  }
  try {
    await apiWrite<{ draftRev: number }>('PUT', `${path}/draft`, { draft: entry.draft, draftRev: latest.draftRev });
    clearJournal(id);
    return { detail: keepNotice(await apiGet<LoadedDetail>(path, signal)), journalNotice: null };
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 409) {
      clearJournal(id);
      return { detail: latest, journalNotice: uiCopy.lastEditLost };
    }
    // Unreachable: keep the copy for the next load. Refused: it will not get better, so drop it. Either way, say so.
    if (error instanceof ApiFailure && error.status < 500) clearJournal(id);
    return { detail: latest, journalNotice: uiCopy.saveFailed };
  }
}

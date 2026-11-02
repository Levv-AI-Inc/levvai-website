'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { draftHash } from '@flow-studio/data/draft-fields';
import { copy } from '@flow-studio/engine/copy';
import { createEditor, isRefusal, type Editor, type EditResult, type Nodes } from '@flow-studio/engine/edit';
import type { EngineContext } from '@flow-studio/model/context';
import type { Workflow } from '@flow-studio/model/workflow';
import { ApiFailure, apiWrite } from './api';
import { uiCopy } from './copy';
import { clearJournal, writeJournal } from './draft-journal';
import type { ToastOptions } from './ui/Toast';

const AUTOSAVE_MS = 800; // 01 §3.2
const UNDO_MS = 10_000; // 04 §6.6

export type NodeChange = (nodes: Nodes, editor: Editor) => EditResult;

export interface Editing {
  editor: Editor | null;
  /** Applies one engine operation. A refusal shows its toast and changes nothing; the return says whether it took. */
  apply: (change: NodeChange) => boolean;
  /** Fields of the workflow itself (04 §7.1). `undefined` removes a field. */
  patch: (fields: Partial<Workflow>) => void;
  /** 04 §6.6. */
  deleteStep: (id: string) => void;
  /** Saves now if anything is waiting, for a server call that must see the current draft. Says why if the draft did not get there. */
  flush: () => Promise<{ ok: true } | { ok: false; message: string }>;
  /** Takes in a change the server already made outside the draft, without saving it back. */
  absorb: (fields: Partial<Workflow>) => void;
}

/** One open workflow's save state. Separate objects, so a save still running when the user moves on finishes against the right one. */
interface Session {
  id: string;
  latest: Workflow;
  draftRev: number;
  dirty: boolean;
  conflicted: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<void> | null;
  /** The fingerprint of what the running save sends, so a save that cannot wait for it can say it replaces it. */
  inFlightHash: string | null;
  /** The newest save sent. An older one's answer decides nothing: the newer one carries everything it did. */
  seq: number;
  again: boolean;
}

interface EditingInput {
  ctx: EngineContext | null;
  workflow: Workflow | null;
  draftRev: number | null;
  onWorkflow: (next: Workflow) => void;
  toast: (message: string, options?: ToastOptions) => void;
  dismissToast: () => void;
  dropToastAction: () => void;
}

const draftPath = (id: string): string => `/api/flow-studio/workflows/${encodeURIComponent(id)}/draft`;

/** 01 §3.2: every edit is a pure operation on a local copy, then autosaved with the draftRev last seen. */
export function useEditing({ ctx, workflow, draftRev, onWorkflow, toast, dismissToast, dropToastAction }: EditingInput): Editing {
  const editor = useMemo(() => (ctx ? createEditor(ctx) : null), [ctx]);
  const session = useRef<Session | null>(null);
  const undo = useRef<{ nodes: Nodes; timer: ReturnType<typeof setTimeout> } | null>(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const clearUndo = useCallback(() => {
    if (undo.current) clearTimeout(undo.current.timer);
    undo.current = null;
  }, []);

  /**
   * `leaving`: the page may not outlive this call, so nothing can wait. The edit goes out at once, replacing a running save
   * if there is one, and the journal keeps a copy in case it never arrives. A session already in conflict has been told.
   */
  const save = useCallback((current: Session, leaving = false): Promise<void> => {
    if (current.timer) clearTimeout(current.timer);
    current.timer = null;
    if (current.conflicted) return current.inFlight ?? Promise.resolve();
    if (leaving && (current.dirty || current.inFlight)) writeJournal({ draft: current.latest, baseRev: current.draftRev, inFlightHash: current.inFlightHash });
    if (!current.dirty) return current.inFlight ?? Promise.resolve();
    if (current.inFlight && !leaving) {
      current.again = true;
      return current.inFlight;
    }
    current.dirty = false;
    const sent = current.latest;
    current.seq += 1;
    const seq = current.seq;
    const body = { draft: sent, draftRev: current.draftRev, ...(current.inFlightHash ? { supersedes: current.inFlightHash } : {}) };
    current.inFlightHash = draftHash(sent);
    // Every autosave is keepalive: a reload may come while it is running, and the edit it carries must still arrive.
    const running = apiWrite<{ draftRev: number }>('PUT', draftPath(current.id), body, { keepalive: true })
      .then((saved) => {
        current.draftRev = Math.max(current.draftRev, saved.draftRev);
        if (!current.dirty && current.latest === sent) clearJournal(current.id);
      })
      .catch((error: unknown) => {
        if (seq !== current.seq) return;
        if (error instanceof ApiFailure && error.status === 409) {
          current.conflicted = true;
          toastRef.current(copy.draftConflict);
        } else {
          current.dirty = true;
          toastRef.current(uiCopy.saveFailed);
        }
      })
      .then(() => {
        if (seq !== current.seq) return undefined;
        current.inFlight = null;
        current.inFlightHash = null;
        if (current.again && !current.conflicted) {
          current.again = false;
          return save(current);
        }
        return undefined;
      });
    current.inFlight = running;
    return running;
  }, []);

  // The loaded workflow starts a session; the previous one, if it still has changes, saves them on its way out.
  const loadedId = workflow?.id ?? null;
  const loadedRev = draftRev;
  useEffect(() => {
    if (!workflow || loadedRev === null) return undefined;
    clearUndo();
    const previous = session.current;
    if (previous && previous.id !== workflow.id) void save(previous);
    if (!previous || previous.id !== workflow.id) {
      session.current = { id: workflow.id, latest: workflow, draftRev: loadedRev, dirty: false, conflicted: false, timer: null, inFlight: null, inFlightHash: null, seq: 0, again: false };
    }
    return undefined;
    // Only a different workflow starts a new session; edits to this one arrive through commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId, loadedRev, clearUndo, save]);

  // A reload or a closed tab must not lose what the debounce still holds, or an edit made while a save was running.
  useEffect(() => {
    const leave = (): void => {
      if (session.current) void save(session.current, true);
    };
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [save]);

  const commit = useCallback(
    (next: Workflow) => {
      const current = session.current;
      if (!current) return;
      current.latest = next;
      onWorkflow(next);
      if (current.conflicted) {
        toastRef.current(copy.draftConflict);
        return;
      }
      current.dirty = true;
      if (current.timer) clearTimeout(current.timer);
      current.timer = setTimeout(() => void save(current), AUTOSAVE_MS);
    },
    [onWorkflow, save],
  );

  const edited = useCallback(() => {
    if (undo.current) {
      clearUndo();
      dropToastAction();
    }
  }, [clearUndo, dropToastAction]);

  const apply = useCallback(
    (change: NodeChange): boolean => {
      const current = session.current;
      if (!current || !editor) return false;
      const result = change(current.latest.draft.nodes, editor);
      if (isRefusal(result)) {
        toastRef.current(result.message);
        return false;
      }
      if (result === current.latest.draft.nodes) return false;
      edited();
      commit({ ...current.latest, draft: { ...current.latest.draft, nodes: result } });
      return true;
    },
    [commit, edited, editor],
  );

  const patch = useCallback(
    (fields: Partial<Workflow>) => {
      const current = session.current;
      if (!current) return;
      edited();
      commit({ ...current.latest, ...fields });
    },
    [commit, edited],
  );

  const deleteStep = useCallback(
    (id: string) => {
      const current = session.current;
      if (!current || !editor) return;
      const before = current.latest.draft.nodes;
      apply((nodes, ed) => ed.deleteStep(nodes, id));
      undo.current = {
        nodes: before,
        timer: setTimeout(() => {
          undo.current = null;
        }, UNDO_MS),
      };
      toastRef.current(copy.stepDeleted, {
        ms: UNDO_MS,
        action: {
          label: copy.undo,
          run: () => {
            const saved = undo.current;
            const open = session.current;
            if (!saved || !open) return;
            clearUndo();
            dismissToast();
            commit({ ...open.latest, draft: { ...open.latest.draft, nodes: saved.nodes } });
          },
        },
      });
    },
    [apply, clearUndo, commit, dismissToast, editor],
  );

  const flush = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    const current = session.current;
    if (!current) return { ok: true };
    await save(current);
    if (current.conflicted) return { ok: false, message: copy.draftConflict };
    if (current.dirty) return { ok: false, message: uiCopy.saveFailed };
    return { ok: true };
  }, [save]);

  const absorb = useCallback(
    (fields: Partial<Workflow>) => {
      const current = session.current;
      if (!current) return;
      current.latest = { ...current.latest, ...fields };
      onWorkflow(current.latest);
    },
    [onWorkflow],
  );

  return { editor, apply, patch, deleteStep, flush, absorb };
}

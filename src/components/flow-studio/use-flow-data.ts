'use client';

import { useCallback, useEffect, useState } from 'react';
import { createIdGen } from '@flow-studio/engine/ids';
import { publishedToast } from '@flow-studio/engine/publish';
import type { EngineContext } from '@flow-studio/model/context';
import type { Workflow } from '@flow-studio/model/workflow';
import { ApiFailure, apiGet } from './api';
import { reconcileJournal, type LoadedDetail } from './draft-journal';

export type LoadProblem = 'none' | 'not-found' | 'not-seeded' | 'failed';

export interface FlowData {
  ctx: EngineContext | null;
  workflow: Workflow | null;
  draftRev: number | null;
  problem: LoadProblem;
  /** What the author should hear once on this load: "Published as v2, …" (03 §13.5), or a last edit that could not be saved. */
  notice: { text: string } | null;
  setWorkflow: (next: Workflow) => void;
  /** A workflow the server just created (04 §12): the picker and Nova must know it. */
  addWorkflow: (created: Workflow) => void;
}

const isAbort = (error: unknown): boolean => (error as { name?: string } | null)?.name === 'AbortError';

/**
 * Loads what the shell needs. 401 goes to sign-in and 403 to /home (decision 5), so the shell itself never shows them.
 * `ctx` keeps its identity for the whole page, because the editor bound to it holds "the last role list" (02 §17);
 * `ctx.workflows` follows the open workflow, so the picker, Nova and the panels read current names and steps.
 */
export function useFlowData(workflowId: string | null, leave: (href: string) => void): FlowData {
  const [ctx, setCtx] = useState<EngineContext | null>(null);
  const [workflow, setWorkflowState] = useState<Workflow | null>(null);
  const [draftRev, setDraftRev] = useState<number | null>(null);
  const [problem, setProblem] = useState<LoadProblem>('none');
  const [notice, setNotice] = useState<{ text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiGet<Omit<EngineContext, 'idGen'>>('/api/flow-studio/engine-context', controller.signal)
      .then((context) => setCtx({ ...context, idGen: createIdGen(101) }))
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        if (error instanceof ApiFailure && error.status === 401) {
          leave(`/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        } else if (error instanceof ApiFailure && error.status === 403) {
          leave('/home');
        } else {
          setProblem(error instanceof ApiFailure && error.code === 'NOT_SEEDED' ? 'not-seeded' : 'failed');
        }
      });
    return () => controller.abort();
  }, [leave]);

  useEffect(() => {
    setWorkflowState(null);
    setDraftRev(null);
    setProblem((current) => (current === 'not-found' ? 'none' : current));
    if (!workflowId) return undefined;
    const controller = new AbortController();
    apiGet<LoadedDetail>(`/api/flow-studio/workflows/${encodeURIComponent(workflowId)}`, controller.signal)
      .then((detail) => reconcileJournal(workflowId, detail, controller.signal))
      .then(({ detail, journalNotice }) => {
        setWorkflowState(detail.workflow);
        setDraftRev(detail.draftRev);
        const published = detail.publishedNotice;
        const text = journalNotice ?? (published ? publishedToast(published.version, published.effective) : null);
        if (text) setNotice({ text });
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        if (error instanceof ApiFailure && error.status === 404) setProblem('not-found');
        else if (error instanceof ApiFailure && error.status === 403) leave('/home');
        else if (error instanceof ApiFailure && error.status === 401) leave(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
        else setProblem(error instanceof ApiFailure && error.code === 'NOT_SEEDED' ? 'not-seeded' : 'failed');
      });
    return () => controller.abort();
  }, [workflowId, leave]);

  // 03 §16.0: "the editor also reserves the open workflow's id"; nf101's first step is n102.
  useEffect(() => {
    if (!ctx || !workflow) return;
    ctx.idGen.reserve([workflow.id]);
    const at = ctx.workflows.findIndex((candidate) => candidate.id === workflow.id);
    if (at >= 0) ctx.workflows[at] = workflow;
    else ctx.workflows.push(workflow);
  }, [ctx, workflow]);

  const addWorkflow = useCallback(
    (created: Workflow) => {
      if (ctx && !ctx.workflows.some((candidate) => candidate.id === created.id)) ctx.workflows.push(created);
    },
    [ctx],
  );

  return { ctx, workflow, draftRev, problem, notice, setWorkflow: setWorkflowState, addWorkflow };
}

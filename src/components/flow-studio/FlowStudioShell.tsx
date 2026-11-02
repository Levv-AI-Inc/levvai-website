'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { workflowSummaries } from '@flow-studio/data/summaries';
import { isCheck } from '@flow-studio/engine/checks';
import { composeTest, samplesFor } from '@flow-studio/engine/compose';
import { copy, curl } from '@flow-studio/engine/copy';
import { isRefusal, type StepSpec } from '@flow-studio/engine/edit';
import { lintWorkflow, novaCount } from '@flow-studio/engine/lint';
import { simulateTest } from '@flow-studio/engine/simulate';
import type { EngineContext } from '@flow-studio/model/context';
import type { Issue, TestRunOptions } from '@flow-studio/model/results';
import type { WfNode, Workflow } from '@flow-studio/model/workflow';
import { apiWrite } from './api';
import { Canvas, type CanvasDrag } from './canvas/Canvas';
import { NODE_SIZE } from './canvas/layout';
import { fitZoom, layoutWorkflow, softEdges, ZOOM_OPEN_COLUMN, ZOOM_OPEN_MIN, type PlacedEdge } from './canvas/layout';
import { Rail } from './canvas/Rail';
import type { CanvasTest } from './canvas/test-look';
import { ZoomControls } from './canvas/ZoomControls';
import { uiCopy } from './copy';
import { NovaDrawer } from './NovaDrawer';
import type { PanelEdit } from './panels/fields';
import { StepPanel } from './panels/StepPanel';
import { PublishDialog } from './PublishDialog';
import { StepMenu } from './StepMenu';
import { TestDrawer, type TestState } from './TestDrawer';
import { TopBar } from './TopBar';
import { Toast, useToast } from './ui/Toast';
import { buttonClass } from './ui/primitives';
import { useEditing } from './use-editing';
import { useFlowData } from './use-flow-data';

export type ShellVariant = 'page' | 'embedded';

const LAST_WORKFLOW_KEY = 'levv.flowStudio.lastWorkflow';
/** 04 §2.5: the rail goes below this, measured on the shell because embedded it is narrower than the window. */
const FULL_FROM = 720;
/** Embedded on a desktop window, between these the drawer still sits beside the canvas: its 400 and one box at the opening zoom. */
const SIDE_DRAWER_FROM = 500;

/** `phone` is 04 §2.5's layout. `narrow` is the same stage with no rail: a window of about 1100 is not a phone, only a tight column. */
export type ShellFit = 'full' | 'narrow' | 'phone';

export function shellFit(width: number, embedded: boolean): ShellFit {
  if (width >= FULL_FROM) return 'full';
  return embedded && width >= SIDE_DRAWER_FROM ? 'narrow' : 'phone';
}

function remembered(): string | null {
  try {
    return window.localStorage.getItem(LAST_WORKFLOW_KEY);
  } catch {
    return null;
  }
}

function remember(id: string): void {
  try {
    window.localStorage.setItem(LAST_WORKFLOW_KEY, id);
  } catch {
    // A blocked store only costs the "last opened" convenience.
  }
}

const PLACING_CLAUSE: Record<string, string> = {
  docs: uiCopy.placingCollect,
  access: uiCopy.placingSystem,
  sweeper: uiCopy.placingSystem,
};

/** 04 §4.10: only these combinations attach; everything else goes on a "+". */
function canAttachWorker(worker: string, node: WfNode | undefined): boolean {
  if (node?.kind === 'collect') return worker === 'docs';
  if (node?.kind === 'system') return worker === 'access' || worker === 'sweeper';
  return false;
}

/** Where a step menu inserts: on a line, or after an If's paths or a Parallel's branches meet (04 §5). */
type MenuTarget = { kind: 'edge'; from: string; key: string } | { kind: 'join'; id: string };

/** The top bar's two drawers (04 §2.1 `?panel=`). A step panel or the step menu replaces them; only one drawer is open at a time. */
type Panel = 'test' | 'nova';

/** What the URL holds about the open drawer (04 §2.1). */
interface DrawerUrl {
  step?: string | null;
  panel?: Panel | null;
  record?: string | null;
}

function queryOf({ step, panel, record }: DrawerUrl): string {
  const query = new URLSearchParams();
  if (step) query.set('step', step);
  else if (panel) {
    query.set('panel', panel);
    if (panel === 'test' && record) query.set('record', record);
  }
  return query.toString();
}

const panelParam = (value: string | null | undefined): Panel | null => (value === 'test' || value === 'nova' ? value : null);

/** Room to scroll a box out from under the drawer: its 390 width and the gap beside it. */
const DRAWER_ROOM = 400;
/** 04 §2.5: a step selected from a drawer sits this far from the top-left corner, scaled by zoom. */
const SHOW_AT_X = 200;
const SHOW_AT_Y = 150;
const RAIL_AND_GUTTERS = 110;
/** A box's title and subtitle are 176 wide, centred on its 88: this much past its right edge. */
const NODE_LABEL_OVERHANG = 44;
const IF_CARD_WIDTH = 176;

function Skeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-[132px]" aria-hidden>
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-[88px] w-[88px] animate-pulse motion-reduce:animate-none rounded-[18px] border-[1.5px] border-slate-700 bg-slate-900" />
      ))}
    </div>
  );
}

interface FlowStudioShellProps {
  basePath: string;
  variant: ShellVariant;
}

/** 04 §2: one shell for /flow-studio (full page) and /admin/workflows (decision 1). It lives in the route's layout so it survives moving between workflows. */
export function FlowStudioShell({ basePath, variant }: FlowStudioShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const embedded = variant === 'embedded';

  const workflowId = useMemo(() => {
    const rest = (pathname ?? '').slice(basePath.length + 1).split('/')[0];
    return rest ? decodeURIComponent(rest) : null;
  }, [pathname, basePath]);

  const leave = useCallback((href: string) => router.replace(href), [router]);
  const { ctx, workflow, draftRev, problem, notice, setWorkflow, addWorkflow } = useFlowData(workflowId, leave);

  // `ctx.workflows` holds everything else; the open workflow's latest copy is the state.
  const summaries = useMemo(() => {
    if (!ctx) return null;
    const list = workflow ? ctx.workflows.map((candidate) => (candidate.id === workflow.id ? workflow : candidate)) : ctx.workflows;
    return workflowSummaries(list, ctx.catalog);
  }, [ctx, workflow]);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [placing, setPlacing] = useState<string | null>(null);
  const [fit, setFit] = useState<ShellFit>('full');
  const compact = fit === 'phone';
  const [rootWidth, setRootWidth] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overStep, setOverStep] = useState<string | null>(null);
  const [overEdge, setOverEdge] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const { message: toast, action: toastAction, show: showToast, dismiss: dismissToast, dropAction } = useToast();
  const editing = useEditing({ ctx, workflow, draftRev, onWorkflow: setWorkflow, toast: showToast, dismissToast, dropToastAction: dropAction });

  const urlStep = searchParams?.get('step') ?? null;
  const urlPanel = urlStep ? null : panelParam(searchParams?.get('panel'));
  const urlRecord = searchParams?.get('record') ?? null;
  const urlQuery = queryOf({ step: urlStep, panel: urlPanel, record: urlRecord });
  const [selectedId, setSelectedId] = useState<string | null>(urlStep);
  const [panel, setPanel] = useState<Panel | null>(urlPanel);
  const [testRecord, setTestRecord] = useState<string | null>(urlRecord);
  const [testOptions, setTestOptions] = useState<{ key: string; options: TestRunOptions }>({ key: '', options: {} });
  const [publishOpen, setPublishOpen] = useState(false);
  const publishOpener = useRef<HTMLElement | null>(null);
  const writtenQuery = useRef<string>(urlQuery);

  // Back and forward, and deep links. A query this shell wrote itself is already in state.
  useEffect(() => {
    if (urlQuery === writtenQuery.current) return;
    writtenQuery.current = urlQuery;
    setSelectedId(urlStep);
    setPanel(urlPanel);
    if (urlRecord) setTestRecord(urlRecord);
  }, [urlQuery, urlStep, urlPanel, urlRecord]);

  useEffect(() => {
    if (notice) showToast(notice.text, { ms: 10_000 });
  }, [notice, showToast]);

  // 04 §2.1: /flow-studio opens the remembered workflow, otherwise the first live one in picker order.
  useEffect(() => {
    if (workflowId || !summaries) return;
    const last = remembered();
    const target = summaries.find((summary) => summary.id === last) ?? summaries.find((summary) => summary.status === 'live') ?? summaries[0];
    if (target) router.replace(`${basePath}/${encodeURIComponent(target.id)}`);
  }, [workflowId, summaries, basePath, router]);

  useEffect(() => {
    if (workflow) remember(workflow.id);
  }, [workflow]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const observer = new ResizeObserver(() => {
      setFit(shellFit(root.clientWidth, embedded));
      setRootWidth(root.clientWidth);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [embedded]);

  const nodes = workflow?.draft.nodes;
  // 04 §7.1 item 9: a change to Applies to must not re-lay out the canvas, so this follows the graph only.
  const layout = useMemo(() => (nodes ? layoutWorkflow(nodes) : null), [nodes]);
  // `ctx.workflows` catches up with the open workflow after the render; whatever reads it during one must see the latest copy.
  const liveCtx = useMemo<EngineContext | null>(() => {
    if (!ctx || !workflow) return ctx;
    const others = ctx.workflows.filter((candidate) => candidate.id !== workflow.id);
    return { ...ctx, workflows: ctx.workflows.some((candidate) => candidate.id === workflow.id) ? ctx.workflows.map((candidate) => (candidate.id === workflow.id ? workflow : candidate)) : [...others, workflow] };
  }, [ctx, workflow]);
  const lint = useMemo(() => (workflow && liveCtx ? lintWorkflow(workflow, liveCtx) : null), [workflow, liveCtx]);
  const flagged = useMemo(() => {
    const ids = new Set<string>();
    for (const issue of lint?.issues ?? []) if (issue.node && (issue.sev === 'bad' || issue.sev === 'warn')) ids.add(issue.node);
    return ids;
  }, [lint]);

  const samples = useMemo(() => (workflow && ctx ? samplesFor(workflow, ctx) : []), [workflow, ctx]);
  // 03 §11 item 4: if the selected record does not fit this workflow, the first that does.
  const sampleId = (samples.find((row) => row.id === testRecord) ?? samples[0])?.id ?? null;
  const optionsKey = `${workflow?.id}:${sampleId}`;
  const runOptions = useMemo(() => (testOptions.key === optionsKey ? testOptions.options : {}), [testOptions, optionsKey]);
  const testState = useMemo<TestState | null>(() => {
    if (panel !== 'test' || !workflow || !liveCtx || !sampleId) return null;
    const sample = liveCtx.samples.find((row) => row.id === sampleId);
    if (!sample) return null;
    const run = simulateTest(workflow, sample, liveCtx, runOptions);
    return { run, view: composeTest(run, liveCtx) };
  }, [panel, workflow, liveCtx, sampleId, runOptions]);
  const canvasTest = useMemo<CanvasTest | null>(
    () => (testState && nodes ? { path: testState.run.walk.path, steps: testState.run.steps, soft: softEdges(nodes), heldBack: new Set(testState.run.heldBack) } : null),
    [testState, nodes],
  );

  // 04 §4.9: opening a workflow fits it. A deep-linked step is then brought into view (§4.7).
  const fittedFor = useRef<string | null>(null);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!workflow || !layout || !scroller || fittedFor.current === workflow.id) return;
    fittedFor.current = workflow.id;
    const next = fitZoom(scroller.clientWidth, scroller.clientHeight, layout, embedded ? ZOOM_OPEN_COLUMN : ZOOM_OPEN_MIN);
    setZoom(next);
    const place = selectedId ? layout.byId[selectedId] : undefined;
    scroller.scrollLeft = place ? place.x * next - SHOW_AT_X : 0;
    scroller.scrollTop = place ? place.y * next - SHOW_AT_Y : 0;
  }, [workflow, layout, selectedId, embedded]);

  // 04 §9 "Show me": after the render, so the room to scroll past the drawer is there.
  const showWanted = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = showWanted.current;
    showWanted.current = null;
    const place = id ? layout?.byId[id] : undefined;
    if (place) scrollerRef.current?.scrollTo(place.x * zoom - SHOW_AT_X, place.y * zoom - SHOW_AT_Y);
  }, [selectedId, layout, zoom]);

  // Embedded, the drawer covers most of the canvas: a box pressed under it moves just clear, with its labels. The full page has the room.
  const revealWanted = useRef<string | null>(null);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const id = revealWanted.current;
    revealWanted.current = null;
    const place = id ? layout?.byId[id] : undefined;
    if (!embedded || compact || !scroller || !place || !nodes || !id) return;
    const clear = scroller.clientWidth - DRAWER_ROOM;
    const box = (nodes[id].kind === 'cond' ? IF_CARD_WIDTH : NODE_SIZE) * zoom;
    const right = place.x * zoom + box + Math.min(NODE_LABEL_OVERHANG * zoom, Math.max(0, clear - box - 6));
    if (right > scroller.scrollLeft + clear) scroller.scrollLeft = right - clear;
  }, [selectedId, embedded, compact, layout, nodes, zoom]);

  // Where focus goes when what held it has gone (04 §14.3): a step made from the menu or brought up by Show me takes it, and its panel opens from it.
  const focusWanted = useRef<string | null>(null);
  // A new workflow's Start box, which must not be taken for the one still on the screen.
  const focusWantedIn = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = focusWanted.current;
    if (!id || (focusWantedIn.current && focusWantedIn.current !== workflow?.id)) return;
    focusWantedIn.current = null;
    const box = rootRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"] button`);
    if (!box) return;
    focusWanted.current = null;
    box.focus({ preventScroll: true });
    if (selectedId === id) openerRef.current = box;
  }, [workflow, selectedId]);

  const writeUrl = useCallback(
    (state: DrawerUrl) => {
      const query = queryOf(state);
      writtenQuery.current = query;
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router, pathname],
  );

  const select = useCallback(
    (id: string, opener: HTMLElement) => {
      openerRef.current = opener;
      revealWanted.current = id;
      setMenu(null);
      setPanel(null);
      setSelectedId(id);
      writeUrl({ step: id });
    },
    [writeUrl],
  );

  /** A step the user did not click: a new one, or none. Focus goes to its box, as if it had been clicked (04 §14.3). */
  const selectNew = useCallback(
    (id: string) => {
      openerRef.current = null;
      focusWanted.current = id;
      revealWanted.current = id;
      setMenu(null);
      setPanel(null);
      setSelectedId(id);
      writeUrl({ step: id });
    },
    [writeUrl],
  );

  const showStep = useCallback(
    (id: string) => {
      showWanted.current = id;
      selectNew(id);
    },
    [selectNew],
  );

  const closeDrawer = useCallback(() => {
    const leaving = selectedId;
    const opener = openerRef.current;
    setMenu(null);
    setSelectedId(null);
    setPanel(null);
    writeUrl({});
    openerRef.current = null;
    if (opener?.isConnected) opener.focus();
    else if (leaving) rootRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(leaving)}"] button`)?.focus();
  }, [writeUrl, selectedId]);

  /** 04 §2.3: the button toggles its drawer; another drawer gives way to it. */
  const togglePanel = useCallback(
    (kind: Panel, opener: HTMLElement) => {
      if (panel === kind) {
        closeDrawer();
        return;
      }
      openerRef.current = opener;
      setMenu(null);
      setSelectedId(null);
      setPanel(kind);
      writeUrl({ panel: kind, record: testRecord });
    },
    [panel, closeDrawer, writeUrl, testRecord],
  );

  const pickRecord = useCallback(
    (id: string) => {
      setTestRecord(id);
      writeUrl({ panel: 'test', record: id });
    },
    [writeUrl],
  );

  const openPublish = useCallback((opener: HTMLElement) => {
    publishOpener.current = opener;
    setPublishOpen(true);
  }, []);

  const closePublish = useCallback(() => {
    setPublishOpen(false);
    if (publishOpener.current?.isConnected) publishOpener.current.focus();
    publishOpener.current = null;
  }, []);

  // 04 §14.2: an open SelectMenu takes Escape first and stops it reaching here.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (publishOpen) closePublish();
      else if (placing) setPlacing(null);
      else if (selectedId || menu || panel) closeDrawer();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [publishOpen, closePublish, placing, selectedId, menu, panel, closeDrawer]);

  /** 04 §3.1: clears the selection and closes a step panel or step menu. Test and Nova stay open and recompute. */
  const openWorkflow = useCallback(
    (id: string) => {
      setMenu(null);
      setSelectedId(null);
      openerRef.current = null;
      const query = queryOf({ panel, record: testRecord });
      writtenQuery.current = query;
      router.push(`${basePath}/${encodeURIComponent(id)}${query ? `?${query}` : ''}`);
    },
    [basePath, router, panel, testRecord],
  );

  /** 04 §12. */
  const newWorkflow = useCallback(async () => {
    if (!workflow) return;
    try {
      await editing.flush();
      const created = await apiWrite<Workflow>('POST', '/api/flow-studio/workflows', { fromWorkflowId: workflow.id });
      addWorkflow(created);
      writtenQuery.current = queryOf({ step: 'T' });
      openerRef.current = null;
      focusWanted.current = 'T';
      focusWantedIn.current = created.id;
      setMenu(null);
      setPanel(null);
      setSelectedId('T');
      router.push(`${basePath}/${encodeURIComponent(created.id)}?step=T`);
      showToast(copy.newDraftToast);
    } catch {
      showToast(uiCopy.saveFailed);
    }
  }, [workflow, editing, addWorkflow, basePath, router, showToast]);

  const openMenu = useCallback(
    (target: MenuTarget, opener: HTMLElement) => {
      openerRef.current = opener;
      setSelectedId(null);
      setPanel(null);
      setMenu(target);
      writeUrl({});
    },
    [writeUrl],
  );

  /** The new node is whichever id the graph did not have before. */
  const insert = useCallback(
    (target: MenuTarget, spec: StepSpec) => {
      if (!workflow) return;
      const before = new Set(Object.keys(workflow.draft.nodes));
      let createdId: string | null = null;
      const took = editing.apply((current, ed) => {
        const result = target.kind === 'edge' ? ed.insertStep(current, target.from, target.key, spec) : ed.insertAfterMerge(current, target.id, spec);
        if (!isRefusal(result)) {
          // A step can bring others with it (Outside plan, a failed escalation); those ids are derived from the new step's.
          const added = Object.keys(result).filter((id) => !before.has(id));
          createdId = added.find((id) => added.every((other) => other.startsWith(id))) ?? added[0] ?? null;
        }
        return result;
      });
      if (!took || !createdId) {
        setMenu(null);
        return;
      }
      if (target.kind === 'join') showToast(workflow.draft.nodes[target.id]?.kind === 'parallel' ? uiCopy.addedAfterBranches : copy.addedAfterPathsMeet);
      selectNew(createdId);
    },
    [workflow, editing, selectNew, showToast],
  );

  const attachWorker = useCallback(
    (worker: string, id: string) => {
      let toastText = '';
      editing.apply((current, ed) => {
        const { nodes: next, toast: text } = ed.dropWorker(current, id, worker);
        toastText = text;
        return next;
      });
      if (toastText) showToast(toastText);
      setPlacing(null);
    },
    [editing, showToast],
  );

  /** While placing, a click on a step that takes this worker attaches it; on an Approve step a check is refused (04 §4.10). */
  const pressStep = useCallback(
    (id: string, opener: HTMLElement) => {
      const node = workflow?.draft.nodes[id];
      if (placing && ctx) {
        if (canAttachWorker(placing, node)) {
          attachWorker(placing, id);
          return;
        }
        if (node?.kind === 'appr' && isCheck(placing, ctx)) {
          showToast(copy.checksGoOnLine);
          return;
        }
      }
      select(id, opener);
    },
    [workflow, placing, ctx, attachWorker, showToast, select],
  );

  const pressPlus = useCallback(
    (edge: PlacedEdge, opener: HTMLElement) => {
      const target: MenuTarget = { kind: 'edge', from: edge.from, key: edge.key };
      if (placing) {
        insert(target, { kind: 'dw', worker: placing });
        setPlacing(null);
      } else {
        openMenu(target, opener);
      }
    },
    [placing, insert, openMenu],
  );

  const endDrag = useCallback(() => {
    setDragging(null);
    setOverStep(null);
    setOverEdge(null);
  }, []);

  const drag = useMemo<CanvasDrag | null>(() => {
    if (!dragging || !workflow || !ctx) return null;
    const stepOf = (id: string): WfNode | undefined => workflow.draft.nodes[id];
    return {
      canAttach: (id) => canAttachWorker(dragging, stepOf(id)),
      accepts: (id) => canAttachWorker(dragging, stepOf(id)) || (stepOf(id)?.kind === 'appr' && isCheck(dragging, ctx)),
      overStep,
      overStepChange: setOverStep,
      overEdge,
      overEdgeChange: setOverEdge,
      dropOnStep: (id) => {
        if (canAttachWorker(dragging, stepOf(id))) attachWorker(dragging, id);
        else showToast(copy.checksGoOnLine);
        endDrag();
      },
      dropOnEdge: (edge) => {
        insert({ kind: 'edge', from: edge.from, key: edge.key }, { kind: 'dw', worker: dragging });
        endDrag();
      },
    };
  }, [dragging, workflow, ctx, overStep, overEdge, attachWorker, showToast, endDrag, insert]);

  const panelEdit = useMemo<PanelEdit>(
    () => ({ editing, toast: showToast, openJoinMenu: (id, opener) => openMenu({ kind: 'join', id }, opener) }),
    [editing, showToast, openMenu],
  );

  /** Its box and panel go, so focus goes to the Undo it has 10 s to reach; when that ends, to the step before (below). */
  const afterDelete = useRef<string | null>(null);
  const removeStep = useCallback(
    (id: string) => {
      const before = Object.values(workflow?.draft.nodes ?? {}).find((node) => (node.outs ?? []).some((out) => out.to === id));
      afterDelete.current = before?.id ?? 'T';
      editing.deleteStep(id);
      setSelectedId(null);
      openerRef.current = null;
      writeUrl({});
    },
    [editing, writeUrl, workflow],
  );

  useEffect(() => {
    if (toastAction) {
      rootRef.current?.querySelector<HTMLElement>('[role="status"] button')?.focus();
      return;
    }
    const id = afterDelete.current;
    afterDelete.current = null;
    if (id && document.activeElement === document.body) rootRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"] button`)?.focus();
  }, [toastAction]);

  /** 04 §14.3: "The first Tab enters the panel header", which is otherwise behind every box. Shift+Tab from there goes back. */
  const onTabAcrossDrawer = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab' || event.defaultPrevented) return;
    const opener = openerRef.current;
    const drawer = rootRef.current?.querySelector<HTMLElement>('[data-flow-studio-stage] [role="dialog"]');
    const first = drawer?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea, summary, [tabindex="0"]');
    if (!first || !opener?.isConnected) return;
    if (!event.shiftKey && document.activeElement === opener) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      opener.focus();
    }
  };

  /** 04 §9: a one-click fix from Nova, and its toast. */
  const applyFix = useCallback(
    (issue: Issue) => {
      if (!issue.fix) return;
      const fix = issue.fix;
      let toastText = '';
      editing.apply((current, ed) => {
        const { nodes: next, toast: text } = ed.applyLintFix(current, fix);
        toastText = text;
        return next;
      });
      if (toastText) showToast(toastText);
    },
    [editing, showToast],
  );

  const selectedNode = workflow && selectedId ? workflow.draft.nodes[selectedId] ?? null : null;
  const placingNow = placing ?? dragging;
  const placingWorker = placingNow && ctx ? ctx.dws.DW[placingNow] : null;
  const drawerOpen = !!selectedNode || !!menu || !!panel;
  const fallback = summaries?.find((summary) => summary.id === 'wf-wo-sub') ?? summaries?.[0];
  const ready = workflow && ctx && layout && summaries;

  return (
    <div
      ref={rootRef}
      onKeyDown={onTabAcrossDrawer}
      role={embedded ? 'region' : undefined}
      aria-label={embedded ? uiCopy.shellLabel : undefined}
      className={
        embedded
          ? 'relative flex h-full flex-col bg-slate-100 px-3 pb-3 pt-2.5 text-[14px] leading-[1.5] text-slate-900'
          : 'relative flex min-h-screen flex-col bg-slate-100 px-4 pb-4 pt-2.5 text-[14px] leading-[1.5] text-slate-900'
      }
    >
      <TopBar
        embedded={embedded}
        fit={fit}
        workflow={workflow}
        summaries={summaries}
        ctx={ctx}
        novaCount={lint ? novaCount(lint.issues) : null}
        panel={panel}
        onNova={(opener) => togglePanel('nova', opener)}
        onTest={(opener) => togglePanel('test', opener)}
        onPublish={openPublish}
        onOpenWorkflow={openWorkflow}
        onNewWorkflow={() => void newWorkflow()}
      />
      <div
        data-flow-studio-stage
        className={[
          'relative overflow-clip rounded-[14px] border border-[#1b2536] bg-slate-950',
          embedded ? 'min-h-0 flex-1' : compact ? 'h-[calc(100vh-130px)] min-h-[540px]' : 'h-[calc(100vh-78px)] min-h-[540px]',
        ].join(' ')}
        // With no rail, the drawer sits where the rail would be (Drawer.tsx).
        style={fit === 'narrow' ? ({ '--drawer-right': '10px' } as CSSProperties) : undefined}
      >
        {ready ? (
          <>
            <Canvas
              ref={scrollerRef}
              workflow={workflow}
              ctx={ctx}
              layout={layout}
              zoom={zoom}
              selectedId={selectedNode ? selectedNode.id : null}
              flagged={flagged}
              placing={placingNow !== null}
              fullWidth={fit !== 'full'}
              trailing={drawerOpen && !compact ? Math.max(DRAWER_ROOM, rootWidth - RAIL_AND_GUTTERS - SHOW_AT_X) : 0}
              activeEdge={menu?.kind === 'edge' ? `${menu.from}:${menu.key}` : null}
              drag={drag}
              test={canvasTest}
              onSelect={pressStep}
              onPlus={pressPlus}
            />
            {fit === 'full' ? <Rail workflow={workflow} ctx={ctx} placing={placing} onPlace={setPlacing} onDragStart={setDragging} onDragEnd={endDrag} onToast={showToast} /> : null}
            <ZoomControls scroller={scrollerRef} layout={layout} onZoom={setZoom} />
            {placingWorker || (panel === 'test' && sampleId) ? (
              <div className={`absolute top-3.5 z-[4] flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full border border-[#2a3850] bg-[#0f1726] px-3 py-[5px] text-[12.5px] text-slate-300 ${drawerOpen ? (fit === 'full' ? 'left-[calc(50%-240px)]' : 'left-[calc(50%-195px)]') : 'left-1/2'}`}>
                <span>{placingWorker ? uiCopy.placing(placingWorker.n, PLACING_CLAUSE[placingWorker.id] ?? '') : uiCopy.showing(sampleId as string)}</span>
                <button type="button" onClick={placingWorker ? () => setPlacing(null) : closeDrawer} className="font-bold text-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400">
                  {placingWorker ? uiCopy.cancel : uiCopy.hide}
                </button>
              </div>
            ) : null}
            {selectedNode ? <StepPanel workflow={workflow} node={selectedNode} ctx={ctx} summaries={summaries} compact={compact} edit={panelEdit} onClose={closeDrawer} onDelete={removeStep} /> : null}
            {menu && !selectedNode ? <StepMenu workflow={workflow} ctx={ctx} compact={compact} onPick={(spec) => insert(menu, spec)} onClose={closeDrawer} /> : null}
            {panel === 'test' && !selectedNode && !menu ? (
              <TestDrawer
                samples={samples}
                sampleId={sampleId}
                state={testState}
                options={runOptions}
                compact={compact}
                onSample={pickRecord}
                onOptions={(options) => setTestOptions({ key: optionsKey, options })}
                onClose={closeDrawer}
              />
            ) : null}
            {panel === 'nova' && !selectedNode && !menu && lint ? (
              <NovaDrawer lint={lint} compact={compact} onClose={closeDrawer} onShow={showStep} onFix={applyFix} onChooseWinner={openPublish} />
            ) : null}
          </>
        ) : problem !== 'none' || summaries?.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <p role="alert" className="text-[14px] text-slate-200">
                {problem === 'not-found' ? uiCopy.notFound : problem === 'failed' ? uiCopy.loadFailed : uiCopy.notSeeded}
              </p>
              {problem === 'not-found' && fallback ? (
                <button type="button" className={buttonClass} onClick={() => openWorkflow(fallback.id)}>
                  {uiCopy.openWorkflow(curl(fallback.name))}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <Skeleton />
        )}
      </div>
      <Toast message={toast} action={toastAction} embedded={embedded} />
      {publishOpen && workflow && liveCtx ? <PublishDialog workflow={workflow} ctx={liveCtx} editing={editing} onClose={closePublish} /> : null}
    </div>
  );
}


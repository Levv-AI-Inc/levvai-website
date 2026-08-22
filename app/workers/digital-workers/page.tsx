'use client';

import { useState, useMemo } from 'react';
import {
  Bot,
  ShieldCheck,
  DollarSign,
  Activity,
  Power,
  AlertTriangle,
  User,
  Building2,
  KeyRound,
  Plus,
  Search,
  X,
  CheckCircle,
  PauseCircle,
  Archive,
  RotateCcw,
  Clock,
  ChevronDown,
  Calendar,
  Layers,
  Lock,
  Cpu,
  Bell,
  TrendingUp,
  Zap,
  XCircle,
  FileText,
  ExternalLink,
  Gauge,
  AlertOctagon,
  Eye,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkerStatus  = 'Active' | 'Pending Review' | 'Paused' | 'Retired';
type RiskLevel     = 'Low' | 'Medium' | 'High';
type OveragePolicy = 'hard_stop' | 'escalate' | 'continue_flag';
type ReviewCadence = 'monthly' | 'quarterly' | 'at_renewal';

type WorkerType =
  | 'LLM Agent'
  | 'Workflow Automation'
  | 'RPA Bot'
  | 'Data Pipeline Agent'
  | 'Decision Support Agent'
  | 'Code Generation Agent';

type DataClass = 'PII' | 'Financial' | 'Internal Only' | 'Public';

type AuditEntry = { action: string; actor: string; timestamp: string };

type ActivityEventType =
  | 'spend_alert'
  | 'spend_cap_reached'
  | 'scope_deviation'
  | 're_review'
  | 'threshold_crossed'
  | 'general';

type ActivityEvent = {
  id: string;
  eventType: ActivityEventType;
  message: string;
  timestamp: string;
  severity: 'info' | 'warn' | 'critical';
};

type DigitalWorker = {
  id: string;
  name: string;
  type: WorkerType;
  status: WorkerStatus;

  businessOwner: string;
  technicalOwner: string;
  aiPlatform: string;

  usageBasedCost: boolean;

  // Spend governance (variable cost only)
  spendCap?: number;
  currentSpend?: number;       // ← NEW: actual spend this period
  alertThreshold?: number;
  overpagePolicy?: OveragePolicy;
  spendApprover?: string;
  reviewCadence?: ReviewCadence;

  risk: RiskLevel;
  approvedScope: string[];     // ← locked at registration, immutable
  dataClassification: DataClass[];
  purpose: string;
  deployedDate: string;
  lastRecertified: string | null;
  recertificationDue: string;
  auditLog: AuditEntry[];

  activityFeed: ActivityEvent[];    // ← NEW: runtime operational events
  scopeDeviations: { system: string; timestamp: string; flaggedBy: string }[]; // ← NEW

  linkedSowId?: string;
};


// ─── Seed Data ────────────────────────────────────────────────────────────────

const seed: DigitalWorker[] = [
  {
    id: 'DW-001',
    name: 'Contract Review Agent',
    type: 'LLM Agent',
    status: 'Active',
    businessOwner: 'Sarah Chen · Legal Operations',
    technicalOwner: 'James Park · Platform Engineering',
    aiPlatform: 'Azure OpenAI',
    usageBasedCost: true,
    spendCap: 3000,
    currentSpend: 2450,
    alertThreshold: 80,
    overpagePolicy: 'escalate',
    spendApprover: 'James Park',
    reviewCadence: 'quarterly',
    risk: 'Medium',
    approvedScope: ['SharePoint', 'Contract Repository', 'Procurement Intake'],
    dataClassification: ['PII', 'Financial'],
    purpose: 'Reviews supplier agreements and flags missing clauses before legal sign-off.',
    deployedDate: '2024-09-12',
    lastRecertified: '2025-01-15',
    recertificationDue: '2025-07-15',
    linkedSowId: 'SOW-2024-0041',
    auditLog: [
      { action: 'Registered', actor: 'A. Mohamed', timestamp: '2024-09-12 09:14' },
      { action: 'Recertified', actor: 'F. Malik', timestamp: '2025-01-15 11:02' },
      { action: 'Spend alert: 80% threshold crossed', actor: 'Nova', timestamp: '2025-05-08 14:20' },
    ],
    activityFeed: [
      {
        id: 'af-001-2',
        eventType: 'spend_alert',
        message: 'Spend reached $2,400 — 80% of $3,000/mo cap. Nova work item routed to James Park for review.',
        timestamp: '2025-05-08 14:20',
        severity: 'warn',
      },
      {
        id: 'af-001-1',
        eventType: 'threshold_crossed',
        message: 'Monthly spend trajectory is $3,060 projected at current burn rate — exceeds approved cap.',
        timestamp: '2025-05-08 14:21',
        severity: 'warn',
      },
    ],
    scopeDeviations: [],
  },
  {
    id: 'DW-002',
    name: 'Invoice Exception Agent',
    type: 'Decision Support Agent',
    status: 'Pending Review',
    businessOwner: 'Finance Operations',
    technicalOwner: 'Unassigned',
    aiPlatform: 'Internal',
    usageBasedCost: false,
    risk: 'High',
    approvedScope: ['Invoice Data', 'Supplier Master', 'AP Queue'],
    dataClassification: ['Financial', 'PII'],
    purpose: 'Detects invoice anomalies before payment approval and routes exceptions to AP team.',
    deployedDate: '2025-02-01',
    lastRecertified: null,
    recertificationDue: '2025-05-01',
    linkedSowId: 'SOW-2025-0012',
    auditLog: [
      { action: 'Registered', actor: 'F. Malik', timestamp: '2025-02-01 14:30' },
      { action: 'Flagged for Review', actor: 'Nova', timestamp: '2025-02-03 09:00' },
    ],
    activityFeed: [
      {
        id: 'af-002-2',
        eventType: 're_review',
        message: 'Governance review required: no technical owner assigned and agent has never been recertified. Activation blocked.',
        timestamp: '2025-02-03 09:00',
        severity: 'critical',
      },
      {
        id: 'af-002-1',
        eventType: 'general',
        message: 'Agent registered and entered Pending Review queue. Awaiting governance sign-off.',
        timestamp: '2025-02-01 14:30',
        severity: 'info',
      },
    ],
    scopeDeviations: [
      { system: 'Treasury Dashboard', timestamp: '2025-04-14 11:33', flaggedBy: 'Nova' },
    ],
  },
  {
    id: 'DW-003',
    name: 'Worker Onboarding Agent',
    type: 'Workflow Automation',
    status: 'Active',
    businessOwner: 'Priya Nair · HR Shared Services',
    technicalOwner: 'IT Infrastructure',
    aiPlatform: 'Microsoft Copilot',
    usageBasedCost: false,
    risk: 'Low',
    approvedScope: ['Onboarding Checklist', 'ServiceNow', 'Azure AD'],
    dataClassification: ['PII', 'Internal Only'],
    purpose: 'Creates onboarding tasks for new contingent workers and monitors completion against SLA.',
    deployedDate: '2024-11-05',
    lastRecertified: '2025-02-10',
    recertificationDue: '2025-08-10',
    auditLog: [
      { action: 'Registered', actor: 'A. Mohamed', timestamp: '2024-11-05 10:22' },
      { action: 'Recertified', actor: 'F. Malik', timestamp: '2025-02-10 13:15' },
    ],
    activityFeed: [
      {
        id: 'af-003-1',
        eventType: 'general',
        message: 'All governance checks passing. Recertification on schedule for Aug 10, 2025.',
        timestamp: '2025-02-10 13:15',
        severity: 'info',
      },
    ],
    scopeDeviations: [],
  },
  {
    id: 'DW-004',
    name: 'Rate Card Validation Bot',
    type: 'RPA Bot',
    status: 'Paused',
    businessOwner: 'Marcus Hill · Procurement',
    technicalOwner: 'James Park · Platform Engineering',
    aiPlatform: 'UiPath',
    usageBasedCost: false,
    risk: 'Low',
    approvedScope: ['Rate Card Repository', 'Supplier Portal'],
    dataClassification: ['Internal Only', 'Financial'],
    purpose: 'Validates submitted rates against approved rate cards and flags out-of-range bids.',
    deployedDate: '2024-07-18',
    lastRecertified: '2024-10-18',
    recertificationDue: '2025-04-18',
    auditLog: [
      { action: 'Registered', actor: 'A. Mohamed', timestamp: '2024-07-18 11:00' },
      { action: 'Recertified', actor: 'F. Malik', timestamp: '2024-10-18 14:00' },
      { action: 'Paused', actor: 'F. Malik', timestamp: '2025-03-01 10:00' },
    ],
    activityFeed: [
      {
        id: 'af-004-2',
        eventType: 'general',
        message: 'Agent paused by administrator. No active monitoring until reactivated.',
        timestamp: '2025-03-01 10:00',
        severity: 'info',
      },
      {
        id: 'af-004-1',
        eventType: 'general',
        message: 'Recertification complete. Scope and ownership confirmed.',
        timestamp: '2024-10-18 14:00',
        severity: 'info',
      },
    ],
    scopeDeviations: [],
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const statusStyle: Record<WorkerStatus, string> = {
  Active:           'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Pending Review': 'bg-amber-50 text-amber-700 border-amber-200',
  Paused:           'bg-slate-100 text-slate-600 border-slate-200',
  Retired:          'bg-zinc-100 text-zinc-500 border-zinc-200',
};

const riskStyle: Record<RiskLevel, string> = {
  Low:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  High:   'bg-rose-50 text-rose-700 border-rose-200',
};

const dataClassStyle: Record<DataClass, string> = {
  PII:             'bg-rose-50 text-rose-700 border-rose-200',
  Financial:       'bg-amber-50 text-amber-700 border-amber-200',
  'Internal Only': 'bg-slate-100 text-slate-600 border-slate-200',
  Public:          'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKER_TYPES: WorkerType[] = [
  'LLM Agent', 'Workflow Automation', 'RPA Bot',
  'Data Pipeline Agent', 'Decision Support Agent', 'Code Generation Agent',
];
const DATA_CLASSES: DataClass[]  = ['PII', 'Financial', 'Internal Only', 'Public'];
const RISK_LEVELS: RiskLevel[]   = ['Low', 'Medium', 'High'];
const ALERT_THRESHOLDS           = [60, 70, 80, 90];

const OVERAGE_POLICIES: { value: OveragePolicy; label: string; description: string }[] = [
  { value: 'hard_stop',     label: 'Hard Stop',            description: 'Agent is paused automatically when cap is reached' },
  { value: 'escalate',      label: 'Escalate to Approver', description: 'Nova routes a work item for approval to continue' },
  { value: 'continue_flag', label: 'Continue & Flag',      description: 'Agent continues; Nova flags for review at end of period' },
];

const REVIEW_CADENCES: { value: ReviewCadence; label: string }[] = [
  { value: 'monthly',    label: 'Monthly' },
  { value: 'quarterly',  label: 'Quarterly' },
  { value: 'at_renewal', label: 'At Renewal' },
];

const AI_PLATFORM_SUGGESTIONS = [
  'Azure OpenAI', 'OpenAI API', 'AWS Bedrock', 'Google Vertex AI',
  'UiPath', 'Automation Anywhere', 'Microsoft Copilot', 'Salesforce Einstein', 'Internal',
];

// ─── Nova Logic ───────────────────────────────────────────────────────────────

function buildNovaFlags(
  w: DigitalWorker,
): { severity: 'warn' | 'info' | 'ok'; message: string }[] {
  const flags: { severity: 'warn' | 'info' | 'ok'; message: string }[] = [];
  const today         = new Date();
  const certDue       = new Date(w.recertificationDue);
  const daysUntilCert = Math.ceil((certDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Spend trajectory
  if (w.usageBasedCost && w.spendCap && w.currentSpend !== undefined) {
    const pct = (w.currentSpend / w.spendCap) * 100;
    if (w.currentSpend > w.spendCap) {
      flags.push({ severity: 'warn', message: `Spend cap exceeded — $${w.currentSpend.toLocaleString()} of $${w.spendCap.toLocaleString()}/mo cap. Overage policy: ${OVERAGE_POLICIES.find(p => p.value === w.overpagePolicy)?.label}.` });
    } else if (w.alertThreshold && pct >= w.alertThreshold) {
      const projected = Math.round(w.currentSpend * (30 / new Date().getDate()));
      flags.push({ severity: 'warn', message: `Spend at ${Math.round(pct)}% of cap ($${w.currentSpend.toLocaleString()}/$${w.spendCap.toLocaleString()}). Projected month-end: $${projected.toLocaleString()}. ${projected > w.spendCap ? 'On track to exceed cap.' : ''}` });
    }
  }
  if (w.usageBasedCost && !w.spendCap) {
    flags.push({ severity: 'warn', message: 'Variable-cost agent has no spend cap. Uncapped usage is a financial control risk.' });
  }

  // Scope deviations
  if (w.scopeDeviations.length > 0) {
    flags.push({ severity: 'warn', message: `${w.scopeDeviations.length} scope deviation${w.scopeDeviations.length > 1 ? 's' : ''} logged. Agent accessed systems outside approved scope: ${w.scopeDeviations.map(d => d.system).join(', ')}.` });
  }

  // Ownership and cert
  if (w.technicalOwner === 'Unassigned' || !w.technicalOwner?.trim())
    flags.push({ severity: 'warn', message: 'No technical owner assigned. Assign one before expanding scope.' });
  if (!w.lastRecertified)
    flags.push({ severity: 'warn', message: 'Agent has never been recertified. Initial governance review required.' });
  else if (daysUntilCert <= 0)
    flags.push({ severity: 'warn', message: `Recertification overdue by ${Math.abs(daysUntilCert)} days. Pause or recertify immediately.` });
  else if (daysUntilCert <= 30)
    flags.push({ severity: 'warn', message: `Recertification due in ${daysUntilCert} days. Schedule now.` });
  if (w.dataClassification.includes('PII') && w.risk === 'High')
    flags.push({ severity: 'warn', message: 'High-risk agent with PII access. Verify data handling and retention policies.' });
  if (w.approvedScope.length >= 4)
    flags.push({ severity: 'warn', message: 'Broad access scope detected. Review for least-privilege compliance.' });

  // Info
  if (w.usageBasedCost && w.spendCap && w.alertThreshold && !(w.currentSpend && w.currentSpend >= w.spendCap * w.alertThreshold / 100)) {
    flags.push({ severity: 'info', message: `Spend cap: $${w.spendCap.toLocaleString()}/mo. Nova alerts ${w.spendApprover || 'the approver'} at ${w.alertThreshold}% ($${Math.round(w.spendCap * w.alertThreshold / 100).toLocaleString()}).` });
  }
  if (w.status === 'Pending Review')
    flags.push({ severity: 'info', message: 'Complete governance review before activating or expanding this agent.' });

  if (flags.length === 0)
    flags.push({ severity: 'ok', message: 'No active governance concerns. Next recertification scheduled.' });
  return flags;
}

// ─── Status transitions ───────────────────────────────────────────────────────

function availableActions(status: WorkerStatus): { label: string; next: WorkerStatus; icon: React.ReactNode }[] {
  switch (status) {
    case 'Active':         return [
      { label: 'Pause',              next: 'Paused',   icon: <PauseCircle className="h-4 w-4" /> },
      { label: 'Retire',             next: 'Retired',  icon: <Archive className="h-4 w-4" /> },
    ];
    case 'Pending Review': return [
      { label: 'Approve & Activate', next: 'Active',  icon: <CheckCircle className="h-4 w-4" /> },
      { label: 'Retire',             next: 'Retired', icon: <Archive className="h-4 w-4" /> },
    ];
    case 'Paused':         return [
      { label: 'Reactivate', next: 'Active',  icon: <RotateCcw className="h-4 w-4" /> },
      { label: 'Retire',     next: 'Retired', icon: <Archive className="h-4 w-4" /> },
    ];
    case 'Retired':        return [];
  }
}

// ─── Spend Gauge ─────────────────────────────────────────────────────────────

function SpendGauge({
  cap,
  current,
  threshold,
  compact = false,
}: {
  cap: number;
  current: number;
  threshold: number;
  compact?: boolean;
}) {
  const rawPct      = (current / cap) * 100;
  const clampedPct  = Math.min(rawPct, 100);
  const isOver      = current > cap;
  const isAlert     = rawPct >= threshold;
  const fillColor   = isOver ? 'bg-rose-500' : isAlert ? 'bg-amber-500' : 'bg-emerald-500';
  const labelColor  = isOver ? 'text-rose-700' : isAlert ? 'text-amber-700' : 'text-slate-600';
  const pctLabel    = isOver ? `${Math.round(rawPct)}% — OVER CAP` : `${Math.round(rawPct)}%`;

  if (compact) {
    return (
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Spend this period</span>
          <span className={`text-xs font-bold ${labelColor}`}>${current.toLocaleString()} / ${cap.toLocaleString()}</span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${fillColor}`}
            style={{ width: `${clampedPct}%` }}
          />
          {/* Threshold tick mark */}
          <div
            className="absolute top-0 h-full w-px bg-slate-400"
            style={{ left: `${threshold}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>$0</span>
          <span className="text-slate-500 font-medium">{pctLabel}</span>
          <span>${cap.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  // Full gauge for governance profile
  return (
    <div className={`rounded-2xl border p-4 ${isOver ? 'border-rose-200 bg-rose-50' : isAlert ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className={`h-4 w-4 ${isOver ? 'text-rose-600' : isAlert ? 'text-amber-600' : 'text-slate-500'}`} />
          <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isOver ? 'text-rose-800' : isAlert ? 'text-amber-800' : 'text-slate-600'}`}>
            Spend Trajectory
          </span>
        </div>
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${isOver ? 'bg-rose-100 text-rose-700' : isAlert ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
          {pctLabel}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className={isOver ? 'text-rose-700' : isAlert ? 'text-amber-800' : 'text-slate-600'}>
            ${current.toLocaleString()} actual
          </span>
          <span className={isOver ? 'text-rose-700' : isAlert ? 'text-amber-800' : 'text-slate-500'}>
            ${cap.toLocaleString()}/mo cap
          </span>
        </div>

        <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/60">
          <div
            className={`h-full rounded-full transition-all ${fillColor}`}
            style={{ width: `${clampedPct}%` }}
          />
          {/* Threshold marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-slate-400/60"
            style={{ left: `${threshold}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px]">
          <span className="text-slate-400">$0</span>
          <span className={`font-medium ${isAlert ? (isOver ? 'text-rose-600' : 'text-amber-600') : 'text-slate-400'}`}>
            Alert at {threshold}% · ${Math.round(cap * threshold / 100).toLocaleString()}
          </span>
          <span className="text-slate-400">${cap.toLocaleString()}</span>
        </div>
      </div>

      {isAlert && (
        <p className={`mt-3 text-xs leading-5 ${isOver ? 'text-rose-700' : 'text-amber-700'}`}>
          {isOver
            ? `Cap exceeded by $${(current - cap).toLocaleString()}. Overage policy applies.`
            : `Projected month-end: $${Math.round(current * (30 / new Date().getDate())).toLocaleString()} at current burn rate.`}
        </p>
      )}
    </div>
  );
}


// ─── Activity Feed Panel ──────────────────────────────────────────────────────

const activityEventStyle: Record<ActivityEventType, { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  spend_alert:     { icon: <TrendingUp className="h-3.5 w-3.5" />, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  spend_cap_reached: { icon: <AlertOctagon className="h-3.5 w-3.5" />, bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  scope_deviation: { icon: <Eye className="h-3.5 w-3.5" />, bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  're_review':     { icon: <AlertTriangle className="h-3.5 w-3.5" />, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  threshold_crossed: { icon: <TrendingUp className="h-3.5 w-3.5" />, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  general:         { icon: <Activity className="h-3.5 w-3.5" />, bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-600' },
};

const activityEventLabel: Record<ActivityEventType, string> = {
  spend_alert:      'Spend Alert',
  spend_cap_reached:'Cap Reached',
  scope_deviation:  'Scope Deviation',
  're_review':      'Re-review Required',
  threshold_crossed:'Threshold Crossed',
  general:          'Event',
};

function ActivityFeedPanel({ feed }: { feed: ActivityEvent[] }) {
  if (feed.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
        <Activity className="mx-auto mb-2 h-5 w-5 text-slate-300" />
        <p className="text-xs text-slate-400">No operational events recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {feed.map(event => {
        const style = activityEventStyle[event.eventType];
        return (
          <div
            key={event.id}
            className={`rounded-2xl border px-3.5 py-3 ${style.bg} ${style.border}`}
          >
            <div className="flex items-start gap-2.5">
              <div className={`mt-0.5 shrink-0 ${style.text}`}>{style.icon}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${style.text}`}>
                    {activityEventLabel[event.eventType]}
                  </span>
                </div>
                <p className={`mt-0.5 text-xs leading-5 ${style.text}`}>{event.message}</p>
                <p className="mt-1 text-[10px] text-slate-400">{event.timestamp}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Registration Modal ───────────────────────────────────────────────────────

type ModalForm = {
  name: string;
  type: WorkerType;
  businessOwnerName: string;
  businessOwnerDept: string;
  technicalOwnerName: string;
  technicalOwnerDept: string;
  aiPlatform: string;
  usageBasedCost: boolean;
  spendCap: string;
  alertThreshold: number;
  overpagePolicy: OveragePolicy;
  spendApprover: string;
  reviewCadence: ReviewCadence;
  risk: RiskLevel;
  accessRaw: string;
  dataClassification: DataClass[];
  purpose: string;
};

const emptyModal: ModalForm = {
  name: '',
  type: 'LLM Agent',
  businessOwnerName: '',
  businessOwnerDept: '',
  technicalOwnerName: '',
  technicalOwnerDept: '',
  aiPlatform: '',
  usageBasedCost: false,
  spendCap: '',
  alertThreshold: 80,
  overpagePolicy: 'escalate',
  spendApprover: '',
  reviewCadence: 'quarterly',
  risk: 'Medium',
  accessRaw: '',
  dataClassification: [],
  purpose: '',
};

function RegisterModal({ onClose, onRegister }: { onClose: () => void; onRegister: (w: DigitalWorker) => void }) {
  const [form, setForm]     = useState<ModalForm>(emptyModal);
  const [errors, setErrors] = useState<Partial<Record<keyof ModalForm, string>>>({});

  function validate(): boolean {
    const e: Partial<Record<keyof ModalForm, string>> = {};
    if (!form.name.trim())                      e.name = 'Required';
    if (!form.businessOwnerName.trim())         e.businessOwnerName = 'Required';
    if (!form.aiPlatform.trim())                e.aiPlatform = 'Required';
    if (!form.purpose.trim())                   e.purpose = 'Required';
    if (form.dataClassification.length === 0)   e.dataClassification = 'Select at least one';
    if (form.usageBasedCost && !form.spendCap)  e.spendCap = 'Required for variable cost';
    if (form.usageBasedCost && !form.spendApprover.trim()) e.spendApprover = 'Required for variable cost';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const today   = new Date();
    const certDue = new Date(today);
    certDue.setMonth(certDue.getMonth() + 3);

    const businessOwner  = [form.businessOwnerName, form.businessOwnerDept].filter(Boolean).join(' · ');
    const technicalOwner = [form.technicalOwnerName, form.technicalOwnerDept].filter(Boolean).join(' · ') || 'Unassigned';
    const scope          = form.accessRaw.split(',').map(s => s.trim()).filter(Boolean);

    const newWorker: DigitalWorker = {
      id:             `DW-${String(Math.floor(Math.random() * 900) + 100)}`,
      name:           form.name.trim(),
      type:           form.type,
      status:         'Pending Review',
      businessOwner,
      technicalOwner,
      aiPlatform:     form.aiPlatform.trim(),
      usageBasedCost: form.usageBasedCost,
      ...(form.usageBasedCost ? {
        spendCap:       parseFloat(form.spendCap) || undefined,
        currentSpend:   0,
        alertThreshold: form.alertThreshold,
        overpagePolicy: form.overpagePolicy,
        spendApprover:  form.spendApprover.trim(),
        reviewCadence:  form.reviewCadence,
      } : {}),
      risk:               form.risk,
      approvedScope:      scope,   // locked at registration
      dataClassification: form.dataClassification,
      purpose:            form.purpose.trim(),
      deployedDate:       today.toISOString().split('T')[0],
      lastRecertified:    null,
      recertificationDue: certDue.toISOString().split('T')[0],
      auditLog: [{ action: 'Registered — scope locked', actor: 'F. Malik', timestamp: today.toLocaleString() }],
      activityFeed: [{
        id:        `af-new-1`,
        eventType: 'general',
        message:   `Agent registered. Approved scope locked: ${scope.join(', ') || 'None'}. Pending governance review.`,
        timestamp: today.toLocaleString(),
        severity:  'info',
      }],
      scopeDeviations: [],
    };
    onRegister(newWorker);
  }

  function toggleDataClass(dc: DataClass) {
    setForm(f => ({
      ...f,
      dataClassification: f.dataClassification.includes(dc)
        ? f.dataClassification.filter(d => d !== dc)
        : [...f.dataClassification, dc],
    }));
  }

  const accessChips = form.accessRaw.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
              <Bot className="h-3.5 w-3.5" />
              Digital Workforce
            </div>
            <h2 className="text-xl font-black text-slate-900">Register Digital Worker</h2>
            <p className="mt-1 text-sm text-slate-500">
              New agents enter <span className="font-medium text-amber-700">Pending Review</span>. Access scope is <span className="font-medium text-slate-700">locked at registration</span> — any usage outside approved scope is logged as a deviation.
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[68vh] overflow-y-auto p-6">
          <div className="space-y-5">

            <ModalSectionDivider label="Identity" />

            <ModalField label="Agent name" error={errors.name} required>
              <input className={inputCls(!!errors.name)} placeholder="e.g. Supplier Risk Screener" value={form.name}
                onChange={e => { setForm({ ...form, name: e.target.value }); setErrors(p => ({ ...p, name: undefined })); }} />
            </ModalField>

            <div className="grid grid-cols-2 gap-4">
              <ModalField label="Agent type" required>
                <ModalSelect value={form.type} onChange={v => setForm({ ...form, type: v as WorkerType })} options={WORKER_TYPES} />
              </ModalField>
              <ModalField label="Risk level" required>
                <ModalSelect value={form.risk} onChange={v => setForm({ ...form, risk: v as RiskLevel })} options={RISK_LEVELS} />
              </ModalField>
            </div>

            <ModalField label="AI platform / technology" error={errors.aiPlatform} required
              helperText="The underlying tech stack — e.g. Azure OpenAI, UiPath, AWS Bedrock. Not the SI or delivery partner.">
              <input className={inputCls(!!errors.aiPlatform)} placeholder="e.g. Azure OpenAI, UiPath, AWS Bedrock"
                value={form.aiPlatform} list="dw-platform-suggestions"
                onChange={e => { setForm({ ...form, aiPlatform: e.target.value }); setErrors(p => ({ ...p, aiPlatform: undefined })); }} />
              <datalist id="dw-platform-suggestions">
                {AI_PLATFORM_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </ModalField>

            <ModalField label="Purpose" error={errors.purpose} required>
              <textarea className={`${inputCls(!!errors.purpose)} min-h-[72px] resize-none`}
                placeholder="What does this agent do and why is it being deployed?"
                value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
            </ModalField>

            <ModalSectionDivider label="Ownership" />

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Business Owner</p>
              <div className="grid grid-cols-2 gap-3">
                <ModalField label="Full name" required error={errors.businessOwnerName}>
                  <input className={inputCls(!!errors.businessOwnerName)} placeholder="e.g. Sarah Chen"
                    value={form.businessOwnerName}
                    onChange={e => { setForm({ ...form, businessOwnerName: e.target.value }); setErrors(p => ({ ...p, businessOwnerName: undefined })); }} />
                </ModalField>
                <ModalField label="Business unit">
                  <input className={inputCls(false)} placeholder="e.g. Legal, Finance, Marketing"
                    value={form.businessOwnerDept} onChange={e => setForm({ ...form, businessOwnerDept: e.target.value })} />
                </ModalField>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Technical Owner</p>
              <div className="grid grid-cols-2 gap-3">
                <ModalField label="Full name">
                  <input className={inputCls(false)} placeholder="e.g. James Park"
                    value={form.technicalOwnerName} onChange={e => setForm({ ...form, technicalOwnerName: e.target.value })} />
                </ModalField>
                <ModalField label="Team">
                  <input className={inputCls(false)} placeholder="e.g. Platform Engineering, IT"
                    value={form.technicalOwnerDept} onChange={e => setForm({ ...form, technicalOwnerDept: e.target.value })} />
                </ModalField>
              </div>
            </div>

            <ModalSectionDivider label="Data & Access" />

            <ModalField label="Data classification" error={errors.dataClassification} required>
              <div className="flex flex-wrap gap-2 pt-1">
                {DATA_CLASSES.map(dc => (
                  <button key={dc} type="button" onClick={() => toggleDataClass(dc)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      form.dataClassification.includes(dc)
                        ? dataClassStyle[dc] + ' ring-2 ring-offset-1 ring-current'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}>
                    {dc}
                  </button>
                ))}
              </div>
            </ModalField>

            <ModalField label="Approved access scope" helperText="Locked at registration. Any access outside this list will be flagged as a deviation event. Comma-separated.">
              <input className={inputCls(false)} placeholder="e.g. SharePoint, AP Queue, Supplier Master"
                value={form.accessRaw} onChange={e => setForm({ ...form, accessRaw: e.target.value })} />
              {accessChips.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {accessChips.map(c => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600">
                      <Lock className="h-3 w-3 text-slate-400" />{c}
                    </span>
                  ))}
                </div>
              )}
              {accessChips.length > 0 && (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                  <Lock className="h-3 w-3" />
                  This scope will be locked after registration. Changes require a deviation event.
                </p>
              )}
            </ModalField>

            <ModalSectionDivider label="Spend Governance" />

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Cost type</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setForm({ ...form, usageBasedCost: false })}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    !form.usageBasedCost ? 'border-slate-950 bg-slate-950' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}>
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${!form.usageBasedCost ? 'border-white' : 'border-slate-300'}`}>
                    {!form.usageBasedCost && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${!form.usageBasedCost ? 'text-white' : 'text-slate-900'}`}>Fixed cost</p>
                    <p className={`mt-0.5 text-xs ${!form.usageBasedCost ? 'text-slate-300' : 'text-slate-500'}`}>Subscription, license, or internal — no variable spend exposure</p>
                  </div>
                </button>
                <button type="button" onClick={() => setForm({ ...form, usageBasedCost: true })}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    form.usageBasedCost ? 'border-amber-500 bg-amber-500' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}>
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${form.usageBasedCost ? 'border-white' : 'border-slate-300'}`}>
                    {form.usageBasedCost && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${form.usageBasedCost ? 'text-white' : 'text-slate-900'}`}>Variable / usage-based</p>
                    <p className={`mt-0.5 text-xs ${form.usageBasedCost ? 'text-amber-100' : 'text-slate-500'}`}>Billed per API call or consumption — requires spend cap</p>
                  </div>
                </button>
              </div>
            </div>

            {form.usageBasedCost && (
              <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Spend governance required</p>
                    <p className="mt-0.5 text-xs leading-5 text-amber-700">
                      Define a monthly cap and what Nova should do when it's reached.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <ModalField label="Monthly spend cap (USD)" required error={errors.spendCap}>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">$</span>
                      <input type="number" min="0" placeholder="3000"
                        className={`${inputCls(!!errors.spendCap)} pl-7`}
                        value={form.spendCap}
                        onChange={e => { setForm({ ...form, spendCap: e.target.value }); setErrors(p => ({ ...p, spendCap: undefined })); }} />
                    </div>
                  </ModalField>
                  <ModalField label="Alert threshold" helperText="% of cap that triggers a Nova work item">
                    <div className="relative">
                      <select value={form.alertThreshold} onChange={e => setForm({ ...form, alertThreshold: Number(e.target.value) })}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500/20">
                        {ALERT_THRESHOLDS.map(t => <option key={t} value={t}>{t}% of cap</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-slate-400" />
                    </div>
                  </ModalField>
                </div>

                <ModalField label="When the cap is reached" required>
                  <div className="space-y-2">
                    {OVERAGE_POLICIES.map(p => (
                      <button key={p.value} type="button" onClick={() => setForm({ ...form, overpagePolicy: p.value })}
                        className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                          form.overpagePolicy === p.value ? 'border-slate-950 bg-slate-950' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}>
                        <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${form.overpagePolicy === p.value ? 'border-white' : 'border-slate-300'}`}>
                          {form.overpagePolicy === p.value && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${form.overpagePolicy === p.value ? 'text-white' : 'text-slate-900'}`}>{p.label}</p>
                          <p className={`text-xs ${form.overpagePolicy === p.value ? 'text-slate-300' : 'text-slate-500'}`}>{p.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ModalField>

                <div className="grid grid-cols-2 gap-4">
                  <ModalField label="Spend approver" required error={errors.spendApprover} helperText="Who Nova routes the escalation to">
                    <input className={inputCls(!!errors.spendApprover)} placeholder="e.g. James Park"
                      value={form.spendApprover}
                      onChange={e => { setForm({ ...form, spendApprover: e.target.value }); setErrors(p => ({ ...p, spendApprover: undefined })); }} />
                  </ModalField>
                  <ModalField label="Review cadence">
                    <div className="relative">
                      <select value={form.reviewCadence} onChange={e => setForm({ ...form, reviewCadence: e.target.value as ReviewCadence })}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500/20">
                        {REVIEW_CADENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-slate-400" />
                    </div>
                  </ModalField>
                </div>

                {form.spendCap && form.alertThreshold && (
                  <div className="rounded-xl border border-amber-200 bg-white px-4 py-3">
                    <p className="text-xs text-amber-800">
                      <Bell className="mr-1 inline h-3.5 w-3.5" />
                      Nova will alert <span className="font-medium">{form.spendApprover || 'the approver'}</span> at{' '}
                      <span className="font-medium">${Math.round(parseFloat(form.spendCap) * form.alertThreshold / 100).toLocaleString()}</span>
                      {' '}({form.alertThreshold}% of ${parseFloat(form.spendCap).toLocaleString()}/mo cap).
                    </p>
                  </div>
                )}
              </div>
            )}

            {!form.usageBasedCost && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">
                  <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-500" />
                  Fixed cost — no variable spend exposure. No spend governance required.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-100 p-6">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-black">
            <Bot className="h-4 w-4" />
            Register Agent
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Recertification badge ────────────────────────────────────────────────────

function RecertBadge({ due, last }: { due: string; last: string | null }) {
  const today   = new Date();
  const dueDate = new Date(due);
  const days    = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  let cls   = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let label = `Cert due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  if (!last)          { cls = 'bg-rose-50 text-rose-700 border-rose-200';   label = 'Never recertified'; }
  else if (days <= 0) { cls = 'bg-rose-50 text-rose-700 border-rose-200';   label = 'Recertification overdue'; }
  else if (days <= 30){ cls = 'bg-amber-50 text-amber-700 border-amber-200'; label = `Recert due in ${days}d`; }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
      <Calendar className="h-3 w-3" />{label}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterStatus = WorkerStatus | 'All';
type FilterRisk   = RiskLevel | 'All';

export default function DigitalWorkersPage() {
  const [workers, setWorkers]           = useState<DigitalWorker[]>(seed);
  const [selectedId, setSelectedId]     = useState<string>(seed[0].id);
  const [showModal, setShowModal]       = useState(false);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [filterRisk, setFilterRisk]     = useState<FilterRisk>('All');
  const [showAudit, setShowAudit]       = useState(false);
  const [showActivity, setShowActivity] = useState(true);

  // Scope deviation logging state
  const [deviationInput, setDeviationInput] = useState('');
  const [showDeviationInput, setShowDeviationInput] = useState(false);

  const selectedWorker = workers.find(w => w.id === selectedId)!;

  const filtered = useMemo(() => workers.filter(w => {
    const matchSearch = !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.aiPlatform.toLowerCase().includes(search.toLowerCase()) ||
      w.businessOwner.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || w.status === filterStatus;
    const matchRisk   = filterRisk === 'All' || w.risk === filterRisk;
    return matchSearch && matchStatus && matchRisk;
  }), [workers, search, filterStatus, filterRisk]);

  const activeCount   = workers.filter(w => w.status === 'Active').length;
  const pendingCount  = workers.filter(w => w.status === 'Pending Review').length;
  const highRiskCount = workers.filter(w => w.risk === 'High' && w.status !== 'Retired').length;
  const variableCount = workers.filter(w => w.usageBasedCost && w.status !== 'Retired').length;
  const deviationCount = workers.filter(w => w.scopeDeviations.length > 0).length;


  function handleRegister(w: DigitalWorker) {
    setWorkers(prev => [w, ...prev]);
    setSelectedId(w.id);
    setShowModal(false);
  }

  function handleStatusChange(next: WorkerStatus) {
    const actionLabel = next === 'Active' ? 'Activated' : next === 'Paused' ? 'Paused' : 'Retired';
    setWorkers(prev => prev.map(w => w.id === selectedWorker.id ? {
      ...w,
      status: next,
      auditLog: [{ action: actionLabel, actor: 'F. Malik', timestamp: new Date().toLocaleString() }, ...w.auditLog],
      activityFeed: [{
        id:        `af-${w.id}-${Date.now()}`,
        eventType: 'general',
        message:   `Agent status changed to ${next}.`,
        timestamp: new Date().toLocaleString(),
        severity:  'info',
      }, ...w.activityFeed],
    } : w));
  }

  function handleRecertify() {
    const today   = new Date();
    const certDue = new Date(today);
    certDue.setMonth(certDue.getMonth() + 3);
    setWorkers(prev => prev.map(w => w.id === selectedWorker.id ? {
      ...w,
      lastRecertified:   today.toISOString().split('T')[0],
      recertificationDue: certDue.toISOString().split('T')[0],
      auditLog: [{ action: 'Recertified', actor: 'F. Malik', timestamp: today.toLocaleString() }, ...w.auditLog],
      activityFeed: [{
        id:        `af-${w.id}-cert-${Date.now()}`,
        eventType: 'general',
        message:   `Recertification complete. Next due ${certDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
        timestamp: today.toLocaleString(),
        severity:  'info',
      }, ...w.activityFeed],
    } : w));
  }

  function handleLogDeviation() {
    if (!deviationInput.trim()) return;
    const now = new Date().toLocaleString();
    const system = deviationInput.trim();
    setWorkers(prev => prev.map(w => w.id === selectedWorker.id ? {
      ...w,
      scopeDeviations: [{ system, timestamp: now, flaggedBy: 'F. Malik' }, ...w.scopeDeviations],
      auditLog: [{ action: `Scope deviation logged: ${system}`, actor: 'F. Malik', timestamp: now }, ...w.auditLog],
      activityFeed: [{
        id:        `af-${w.id}-dev-${Date.now()}`,
        eventType: 'scope_deviation',
        message:   `Access to "${system}" detected outside approved scope. Logged as deviation event.`,
        timestamp: now,
        severity:  'warn',
      }, ...w.activityFeed],
    } : w));
    setDeviationInput('');
    setShowDeviationInput(false);
  }

  const novaFlags = buildNovaFlags(selectedWorker);
  const actions   = availableActions(selectedWorker.status);

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      {showModal && <RegisterModal onClose={() => setShowModal(false)} onRegister={handleRegister} />}

      <div className="mx-auto max-w-7xl space-y-6">

        {/* ── Header ── */}
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-700">
                <Bot className="h-4 w-4" />
                Digital Workforce Governance
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">Digital Workers</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                AI agents, automation bots, and autonomous software workers governed as part of the external workforce — tracked for ownership, access, cost, lifecycle, and compliance risk. Scope is locked at registration; runtime deviations, spend alerts, and platform incidents surface in the activity feed.
              </p>
            </div>
            <button onClick={() => setShowModal(true)} className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
              <Plus className="h-4 w-4" />
              Register Digital Worker
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
            <MetricCard icon={<Bot className="h-5 w-5" />}           label="Registered"       value={workers.length.toString()} />
            <MetricCard icon={<Activity className="h-5 w-5" />}      label="Active"           value={activeCount.toString()} sub={pendingCount > 0 ? `${pendingCount} pending` : undefined} />
            <MetricCard icon={<Zap className="h-5 w-5" />}           label="Variable Cost"    value={variableCount.toString()} />
            <MetricCard icon={<AlertTriangle className="h-5 w-5" />} label="High Risk"        value={highRiskCount.toString()} alert={highRiskCount > 0} />
            <MetricCard icon={<Eye className="h-5 w-5" />}           label="Scope Deviations" value={deviationCount.toString()} alert={deviationCount > 0} />
          </div>
        </section>

        {/* ── Main Grid ── */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">

          {/* Left: list */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black">Registered Agents</h2>
                <p className="text-sm text-slate-400">{filtered.length} of {workers.length} digital workers</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input className="w-44 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500/20"
                    placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="relative">
                  <select className="appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 text-sm text-slate-700 outline-none"
                    value={filterStatus} onChange={e => setFilterStatus(e.target.value as FilterStatus)}>
                    <option value="All">All Statuses</option>
                    {(['Active', 'Pending Review', 'Paused', 'Retired'] as WorkerStatus[]).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" />
                </div>
                <div className="relative">
                  <select className="appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 text-sm text-slate-700 outline-none"
                    value={filterRisk} onChange={e => setFilterRisk(e.target.value as FilterRisk)}>
                    <option value="All">All Risk</option>
                    {(['Low', 'Medium', 'High'] as RiskLevel[]).map(r => <option key={r}>{r}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-14 text-center">
                <Bot className="mb-3 h-8 w-8 text-slate-300" />
                <p className="text-xs font-bold text-slate-500">No agents match your filters</p>
                <button onClick={() => { setSearch(''); setFilterStatus('All'); setFilterRisk('All'); }}
                  className="mt-3 text-sm text-cyan-600 hover:underline">Clear filters</button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(worker => {
                  const hasDeviations    = worker.scopeDeviations.length > 0;
                  const hasSpendAlert    = worker.usageBasedCost && worker.spendCap && worker.currentSpend !== undefined &&
                    worker.alertThreshold !== undefined && worker.currentSpend >= worker.spendCap * worker.alertThreshold / 100;

                  return (
                    <button key={worker.id}
                      onClick={() => { setSelectedId(worker.id); setShowAudit(false); setShowDeviationInput(false); }}
                      className={`w-full rounded-2xl border p-5 text-left transition hover:bg-cyan-50/40 ${selectedId === worker.id ? 'border-slate-200 bg-white border-l-4 border-l-cyan-500' : 'border-slate-200 bg-white border-l-4 border-l-transparent'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <AgentTypeIcon type={worker.type} />
                            <h3 className="truncate font-bold text-slate-900">{worker.name}</h3>
                            {/* Real-time alert indicators */}                            {hasSpendAlert && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                                <TrendingUp className="h-2.5 w-2.5" />Spend
                              </span>
                            )}
                            {hasDeviations && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-700">
                                <Eye className="h-2.5 w-2.5" />{worker.scopeDeviations.length} deviation{worker.scopeDeviations.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{worker.purpose}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Chip>{worker.id}</Chip>
                            <Chip>{worker.type}</Chip>
                            <Chip>{worker.aiPlatform}</Chip>
                            <Chip className={worker.usageBasedCost ? 'border-amber-200 bg-amber-50 text-amber-700' : ''}>
                              {worker.usageBasedCost ? 'Variable cost' : 'Fixed cost'}
                            </Chip>
                            {worker.linkedSowId && (
                              <Chip className="border-cyan-200 bg-cyan-50 text-cyan-700">
                                SOW {worker.linkedSowId}
                              </Chip>
                            )}
                          </div>

                          {/* Spend gauge on card — variable cost only */}
                          {worker.usageBasedCost && worker.spendCap && worker.currentSpend !== undefined && worker.alertThreshold !== undefined && (
                            <SpendGauge
                              cap={worker.spendCap}
                              current={worker.currentSpend}
                              threshold={worker.alertThreshold}
                              compact
                            />
                          )}

                          <div className="mt-3">
                            <RecertBadge due={worker.recertificationDue} last={worker.lastRecertified} />
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusStyle[worker.status]}`}>{worker.status}</span>
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${riskStyle[worker.risk]}`}>{worker.risk} Risk</span>
                          {worker.usageBasedCost && worker.spendCap && (
                            <span className="text-sm font-bold text-amber-700">${worker.spendCap.toLocaleString()}/mo cap</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Governance Profile */}
          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">Governance Profile</h2>
                <p className="text-sm text-slate-400">Ownership, monitoring & compliance.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                {selectedWorker.id}
              </span>
            </div>

            {/* Hero */}
            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <AgentTypeIcon type={selectedWorker.type} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{selectedWorker.name}</h3>
                  <p className="text-sm text-slate-300">{selectedWorker.type} · {selectedWorker.aiPlatform}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">{selectedWorker.purpose}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusStyle[selectedWorker.status]}`}>{selectedWorker.status}</span>
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${riskStyle[selectedWorker.risk]}`}>{selectedWorker.risk} Risk</span>
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${selectedWorker.usageBasedCost ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                  {selectedWorker.usageBasedCost ? 'Variable cost' : 'Fixed cost'}
                </span>
              </div>
            </div>

            {/* Info rows */}
            <div className="mt-5 space-y-2.5">
              <InfoRow icon={<User className="h-4 w-4" />}      label="Business Owner"  value={selectedWorker.businessOwner} />
              <InfoRow icon={<Cpu className="h-4 w-4" />}       label="Technical Owner" value={selectedWorker.technicalOwner} warn={selectedWorker.technicalOwner === 'Unassigned'} />
              <InfoRow icon={<Building2 className="h-4 w-4" />} label="AI Platform"     value={selectedWorker.aiPlatform} />
              <InfoRow icon={<Power className="h-4 w-4" />}     label="Status"          value={selectedWorker.status} />
              <InfoRow icon={<Calendar className="h-4 w-4" />}  label="Deployed"
                value={new Date(selectedWorker.deployedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
              {selectedWorker.linkedSowId ? (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-cyan-600">
                    <FileText className="h-4 w-4" />Linked SOW
                  </div>
                  <a href={`/requests/sow/${selectedWorker.linkedSowId}`}
                    className="inline-flex items-center gap-1 text-sm font-bold text-cyan-600 hover:underline">
                    {selectedWorker.linkedSowId}<ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-slate-400"><FileText className="h-4 w-4" />Linked SOW</div>
                  <span className="text-sm text-slate-400">Not linked</span>
                </div>
              )}
            </div>

            {/* Spend Governance + Gauge — variable cost only */}
            {selectedWorker.usageBasedCost && (
              <div className="mt-4 space-y-3">
                {/* Full spend gauge */}
                {selectedWorker.spendCap && selectedWorker.currentSpend !== undefined && selectedWorker.alertThreshold !== undefined && (
                  <SpendGauge
                    cap={selectedWorker.spendCap}
                    current={selectedWorker.currentSpend}
                    threshold={selectedWorker.alertThreshold}
                  />
                )}

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-600" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-800">Spend Governance</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-700">Monthly cap</span>
                      {selectedWorker.spendCap
                        ? <span className="text-xs font-bold text-amber-900">${selectedWorker.spendCap.toLocaleString()}/mo</span>
                        : <span className="text-xs font-bold text-rose-600 flex items-center gap-1"><XCircle className="h-3 w-3" />No cap set</span>}
                    </div>
                    {selectedWorker.spendCap && selectedWorker.alertThreshold && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-amber-700">Alert at</span>
                          <span className="text-xs font-bold text-amber-900">{selectedWorker.alertThreshold}% — ${Math.round(selectedWorker.spendCap * selectedWorker.alertThreshold / 100).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-amber-700">Overage policy</span>
                          <span className="text-xs font-bold text-amber-900">{OVERAGE_POLICIES.find(p => p.value === selectedWorker.overpagePolicy)?.label}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-amber-700">Approver</span>
                          <span className="text-xs font-bold text-amber-900">{selectedWorker.spendApprover || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-amber-700">Review cadence</span>
                          <span className="text-xs font-bold text-amber-900">{REVIEW_CADENCES.find(r => r.value === selectedWorker.reviewCadence)?.label}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Data classification */}
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Lock className="h-4 w-4" />Data Classification
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedWorker.dataClassification.map(dc => (
                  <span key={dc} className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${dataClassStyle[dc]}`}>{dc}</span>
                ))}
              </div>
            </div>

            {/* Approved scope — locked at onboarding */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Approved Scope</span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Locked at onboarding</span>
                </div>
              </div>
              {selectedWorker.approvedScope.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedWorker.approvedScope.map(item => (
                    <span key={item} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600">
                      <Lock className="h-2.5 w-2.5 text-slate-400" />{item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No access scope defined.</p>
              )}

              {/* Scope deviations */}
              {selectedWorker.scopeDeviations.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-rose-700">
                    <Eye className="h-3.5 w-3.5" />
                    {selectedWorker.scopeDeviations.length} scope deviation{selectedWorker.scopeDeviations.length > 1 ? 's' : ''} logged
                  </p>
                  {selectedWorker.scopeDeviations.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" />
                      <div>
                        <p className="text-xs font-medium text-rose-800">{d.system}</p>
                        <p className="text-[10px] text-rose-600">{d.flaggedBy} · {d.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Log deviation inline input */}
              {selectedWorker.status !== 'Retired' && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  {showDeviationInput ? (
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-rose-300 placeholder:text-slate-400"
                        placeholder="System accessed outside scope..."
                        value={deviationInput}
                        onChange={e => setDeviationInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleLogDeviation(); if (e.key === 'Escape') { setShowDeviationInput(false); setDeviationInput(''); } }}
                        autoFocus
                      />
                      <button onClick={handleLogDeviation}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100">
                        Log
                      </button>
                      <button onClick={() => { setShowDeviationInput(false); setDeviationInput(''); }}
                        className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-slate-400 hover:bg-cyan-50/40">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setShowDeviationInput(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-700 transition-colors">
                      <Eye className="h-3.5 w-3.5" />
                      Log scope deviation
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Recertification */}
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Recertification</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {selectedWorker.lastRecertified
                      ? `Last: ${new Date(selectedWorker.lastRecertified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : 'Never recertified'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Due: {new Date(selectedWorker.recertificationDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                {selectedWorker.status !== 'Retired' && (
                  <button onClick={handleRecertify}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 shadow-sm">
                    <CheckCircle className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
                    Recertify
                  </button>
                )}
              </div>
            </div>

            {/* Nova flags */}
            <div className="mt-4 space-y-2">
              {novaFlags.map((flag, i) => (
                <div key={i} className={`rounded-2xl border p-4 ${
                  flag.severity === 'warn' ? 'border-amber-200 bg-amber-50'
                  : flag.severity === 'ok' ? 'border-emerald-200 bg-emerald-50'
                  : 'border-cyan-200 bg-cyan-50'
                }`}>
                  <div className="flex gap-3">
                    {flag.severity === 'warn'
                      ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      : flag.severity === 'ok'
                      ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      : <Bot className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />}
                    <div>
                      <p className={`text-xs font-bold ${flag.severity === 'warn' ? 'text-amber-800' : flag.severity === 'ok' ? 'text-emerald-800' : 'text-cyan-800'}`}>
                        Nova{flag.severity === 'ok' ? ' — All Clear' : flag.severity === 'info' ? ' — Note' : ' — Action Required'}
                      </p>
                      <p className={`mt-0.5 text-xs leading-5 ${flag.severity === 'warn' ? 'text-amber-700' : flag.severity === 'ok' ? 'text-emerald-700' : 'text-cyan-700'}`}>
                        {flag.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            {actions.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Actions</p>
                <div className="flex flex-wrap gap-2">
                  {actions.map(a => (
                    <button key={a.label} onClick={() => handleStatusChange(a.next)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-cyan-50/40">
                      {a.icon}{a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Feed */}
            <div className="mt-5">
              <button onClick={() => setShowActivity(v => !v)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-400" />
                  Activity Feed
                  {selectedWorker.activityFeed.some(e => e.severity === 'warn' || e.severity === 'critical') && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                      {selectedWorker.activityFeed.filter(e => e.severity === 'warn' || e.severity === 'critical').length}
                    </span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showActivity ? 'rotate-180' : ''}`} />
              </button>
              {showActivity && (
                <div className="mt-2 px-1">
                  <ActivityFeedPanel feed={selectedWorker.activityFeed} />
                </div>
              )}
            </div>

            {/* Audit log */}
            <div className="mt-3">
              <button onClick={() => setShowAudit(v => !v)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Audit Log
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showAudit ? 'rotate-180' : ''}`} />
              </button>
              {showAudit && (
                <div className="mt-2 space-y-2 px-1">
                  {selectedWorker.auditLog.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-3">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{entry.action}</p>
                        <p className="text-xs text-slate-400">{entry.actor} · {entry.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AgentTypeIcon({ type, className }: { type: WorkerType; className?: string }) {
  const base = `h-5 w-5 text-slate-700 ${className ?? ''}`;
  switch (type) {
    case 'LLM Agent':              return <Bot className={base} />;
    case 'Workflow Automation':    return <Layers className={base} />;
    case 'RPA Bot':                return <RotateCcw className={base} />;
    case 'Data Pipeline Agent':    return <Activity className={base} />;
    case 'Decision Support Agent': return <ShieldCheck className={base} />;
    case 'Code Generation Agent':  return <Cpu className={base} />;
    default:                       return <Bot className={base} />;
  }
}

function MetricCard({ icon, label, value, sub, alert }: { icon: React.ReactNode; label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${alert ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ${alert ? 'text-rose-600' : 'text-slate-700'}`}>{icon}</div>
      <div className={`text-2xl font-black ${alert ? 'text-rose-700' : 'text-slate-900'}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
      {sub && <div className="mt-1 text-xs text-amber-600">{sub}</div>}
    </div>
  );
}

function InfoRow({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
      <div className="flex items-center gap-2 text-sm text-slate-500">{icon}{label}</div>
      <div className={`text-right text-sm font-medium ${warn ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}{warn && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-rose-500" />}
      </div>
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 ${className ?? ''}`}>
      {children}
    </span>
  );
}

function inputCls(error: boolean) {
  return `w-full rounded-xl border ${error ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500/20 focus:ring-2 focus:ring-slate-100`;
}

function ModalSectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="flex-1 border-t border-slate-100" />
    </div>
  );
}

function ModalField({ label, children, error, required, helperText }: { label: string; children: React.ReactNode; error?: string; required?: boolean; helperText?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}{required && <span className="ml-1 text-rose-400">*</span>}
      </label>
      {children}
      {error      && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-slate-400">{helperText}</p>}
    </div>
  );
}

function ModalSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500/20 focus:ring-2 focus:ring-slate-100"
        value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-slate-400" />
    </div>
  );
}
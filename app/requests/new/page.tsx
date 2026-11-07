'use client'

import { useMemo, useState, useRef } from 'react'
import type { ElementType } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BriefcaseBusiness,
  FileText,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
  Paperclip,
  CheckCircle2,
  File,
  Image,
  FileSpreadsheet,
} from 'lucide-react'
import {
  LevvEmptyState,
  LevvNotice,
  LevvPage,
  LevvPageHeader,
  LevvSearchField,
  LevvSelect,
  LevvStatusBadge,
  levvUi,
} from '@/components/ui/levv-app'

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkRecordType = 'contingent' | 'sow' | 'profile'

type WorkRecord = {
  id: string
  type: WorkRecordType
  title: string
  supplier: string
  meta: string
  rate?: string
  rateMax?: string
  engagement?: string
  committedSpend?: string
  maxBudget?: string
  spentToDate?: string
  workers?: number
}

type ChangeType =
  | 'extend_end_date'
  | 'adjust_rate'
  | 'early_termination'
  | 'admin_ownership'
  | 'close_worker'
  | 'adjust_budget'
  | 'change_scope'
  | 'change_workers'
  | 'close_sow'
  | 'update_details'
  | 'change_contact'
  | 'close_record'

// ─── Data ────────────────────────────────────────────────────────────────────

const newEngagementCards: {
  id: string
  title: string
  subtitle: string
  route: string
  icon: ElementType
}[] = [
  {
    id: 'job',
    title: 'Job posting',
    subtitle: 'Hire a contractor',
    route: '/requests/new/job/create/define',
    icon: BriefcaseBusiness,
  },
  {
    id: 'sow',
    title: 'Statement of work',
    subtitle: 'Services / outcomes',
    route: '/requests/new/sow',
    icon: FileText,
  },
  {
    id: 'profile-worker',
    title: 'Track a worker',
    subtitle: 'Visibility only',
    route: '/requests/new/profile',
    icon: UserRound,
  },
]

const workRecords: WorkRecord[] = [
  {
    id: 'wo-1',
    type: 'contingent',
    title: 'Sarah Chen — Sr. data engineer',
    supplier: 'TekStaff Inc.',
    meta: 'Ends Jun 30, 2025',
    rate: '$92.00 /hr',
    rateMax: '$95.00 /hr',
    engagement: 'Jan 6 — Jun 30, 2025',
    committedSpend: '$47,840 of $79,800',
  },
  {
    id: 'wo-2',
    type: 'contingent',
    title: 'Marcus Rivera — UX designer',
    supplier: 'DesignForce',
    meta: 'Ends Sep 15, 2025',
    rate: '$85.00 /hr',
    rateMax: '$90.00 /hr',
    engagement: 'Mar 1 — Sep 15, 2025',
    committedSpend: '$22,100 of $61,200',
  },
  {
    id: 'wo-3',
    type: 'contingent',
    title: 'Priya Sharma — Sr. QA analyst',
    supplier: 'QualityFirst',
    meta: 'Starts Mar 31, 2025',
    rate: '$78.00 /hr',
    rateMax: '$82.00 /hr',
    engagement: 'Mar 31 — Dec 31, 2025',
    committedSpend: '$0 of $124,800',
  },
  {
    id: 'sow-1',
    type: 'sow',
    title: 'Acme Corp — Cloud migration consulting',
    supplier: 'Acme Corp',
    meta: 'Ends Jul 14, 2025',
    maxBudget: '$240,000',
    spentToDate: '$156,200 (65%)',
    engagement: 'Jan 15 — Jul 14, 2025',
    workers: 3,
  },
  {
    id: 'sow-2',
    type: 'sow',
    title: 'Globex — Security audit & remediation',
    supplier: 'Globex',
    meta: 'Ends Mar 30, 2025',
    maxBudget: '$85,000',
    spentToDate: '$61,200 (72%)',
    engagement: 'Nov 1 — Mar 30, 2025',
    workers: 1,
  },
  {
    id: 'sow-3',
    type: 'sow',
    title: 'Pinnacle — Data warehouse build',
    supplier: 'Pinnacle',
    meta: 'Ends Dec 31, 2025',
    maxBudget: '$380,000',
    spentToDate: '$94,500 (25%)',
    engagement: 'Jan 1 — Dec 31, 2025',
    workers: 4,
  },
  {
    id: 'pw-1',
    type: 'profile',
    title: 'James Park — Independent advisor',
    supplier: 'Strategy',
    meta: 'Ongoing',
  },
]

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'contingent', label: 'Contingent' },
  { id: 'sow', label: 'SOW' },
  { id: 'profile', label: 'Profile' },
] as const

type TabId = (typeof tabs)[number]['id']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeCode(type: WorkRecordType) {
  return type === 'contingent' ? 'WO' : type === 'sow' ? 'SOW' : 'PW'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext ?? ''))
    return <Image className="h-4 w-4 text-slate-400" />
  if (['xls', 'xlsx', 'csv'].includes(ext ?? ''))
    return <FileSpreadsheet className="h-4 w-4 text-slate-400" />
  if (['pdf'].includes(ext ?? ''))
    return <FileText className="h-4 w-4 text-slate-400" />
  return <File className="h-4 w-4 text-slate-400" />
}

/** The plain choice surface: white, bordered, 12px, lifts a pixel on hover. */
const choiceClass =
  'levv-press group rounded-[12px] border border-[var(--line)] bg-white text-left outline-none hover:-translate-y-px hover:border-[var(--line-strong)] focus-visible:border-[var(--accent)] focus-visible:shadow-[0_0_0_3px_var(--focus)]'

const textareaClass =
  'w-full resize-none rounded-lg border border-[var(--line-strong)] bg-white px-3 py-2 text-[13px] text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-slate-400/60 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus)]'

const underlineTab = (active: boolean) =>
  `levv-press -mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 text-[13px] font-medium outline-none focus-visible:text-slate-950 ${
    active
      ? 'border-blue-600 text-slate-950'
      : 'border-transparent text-slate-500 hover:text-slate-900'
  }`

function NovaMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-[var(--rail)] text-[var(--nova)] ${
        size === 'sm' ? 'h-5 w-5 rounded' : 'h-8 w-8 rounded-lg'
      }`}
    >
      <Sparkles className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
    </span>
  )
}

// ─── Attachment Upload ────────────────────────────────────────────────────────

function AttachmentUpload() {
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const arr = Array.from(incoming)
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...arr.filter(f => !existing.has(f.name + f.size))]
    })
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer select-none items-center gap-2.5 rounded-lg border border-dashed px-3.5 py-3 text-[13px] transition-[background-color,border-color,color] duration-150 ease-out ${
          dragging
            ? 'border-blue-600 bg-blue-50 text-blue-700'
            : 'border-[var(--line-strong)] bg-[var(--surface-sunken)] text-slate-500 hover:border-slate-400/60 hover:bg-white'
        }`}
      >
        <Paperclip className="h-4 w-4 flex-shrink-0" />
        <span>{dragging ? 'Drop files here…' : 'Drag files or click to upload'}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2.5 px-3 py-2"
            >
              <span className="flex-shrink-0">{fileIcon(file.name)}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">
                {file.name}
              </span>
              <span className="flex-shrink-0 text-xs tabular-nums text-slate-500">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={e => { e.stopPropagation(); removeFile(i) }}
                className="levv-press ml-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-rose-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-slate-950">{children}</h3>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="text-[13px] font-medium text-slate-700">{children}</label>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function TextInput({ placeholder, defaultValue, type = 'text', readOnly }: {
  placeholder?: string; defaultValue?: string; type?: string; readOnly?: boolean
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      defaultValue={defaultValue}
      readOnly={readOnly}
      className={`${levvUi.input} ${readOnly ? 'levv-readonly-input cursor-default' : ''}`}
    />
  )
}

function SelectInput({ options, placeholder }: { options: string[]; placeholder?: string }) {
  return (
    <LevvSelect>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o}>{o}</option>)}
    </LevvSelect>
  )
}

function TextAreaInput({ placeholder, rows = 3 }: { placeholder?: string; rows?: number }) {
  return (
    <textarea
      placeholder={placeholder}
      rows={rows}
      className={textareaClass}
    />
  )
}

function NovaHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5">
      <NovaMark size="sm" />
      <p className="text-[13px] leading-relaxed text-slate-700">
        <span className="font-semibold text-slate-900">Nova AI: </span>{children}
      </p>
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>
}

function FormDivider() {
  return <hr className="border-[var(--line)]" />
}

function RecordSummary({
  code,
  title,
  reference,
  facts,
}: {
  code?: string
  title: string
  reference: string
  facts: [string, React.ReactNode][]
}) {
  return (
    <div className="rounded-lg bg-[var(--surface-sunken)] px-4 py-3.5 text-[13px]">
      <div className="flex items-center gap-2">
        {code ? (
          <span className="rounded border border-[var(--line)] bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {code}
          </span>
        ) : null}
        <p className="font-semibold text-slate-950">{title}</p>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{reference}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-medium tabular-nums text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ─── Change type checkbox selector ───────────────────────────────────────────

function ChangeTypeSelector({
  options,
  selected,
  onToggle,
}: {
  options: { id: ChangeType; label: string; sub: string }[]
  selected: Set<ChangeType>
  onToggle: (id: ChangeType) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(opt => {
        const active = selected.has(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            role="checkbox"
            aria-checked={active}
            onClick={() => onToggle(opt.id)}
            className={`levv-press rounded-lg border p-3 text-left outline-none focus-visible:shadow-[0_0_0_3px_var(--focus)] ${
              active
                ? 'border-blue-600 bg-blue-50/60'
                : 'border-[var(--line)] bg-white hover:border-[var(--line-strong)] hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
                active ? 'border-blue-600 bg-blue-600' : 'border-[var(--line-strong)] bg-white'
              }`}>
                {active && (
                  <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-[13px] font-medium leading-tight text-slate-900">
                  {opt.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {opt.sub}
                </p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Justification & submission ───────────────────────────────────────────────

function JustificationSection() {
  return (
    <div className="space-y-4">
      <SectionLabel>Justification &amp; submission</SectionLabel>
      <div>
        <FieldLabel hint="Visible to all approvers in the chain">Business justification</FieldLabel>
        <TextAreaInput placeholder="Why is this change needed? This will be visible to approvers." rows={3} />
      </div>
      <div>
        <FieldLabel>Urgency</FieldLabel>
        <SelectInput options={['Standard — within normal SLA', 'Urgent — escalate immediately']} />
      </div>
      <div>
        <FieldLabel hint="Revised scope documents, amended SOW, supporting materials">Attachments</FieldLabel>
        <AttachmentUpload />
      </div>
      <NovaHint>
        Nova will evaluate all requested changes against company policy and route to the appropriate approval chain. Admin-only changes are auto-approved. Financial and scope changes route based on magnitude.
      </NovaHint>
    </div>
  )
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({
  onClose,
  recordTitle,
  changeType,
}: {
  onClose: () => void
  recordTitle: string
  changeType: string
}) {
  const refNumber = `CR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

  return (
    <div className="flex flex-col items-center px-2 pb-2 pt-4 text-center sm:px-6">
      <CheckCircle2 className="h-9 w-9 text-emerald-600" strokeWidth={1.75} />
      <h3 className="mt-4 text-lg font-semibold text-slate-950">Change request submitted</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
        Your request for <span className="font-medium text-slate-800">{recordTitle}</span> has been
        received and is pending review.
      </p>

      <dl className="mt-6 w-full divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] text-left text-[13px]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <dt className="text-slate-500">Reference</dt>
          <dd className="font-mono font-semibold text-slate-900">{refNumber}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <dt className="text-slate-500">Type</dt>
          <dd className="font-medium text-slate-900">{changeType}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <dt className="text-slate-500">Status</dt>
          <dd>
            <LevvStatusBadge tone="amber">Pending approval</LevvStatusBadge>
          </dd>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <dt className="text-slate-500">Submitted</dt>
          <dd className="font-medium tabular-nums text-slate-900">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex w-full items-start gap-2.5 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5 text-left">
        <NovaMark size="sm" />
        <p className="text-[13px] leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">What happens next: </span>
          Nova will route this to the appropriate approvers based on change type and magnitude. You'll receive an email notification when action is taken.
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className={`${levvUi.primaryButton} mt-6 w-full`}
      >
        Done
      </button>
    </div>
  )
}

// ─── Contingent WO Form ───────────────────────────────────────────────────────

const contingentChangeOptions: { id: ChangeType; label: string; sub: string }[] = [
  { id: 'extend_end_date', label: 'Extend end date', sub: 'Push the engagement further out' },
  { id: 'adjust_rate', label: 'Adjust rate', sub: 'Change bill rate or pay rate' },
  { id: 'early_termination', label: 'Early termination', sub: 'End the engagement early' },
  { id: 'admin_ownership', label: 'Admin / ownership', sub: 'Cost center, site, owner' },
  { id: 'close_worker', label: 'Close worker', sub: 'Work is done, close the record' },
]

function ContingentForm({ record }: { record: WorkRecord }) {
  const [selected, setSelected] = useState<Set<ChangeType>>(new Set<ChangeType>(['extend_end_date']))

  const toggle = (id: ChangeType) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-5">
      <RecordSummary
        title={record.title}
        reference={`WO-2024-3291 (Rev. 2) · ${record.supplier}`}
        facts={[
          ['Bill rate (ST)', record.rate],
          ['Rate card max (ST)', record.rateMax],
          ['Engagement', record.engagement],
          ['Committed spend', record.committedSpend],
        ]}
      />

      <div>
        <FieldLabel>What needs to change?</FieldLabel>
        <ChangeTypeSelector options={contingentChangeOptions} selected={selected} onToggle={toggle} />
      </div>

      <FormDivider />

      {selected.has('extend_end_date') && (
        <div className="space-y-3">
          <SectionLabel>Extension details</SectionLabel>
          <FieldRow>
            <div>
              <FieldLabel>Current end date</FieldLabel>
              <TextInput defaultValue={record.meta.replace('Ends ', '')} readOnly />
            </div>
            <div>
              <FieldLabel>Requested new end date</FieldLabel>
              <TextInput type="date" placeholder="yyyy-mm-dd" />
            </div>
          </FieldRow>
          <div>
            <FieldLabel>Additional budget needed?</FieldLabel>
            <SelectInput options={[
              'No — same rate, longer timeline',
              'Yes — I need additional budget',
            ]} />
          </div>
        </div>
      )}

      {selected.has('adjust_rate') && (
        <div className="space-y-3">
          <SectionLabel>Rate adjustment</SectionLabel>
          <FieldRow>
            <div>
              <FieldLabel>Current bill rate (ST)</FieldLabel>
              <TextInput defaultValue={record.rate} readOnly />
            </div>
            <div>
              <FieldLabel>Requested bill rate (ST)</FieldLabel>
              <TextInput placeholder="e.g. $105.00 /hr" />
            </div>
          </FieldRow>
          <div>
            <FieldLabel>Reason for rate change</FieldLabel>
            <SelectInput placeholder="Select reason..." options={[
              'Market adjustment',
              'Role change / promotion',
              'Contract renewal',
              'Correction',
              'Other',
            ]} />
          </div>
          <NovaHint>
            Rates above the card maximum ({record.rateMax}) are flagged as a rate exception. Under 10% above card: manager approval. 10–25%: director. Over 25%: VP + finance.
          </NovaHint>
        </div>
      )}

      {selected.has('early_termination') && (
        <div className="space-y-3">
          <SectionLabel>Early termination</SectionLabel>
          <div>
            <FieldLabel>Last working day</FieldLabel>
            <TextInput type="date" placeholder="yyyy-mm-dd" />
          </div>
          <div>
            <FieldLabel>Reason</FieldLabel>
            <SelectInput options={[
              'Project completed early',
              'Budget reduction',
              'Performance',
              'Role eliminated',
              'Other',
            ]} />
          </div>
          <div>
            <FieldLabel>Allow time/expense submission after close?</FieldLabel>
            <SelectInput options={[
              'Yes — outstanding time may still be submitted',
              'No — close immediately',
            ]} />
          </div>
        </div>
      )}

      {selected.has('admin_ownership') && (
        <div className="space-y-3">
          <SectionLabel>Administrative changes</SectionLabel>
          <div>
            <FieldLabel>What needs to change?</FieldLabel>
            <TextAreaInput placeholder="e.g. Transfer ownership to Jane Smith, change cost center to CC-3200, update site to New York" rows={2} />
          </div>
        </div>
      )}

      {selected.has('close_worker') && (
        <div className="space-y-3">
          <SectionLabel>Close worker</SectionLabel>
          <div>
            <FieldLabel>Actual end date</FieldLabel>
            <TextInput type="date" placeholder="yyyy-mm-dd" />
          </div>
          <div>
            <FieldLabel>Reason</FieldLabel>
            <SelectInput options={[
              'Assignment completed',
              'Early termination',
              'Converted to FTE',
              'Other',
            ]} />
          </div>
          <div>
            <FieldLabel>Allow invoicing after close?</FieldLabel>
            <SelectInput options={['Yes', 'No']} />
          </div>
        </div>
      )}

      <FormDivider />
      <JustificationSection />
    </div>
  )
}

// ─── SOW Form ─────────────────────────────────────────────────────────────────

const sowChangeOptions: { id: ChangeType; label: string; sub: string }[] = [
  { id: 'extend_end_date', label: 'Extend end date', sub: 'Push the SOW end date further out' },
  { id: 'adjust_budget', label: 'Adjust budget', sub: 'Increase or decrease max budget' },
  { id: 'change_scope', label: 'Change scope', sub: 'Add, remove, or modify deliverables' },
  { id: 'change_workers', label: 'Change workers', sub: 'Add, remove, or swap resources' },
  { id: 'admin_ownership', label: 'Admin / ownership', sub: 'Owner, cost center, site, GLA' },
  { id: 'close_sow', label: 'Close the SOW', sub: 'Work is complete, close it out' },
]

function SowForm({ record }: { record: WorkRecord }) {
  const [selected, setSelected] = useState<Set<ChangeType>>(
    new Set<ChangeType>(['extend_end_date'])
  )

  const toggle = (id: ChangeType) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-5">
      <RecordSummary
        code="SOW"
        title={record.title}
        reference={`SOW-2024-0847 (v2) · ${record.supplier}`}
        facts={[
          ['Max budget', record.maxBudget],
          ['Spent to date', record.spentToDate],
          ['Engagement', record.engagement],
          ['Workers', `${record.workers} active`],
        ]}
      />

      <div>
        <FieldLabel>What do you need to change?</FieldLabel>
        <ChangeTypeSelector options={sowChangeOptions} selected={selected} onToggle={toggle} />
      </div>

      <FormDivider />

      {selected.has('extend_end_date') && (
        <div className="space-y-3">
          <SectionLabel>Extension details</SectionLabel>
          <FieldRow>
            <div>
              <FieldLabel>Current end date</FieldLabel>
              <TextInput defaultValue={record.meta.replace('Ends ', '')} readOnly />
            </div>
            <div>
              <FieldLabel>Requested new end date</FieldLabel>
              <TextInput type="date" placeholder="yyyy-mm-dd" />
            </div>
          </FieldRow>
          <div>
            <FieldLabel>Extend all worker end dates to match?</FieldLabel>
            <SelectInput options={[
              'Yes — extend all workers to new SOW end date',
              'No — keep individual worker dates',
            ]} />
          </div>
          <div>
            <FieldLabel>Additional budget needed?</FieldLabel>
            <SelectInput options={[
              'No — same budget, longer timeline',
              'Yes — I need additional budget',
            ]} />
          </div>
        </div>
      )}

      {selected.has('adjust_budget') && (
        <div className="space-y-3">
          <SectionLabel>Budget adjustment</SectionLabel>
          <FieldRow>
            <div>
              <FieldLabel>Current budget</FieldLabel>
              <TextInput defaultValue={record.maxBudget} readOnly />
            </div>
            <div>
              <FieldLabel>Requested new budget</FieldLabel>
              <TextInput placeholder="e.g. $300,000" />
            </div>
          </FieldRow>
          <div>
            <FieldLabel>Reason for adjustment</FieldLabel>
            <TextAreaInput placeholder="What's driving the budget change? (e.g., scope expansion, rate change, timeline extension)" rows={2} />
          </div>
          <NovaHint>
            Budget increases route to approval based on the increment: under $25K requires manager approval, $25K–$100K requires director, over $100K requires VP + finance.
          </NovaHint>
        </div>
      )}

      {selected.has('change_scope') && (
        <div className="space-y-3">
          <SectionLabel>Scope changes</SectionLabel>
          <div>
            <FieldLabel>Describe the scope change</FieldLabel>
            <TextAreaInput placeholder="What deliverables, milestones, or line items need to change? Be specific — this goes directly to your procurement contact." rows={3} />
          </div>
          <div>
            <FieldLabel>Impact on timeline?</FieldLabel>
            <SelectInput options={[
              'No timeline impact',
              'Requires timeline extension',
              'Reduces timeline',
            ]} />
          </div>
        </div>
      )}

      {selected.has('change_workers') && (
        <div className="space-y-3">
          <SectionLabel>Worker changes</SectionLabel>
          <div>
            <FieldLabel>What needs to change?</FieldLabel>
            <SelectInput options={[
              'Add new worker(s)',
              'Remove a worker',
              'Swap / replace a worker',
              'Change worker role or rate',
            ]} />
          </div>
          <div>
            <FieldLabel>Details</FieldLabel>
            <TextAreaInput placeholder="Provide names, roles, or any specifics. Procurement will coordinate with the supplier." rows={2} />
          </div>
        </div>
      )}

      {selected.has('admin_ownership') && (
        <div className="space-y-3">
          <SectionLabel>Administrative changes</SectionLabel>
          <div>
            <FieldLabel>What needs to change?</FieldLabel>
            <TextAreaInput placeholder="e.g. Transfer ownership to Jane Smith, change cost center to CC-3200, update site to New York" rows={2} />
          </div>
        </div>
      )}

      {selected.has('close_sow') && (
        <div className="space-y-3">
          <SectionLabel>Close SOW</SectionLabel>
          <div>
            <FieldLabel>Allow invoicing after close?</FieldLabel>
            <SelectInput options={[
              'Yes — supplier may have outstanding invoices',
              'No — stop all invoicing immediately',
            ]} />
          </div>
          <div>
            <FieldLabel>Close all workers at the same time?</FieldLabel>
            <SelectInput options={[
              'Yes — close all with SOW end date',
              'No — workers close on their own dates',
            ]} />
          </div>
          <div>
            <FieldLabel>Notes</FieldLabel>
            <TextAreaInput placeholder="Any context for procurement? (e.g. project completed early, deliverables accepted)" rows={2} />
          </div>
        </div>
      )}

      <FormDivider />
      <JustificationSection />
    </div>
  )
}

// ─── Profile Worker Form ──────────────────────────────────────────────────────

const profileChangeOptions: { id: ChangeType; label: string; sub: string }[] = [
  { id: 'update_details', label: 'Update details', sub: 'Site, department, dates, role' },
  { id: 'change_contact', label: 'Change contact', sub: 'Transfer to someone else' },
  { id: 'close_record', label: 'Close record', sub: 'Engagement is over' },
]

function ProfileForm({
  record,
  onSubmit,
}: {
  record: WorkRecord
  onSubmit: () => void
}) {
  const [selected, setSelected] = useState<Set<ChangeType>>(
    new Set<ChangeType>(['update_details'])
  )

  const toggle = (id: ChangeType) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-5">
      <RecordSummary
        code="PW"
        title={record.title}
        reference="PW-2024-0388 · Strategy"
        facts={[
          ['Site', 'Toronto, ON'],
          ['Department', 'Strategy'],
          ['Since', 'Mar 1, 2024'],
          ['Status', 'Active — ongoing'],
        ]}
      />

      <div>
        <FieldLabel>What needs to change?</FieldLabel>
        <ChangeTypeSelector options={profileChangeOptions} selected={selected} onToggle={toggle} />
      </div>

      <FormDivider />

      {selected.has('update_details') && (
        <div className="space-y-3">
          <SectionLabel>Update details</SectionLabel>
          <FieldRow>
            <div>
              <FieldLabel>Site</FieldLabel>
              <SelectInput options={['Toronto, ON', 'New York, NY', 'Chicago, IL', 'Remote']} />
            </div>
            <div>
              <FieldLabel>Department</FieldLabel>
              <TextInput defaultValue="Strategy" />
            </div>
          </FieldRow>
          <div>
            <FieldLabel>Role / description</FieldLabel>
            <TextInput defaultValue="Independent advisor" />
          </div>
          <FieldRow>
            <div>
              <FieldLabel>Start date</FieldLabel>
              <TextInput defaultValue="Mar 1, 2024" readOnly />
            </div>
            <div>
              <FieldLabel hint="Set a date to schedule automatic close">End date</FieldLabel>
              <TextInput type="date" placeholder="yyyy-mm-dd" />
            </div>
          </FieldRow>
        </div>
      )}

      {selected.has('change_contact') && (
        <div className="space-y-3">
          <SectionLabel>Change primary contact</SectionLabel>
          <div>
            <FieldLabel>Current primary contact</FieldLabel>
            <TextInput placeholder="You..." readOnly />
          </div>
          <div>
            <FieldLabel>New primary contact</FieldLabel>
            <TextInput placeholder="Start typing name..." />
          </div>
        </div>
      )}

      {selected.has('close_record') && (
        <div className="space-y-3">
          <SectionLabel>Close record</SectionLabel>
          <div>
            <FieldLabel>Actual end date</FieldLabel>
            <TextInput type="date" placeholder="yyyy-mm-dd" />
          </div>
          <div>
            <FieldLabel>Reason</FieldLabel>
            <SelectInput options={[
              'Engagement ended',
              'Converted to FTE',
              'Left the company',
              'Other',
            ]} />
          </div>
        </div>
      )}

      <FormDivider />

      <div>
        <FieldLabel hint="Attach any supporting documents">Attachments</FieldLabel>
        <AttachmentUpload />
      </div>

      <NovaHint>
        Profile worker changes are auto-approved and take effect immediately. All changes are logged in the audit trail.
      </NovaHint>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" className={levvUi.secondaryButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className={levvUi.primaryButton}
        >
          Save changes
        </button>
      </div>
    </div>
  )
}

// ─── Change Request Modal ─────────────────────────────────────────────────────

type ModalTab = 'contingent' | 'sow' | 'profile'

function ChangeRequestModal({
  record,
  onClose,
}: {
  record: WorkRecord
  onClose: () => void
}) {
  const [activeModalTab, setActiveModalTab] = useState<ModalTab>(record.type as ModalTab)
  const [submitted, setSubmitted] = useState(false)

  const modalTabs: { id: ModalTab; label: string }[] = [
    { id: 'contingent', label: 'Contingent (WO)' },
    { id: 'sow', label: 'SOW' },
    { id: 'profile', label: 'Profile worker' },
  ]

  const activeRecord = workRecords.find(r => r.type === activeModalTab) ?? record

  const changeTypeLabel =
    activeModalTab === 'contingent'
      ? 'Worker change request'
      : activeModalTab === 'sow'
      ? 'SOW change request'
      : 'Profile worker update'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 duration-200 animate-in fade-in sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Change request forms"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-xl duration-200 animate-in fade-in zoom-in-95"
      >

        {/* Header */}
        {!submitted && (
          <div className="flex-shrink-0 border-b border-[var(--line)] px-6 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-950">Change request forms</h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Tell us what needs to change. Procurement will review and action it directly.
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Requests / Change request /{' '}
                  <span className="text-slate-700">
                    {activeModalTab === 'contingent' ? 'Contingent worker' : activeModalTab === 'sow' ? 'Statement of work' : 'Profile worker'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className={`${levvUi.ghostButton} -mr-2 w-9 px-0`}
              >
                <X />
              </button>
            </div>

            <div role="tablist" aria-label="Change request type" className="mt-3 flex gap-5 overflow-x-auto">
              {modalTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeModalTab === tab.id}
                  onClick={() => { setActiveModalTab(tab.id); setSubmitted(false) }}
                  className={underlineTab(activeModalTab === tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Close button for success screen */}
        {submitted && (
          <div className="flex flex-shrink-0 justify-end px-4 pt-4">
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className={`${levvUi.ghostButton} w-9 px-0`}
            >
              <X />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {submitted ? (
            <SuccessScreen
              onClose={onClose}
              recordTitle={activeRecord.title}
              changeType={changeTypeLabel}
            />
          ) : (
            <>
              <h3 className="text-lg font-semibold text-slate-950">
                {changeTypeLabel}
              </h3>
              <p className="mb-5 mt-0.5 text-[13px] text-slate-500">
                {activeModalTab === 'contingent'
                  ? 'Tell us what needs to change. Procurement will review and execute the work order revision.'
                  : activeModalTab === 'sow'
                  ? 'Tell us what needs to change. Procurement will review and action it directly.'
                  : "Update this worker's record. Most changes are auto-approved."}
              </p>

              {activeModalTab === 'contingent' && <ContingentForm record={activeRecord} />}
              {activeModalTab === 'sow' && <SowForm record={activeRecord} />}
              {activeModalTab === 'profile' && (
                <ProfileForm record={activeRecord} onSubmit={() => setSubmitted(true)} />
              )}
            </>
          )}
        </div>

        {/* Footer — only for contingent and SOW, and only before submission */}
        {!submitted && activeModalTab !== 'profile' && (
          <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-[var(--line)] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className={levvUi.secondaryButton}
            >
              Save as draft
            </button>
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              className={levvUi.primaryButton}
            >
              Submit change request
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Nova modal ───────────────────────────────────────────────────────────────

function NovaModal({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const prompts = [
    'Do I need procurement approval for a rate increase?',
    'What change type should I use for extending a SOW?',
    'What is the normal approval path for worker end-date changes?',
    'How many suppliers can support this role?',
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 p-4 duration-200 animate-in fade-in sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ask Nova"
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-xl duration-200 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
          <div className="flex items-center gap-3">
            <NovaMark />
            <div>
              <h2 className="text-base font-semibold text-slate-950">Ask Nova</h2>
              <p className="text-[13px] text-slate-500">Policy, rate, approval, or process questions</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`${levvUi.ghostButton} -mr-2 w-9 px-0`}
          >
            <X />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <p className="mb-2 text-xs text-slate-500">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {prompts.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setQuestion(p); setSubmitted(false) }}
                  className="levv-press rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-left text-[13px] text-slate-700 hover:border-[var(--line-strong)] hover:bg-slate-50 hover:text-slate-900"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="nova-question" className="mb-1.5 block text-[13px] font-medium text-slate-700">Your question</label>
            <textarea
              id="nova-question"
              value={question}
              onChange={e => { setQuestion(e.target.value); setSubmitted(false) }}
              placeholder="Type your question for Nova..."
              rows={4}
              className={textareaClass}
            />
          </div>

          {submitted && (
            <LevvNotice tone="emerald" icon={CheckCircle2}>
              Nova has received your question and will respond shortly.
            </LevvNotice>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-6 py-4">
          <button type="button" onClick={onClose} className={levvUi.secondaryButton}>
            Close
          </button>
          <button
            type="button"
            onClick={() => question.trim() && setSubmitted(true)}
            disabled={!question.trim()}
            className={levvUi.primaryButton}
          >
            <Send />
            Ask Nova
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewRequestPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('all')
  const [search, setSearch] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<WorkRecord | null>(null)
  const [showNova, setShowNova] = useState(false)

  const counts = useMemo(() => ({
    all: workRecords.length,
    contingent: workRecords.filter(r => r.type === 'contingent').length,
    sow: workRecords.filter(r => r.type === 'sow').length,
    profile: workRecords.filter(r => r.type === 'profile').length,
  }), [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return workRecords.filter(r => {
      const matchTab = activeTab === 'all' || r.type === activeTab
      const matchSearch = !q || r.title.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q)
      return matchTab && matchSearch
    })
  }, [activeTab, search])

  return (
    <LevvPage width="standard">
      <div className="space-y-10">
        <LevvPageHeader
          title="New request"
          description="Start a new engagement or request a change to existing work."
        />

        {/* ── New engagement ─────────────────────────────────────────── */}
        <section aria-labelledby="new-engagement-heading" className="space-y-3">
          <h2 id="new-engagement-heading" className="text-[15px] font-semibold text-slate-950">
            New engagement
          </h2>

          <button
            type="button"
            onClick={() => router.push('/requests/new/guided')}
            className={`${choiceClass} flex w-full items-center gap-3.5 px-4 py-3.5`}
          >
            <NovaMark />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-950">Help me figure out what I need</span>
              <span className="mt-0.5 block text-[13px] text-slate-500">Nova will ask a few questions and route you to the right path</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-[color,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-slate-700" />
          </button>

          <div className="grid gap-3 sm:grid-cols-3">
            {newEngagementCards.map(card => {
              const Icon = card.icon
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => router.push(card.route)}
                  className={`${choiceClass} flex flex-col p-4`}
                >
                  <span className="flex w-full items-center justify-between">
                    <Icon className="h-4 w-4 text-slate-500" />
                    <ArrowRight className="h-4 w-4 text-slate-300 transition-[color,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-slate-600" />
                  </span>
                  <span className="mt-6 text-sm font-semibold text-slate-950">{card.title}</span>
                  <span className="mt-0.5 text-[13px] text-slate-500">{card.subtitle}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Change existing work ───────────────────────────────────── */}
        <section aria-labelledby="change-work-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 id="change-work-heading" className="text-[15px] font-semibold text-slate-950">
              Change existing work
            </h2>
            <button
              type="button"
              onClick={() => router.push('/requests')}
              className="levv-press rounded-md text-[13px] font-medium text-blue-700 outline-none hover:text-blue-800 focus-visible:shadow-[0_0_0_3px_var(--focus)]"
            >
              View all workforce
            </button>
          </div>

          <div className="flex flex-col-reverse gap-3 border-b border-[var(--line)] sm:flex-row sm:items-end sm:justify-between">
            <div role="tablist" aria-label="Record type" className="flex gap-5 overflow-x-auto">
              {tabs.map(tab => {
                const count = counts[tab.id]
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={underlineTab(active)}
                  >
                    {tab.label}
                    <span className={`tabular-nums ${active ? 'text-slate-500' : 'text-slate-400'}`}>{count}</span>
                  </button>
                )
              })}
            </div>
            <LevvSearchField
              className="w-full sm:mb-2 sm:w-72"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, supplier, or ID..."
              aria-label="Search by name, supplier, or ID"
            />
          </div>

          {/* Records list */}
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
            {filtered.length === 0 ? (
              <LevvEmptyState icon={Search} title="No matching records">
                Try a different search or switch tabs.
              </LevvEmptyState>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {filtered.map(record => (
                  <li
                    key={record.id}
                    className="flex flex-col gap-2.5 px-4 py-3 transition-colors duration-150 hover:bg-[var(--surface-sunken)] sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-6 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-sunken)] text-[11px] font-semibold text-slate-600">
                        {typeCode(record.type)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-950">{record.title}</p>
                        <p className="mt-0.5 truncate text-xs tabular-nums text-slate-500">
                          {record.type === 'sow'
                            ? `${record.maxBudget} · ${record.workers} worker${record.workers !== 1 ? 's' : ''} · ${record.meta}`
                            : `${record.supplier} · ${record.meta}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(record)}
                      className={`${levvUi.secondaryButton} ml-[52px] self-start sm:ml-0 sm:self-auto`}
                    >
                      Request change
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Nova bar */}
          <button
            type="button"
            onClick={() => setShowNova(true)}
            className="levv-press flex h-10 w-full items-center gap-2.5 rounded-lg border border-[var(--line-strong)] bg-white pl-1.5 pr-3 text-left outline-none hover:border-slate-400/60 focus-visible:border-[var(--accent)] focus-visible:shadow-[0_0_0_3px_var(--focus)]"
          >
            <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--rail)] text-[var(--nova)]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-[13px] text-slate-500">Ask Nova — policy questions, rate guidance, process help...</span>
          </button>
        </section>
      </div>

      {/* Modals */}
      {selectedRecord && (
        <ChangeRequestModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
      {showNova && <NovaModal onClose={() => setShowNova(false)} />}
    </LevvPage>
  )
}

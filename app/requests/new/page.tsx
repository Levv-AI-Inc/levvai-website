'use client'

import { useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import MotionWrapper from '@/components/motion/MotionWrapper'
import {
  ArrowRight,
  BriefcaseBusiness,
  FileText,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
  ChevronDown,
  Paperclip,
  CheckCircle2,
  File,
  Image,
  FileSpreadsheet,
} from 'lucide-react'

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

const newEngagementCards = [
  {
    id: 'job',
    title: 'Job posting',
    subtitle: 'Hire a contractor',
    route: '/requests/new/job/create/define',
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    color: 'text-emerald-700',
    bg: 'bg-emerald-100',
    cardBg: 'bg-gradient-to-br from-emerald-50 to-teal-50/60',
    cardBorder: 'border-emerald-200',
    cardHover: 'hover:border-emerald-300 hover:shadow-emerald-100/80',
    accent: 'bg-emerald-500',
  },
  {
    id: 'sow',
    title: 'Statement of work',
    subtitle: 'Services / outcomes',
    route: '/requests/new/sow',
    icon: <FileText className="h-5 w-5" />,
    color: 'text-violet-700',
    bg: 'bg-violet-100',
    cardBg: 'bg-gradient-to-br from-violet-50 to-purple-50/60',
    cardBorder: 'border-violet-200',
    cardHover: 'hover:border-violet-300 hover:shadow-violet-100/80',
    accent: 'bg-violet-500',
  },
  {
    id: 'profile-worker',
    title: 'Track a worker',
    subtitle: 'Visibility only',
    route: '/requests/new/profile',
    icon: <UserRound className="h-5 w-5" />,
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    cardBg: 'bg-gradient-to-br from-amber-50 to-orange-50/60',
    cardBorder: 'border-amber-200',
    cardHover: 'hover:border-amber-300 hover:shadow-amber-100/80',
    accent: 'bg-amber-500',
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

function typePillStyles(type: WorkRecordType) {
  switch (type) {
    case 'contingent': return 'bg-emerald-50 text-emerald-700 border-emerald-100'
    case 'sow': return 'bg-violet-50 text-violet-700 border-violet-100'
    case 'profile': return 'bg-amber-50 text-amber-700 border-amber-100'
  }
}

function typeAccentBar(type: WorkRecordType) {
  switch (type) {
    case 'contingent': return 'bg-emerald-400'
    case 'sow': return 'bg-violet-400'
    case 'profile': return 'bg-amber-400'
  }
}

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
    return <Image className="h-4 w-4 text-blue-400" />
  if (['xls', 'xlsx', 'csv'].includes(ext ?? ''))
    return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
  if (['pdf'].includes(ext ?? ''))
    return <FileText className="h-4 w-4 text-red-400" />
  return <File className="h-4 w-4 text-slate-400" />
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
        className={`flex cursor-pointer items-center gap-2.5 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-all select-none ${
          dragging
            ? 'border-blue-400 bg-blue-50 text-blue-600'
            : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-white'
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
        <div className="space-y-1.5">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <span className="flex-shrink-0">{fileIcon(file.name)}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">
                {file.name}
              </span>
              <span className="flex-shrink-0 text-[11px] text-slate-400">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeFile(i) }}
                className="ml-1 flex-shrink-0 rounded p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[13px] font-semibold text-slate-800">{children}</h3>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1">
      <label className="text-[13px] font-medium text-slate-700">{children}</label>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
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
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition
        ${readOnly
          ? 'border-slate-100 bg-slate-50 text-slate-500 cursor-default'
          : 'border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
        }`}
    />
  )
}

function SelectInput({ options, placeholder }: { options: string[]; placeholder?: string }) {
  return (
    <div className="relative">
      <select className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
}

function TextAreaInput({ placeholder, rows = 3 }: { placeholder?: string; rows?: number }) {
  return (
    <textarea
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 resize-none"
    />
  )
}

function NovaHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
      <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
      <p className="text-[12px] text-blue-800 leading-relaxed">
        <span className="font-semibold">Nova AI: </span>{children}
      </p>
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function FormDivider() {
  return <hr className="border-slate-100" />
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
    <div className="grid grid-cols-2 gap-2">
      {options.map(opt => {
        const active = selected.has(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={`rounded-xl border p-3 text-left transition-all ${
              active
                ? 'border-blue-300 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-2">
              <div className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                active ? 'border-blue-500 bg-blue-500' : 'border-slate-300 bg-white'
              }`}>
                {active && (
                  <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-[13px] font-medium leading-tight ${active ? 'text-blue-900' : 'text-slate-800'}`}>
                  {opt.label}
                </p>
                <p className={`mt-0.5 text-[11px] ${active ? 'text-blue-600' : 'text-slate-400'}`}>
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
    <div className="flex flex-col items-center px-8 py-10 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      </div>
      <h3 className="text-[20px] font-semibold text-slate-900">Change request submitted</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500 leading-relaxed">
        Your request for <span className="font-medium text-slate-700">{recordTitle}</span> has been
        received and is pending review.
      </p>

      <div className="mt-6 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Reference</span>
          <span className="font-mono font-semibold text-slate-800">{refNumber}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Type</span>
          <span className="font-medium text-slate-800">{changeType}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Status</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700 border border-amber-100">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Pending approval
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Submitted</span>
          <span className="font-medium text-slate-800">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="mt-5 w-full rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-left">
        <p className="text-[12px] text-blue-800 leading-relaxed">
          <span className="font-semibold">What happens next: </span>
          Nova will route this to the appropriate approvers based on change type and magnitude. You'll receive an email notification when action is taken.
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black"
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
  const [selected, setSelected] = useState<Set<ChangeType>>(new Set(['extend_end_date']))

  const toggle = (id: ChangeType) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] space-y-1.5">
        <p className="font-semibold text-slate-900">{record.title}</p>
        <p className="text-slate-400 text-[11px]">WO-2024-3291 (Rev. 2) · {record.supplier}</p>
        <div className="pt-1 grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-slate-500">Bill rate (ST)</span><span className="text-right font-medium text-slate-800">{record.rate}</span>
          <span className="text-slate-500">Rate card max (ST)</span><span className="text-right font-medium text-slate-800">{record.rateMax}</span>
          <span className="text-slate-500">Engagement</span><span className="text-right font-medium text-slate-800">{record.engagement}</span>
          <span className="text-slate-500">Committed spend</span><span className="text-right font-medium text-slate-800">{record.committedSpend}</span>
        </div>
      </div>

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
    new Set(['extend_end_date'])
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
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-100 px-1.5 py-0.5 rounded">SOW</span>
          <p className="font-semibold text-slate-900">{record.title}</p>
        </div>
        <p className="text-slate-400 text-[11px]">SOW-2024-0847 (v2) · {record.supplier}</p>
        <div className="pt-1 grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-slate-500">Max budget</span><span className="text-right font-medium text-slate-800">{record.maxBudget}</span>
          <span className="text-slate-500">Spent to date</span><span className="text-right font-medium text-slate-800">{record.spentToDate}</span>
          <span className="text-slate-500">Engagement</span><span className="text-right font-medium text-slate-800">{record.engagement}</span>
          <span className="text-slate-500">Workers</span><span className="text-right font-medium text-slate-800">{record.workers} active</span>
        </div>
      </div>

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
    new Set(['update_details'])
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
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded">PW</span>
          <p className="font-semibold text-slate-900">{record.title}</p>
        </div>
        <p className="text-slate-400 text-[11px]">PW-2024-0388 · Strategy</p>
        <div className="pt-1 grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-slate-500">Site</span><span className="text-right font-medium text-slate-800">Toronto, ON</span>
          <span className="text-slate-500">Department</span><span className="text-right font-medium text-slate-800">Strategy</span>
          <span className="text-slate-500">Since</span><span className="text-right font-medium text-slate-800">Mar 1, 2024</span>
          <span className="text-slate-500">Status</span><span className="text-right font-medium text-slate-800">Active — ongoing</span>
        </div>
      </div>

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

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black"
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-4 backdrop-blur-[2px] sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[24px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">

        {/* Header */}
        {!submitted && (
          <div className="flex-shrink-0 border-b border-slate-100 px-6 pt-5 pb-0">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900">Change request forms</h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Tell us what needs to change. Procurement will review and action it directly.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-4 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-[11px] text-slate-400">
              Requests / Change request /{' '}
              <span className="text-slate-600">
                {activeModalTab === 'contingent' ? 'Contingent worker' : activeModalTab === 'sow' ? 'Statement of work' : 'Profile worker'}
              </span>
            </p>

            <div className="mt-3 flex gap-1">
              {modalTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setActiveModalTab(tab.id); setSubmitted(false) }}
                  className={`rounded-t-lg px-4 py-2 text-[13px] font-medium transition-colors border border-b-0 ${
                    activeModalTab === tab.id
                      ? 'border-slate-200 bg-white text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Close button for success screen */}
        {submitted && (
          <div className="flex-shrink-0 flex justify-end px-6 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
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
              <h3 className="mb-1 text-[20px] font-semibold text-slate-900">
                {changeTypeLabel}
              </h3>
              <p className="mb-5 text-[13px] text-slate-500">
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
          <div className="flex-shrink-0 flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Save as draft
            </button>
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black"
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] sm:items-center">
      <div className="w-full max-w-2xl rounded-[24px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[17px] font-semibold text-slate-900">Ask Nova</p>
              <p className="mt-0.5 text-sm text-slate-500">Policy, rate, approval, or process questions</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {prompts.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setQuestion(p); setSubmitted(false) }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-300"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Your question</label>
            <textarea
              value={question}
              onChange={e => { setQuestion(e.target.value); setSubmitted(false) }}
              placeholder="Type your question for Nova..."
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 resize-none"
            />
          </div>

          {submitted && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Nova has received your question and will respond shortly.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
            Close
          </button>
          <button
            type="button"
            onClick={() => question.trim() && setSubmitted(true)}
            disabled={!question.trim()}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              question.trim() ? 'bg-slate-900 text-white hover:bg-black' : 'cursor-not-allowed bg-slate-100 text-slate-400'
            }`}
          >
            <Send className="h-4 w-4" />
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
    <MotionWrapper>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">

          {/* Page header */}
          <div className="border-b border-slate-100 px-8 py-7">
            <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">New request</h1>
            <p className="mt-1 text-sm text-slate-500">Start a new engagement or request a change to existing work.</p>
          </div>

          <div className="space-y-8 px-8 py-8">

            {/* ── NEW ENGAGEMENT ─────────────────────────────────────────── */}
            <section className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">New engagement</p>

              {/* Nova card */}
              <button
                type="button"
                onClick={() => router.push('/requests/new/guided')}
                className="group flex w-full items-center justify-between rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50/60 px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md hover:shadow-sky-100/80"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-slate-900">Help me figure out what I need</p>
                    <p className="mt-0.5 text-sm text-slate-500">Nova will ask a few questions and route you to the right path</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </button>

              {/* 3 tiles */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {newEngagementCards.map(card => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => router.push(card.route)}
                    className={`group rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${card.cardBg} ${card.cardBorder} ${card.cardHover}`}
                  >
                    <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.bg} ${card.color} transition-colors`}>
                      {card.icon}
                    </div>
                    <p className="text-[14px] font-semibold text-slate-900">{card.title}</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">{card.subtitle}</p>
                    <div className={`mt-3 h-0.5 w-8 rounded-full ${card.accent} opacity-50 transition-all group-hover:w-12 group-hover:opacity-100`} />
                  </button>
                ))}
              </div>
            </section>

            {/* ── CHANGE EXISTING WORK ───────────────────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Change existing work</p>
                <button
                  type="button"
                  onClick={() => router.push('/requests')}
                  className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
                >
                  View all workforce
                </button>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">

                {/* Tabs */}
                <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-3">
                  {tabs.map(tab => {
                    const count = counts[tab.id]
                    const active = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative px-3 py-1.5 text-sm font-medium transition-all ${
                          active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {tab.label} <span className={active ? 'text-slate-600' : 'text-slate-300'}>{count}</span>
                        {active && (
                          <span className="absolute -bottom-3 left-0 right-0 h-0.5 rounded-full bg-blue-500" />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, supplier, or ID..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                {/* Records list */}
                <div className="space-y-2">
                  {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
                      <p className="text-sm font-medium text-slate-600">No matching records</p>
                      <p className="mt-1 text-sm text-slate-400">Try a different search or switch tabs.</p>
                    </div>
                  ) : (
                    filtered.map(record => (
                      <div
                        key={record.id}
                        className="flex items-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white"
                      >
                        {/* Colored accent bar */}
                        <div className={`w-1 self-stretch flex-shrink-0 ${typeAccentBar(record.type)}`} />

                        <div className={`flex h-8 w-10 flex-shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold ${typePillStyles(record.type)}`}>
                          {typeCode(record.type)}
                        </div>
                        <div className="min-w-0 flex-1 py-3 pr-1">
                          <p className="truncate text-[14px] font-semibold text-slate-900">{record.title}</p>
                          <p className="mt-0.5 truncate text-[12px] text-slate-400">
                            {record.type === 'sow'
                              ? `${record.maxBudget} · ${record.workers} worker${record.workers !== 1 ? 's' : ''} · ${record.meta}`
                              : `${record.supplier} · ${record.meta}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(record)}
                          className="mr-3 flex-shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          Request change
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Nova bar */}
                <button
                  type="button"
                  onClick={() => setShowNova(true)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  <span className="text-sm text-slate-400">Ask Nova — policy questions, rate guidance, process help...</span>
                </button>

              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedRecord && (
        <ChangeRequestModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
      {showNova && <NovaModal onClose={() => setShowNova(false)} />}
    </MotionWrapper>
  )
}
'use client'

// Prototype-only supplier agreement concept. Production rate-card work must
// build on the API-backed /admin/rates/cards routes and lib/api/rates.ts.

import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  FileUp,
  Filter,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import {
  LevvEmptyState,
  LevvNotice,
  LevvPage,
  LevvPanel,
  LevvRecordHeader,
  LevvSearchField,
  LevvSelect,
  LevvStat,
  LevvStatStrip,
  LevvStatusBadge,
  LevvTabs,
  levvUi,
} from '@/components/ui/levv-app'

type RateLine = {
  id: number
  role: string
  location: string
  minimum: number
  maximum: number
  overtime: string
}

type SupplierCard = {
  id: string
  supplier: string
  country: string
  currency: string
  period: string
  source: string
  status: 'Active' | 'Draft'
  updated: string
  lines: RateLine[]
}

const INITIAL_CARDS: SupplierCard[] = [
  {
    id: 'apex-ca-2026', supplier: 'Apex Systems', country: 'Canada', currency: 'CAD',
    period: 'Jan 1 – Dec 31, 2026', source: 'MSA + rate schedule', status: 'Active', updated: 'Sep 18, 2026',
    lines: [
      { id: 1, role: 'Data Engineer', location: 'Toronto', minimum: 85, maximum: 105, overtime: '1.5×' },
      { id: 2, role: 'Data Engineer', location: 'All Canada', minimum: 80, maximum: 100, overtime: '1.5×' },
      { id: 3, role: 'Software Engineer', location: 'Toronto', minimum: 80, maximum: 100, overtime: '1.5×' },
      { id: 4, role: 'Senior Developer', location: 'Vancouver', minimum: 88, maximum: 110, overtime: '1.5×' },
      { id: 5, role: 'Business Analyst', location: 'All Canada', minimum: 65, maximum: 82, overtime: '1.5×' },
    ],
  },
  {
    id: 'randstad-ca-2026', supplier: 'Randstad', country: 'Canada', currency: 'CAD',
    period: 'Jan 1 – Dec 31, 2026', source: 'Uploaded spreadsheet', status: 'Active', updated: 'Sep 12, 2026',
    lines: [
      { id: 1, role: 'Data Engineer', location: 'Toronto', minimum: 82, maximum: 102, overtime: '1.5×' },
      { id: 2, role: 'Product Manager', location: 'All Canada', minimum: 78, maximum: 98, overtime: '1.5×' },
      { id: 3, role: 'Business Analyst', location: 'Montreal', minimum: 63, maximum: 80, overtime: '1.5×' },
    ],
  },
  {
    id: 'tek-us-2026', supplier: 'TEKsystems', country: 'United States', currency: 'USD',
    period: 'Jan 1 – Dec 31, 2026', source: 'Manual entry', status: 'Active', updated: 'Aug 29, 2026',
    lines: [
      { id: 1, role: 'Data Engineer', location: 'New York', minimum: 92, maximum: 118, overtime: '1.5×' },
      { id: 2, role: 'Software Engineer', location: 'Remote — US', minimum: 84, maximum: 108, overtime: '1.5×' },
    ],
  },
  {
    id: 'procom-ca-2026', supplier: 'Procom', country: 'Canada', currency: 'CAD',
    period: 'Apr 1, 2026 – Mar 31, 2027', source: 'MSA + rate schedule', status: 'Draft', updated: 'Sep 24, 2026',
    lines: [{ id: 1, role: 'Data Engineer', location: 'All Canada', minimum: 79, maximum: 99, overtime: '1.5×' }],
  },
]

type View = 'list' | 'detail' | 'create' | 'review'
type Tab = 'cards' | 'finder'

function StatusBadge({ status }: { status: SupplierCard['status'] }) {
  return <LevvStatusBadge tone={status === 'Active' ? 'emerald' : 'slate'}>{status}</LevvStatusBadge>
}

const BACK_BUTTON = `${levvUi.ghostButton} -ml-3.5`
const SECTION_TITLE = 'text-[15px] font-semibold text-slate-950'

export default function AdminRatesPage() {
  const [tab, setTab] = useState<Tab>('cards')
  const [view, setView] = useState<View>('list')
  const [cards, setCards] = useState(INITIAL_CARDS)
  const [selectedId, setSelectedId] = useState(INITIAL_CARDS[0].id)
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('All countries')
  const [status, setStatus] = useState('Active')
  const [creationMode, setCreationMode] = useState<'import' | 'manual'>('import')
  const [uploadedName, setUploadedName] = useState('')
  const [published, setPublished] = useState(false)

  const selected = cards.find((card) => card.id === selectedId) || cards[0]
  const filtered = cards.filter((card) => {
    const query = search.toLowerCase()
    return (!query || `${card.supplier} ${card.country}`.toLowerCase().includes(query)) &&
      (country === 'All countries' || card.country === country) &&
      (status === 'All statuses' || card.status === status)
  })

  const openCard = (id: string) => { setSelectedId(id); setView('detail') }
  const startCreate = (mode: 'import' | 'manual') => { setCreationMode(mode); setUploadedName(''); setPublished(false); setView('create') }
  const publishDraft = () => {
    setCards((current) => current.map((card) => card.id === 'procom-ca-2026' ? { ...card, status: 'Active' } : card))
    setPublished(true)
  }

  return (
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Admin settings / Rates"
          title="Rates"
          statement="Manage supplier rate cards and verify which contracted rate applies."
          actions={tab === 'cards' && view === 'list' ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => startCreate('import')} className={levvUi.secondaryButton}><Upload /> Import agreement</button>
              <button type="button" onClick={() => startCreate('manual')} className={levvUi.primaryButton}><Plus /> New rate card</button>
            </div>
          ) : null}
        />

        <LevvTabs<Tab>
          label="Rate views"
          value={tab}
          onChange={(next) => { setTab(next); setView('list') }}
          options={[{ value: 'cards', label: 'Supplier rate cards' }, { value: 'finder', label: 'Rate finder' }]}
        />

        {tab === 'finder' ? <RateFinder cards={cards} /> : null}
        {tab === 'cards' && view === 'list' ? <RateCardList cards={filtered} search={search} country={country} status={status} onSearch={setSearch} onCountry={setCountry} onStatus={setStatus} onOpen={openCard} /> : null}
        {tab === 'cards' && view === 'detail' ? <RateCardDetail card={selected} onBack={() => setView('list')} onAdd={() => startCreate('manual')} /> : null}
        {tab === 'cards' && view === 'create' ? <CreateRateCard mode={creationMode} uploadedName={uploadedName} onUploadedName={setUploadedName} onBack={() => setView('list')} onReview={() => setView('review')} /> : null}
        {tab === 'cards' && view === 'review' ? <ReviewDraft published={published} onBack={() => setView('create')} onPublish={publishDraft} onDone={() => setView('list')} /> : null}
      </div>
    </LevvPage>
  )
}

function RateCardList({ cards, search, country, status, onSearch, onCountry, onStatus, onOpen }: { cards: SupplierCard[]; search: string; country: string; status: string; onSearch: (value: string) => void; onCountry: (value: string) => void; onStatus: (value: string) => void; onOpen: (id: string) => void }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className={SECTION_TITLE}>Supplier agreements</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">One agreement can contain rates for many roles and locations.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid w-full gap-1.5 sm:w-72">
          <span className={levvUi.label}>Search</span>
          <LevvSearchField value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search supplier or country" aria-label="Search supplier or country" />
        </label>
        <Field label="Country" className="w-full sm:w-48"><Select label="Country" value={country} onChange={onCountry} options={['All countries', 'Canada', 'United States']} /></Field>
        <Field label="Status" className="w-full sm:w-40"><Select label="Status" value={status} onChange={onStatus} options={['All statuses', 'Active', 'Draft']} /></Field>
      </div>
      <div className="border-t-2 border-slate-950">
        <ul className="divide-y divide-[var(--line)] border-b border-[var(--line)]">
          {cards.map((card) => (
            <li key={card.id}>
              <button type="button" onClick={() => onOpen(card.id)} className="group grid w-full grid-cols-1 gap-3 px-3 py-4 text-left outline-none transition-colors duration-150 hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] md:grid-cols-[minmax(0,1.4fr)_0.65fr_0.8fr_auto] md:items-center md:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="truncate text-[14px] font-semibold text-slate-950">{card.supplier} — {card.country} 2026</span><StatusBadge status={card.status} /></div>
                  <div className="mt-1 text-[13px] tabular-nums text-slate-500">{card.lines.length} roles · {new Set(card.lines.map((line) => line.location)).size} locations · {card.currency} · Hourly</div>
                </div>
                <div><div className={levvUi.label}>Effective</div><div className="mt-1 text-[13px] tabular-nums text-slate-800">{card.period}</div></div>
                <div><div className={levvUi.label}>Source</div><div className="mt-1 text-[13px] text-slate-800">{card.source}</div></div>
                <span className={`${levvUi.legend} inline-flex items-center gap-1.5 text-blue-600`}>View rate card <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" /></span>
              </button>
            </li>
          ))}
        </ul>
        {cards.length === 0 ? (
          <LevvEmptyState icon={Search} title="No rate cards match these filters.">Try another supplier, country, or status.</LevvEmptyState>
        ) : null}
      </div>
    </section>
  )
}

function RateCardDetail({ card, onBack, onAdd }: { card: SupplierCard; onBack: () => void; onAdd: () => void }) {
  return (
    <section className="space-y-6">
      <button type="button" onClick={onBack} className={BACK_BUTTON}><ArrowLeft /> All supplier rate cards</button>
      <div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold text-slate-950">{card.supplier} — {card.country} 2026</h2><StatusBadge status={card.status} /></div><p className="mt-1 text-[13px] tabular-nums text-slate-500">{card.currency} · Hourly · Bill rate · Effective {card.period}</p></div>
          <div className="flex gap-2"><button type="button" className={levvUi.secondaryButton}><MoreHorizontal /> More</button><button type="button" onClick={onAdd} className={levvUi.primaryButton}><Plus /> Add rate</button></div>
        </div>
        <dl className="mt-4 grid gap-4 border-y border-[var(--line)] py-4 sm:grid-cols-4"><DetailItem label="Supplier" value={card.supplier} /><DetailItem label="Country" value={card.country} /><DetailItem label="Source" value={card.source} /><DetailItem label="Last updated" value={card.updated} /></dl>
      </div>
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4"><div><h3 className={SECTION_TITLE}>Contracted rates</h3><p className="mt-0.5 text-[13px] text-slate-500">Rates are matched by supplier, role, location, and effective date.</p></div><button type="button" className={levvUi.secondaryButton}><FileSpreadsheet /> Export</button></div>
        <RateTable card={card} />
      </div>
    </section>
  )
}

function CreateRateCard({ mode, uploadedName, onUploadedName, onBack, onReview }: { mode: 'import' | 'manual'; uploadedName: string; onUploadedName: (value: string) => void; onBack: () => void; onReview: () => void }) {
  const [manualRows, setManualRows] = useState([
    { id: 1, role: 'Data Engineer', location: 'Toronto', minimum: '85', maximum: '105' },
  ])

  return (
    <section className="max-w-4xl space-y-5">
      <button type="button" onClick={onBack} className={BACK_BUTTON}><ArrowLeft /> All supplier rate cards</button>
      <LevvPanel>
        <div className="border-b border-[var(--line)] px-6 py-5"><div className="flex items-start justify-between gap-4"><div><div className={`${levvUi.legend} flex items-center gap-1.5 text-slate-500`}>{mode === 'import' ? <Sparkles className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}<span>{mode === 'import' ? 'AI-assisted import' : 'Manual setup'}</span></div><h2 className="mt-1.5 text-xl font-semibold text-slate-950">{mode === 'import' ? 'Import supplier agreement' : 'Create a rate card'}</h2><p className="mt-1 text-[13px] text-slate-500">{mode === 'import' ? 'Upload an MSA, pricing schedule, amendment, or spreadsheet. Levv will build a draft rate card.' : 'Set the agreement details, then add each contracted role and location.'}</p></div><button type="button" onClick={onBack} aria-label="Close" className={levvUi.iconButton}><X /></button></div></div>
        <div className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Supplier"><Select label="Supplier" value={mode === 'import' ? 'Procom' : 'Apex Systems'} onChange={() => {}} options={['Procom', 'Apex Systems', 'Randstad', 'TEKsystems']} /></Field><Field label="Agreement type"><Select label="Agreement type" value="MSA + Rate Schedule" onChange={() => {}} options={['MSA + Rate Schedule', 'Pricing schedule', 'Spreadsheet', 'Amendment']} /></Field><Field label="Country"><Select label="Country" value="Canada" onChange={() => {}} options={['Canada', 'United States']} /></Field><Field label="Currency"><Select label="Currency" value="CAD" onChange={() => {}} options={['CAD', 'USD']} /></Field></div>
          {mode === 'import' ? (
            <div><label className={`${levvUi.label} mb-1.5 block`}>Agreement file</label><label className={`flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-8 text-center transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent)] ${uploadedName ? 'border-blue-600 bg-[var(--surface)]' : 'border-[var(--line-strong)] bg-[var(--surface)] hover:border-slate-500'}`}><input type="file" className="sr-only" onChange={(event) => onUploadedName(event.target.files?.[0]?.name || '')} />{uploadedName ? <Check className="mb-2 h-6 w-6 text-[#1f8a5b]" /> : <FileUp className="mb-2 h-6 w-6 text-slate-400" />}<span className="text-[14px] font-semibold text-slate-950">{uploadedName || 'Choose a file or drag it here'}</span><span className="mt-1 text-xs text-slate-500">PDF, DOCX, XLSX, or CSV · up to 20 MB</span></label><div className="mt-5 border-t border-[var(--line)] pt-4"><div className={`${levvUi.legend} flex items-center gap-1.5 text-slate-500`}><Sparkles className="h-3.5 w-3.5" /> Levv will extract</div><div className="mt-3 grid gap-x-8 gap-y-2 text-[13px] text-slate-700 sm:grid-cols-2">{['Supplier and geography', 'Effective dates', 'Roles and locations', 'Standard and overtime rates', 'Pay and markup terms', 'Exceptions and premiums'].map((item) => <div key={item} className="flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-slate-400" />{item}</div>)}</div></div></div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                <div className={`grid grid-cols-[1.2fr_1fr_0.65fr_0.65fr_2.25rem] gap-3 border-b-2 border-slate-950 py-2.5 ${levvUi.legend} text-slate-500`}><span>Role</span><span>Location</span><span>ST min</span><span>ST max</span><span /></div>
                <div className="divide-y divide-[var(--line)]">
                  {manualRows.map((row) => (
                    <div key={row.id} className="grid grid-cols-[1.2fr_1fr_0.65fr_0.65fr_2.25rem] items-center gap-3 py-3">
                      {(['role', 'location', 'minimum', 'maximum'] as const).map((field) => (
                        <input
                          key={field}
                          value={row[field]}
                          type={field === 'minimum' || field === 'maximum' ? 'number' : 'text'}
                          placeholder={field === 'role' ? 'Role' : field === 'location' ? 'Location' : '0'}
                          onChange={(event) => setManualRows((current) => current.map((item) => item.id === row.id ? { ...item, [field]: event.target.value } : item))}
                          className={`${levvUi.input} min-w-0 ${field === 'minimum' || field === 'maximum' ? 'tabular-nums' : ''}`}
                        />
                      ))}
                      <button type="button" aria-label="Remove row" onClick={() => setManualRows((current) => current.length === 1 ? current : current.filter((item) => item.id !== row.id))} className={levvUi.iconButton}><X /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setManualRows((current) => [...current, { id: Math.max(...current.map((row) => row.id)) + 1, role: '', location: '', minimum: '', maximum: '' }])} className={`${levvUi.ghostButton} -ml-3.5 mt-2`}><Plus /> Add another row</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-6 py-4"><button type="button" onClick={onBack} className={levvUi.secondaryButton}>Cancel</button><button type="button" onClick={onReview} className={levvUi.primaryButton}>{mode === 'import' ? 'Extract & create draft' : 'Review rate card'} <ArrowRight /></button></div>
      </LevvPanel>
    </section>
  )
}

function ReviewDraft({ published, onBack, onPublish, onDone }: { published: boolean; onBack: () => void; onPublish: () => void; onDone: () => void }) {
  const draft = INITIAL_CARDS[0]
  return (
    <section className="max-w-6xl space-y-6">
      <button type="button" onClick={onBack} className={BACK_BUTTON}><ArrowLeft /> Edit import</button>
      {published ? (
        <div className="flex flex-col items-center border-t-2 border-slate-950 px-6 py-14 text-center"><span className="flex h-10 w-10 items-center justify-center bg-[#1f8a5b] text-white"><Check className="h-5 w-5" /></span><h2 className="mt-4 text-xl font-semibold text-slate-950">Rate card published</h2><p className="mt-2 max-w-lg text-[14px] text-slate-600">The Procom agreement is active and can now resolve rates in new job postings.</p><button type="button" onClick={onDone} className={`${levvUi.primaryButton} mt-6`}>Back to rate cards</button></div>
      ) : (
        <>
          <div>
            <div className="flex flex-wrap items-center gap-3"><LevvStatusBadge>Draft · not published</LevvStatusBadge><span className="text-xs text-slate-500">AI extraction complete</span></div>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Review Procom — Canada 2026</h2>
            <p className="mt-1 text-[13px] text-slate-500">Review role mappings and conflicts before publishing.</p>
            <LevvStatStrip className="mt-4 grid-cols-3"><LevvStat value="12" label="Rows found" /><LevvStat value="10" label="High confidence" tone="positive" /><LevvStat value="2" label="Needs review" tone="attention" /></LevvStatStrip>
          </div>
          <div className="space-y-3">
            <div><h3 className={SECTION_TITLE}>Extracted rates</h3><p className="mt-0.5 text-[13px] text-slate-500">Uncheck any rate you do not want to publish.</p></div>
            <div className="relative overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr><th className={levvUi.th}>Use</th><th className={levvUi.th}>Role</th><th className={levvUi.th}>Location</th><th className={levvUi.th}>ST min</th><th className={levvUi.th}>ST max</th><th className={levvUi.th}>Confidence</th></tr></thead><tbody>{draft.lines.slice(0, 4).map((line, index) => <tr key={line.id} className="hover:bg-[var(--surface)] [&>td]:border-b [&>td]:border-[var(--line)]"><td className={levvUi.td}><input type="checkbox" defaultChecked aria-label={`Use ${line.role}, ${line.location}`} className="h-4 w-4 accent-blue-600" /></td><td className={`${levvUi.td} font-medium text-slate-950`}>{line.role}</td><td className={`${levvUi.td} text-slate-600`}>{line.location}</td><td className={`${levvUi.td} font-semibold tabular-nums text-slate-950`}>${line.minimum}</td><td className={`${levvUi.td} font-semibold tabular-nums text-slate-950`}>${line.maximum}</td><td className={levvUi.td}><LevvStatusBadge tone={index === 3 ? 'amber' : 'emerald'}>{index === 3 ? 'Review' : 'High'}</LevvStatusBadge></td></tr>)}</tbody></table></div>
          </div>
          <LevvNotice tone="amber" title="2 items need attention"><div className="mt-1 space-y-2"><p><strong>Rate conflict:</strong> Data Engineer · Toronto overlaps the active Apex Systems 2026 rate card. <button className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800">Review conflict</button></p><p><strong>Role mapping:</strong> “Senior Developer” was mapped to Software Engineer. <button className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800">Confirm mapping</button></p></div></LevvNotice>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4"><button type="button" onClick={onBack} className={levvUi.secondaryButton}>Back</button><button type="button" onClick={onPublish} className={levvUi.primaryButton}><Check /> Publish rate card</button></div>
        </>
      )}
    </section>
  )
}

function RateFinder({ cards }: { cards: SupplierCard[] }) {
  const activeCards = cards.filter((card) => card.status === 'Active')
  const [supplier, setSupplier] = useState('All suppliers')
  const [role, setRole] = useState('Data Engineer')
  const [location, setLocation] = useState('Toronto')
  const [resolved, setResolved] = useState(true)
  const matches = useMemo(() => activeCards.flatMap((card) => card.lines.filter((line) => line.role === role && (location === 'All locations' || line.location === location || line.location.startsWith('All '))).map((line) => ({ card, line }))).filter(({ card }) => supplier === 'All suppliers' || card.supplier === supplier), [activeCards, location, role, supplier])
  return (
    <section className="grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
      <LevvPanel className="h-fit p-5"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-slate-400" /><h2 className={SECTION_TITLE}>Find a contracted rate</h2></div><p className="mt-0.5 text-[13px] text-slate-500">Check the rate Levv would apply to a job posting.</p><div className="mt-5 space-y-4"><Field label="Role"><Select label="Role" value={role} onChange={setRole} options={['Data Engineer', 'Software Engineer', 'Senior Developer', 'Business Analyst', 'Product Manager']} /></Field><Field label="Supplier"><Select label="Supplier" value={supplier} onChange={setSupplier} options={['All suppliers', ...activeCards.map((card) => card.supplier)]} /></Field><Field label="Location"><Select label="Location" value={location} onChange={setLocation} options={['Toronto', 'Vancouver', 'Montreal', 'New York', 'Remote — US', 'All locations']} /></Field><Field label="Effective date"><input type="date" defaultValue="2026-09-26" className={`${levvUi.input} tabular-nums`} /></Field><button type="button" onClick={() => setResolved(true)} className={`${levvUi.primaryButton} w-full`}><Search /> Resolve rate</button></div></LevvPanel>
      <div className="min-w-0 space-y-3"><div><h2 className={SECTION_TITLE}>Matching rates</h2><p className="mt-0.5 text-[13px] tabular-nums text-slate-500">{resolved ? `${matches.length} active contracted rate${matches.length === 1 ? '' : 's'} found` : 'Choose criteria to resolve a rate'}</p></div>{resolved && matches.length ? <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)] border-t-2 border-t-slate-950">{matches.map(({ card, line }, index) => <li key={`${card.id}-${line.id}`} className="px-3 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[14px] font-semibold text-slate-950">{card.supplier}</span>{index === 0 ? <LevvStatusBadge tone="blue" dot={false}>Best match</LevvStatusBadge> : null}</div><div className="mt-1 flex items-center gap-1 text-[13px] text-slate-500"><MapPin className="h-3.5 w-3.5" />{line.role} · {line.location}</div></div><div className="text-left sm:text-right"><div className="text-xl font-semibold tabular-nums text-slate-950">${line.minimum}–${line.maximum}</div><div className="text-xs tabular-nums text-slate-500">{card.currency} / hour · OT {line.overtime}</div></div></div><div className="mt-3 border-l-2 border-[var(--line-strong)] pl-3 text-[13px] text-slate-700"><strong className="text-slate-950">Why:</strong> {line.location === location ? `Exact ${role} + ${location} location match.` : `Country-wide ${role} rate applies because no exact ${location} rate was found.`}</div></li>)}</ul> : <div className="border-t-2 border-slate-950"><LevvEmptyState icon={Search} title="No matching contracted rates">Try broadening the supplier or location filters.</LevvEmptyState></div>}</div>
    </section>
  )
}

function RateTable({ card }: { card: SupplierCard }) {
  return <div className="relative overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr><th className={levvUi.th}>Role</th><th className={levvUi.th}>Location</th><th className={levvUi.th}>ST min</th><th className={levvUi.th}>ST max</th><th className={levvUi.th}>Overtime</th><th className={`${levvUi.th} w-12`}><span className="sr-only">Actions</span></th></tr></thead><tbody>{card.lines.map((line) => <tr key={line.id} className="hover:bg-[var(--surface)] [&>td]:border-b [&>td]:border-[var(--line)]"><td className={`${levvUi.td} font-medium text-slate-950`}>{line.role}</td><td className={`${levvUi.td} text-slate-600`}>{line.location}</td><td className={`${levvUi.td} font-semibold tabular-nums text-slate-950`}>${line.minimum}</td><td className={`${levvUi.td} font-semibold tabular-nums text-slate-950`}>${line.maximum}</td><td className={`${levvUi.td} tabular-nums text-slate-600`}>{line.overtime}</td><td className={`${levvUi.td} text-right`}><button type="button" aria-label={`More for ${line.role}, ${line.location}`} className={levvUi.iconButton}><MoreHorizontal /></button></td></tr>)}</tbody></table></div>
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <LevvSelect aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</LevvSelect>
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) { return <label className={`grid gap-1.5 ${className}`}><span className={levvUi.label}>{label}</span>{children}</label> }
function DetailItem({ label, value }: { label: string; value: string }) { return <div><dt className={levvUi.label}>{label}</dt><dd className="mt-1 text-[14px] font-medium tabular-nums text-slate-950">{value}</dd></div> }

'use client'

import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
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

function StatusBadge({ status }: { status: SupplierCard['status'] }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {status}
    </span>
  )
}

export default function AdminRatesPage() {
  const [tab, setTab] = useState<'cards' | 'finder'>('cards')
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
    <div className="mx-auto max-w-[1480px] space-y-6">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Financial controls</div>
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-[#101b3c]">Rates</h1>
          <p className="mt-1.5 text-sm text-slate-600">Manage supplier rate cards and verify which contracted rate applies.</p>
        </div>
        {tab === 'cards' && view === 'list' ? (
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => startCreate('import')} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"><Upload className="h-4 w-4" /> Import agreement</button>
            <button type="button" onClick={() => startCreate('manual')} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"><Plus className="h-4 w-4" /> New rate card</button>
          </div>
        ) : null}
      </header>

      <div className="border-b border-slate-200">
        <nav className="flex gap-6" aria-label="Rate views">
          {[{ id: 'cards', label: 'Supplier rate cards' }, { id: 'finder', label: 'Rate finder' }].map((item) => (
            <button type="button" key={item.id} onClick={() => { setTab(item.id as 'cards' | 'finder'); setView('list') }} className={`border-b-2 px-1 pb-3 text-sm font-semibold transition ${tab === item.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item.label}</button>
          ))}
        </nav>
      </div>

      {tab === 'finder' ? <RateFinder cards={cards} /> : null}
      {tab === 'cards' && view === 'list' ? <RateCardList cards={filtered} search={search} country={country} status={status} onSearch={setSearch} onCountry={setCountry} onStatus={setStatus} onOpen={openCard} /> : null}
      {tab === 'cards' && view === 'detail' ? <RateCardDetail card={selected} onBack={() => setView('list')} onAdd={() => startCreate('manual')} /> : null}
      {tab === 'cards' && view === 'create' ? <CreateRateCard mode={creationMode} uploadedName={uploadedName} onUploadedName={setUploadedName} onBack={() => setView('list')} onReview={() => setView('review')} /> : null}
      {tab === 'cards' && view === 'review' ? <ReviewDraft published={published} onBack={() => setView('create')} onPublish={publishDraft} onDone={() => setView('list')} /> : null}
    </div>
  )
}

function RateCardList({ cards, search, country, status, onSearch, onCountry, onStatus, onOpen }: { cards: SupplierCard[]; search: string; country: string; status: string; onSearch: (value: string) => void; onCountry: (value: string) => void; onStatus: (value: string) => void; onOpen: (id: string) => void }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_18px_50px_-38px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="text-lg font-bold text-slate-950">Supplier agreements</h2><p className="mt-1 text-sm text-slate-500">One agreement can contain rates for many roles and locations.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block min-w-[260px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search supplier or country" className="h-10 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          <Select value={country} onChange={onCountry} options={['All countries', 'Canada', 'United States']} />
          <Select value={status} onChange={onStatus} options={['All statuses', 'Active', 'Draft']} />
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {cards.map((card) => (
          <button type="button" key={card.id} onClick={() => onOpen(card.id)} className="group grid w-full grid-cols-1 gap-4 px-6 py-5 text-left transition hover:bg-blue-50/40 md:grid-cols-[minmax(0,1.4fr)_0.65fr_0.8fr_auto] md:items-center">
            <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-[15px] font-bold text-slate-950">{card.supplier} — {card.country} 2026</span><StatusBadge status={card.status} /></div><div className="mt-1.5 text-sm text-slate-500">{card.lines.length} roles · {new Set(card.lines.map((line) => line.location)).size} locations · {card.currency} · Hourly</div></div>
            <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Effective</div><div className="mt-1 text-sm font-medium text-slate-700">{card.period}</div></div>
            <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Source</div><div className="mt-1 text-sm font-medium text-slate-700">{card.source}</div></div>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-blue-600">View rate card <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
          </button>
        ))}
        {cards.length === 0 ? <div className="px-6 py-16 text-center"><p className="font-semibold text-slate-800">No rate cards match these filters.</p><p className="mt-1 text-sm text-slate-500">Try another supplier, country, or status.</p></div> : null}
      </div>
    </section>
  )
}

function RateCardDetail({ card, onBack, onAdd }: { card: SupplierCard; onBack: () => void; onAdd: () => void }) {
  return (
    <section className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> All supplier rate cards</button>
      <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold tracking-tight text-slate-950">{card.supplier} — {card.country} 2026</h2><StatusBadge status={card.status} /></div><p className="mt-1 text-sm text-slate-500">{card.currency} · Hourly · Bill rate · Effective {card.period}</p></div>
          <div className="flex gap-2"><button type="button" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><MoreHorizontal className="h-4 w-4" /> More</button><button type="button" onClick={onAdd} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add rate</button></div>
        </div>
        <dl className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:grid-cols-4"><DetailItem label="Supplier" value={card.supplier} /><DetailItem label="Country" value={card.country} /><DetailItem label="Source" value={card.source} /><DetailItem label="Last updated" value={card.updated} /></dl>
      </div>
      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><h3 className="font-bold text-slate-950">Contracted rates</h3><p className="mt-0.5 text-sm text-slate-500">Rates are matched by supplier, role, location, and effective date.</p></div><button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700"><FileSpreadsheet className="h-4 w-4" /> Export</button></div>
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
    <section className="mx-auto max-w-4xl space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> All supplier rate cards</button>
      <div className="rounded-[18px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-7 py-6"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-blue-600">{mode === 'import' ? <Sparkles className="h-4 w-4" /> : <Plus className="h-4 w-4" />}<span className="text-xs font-bold uppercase tracking-[0.16em]">{mode === 'import' ? 'AI-assisted import' : 'Manual setup'}</span></div><h2 className="mt-2 text-2xl font-bold text-slate-950">{mode === 'import' ? 'Import supplier agreement' : 'Create a rate card'}</h2><p className="mt-1 text-sm text-slate-500">{mode === 'import' ? 'Upload an MSA, pricing schedule, amendment, or spreadsheet. Levv will build a draft rate card.' : 'Set the agreement details, then add each contracted role and location.'}</p></div><button type="button" onClick={onBack} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button></div></div>
        <div className="space-y-6 p-7">
          <div className="grid gap-5 sm:grid-cols-2"><Field label="Supplier"><Select value={mode === 'import' ? 'Procom' : 'Apex Systems'} onChange={() => {}} options={['Procom', 'Apex Systems', 'Randstad', 'TEKsystems']} fill /></Field><Field label="Agreement type"><Select value="MSA + Rate Schedule" onChange={() => {}} options={['MSA + Rate Schedule', 'Pricing schedule', 'Spreadsheet', 'Amendment']} fill /></Field><Field label="Country"><Select value="Canada" onChange={() => {}} options={['Canada', 'United States']} fill /></Field><Field label="Currency"><Select value="CAD" onChange={() => {}} options={['CAD', 'USD']} fill /></Field></div>
          {mode === 'import' ? (
            <div><label className="mb-2 block text-sm font-semibold text-slate-800">Agreement file</label><label className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${uploadedName ? 'border-blue-300 bg-blue-50/50' : 'border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40'}`}><input type="file" className="sr-only" onChange={(event) => onUploadedName(event.target.files?.[0]?.name || '')} />{uploadedName ? <Check className="mb-3 h-8 w-8 text-emerald-600" /> : <FileUp className="mb-3 h-8 w-8 text-blue-600" />}<span className="text-sm font-bold text-slate-900">{uploadedName || 'Choose a file or drag it here'}</span><span className="mt-1 text-xs text-slate-500">PDF, DOCX, XLSX, or CSV · up to 20 MB</span></label><div className="mt-5 rounded-2xl bg-blue-50 p-5"><div className="flex items-center gap-2 text-sm font-bold text-blue-900"><Sparkles className="h-4 w-4 text-blue-600" /> Levv will extract</div><div className="mt-3 grid gap-x-8 gap-y-2 text-sm text-blue-900/75 sm:grid-cols-2">{['Supplier and geography', 'Effective dates', 'Roles and locations', 'Standard and overtime rates', 'Pay and markup terms', 'Exceptions and premiums'].map((item) => <div key={item} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />{item}</div>)}</div></div></div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.2fr_1fr_0.65fr_0.65fr_auto] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><span>Role</span><span>Location</span><span>ST min</span><span>ST max</span><span /></div>
              <div className="divide-y divide-slate-100">
                {manualRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1.2fr_1fr_0.65fr_0.65fr_auto] gap-3 p-4">
                    {(['role', 'location', 'minimum', 'maximum'] as const).map((field) => (
                      <input
                        key={field}
                        value={row[field]}
                        type={field === 'minimum' || field === 'maximum' ? 'number' : 'text'}
                        placeholder={field === 'role' ? 'Role' : field === 'location' ? 'Location' : '0'}
                        onChange={(event) => setManualRows((current) => current.map((item) => item.id === row.id ? { ...item, [field]: event.target.value } : item))}
                        className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    ))}
                    <button type="button" aria-label="Remove row" onClick={() => setManualRows((current) => current.length === 1 ? current : current.filter((item) => item.id !== row.id))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setManualRows((current) => [...current, { id: Math.max(...current.map((row) => row.id)) + 1, role: '', location: '', minimum: '', maximum: '' }])} className="m-4 inline-flex items-center gap-2 text-sm font-bold text-blue-600"><Plus className="h-4 w-4" /> Add another row</button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-7 py-4"><button type="button" onClick={onBack} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button type="button" onClick={onReview} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">{mode === 'import' ? 'Extract & create draft' : 'Review rate card'} <ArrowRight className="h-4 w-4" /></button></div>
      </div>
    </section>
  )
}

function ReviewDraft({ published, onBack, onPublish, onDone }: { published: boolean; onBack: () => void; onPublish: () => void; onDone: () => void }) {
  const draft = INITIAL_CARDS[0]
  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Edit import</button>
      {published ? (
        <div className="flex flex-col items-center rounded-[18px] border border-emerald-200 bg-white px-6 py-16 text-center shadow-sm"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-7 w-7" /></span><h2 className="mt-5 text-2xl font-bold text-slate-950">Rate card published</h2><p className="mt-2 max-w-lg text-sm text-slate-600">The Procom agreement is active and can now resolve rates in new job postings.</p><button type="button" onClick={onDone} className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Back to rate cards</button></div>
      ) : (
        <>
          <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Draft · not published</span><span className="text-xs text-slate-400">AI extraction complete</span></div><h2 className="mt-3 text-2xl font-bold text-slate-950">Review Procom — Canada 2026</h2><p className="mt-1 text-sm text-slate-500">Review role mappings and conflicts before publishing.</p></div><div className="grid grid-cols-3 gap-2"><MiniStat value="12" label="Rows found" /><MiniStat value="10" label="High confidence" tone="emerald" /><MiniStat value="2" label="Needs review" tone="amber" /></div></div></div>
          <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-4"><h3 className="font-bold text-slate-950">Extracted rates</h3><p className="mt-0.5 text-sm text-slate-500">Uncheck any rate you do not want to publish.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Use</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">ST min</th><th className="px-5 py-3">ST max</th><th className="px-5 py-3">Confidence</th></tr></thead><tbody className="divide-y divide-slate-100">{draft.lines.slice(0, 4).map((line, index) => <tr key={line.id}><td className="px-5 py-3"><input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-blue-600" /></td><td className="px-5 py-3 font-semibold text-slate-900">{line.role}</td><td className="px-5 py-3 text-slate-600">{line.location}</td><td className="px-5 py-3 font-semibold text-slate-800">${line.minimum}</td><td className="px-5 py-3 font-semibold text-slate-800">${line.maximum}</td><td className="px-5 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${index === 3 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{index === 3 ? 'Review' : 'High'}</span></td></tr>)}</tbody></table></div></div>
          <div className="rounded-[18px] border border-amber-200 bg-amber-50/70 p-5"><h3 className="text-sm font-bold text-amber-950">2 items need attention</h3><div className="mt-3 space-y-2 text-sm text-amber-900/80"><p><strong>Rate conflict:</strong> Data Engineer · Toronto overlaps the active Apex Systems 2026 rate card. <button className="font-bold text-blue-700">Review conflict</button></p><p><strong>Role mapping:</strong> “Senior Developer” was mapped to Software Engineer. <button className="font-bold text-blue-700">Confirm mapping</button></p></div></div>
          <div className="flex items-center justify-between rounded-[16px] border border-slate-200 bg-white px-5 py-4 shadow-sm"><button type="button" onClick={onBack} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Back</button><button type="button" onClick={onPublish} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Check className="h-4 w-4" /> Publish rate card</button></div>
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
    <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="h-fit rounded-[18px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-blue-600" /><h2 className="text-lg font-bold text-slate-950">Find a contracted rate</h2></div><p className="mt-1 text-sm text-slate-500">Check the rate Levv would apply to a job posting.</p><div className="mt-6 space-y-4"><Field label="Role"><Select value={role} onChange={setRole} options={['Data Engineer', 'Software Engineer', 'Senior Developer', 'Business Analyst', 'Product Manager']} fill /></Field><Field label="Supplier"><Select value={supplier} onChange={setSupplier} options={['All suppliers', ...activeCards.map((card) => card.supplier)]} fill /></Field><Field label="Location"><Select value={location} onChange={setLocation} options={['Toronto', 'Vancouver', 'Montreal', 'New York', 'Remote — US', 'All locations']} fill /></Field><Field label="Effective date"><input type="date" defaultValue="2026-09-26" className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></Field><button type="button" onClick={() => setResolved(true)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Search className="h-4 w-4" /> Resolve rate</button></div></div>
      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-5"><h2 className="text-lg font-bold text-slate-950">Matching rates</h2><p className="mt-1 text-sm text-slate-500">{resolved ? `${matches.length} active contracted rate${matches.length === 1 ? '' : 's'} found` : 'Choose criteria to resolve a rate'}</p></div>{resolved && matches.length ? <div className="divide-y divide-slate-100">{matches.map(({ card, line }, index) => <div key={`${card.id}-${line.id}`} className="px-6 py-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><span className="font-bold text-slate-950">{card.supplier}</span>{index === 0 ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Best match</span> : null}</div><div className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-3.5 w-3.5" />{line.role} · {line.location}</div></div><div className="text-left sm:text-right"><div className="text-xl font-bold text-slate-950">${line.minimum}–${line.maximum}</div><div className="text-xs text-slate-500">{card.currency} / hour · OT {line.overtime}</div></div></div><div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900"><strong>Why:</strong> {line.location === location ? `Exact ${role} + ${location} location match.` : `Country-wide ${role} rate applies because no exact ${location} rate was found.`}</div></div>)}</div> : <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center"><Search className="h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-800">No matching contracted rates</p><p className="mt-1 text-sm text-slate-500">Try broadening the supplier or location filters.</p></div>}</div>
    </section>
  )
}

function RateTable({ card }: { card: SupplierCard }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3.5">Role</th><th className="px-6 py-3.5">Location</th><th className="px-6 py-3.5">ST min</th><th className="px-6 py-3.5">ST max</th><th className="px-6 py-3.5">Overtime</th><th className="px-6 py-3.5" /></tr></thead><tbody className="divide-y divide-slate-100">{card.lines.map((line) => <tr key={line.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-semibold text-slate-950">{line.role}</td><td className="px-6 py-4 text-slate-600">{line.location}</td><td className="px-6 py-4 font-semibold text-slate-800">${line.minimum}</td><td className="px-6 py-4 font-semibold text-slate-800">${line.maximum}</td><td className="px-6 py-4 text-slate-600">{line.overtime}</td><td className="px-6 py-4 text-right"><button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
}

function Select({ value, onChange, options, fill = false }: { value: string; onChange: (value: string) => void; options: string[]; fill?: boolean }) {
  return <label className={`relative block ${fill ? 'w-full' : ''}`}><select value={value} onChange={(event) => onChange(event.target.value)} className={`h-10 appearance-none rounded-xl border border-slate-300 bg-white pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${fill ? 'w-full' : 'min-w-[140px]'}`}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></label>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-2 block text-sm font-semibold text-slate-800">{label}</label>{children}</div> }
function DetailItem({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-800">{value}</dd></div> }
function MiniStat({ value, label, tone = 'slate' }: { value: string; label: string; tone?: 'slate' | 'emerald' | 'amber' }) { const colors = tone === 'emerald' ? 'bg-emerald-50 text-emerald-800' : tone === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-800'; return <div className={`min-w-[100px] rounded-xl px-4 py-3 ${colors}`}><div className="text-xl font-bold">{value}</div><div className="text-xs font-medium opacity-70">{label}</div></div> }

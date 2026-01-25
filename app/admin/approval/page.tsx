'use client'

import { useState } from 'react'
import { Sparkles, Plus } from 'lucide-react'
import ApprovalRulesTable from './ApprovalRulesTable'
import {
  parseApprovalRules,
  evolveApprovalRules,
} from '@/lib/intelligence'

/* =========================
   Approval scope (optical)
========================= */
const APPROVAL_SCOPES = [
  'spend',
  'worker',
  'supplier',
  'sow',
  'invoicing',
  'payments',
] as const

type ApprovalScope = (typeof APPROVAL_SCOPES)[number]

export default function ApprovalConfigurationPage() {
  const [activeScope, setActiveScope] =
    useState<ApprovalScope>('spend')

  const [prompt, setPrompt] = useState('')
  const [evolutionPrompt, setEvolutionPrompt] = useState('')
  const [rules, setRules] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [evolving, setEvolving] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setLoading(true)
    try {
      const result = await parseApprovalRules(prompt)
      setRules(result)
      setEvolutionPrompt('')
    } finally {
      setLoading(false)
    }
  }

  const handleEvolve = async () => {
    if (!rules || !evolutionPrompt.trim()) return

    setEvolving(true)
    try {
      const updated = await evolveApprovalRules({
        existingRules: rules,
        input: evolutionPrompt,
      })
      setRules(updated)
      setEvolutionPrompt('')
    } finally {
      setEvolving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Workflow and Approval Configuration
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure approval rules using Nova.
        </p>
      </div>

    {/* =========================
        Approval Hierarchy Integration (Optical)
    ========================= */}
    <div className="rounded-lg border bg-white p-4 max-w-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Approval Hierarchy Integration
        </h3>
        <span className="text-xs text-gray-500">0 of 1</span>
      </div>

      <div className="relative rounded-md border p-3">

        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900">
              Sync approval hierarchy
            </p>

            <p className="text-xs text-gray-500">
              System: Not Defined
            </p>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Integration:</span>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                Not connected
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              Not Enabled
            </span>
            <button className="text-gray-400 hover:text-gray-600">
              
            </button>
          </div>
        </div>
      </div>
    </div>



      {/* TOP TABS */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 text-sm font-medium">
          <ScopeTab
            label="Spend approvals"
            active={activeScope === 'spend'}
            onClick={() => setActiveScope('spend')}
          />
          <ScopeTab label="Worker onboarding" disabled />
          <ScopeTab label="Supplier onboarding" disabled />
          <ScopeTab label="SOW lifecycle" disabled />
          <ScopeTab label="Invoicing" disabled />
          <ScopeTab label="Payments" disabled />
        </nav>
      </div>

      {/* CONTENT */}
      {activeScope !== 'spend' ? (
        <div className="rounded-lg border bg-white p-6 text-sm text-gray-500">
          This approval area is available in a future release.
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* CENTER */}
          <div className="col-span-8 space-y-4">
            {/* PROMPT */}
            <div className="rounded-lg border bg-white p-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Describe your approval rules
              </label>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="HR approves greater than 10,000 USD"
                className="w-full rounded-md border px-3 py-2 text-sm min-h-[100px]"
              />

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
              >
                
                ✨ {loading ? 'Generating…' : 'Generate rules'}
              </button>
            </div>

            {/* RULES TABLE */}
            {rules && (
              <>
                <ApprovalRulesTable
                  data={rules}
                  onChange={setRules}
                />

                {/* EVOLUTION (hidden for now) */}
                {false && (
                  <div className="rounded-lg border bg-white p-4">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Add a condition or refinement
                    </label>

                    <textarea
                      value={evolutionPrompt}
                      onChange={(e) =>
                        setEvolutionPrompt(e.target.value)
                      }
                      placeholder="Only when category is IT."
                      className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px]"
                    />

                    <button
                      onClick={handleEvolve}
                      disabled={evolving}
                      className="mt-3 inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      {evolving ? 'Applying…' : 'Add condition'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT – AI INSIGHTS */}
          <div className="col-span-4 rounded-lg border bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              ✨ AI Insights
            </h3>

            {!rules ? (
              <p className="text-sm text-gray-500">
                Generate rules to see insights.
              </p>
            ) : (
              <div className="space-y-4 text-sm">
                {/* INTERPRETED POLICY BEHAVIOR */}
                <div>
                  <p className="font-medium text-gray-900">
                    Interpreted policy behavior
                  </p>
                  <ul className="mt-1 list-disc list-inside text-gray-600">
                    {rules.metadata?.behavior?.length ? (
                      rules.metadata.behavior.map(
                        (b: string, i: number) => (
                          <li key={i}>{b}</li>
                        )
                      )
                    ) : (
                      <li>
                        Based on the defined rules, multiple approvers may
                        be triggered depending on SOW amount, location,
                        and additional conditions.
                      </li>
                    )}
                  </ul>
                </div>

                {/* ASSUMPTIONS */}
                <div>
                  <p className="font-medium text-gray-900">
                    Assumptions
                  </p>
                  <ul className="mt-1 list-disc list-inside text-gray-600">
                    {rules.metadata?.assumptions?.length ? (
                      rules.metadata.assumptions.map(
                        (a: string, i: number) => (
                          <li key={i}>{a}</li>
                        )
                      )
                    ) : (
                      <li>No implicit assumptions were required.</li>
                    )}
                  </ul>
                </div>

                {/* THINGS TO CONFIRM */}
                <div>
                  <p className="font-medium text-gray-900">
                    Things to confirm
                  </p>
                  <ul className="mt-1 list-disc list-inside text-gray-600">
                    {rules.metadata?.gaps?.length ? (
                      rules.metadata.gaps.map(
                        (g: string, i: number) => (
                          <li key={i}>{g}</li>
                        )
                      )
                    ) : (
                      <li>None</li>
                    )}
                  </ul>
                </div>

                <p className="text-xs text-gray-500">
                
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================
   Tab component
========================= */
function ScopeTab({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`pb-3 transition-colors ${
        active
          ? 'text-black border-b-2 border-black'
          : disabled
          ? 'text-gray-400 cursor-not-allowed'
          : 'text-gray-600 hover:text-black'
      }`}
    >
      {label}
    </button>
  )
}

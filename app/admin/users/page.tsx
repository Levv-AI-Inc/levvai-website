'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { parseUser } from '@/lib/intelligence'
import { useRouter } from 'next/navigation'

/* =========================
   HELPERS
========================= */

function normalizeUserRow(raw: any) {
  return {
    name:
      raw.name && raw.name.trim().length > 0
        ? raw.name
        : 'Pending user',

    // ❗ DO NOT DEFAULT EMAIL
    email:
      raw.email && raw.email.trim().length > 0
        ? raw.email
        : undefined,

    role: raw.role,
    status: raw.status,
    businessUnit: raw.businessUnit,
    costCenter: raw.costCenter,
    ssoEnabled: raw.ssoEnabled ?? false,
    source: raw.source ?? 'Nova',
  }
}

/* =========================
   TYPES
========================= */

type UserRow = {
  name: string
  email?: string
  role: string
  status: 'Active' | 'Inactive'
  businessUnit?: string
  costCenter?: string
  ssoEnabled: boolean
  source: string
}

/* =========================
   LOCAL STORAGE
========================= */

const loadUsers = (): UserRow[] => {
  if (typeof window === 'undefined') return MOCK_USERS
  const saved = localStorage.getItem('users')
  return saved ? JSON.parse(saved) : MOCK_USERS
}

/* =========================
   UPSERT HELPERS
========================= */

function normalizeName(name: string) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

function upsertUser(
  existing: UserRow[],
  incoming: Partial<UserRow>,
): UserRow[] {
  if (!incoming.name) {
    return [...existing, incoming as UserRow]
  }

  const index = existing.findIndex(
    (u) =>
      normalizeName(u.name) === normalizeName(incoming.name!),
  )

  if (index === -1) {
    return [...existing, incoming as UserRow]
  }

  const updated = [...existing]
  updated[index] = {
    ...updated[index],
    ...Object.fromEntries(
      Object.entries(incoming).filter(
        ([, v]) => v !== undefined,
      ),
    ),
  }

  return updated
}

/* =========================
   PAGE
========================= */

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<{
    missingEmail?: boolean
    role?: string
  } | null>(null)

  useEffect(() => {
    setUsers(loadUsers())
  }, [])

  /* =========================
     AI GENERATE (Nova)
  ========================= */

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setLoading(true)
    try {
      const result = await parseUser(prompt)

      const newUser = normalizeUserRow({
        ...result,
        source: 'Nova',
      })

      const updated = upsertUser(users, newUser)
      setUsers(updated)
      localStorage.setItem('users', JSON.stringify(updated))

      setInsights({
        missingEmail: !result.email,
        role: result.role,
      })

      setPrompt('')
    } finally {
      setLoading(false)
    }
  }

  const toggleSSO = (index: number) => {
    const updated = [...users]
    updated[index] = {
      ...updated[index],
      ssoEnabled: !updated[index].ssoEnabled,
    }
    setUsers(updated)
    localStorage.setItem('users', JSON.stringify(updated))
  }

  const deleteUser = (index: number) => {
    const updated = users.filter((_, i) => i !== index)
    setUsers(updated)
    localStorage.setItem('users', JSON.stringify(updated))
  }

  return (
    <div className="space-y-8">
      {/* =========================
          Header
      ========================= */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Users
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage users, roles, and access across the system.
          </p>
        </div>

        <button className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900">
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* =========================
          AI RULES PANEL
      ========================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-lg border bg-white p-4">
          <label className="block text-sm font-medium mb-2">
            Type the desired changes or updates
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-md border p-3 text-sm"
            rows={3}
            placeholder="Make Amy Schneider inactive and move to Procurement"
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            ✨ {loading ? 'Generating…' : 'Generate rules'}
          </button>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="font-medium mb-1">✨ AI Insights</div>

          {!insights ? (
            <p className="text-sm text-gray-600">
              Generate rules to see insights.
            </p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <strong>Assigned role:</strong> {insights.role}
              </p>
              {insights.missingEmail && (
                <p className="text-amber-600">
                  Email not provided. Follow-up required.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =========================
          Users Table
      ========================= */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">
                Business Unit
              </th>
              <th className="px-4 py-3 font-medium">
                Cost Center
              </th>
              <th className="px-4 py-3 font-medium">
                SSO Enabled
              </th>
              <th className="px-4 py-3 font-medium text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {users.map((u, i) => (
              <tr
                key={`${u.name}-${i}`}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() =>
                  router.push(
                    `/admin/users/${encodeURIComponent(
                      u.name,
                    )}`,
                  )
                }
              >
                <td className="px-4 py-3 font-medium">
                  {u.name}
                </td>
                <td className="px-4 py-3">
                  {u.email ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.status} />
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.businessUnit ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {u.costCenter ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSSO(i)
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                      u.ssoEnabled
                        ? 'bg-black'
                        : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        u.ssoEnabled
                          ? 'translate-x-4'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteUser(i)
                    }}
                    className="text-gray-400 hover:text-red-600 text-lg"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* =========================
   STATUS BADGE
========================= */

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        status === 'Active'
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-600'
      }`}
    >
      {status}
    </span>
  )
}

/* =========================
   MOCK DATA
========================= */

const MOCK_USERS: UserRow[] = [
  {
    name: 'Sarah Thompson',
    email: 'sarah.thompson@company.com',
    role: 'Admin',
    status: 'Active',
    businessUnit: 'Finance',
    costCenter: '1001',
    ssoEnabled: true,
    source: 'Workday',
  },
  {
    name: 'James Lee',
    email: 'james.lee@company.com',
    role: 'Hiring Manager',
    status: 'Active',
    businessUnit: 'Technology',
    costCenter: '4201',
    ssoEnabled: false,
    source: 'Workday',
  },
  {
    name: 'Priya Patel',
    email: 'priya.patel@company.com',
    role: 'Viewer',
    status: 'Inactive',
    businessUnit: 'Operations',
    costCenter: '3302',
    ssoEnabled: false,
    source: 'Workday',
  },
]

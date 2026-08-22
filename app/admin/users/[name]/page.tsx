'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown } from 'lucide-react'

/* =========================
   MOCK LOOKUP DATA
========================= */

const SUPERVISORS = [
  'Sarah Thompson',
  'James Lee',
  'Priya Patel',
  'Michael Chen',
  'Ayesha Khan',
  'Robert Wilson',
]

const ROLE_OPTIONS = [
  'Admin',
  'Hiring Manager',
  'Finance',
  'Procurement',
  'HR',
  'Viewer',
]

const PERMISSIONS = [
  'Manage Users',
  'Assign Roles',
  'Configure Approval Chains',
  'Edit Financial Policies',
  'Override System Holds',
  'Access All Reports',
  'View Audit Logs',
  'Impersonate Users',
  'Manage Integrations',
  'Lock / Unlock Records',
  'Delete Records',
  'Trigger Auto-Terminations',
  'Create Requests',
  'Approve Timesheets',
  'Approve Invoices',
  'Edit SOWs',
  'Manage Suppliers',
  'View Contracts',
  'View Spend Summaries',
]

/* =========================
   PAGE
========================= */

export default function UserRecordPage() {
  const params = useParams()
  const router = useRouter()
  const name = decodeURIComponent(params.name as string)

  const [user, setUser] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [supervisor, setSupervisor] = useState('')

  /* =========================
     LOAD USER FROM TABLE
  ========================= */

  useEffect(() => {
    const stored = localStorage.getItem('users')
    if (!stored) return

    const users = JSON.parse(stored)
    const found = users.find(
  (u: any) =>
    (u.name ?? '').toLowerCase().trim() ===
    name.toLowerCase().trim(),
)


    if (found) {
      setUser(found)
      setSupervisor(found.supervisor ?? '')
    }
  }, [name])

  const filteredSupervisors = useMemo(() => {
    return SUPERVISORS.filter((s) =>
      s.toLowerCase().includes(search.toLowerCase()),
    )
  }, [search])

  if (!user) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Loading user…
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* =========================
          Header
      ========================= */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/users')}
          className="text-gray-600 hover:text-black"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {user.name}
          </h1>
          <span className="inline-block mt-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            {user.status}
          </span>
        </div>
      </div>

      {/* =========================
          User Details
      ========================= */}
      <div className="rounded-lg border bg-white p-6 grid grid-cols-2 gap-6">
        <Field label="Name">
          <input
            value={user.name}
            disabled
            className="w-full rounded-md border px-3 py-2 text-sm bg-gray-50"
          />
        </Field>

        <Field label="Email">
          <input
            value={user.email}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Business Unit">
          <input
            value={user.businessUnit ?? ''}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Cost Center">
          <input
            value={user.costCenter ?? ''}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Legal Entity">
          <input
            placeholder="Company Inc."
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Approval Limit">
          <input
            placeholder="$50,000"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>

        {/* Supervisor */}
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">
            Supervisor
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supervisors"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {search && (
            <div className="mt-1 max-h-40 overflow-auto rounded-md border bg-white shadow">
              {filteredSupervisors.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSupervisor(s)
                    setSearch('')
                  }}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {supervisor && (
            <p className="mt-1 text-sm text-gray-600">
              Selected: {supervisor}
            </p>
          )}
        </div>

        {/* SSO */}
        <div className="col-span-2 flex items-center justify-between">
          <span className="text-sm font-medium">SSO Enabled</span>
          <button
            onClick={() =>
              setUser({
                ...user,
                ssoEnabled: !user.ssoEnabled,
              })
            }
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
              user.ssoEnabled ? 'bg-black' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                user.ssoEnabled
                  ? 'translate-x-4'
                  : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* =========================
          Role
      ========================= */}
      <div className="rounded-lg border bg-white p-6">
        <label className="block text-sm font-medium mb-2">
          Role
        </label>
        <div className="relative w-64">
          <select
            value={user.role}
            onChange={(e) =>
              setUser({ ...user, role: e.target.value })
            }
            className="w-full rounded-md border px-3 py-2 text-sm appearance-none"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* =========================
          Permissions (Visual)
      ========================= */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-semibold mb-4">
          Permissions
        </h3>

        <div className="space-y-3">
          {PERMISSIONS.map((p) => (
            <label
              key={p}
              className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-gray-50"
            >
              <span className="text-sm text-gray-800">
                {p}
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
              />
            </label>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Permissions shown here represent additional overrides
          layered on top of the assigned role.
        </p>
      </div>
    </div>
  )
}

/* =========================
   FIELD COMPONENT
========================= */

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}

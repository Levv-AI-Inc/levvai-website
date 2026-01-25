'use client'

import { useState } from 'react'
import { RATE_TABLES } from '../../../data/rates'
import { resolveCWRate } from '../../../lib/rates/resolveCWRate'

export default function AdminRatesPage() {
  const [role, setRole] = useState('Data Analyst II')
  const [country, setCountry] = useState('US')
  const [region, setRegion] = useState('New York')

  const resolution = resolveCWRate({
    role,
    country,
    region,
  })

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Rates 
        </h1>

        <button className="rounded-full bg-black px-4 py-2 text-sm text-white">
          + New Rate Table
        </button>
      </div>

      {/* Resolution Context */}
      <div className="mb-4 flex gap-4 text-sm">
        <div>
          <label className="block text-gray-600 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option>Data Analyst II</option>
            <option>Software Engineer</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-600 mb-1">Country</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option>US</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-600 mb-1">Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option>New York</option>
            <option>California</option>
          </select>
        </div>
      </div>

      {/* Policy Result */}
      {resolution.outcome === 'allowed' && resolution.rate && (
        <div className="mb-6 rounded-md border bg-green-50 px-4 py-3 text-sm">
          <div className="font-medium text-green-900 mb-1">
            Rate Approved
          </div>
          <div className="text-green-800">
            <span className="font-medium">{resolution.rate.role}</span> ·{' '}
            {resolution.rate.location.country} –{' '}
            {resolution.rate.location.region}
          </div>
          <div className="text-green-800">
            {resolution.rate.billRate
              ? `$${resolution.rate.billRate.min} – $${resolution.rate.billRate.max} / hr`
              : `$${resolution.rate.payRate?.min} – $${resolution.rate.payRate?.max} / hr`}
            {' · '}
            {resolution.rate.overtimeRule.label}
          </div>
        </div>
      )}

      {resolution.outcome === 'exception' && (
        <div className="mb-6 rounded-md border bg-yellow-50 px-4 py-3 text-sm">
          <div className="font-medium text-yellow-900 mb-1">
            Rate Exception
          </div>
          <div className="text-yellow-800">
            {resolution.reason}
          </div>
        </div>
      )}

      {resolution.outcome === 'blocked' && (
        <div className="mb-6 rounded-md border bg-red-50 px-4 py-3 text-sm">
          <div className="font-medium text-red-900 mb-1">
            Rate Blocked
          </div>
          <div className="text-red-800">
            {resolution.reason}
          </div>
        </div>
      )}

      {/* Rate Table */}
      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Role</th>
              <th className="px-4 py-2 text-left font-medium">Location</th>
              <th className="px-4 py-2 text-left font-medium">Pricing Model</th>
              <th className="px-4 py-2 text-left font-medium">Rate</th>
              <th className="px-4 py-2 text-left font-medium">OT Rule</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {RATE_TABLES.map((rate) => (
              <tr key={rate.id} className="border-b last:border-0">
                <td className="px-4 py-2">{rate.role}</td>
                <td className="px-4 py-2">
                  {rate.location.country} – {rate.location.region}
                </td>
                <td className="px-4 py-2">
                  {rate.pricingModel === 'bill_only'
                    ? 'Bill-only'
                    : 'Pay + Markup'}
                </td>
                <td className="px-4 py-2">
                  {rate.billRate
                    ? `$${rate.billRate.min} – $${rate.billRate.max} / hr`
                    : `$${rate.payRate?.min} – $${rate.payRate?.max} / hr`}
                </td>
                <td className="px-4 py-2">
                  {rate.overtimeRule.label}
                </td>
                <td className="px-4 py-2 capitalize">{rate.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'

export default function WorksiteActionsDropdown({
  onEdit,
}: {
  onEdit: () => void
}) {
  const [selectedAction, setSelectedAction] = useState('')

  return (
    <select
      value={selectedAction}
      onChange={(event) => {
        const nextAction = event.target.value
        setSelectedAction('')

        if (nextAction === 'edit') {
          onEdit()
        }
      }}
      className="min-w-[132px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
      aria-label="Worksite actions"
    >
      <option value="">Actions</option>
      <option value="edit">Edit worksite</option>
    </select>
  )
}

'use client'

import { useState } from 'react'
import {
  Plus,
  Trash2,
  Calendar,
  MessageSquare,
  X,
  Receipt,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

type Assignment = {
  id: string
  label: string
  type: 'SOW' | 'Work Order'
}

const ASSIGNMENTS: Assignment[] = [
  { id: 'SOW-10492', label: 'Managed Services – Finance Ops', type: 'SOW' },
  { id: 'WO-88321', label: 'Data Migration Support', type: 'Work Order' },
]

export default function ExternalWorkerPortalDemo() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-2xl border bg-white/80 backdrop-blur shadow-sm">
        <TimesheetPanel
          onSubmit={() => router.push('/approvals/timesheets?demo=submitted')}
        />
      </div>
    </div>
  )
}

/* =========================
   TIMESHEET PANEL
========================= */

function TimesheetPanel({ onSubmit }: { onSubmit: () => void }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

  const [assignment, setAssignment] = useState<Assignment>(ASSIGNMENTS[0])
  const [weekStart, setWeekStart] = useState('2024-08-12')

  const [showComments, setShowComments] = useState(false)
  const [comment, setComment] = useState('')

  const [tasks, setTasks] = useState<string[]>([
    'Client workshops',
    'Design & documentation',
  ])

  const [hours, setHours] = useState<Record<string, number[]>>({
    'Client workshops': [8, 6, 6, 4, 0],
    'Design & documentation': [0, 2, 2, 4, 6],
  })

  const addTask = () => {
    const name = 'New task'
    setTasks([...tasks, name])
    setHours({ ...hours, [name]: [0, 0, 0, 0, 0] })
  }

  const updateTaskName = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return

    const updatedTasks = tasks.map((t) => (t === oldName ? newName : t))
    const updatedHours: Record<string, number[]> = {}

    Object.entries(hours).forEach(([k, v]) => {
      updatedHours[k === oldName ? newName : k] = v
    })

    setTasks(updatedTasks)
    setHours(updatedHours)
  }

  const deleteTask = (task: string) => {
    setTasks(tasks.filter((t) => t !== task))
    const { [task]: _, ...rest } = hours
    setHours(rest)
  }

  const updateHour = (task: string, dayIndex: number, value: number) => {
    const updated = [...hours[task]]
    updated[dayIndex] = value
    setHours({ ...hours, [task]: updated })
  }

  const rowTotal = (task: string) =>
    hours[task].reduce((a, b) => a + b, 0)

  const weekTotal = tasks.reduce((sum, t) => sum + rowTotal(t), 0)
  const overtime = weekTotal > 40

  return (
    <>
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Submit Timesheet
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Engagement type: Hourly · Expected hours: 40
            </div>
          </div>

          {/* Comment button */}
          <button
            onClick={() => setShowComments(true)}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <MessageSquare className="h-4 w-4" />
            Comment
          </button>
        </div>

        {/* Selectors */}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-gray-500">
              Select week (Monday)
            </label>
            <div className="relative mt-1">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">
              Select assignment
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              value={assignment.id}
              onChange={(e) =>
                setAssignment(
                  ASSIGNMENTS.find((a) => a.id === e.target.value)!
                )
              }
            >
              {ASSIGNMENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.type} · {a.id} — {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Validation banner */}
        <div
          className={`mt-4 rounded-lg border px-4 py-2 text-xs ${
            overtime
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          {overtime
            ? '⚠ Overtime detected · Manager approval will be required'
            : '✔ No overtime risk detected · Hours align with engagement terms'}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">Task / Activity</th>
              {days.map((d) => (
                <th key={d} className="px-3 py-3 text-center">
                  {d}
                </th>
              ))}
              <th className="px-4 py-3 text-center">Total</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {tasks.map((task) => (
              <tr key={task} className="border-b border-gray-100">
                <td className="px-4 py-2">
                  <input
                    defaultValue={task}
                    onBlur={(e) => updateTaskName(task, e.target.value)}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm font-medium"
                  />
                </td>

                {days.map((_, i) => (
                  <td key={i} className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      value={hours[task][i]}
                      onChange={(e) =>
                        updateHour(task, i, Number(e.target.value))
                      }
                      className="w-14 rounded-md border border-gray-200 px-2 py-1 text-sm text-center"
                    />
                  </td>
                ))}

                <td className="px-4 py-3 text-center font-semibold">
                  {rowTotal(task)}
                </td>

                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => deleteTask(task)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 py-4 border-t bg-gray-50">
        <button
          onClick={addTask}
          className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add task
        </button>

        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium text-gray-700">
            <Receipt className="h-4 w-4" />
            Expenses
          </button>

          <div className="text-sm font-medium">
            Week total:{' '}
            <span className="font-semibold">{weekTotal}</span> hours
          </div>

          <button
            onClick={onSubmit}
            className="rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white"
          >
            Submit
          </button>
        </div>
      </div>

      {/* Comments drawer */}
      {showComments && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/30"
            onClick={() => setShowComments(false)}
          />
          <div className="w-[360px] bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm font-semibold">Add comment</div>
              <button onClick={() => setShowComments(false)}>
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="p-4 flex-1">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add context for approver..."
                className="w-full h-full rounded-md border border-gray-200 p-2 text-sm resize-none"
              />
            </div>

            <div className="p-4 border-t">
              <button
                onClick={() => setShowComments(false)}
                className="w-full rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
              >
                Save comment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'

type Action = {
  label: string
  description: string
  intent: 'primary' | 'secondary'
}

type ActionPanelProps = {
  title: string
  actions: Action[]
}

export default function ActionPanel({ title, actions }: ActionPanelProps) {
  return (
    <div className="rounded-md border bg-white p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-3">
        {title}
      </h3>

      <div className="space-y-3">
        {actions.map((action, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-4"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {action.label}
              </p>
              <p className="text-sm text-gray-500">
                {action.description}
              </p>
            </div>

            <button
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                action.intent === 'primary'
                  ? 'bg-black text-white'
                  : 'border text-gray-700'
              }`}
            >
              Take action
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

"use client"

interface Option {
  label: string
  description?: string
  value: string
}

interface NovaQuestionProps {
  title?: string
  question: string
  options: Option[]
  value: string
  onChange: (value: string) => void
}

export default function NovaQuestion({
  title,
  question,
  options,
  value,
  onChange,
}: NovaQuestionProps) {
  return (
    <div>
      {title && (
        <div className="mb-4">
          <div className="text-sm text-gray-500">Nova</div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-sm font-medium text-gray-900 mb-4">{question}</p>

        <div className="space-y-4">
          {options.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition ${
                value === option.value
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="nova-question"
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="mt-1"
              />

              <div>
                <div className="text-sm font-medium text-gray-900">
                  {option.label}
                </div>
                {option.description && (
                  <div className="text-sm text-gray-600">
                    {option.description}
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

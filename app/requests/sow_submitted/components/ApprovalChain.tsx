type ApprovalStep = {
  name: string
  role: string
  status: 'completed' | 'active' | 'pending'
}

const APPROVAL_STEPS: ApprovalStep[] = [
  {
    name: 'Amy Jackson',
    role: 'Supervisor',
    status: 'completed',
  },
  {
    name: 'Christopher Chang',
    role: 'CC Owner',
    status: 'active',
  },
  {
    name: 'Harjot Kaur',
    role: 'InfoSec',
    status: 'pending',
  },
]

export default function ApprovalChain() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-8">
        Approval routing
      </h2>

      <div className="flex items-center justify-between">
        {APPROVAL_STEPS.map((step, index) => {
          const isLast = index === APPROVAL_STEPS.length - 1

          return (
            <div key={index} className="flex items-center flex-1">
              {/* Node */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    flex items-center justify-center w-9 h-9 rounded-full border-2
                    ${
                      step.status === 'completed'
                        ? 'bg-green-500 border-green-500 text-white'
                        : step.status === 'active'
                        ? 'border-amber-500 text-amber-600'
                        : 'border-gray-300 text-gray-400'
                    }
                  `}
                >
                  {step.status === 'completed' && '✓'}
                </div>

                <div className="mt-2 text-sm font-medium text-gray-900">
                  {step.name}
                </div>
                <div className="text-xs text-gray-500">
                  {step.role}
                </div>
              </div>

              {/* Connector */}
              {!isLast && (
                <div
                  className={`
                    flex-1 h-px mx-4
                    ${
                      step.status === 'completed'
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                    }
                  `}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

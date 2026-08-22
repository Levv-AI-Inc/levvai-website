"use client"

import { useRouter } from "next/navigation"

interface NovaFooterProps {
  canContinue: boolean
  input: string
  nextPath?: string
}

export default function NovaFooter({
  canContinue,
  nextPath,
}: NovaFooterProps) {
  const router = useRouter()

  const handleContinue = () => {
    if (!canContinue) return
    if (nextPath) {
      router.push(nextPath)
    }
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-4 flex justify-end">
      <button
        onClick={handleContinue}
        disabled={!canContinue}
        className={`px-6 py-2.5 rounded-full text-sm font-medium transition
        focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 ${
          canContinue
            ? "bg-gray-900 text-white hover:bg-gray-800"
            : "bg-gray-200 text-gray-500 cursor-not-allowed"
        }`}
      >
        Continue
      </button>
    </div>
  )
}

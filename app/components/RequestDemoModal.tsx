"use client"

import { useState } from "react"

export default function RequestDemoModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [submitted, setSubmitted] = useState(false)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        {!submitted ? (
          <>
            <h2 className="text-2xl font-semibold tracking-tight">
              Request a demo
            </h2>

            <p className="mt-2 text-sm text-neutral-600">
              Share your details and we’ll reach out directly.
            </p>

            <form
                className="mt-6 space-y-4"
                onSubmit={async (e) => {
                    e.preventDefault()

                    const form = e.currentTarget
                    const formData = new FormData(form)

                    await fetch("/api/demo-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formData.get("name"),
                        email: formData.get("email"),
                        company: formData.get("company"),
                    }),
                    })

                    setSubmitted(true)
                    setTimeout(onClose, 1200)
                }}
                >

              <input
                name="name"
                required
                placeholder="First name"
                className="w-full rounded-md border border-neutral-300 p-3 text-sm"
                />


              <input
                name="company"
                required
                placeholder="Company"
                className="w-full rounded-md border border-neutral-300 p-3 text-sm"
                />


              <input
                    name="email"
                    type="email"
                    required
                    placeholder="Work email"
                    className="w-full rounded-md border border-neutral-300 p-3 text-sm"
                    />


              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                >
                  Submit
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>

              <p className="pt-2 text-xs text-neutral-500">
                No spam. Direct response.
              </p>
            </form>
          </>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm font-medium">
              Thanks — we’ll be in touch shortly.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

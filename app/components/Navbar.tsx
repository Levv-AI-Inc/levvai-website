"use client"

import { useState, useEffect } from "react"
import Container from "@/components/Container"
import RequestDemoModal from "@/components/RequestDemoModal"

export default function Navbar() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const openModal = () => setOpen(true)
    window.addEventListener("open-demo-modal", openModal)
    return () => window.removeEventListener("open-demo-modal", openModal)
  }, [])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <Container>
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="text-lg font-bold tracking-tight">
              Levv AI
            </div>

            {/* CTA */}
            <button
              onClick={() =>
                window.dispatchEvent(new Event("open-demo-modal"))
              }
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-[1px] hover:bg-neutral-800"
            >
              Request demo
            </button>
          </div>
        </Container>
      </header>

      <RequestDemoModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

import Container from "@/components/Container"

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <Container>
        <div className="flex flex-col gap-6 py-12 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-neutral-600">
            © {new Date().getFullYear()} Levv AI. All rights reserved.
          </div>

          <div className="flex gap-6 text-sm text-neutral-600">
            <a
              href="/security"
              className="transition hover:text-neutral-900"
            >
              Security
            </a>
            <a
              href="#"
              className="transition hover:text-neutral-900"
            >
              Privacy
            </a>
            <a
              href="#"
              className="transition hover:text-neutral-900"
            >
              Contact
            </a>
          </div>
        </div>
      </Container>
    </footer>
  )
}

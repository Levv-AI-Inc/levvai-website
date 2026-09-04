import Link from "next/link"
import { ArrowLeft, CheckCircle2, GitBranch, LockKeyhole, ShieldCheck } from "lucide-react"

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-blue-100 bg-white/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Levv home">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
              <GitBranch className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <span className="text-base font-semibold text-slate-950">Levv</span>
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b border-blue-100 bg-blue-50/70">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
            <span className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Security and trust
            </span>
            <h1 className="mt-7 max-w-3xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
              Built for governed external workforce operations.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Levv AI is designed with enterprise security expectations in mind.
              We take a deliberate approach to how data is handled, accessed, and
              protected across the platform.
            </p>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 sm:px-8 md:grid-cols-2">
            {[
              [
                'Data protection',
                'Customer data is isolated by design and protected using modern encryption standards, both in transit and at rest.',
              ],
              [
                'Access controls',
                'Role-based access controls ensure users only have access to the data and functionality appropriate to their role.',
              ],
              [
                'AI and data usage',
                'Levv AI does not train shared models on customer data. AI features operate within defined boundaries and augment human decision-making.',
              ],
              [
                'Operational safeguards',
                'Logging, monitoring, and auditability are built into the platform to support transparency and accountability.',
              ],
            ].map(([title, copy]) => (
              <article
                key={title}
                className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <h2 className="mt-5 text-base font-semibold text-slate-950">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-blue-100 bg-slate-950 py-14 text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold">Compliance posture</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                We are actively working toward formal security and compliance
                frameworks as the platform scales. Details are available upon
                request.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">
                Questions about security, data handling, or compliance?
              </p>
              <a
                href="mailto:security@levvai.com"
                className="mt-2 block text-sm font-semibold text-white hover:text-blue-200"
              >
                security@levvai.com
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

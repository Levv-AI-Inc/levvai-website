import Container from "@/components/Container"

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 pt-24">
      <Container>
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight">
            Security & Trust
          </h1>

          <p className="mt-6 text-lg text-neutral-600">
            Levv AI is designed with enterprise security expectations in mind.
            We take a deliberate, security-first approach to how data is handled,
            accessed, and protected across the platform.
          </p>

          <div className="mt-12 space-y-10">
            <section>
              <h2 className="text-xl font-medium">Data protection</h2>
              <p className="mt-3 text-neutral-600">
                Customer data is isolated by design and protected using modern
                encryption standards, both in transit and at rest.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-medium">Access controls</h2>
              <p className="mt-3 text-neutral-600">
                Role-based access controls ensure users only have access to the
                data and functionality appropriate to their role.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-medium">AI and data usage</h2>
              <p className="mt-3 text-neutral-600">
                Levv AI does not train shared models on customer data. AI features
                operate within defined boundaries and are designed to augment
                human decision-making—not replace it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-medium">Operational safeguards</h2>
              <p className="mt-3 text-neutral-600">
                Logging, monitoring, and auditability are built into the platform
                to support transparency and accountability.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-medium">Compliance posture</h2>
              <p className="mt-3 text-neutral-600">
                We are actively working toward formal security and compliance
                frameworks as the platform scales. Details are available upon
                request.
              </p>
            </section>
          </div>

          <div className="mt-16 rounded-xl border border-neutral-200 bg-neutral-50 p-6">
            <p className="text-sm text-neutral-600">
              Questions about security, data handling, or compliance?
            </p>
            <p className="mt-2 text-sm font-medium">
              Contact us at{" "}
              <a
                href="mailto:security@levvai.com"
                className="text-accent hover:underline"
              >
                security@levvai.com
              </a>
            </p>
          </div>
        </div>
      </Container>
    </main>
  )
}

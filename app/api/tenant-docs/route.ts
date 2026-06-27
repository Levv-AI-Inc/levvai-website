type DocumentType = 'configuration' | 'integration'

type RequestBody = {
  documentType: DocumentType
  sections: string[]
}

type GeneratedSection = {
  title: string
  narrative: string
  bullets: string[] | null
  table:
    | {
        columns: string[]
        rows: string[][]
      }
    | null
}

type GeneratedDocument = {
  title: string
  subtitle: string
  generatedAt: string
  sections: GeneratedSection[]
}

type TenantSnapshot = {
  tenant: {
    companyName: string
    environment: string
    generatedAt?: string
  }
  configuration?: Record<string, any>
  integrations?: Record<string, any>
}

const tenantSnapshot: TenantSnapshot = {
  tenant: {
    companyName: 'Levv Demo Tenant',
    environment: 'Prototype',
  },

  configuration: {
    roles: {
      configured: true,
      users: [
        {
          name: 'Sarah Thompson',
          email: 'sarah.thompson@company.com',
          status: 'Active',
          role: 'Admin',
          businessUnit: '',
          costCenter: '',
          ssoEnabled: false,
        },
        {
          name: 'James Lee',
          email: 'james.lee@company.com',
          status: 'Active',
          role: 'Hiring Manager',
          businessUnit: '',
          costCenter: '',
          ssoEnabled: false,
        },
        {
          name: 'Priya Patel',
          email: 'priya.patel@company.com',
          status: 'Inactive',
          role: 'Viewer',
          businessUnit: '',
          costCenter: '',
          ssoEnabled: false,
        },
      ],
    },

    financial: {
      configured: true,
      currencies: [
        { currency: 'US Dollar', isoCode: 'USD', symbol: '$', status: 'Active' },
        { currency: 'Euro', isoCode: 'EUR', symbol: '€', status: 'Active' },
        { currency: 'British Pound', isoCode: 'GBP', symbol: '£', status: 'Inactive' },
      ],
      expenseCodes: [
        { code: 'TRAVEL', description: 'Travel expenses', status: 'Active' },
        { code: 'MEALS', description: 'Meals and entertainment', status: 'Active' },
      ],
      taxCodes: [],
      timesheets: [],
    },

    onboarding: {
      configured: true,
      workflows: [
        {
          policy: 'US IT Worker',
          status: 'Draft',
          active: true,
        },
      ],
      offboarding: [],
      requirementsList: [],
    },

    rates: {
      configured: false,
      note: 'Rates, rate cards, and rate rules have not yet been configured in the tenant.',
      rateCards: [],
      rateRules: [],
      rateSchedules: [],
    },

    org: {
      configured: false,
      note: 'Company structure, business units, legal entities, and sites are not yet fully configured in the tenant.',
      businessUnits: [],
      legalEntities: [],
      sites: [],
    },

    workflow: {
      configured: false,
      note: 'Approval workflows are not yet fully configured in the tenant.',
      contingent: [],
      sow: [],
    },

    workerTypes: {
      configured: false,
      note: 'Worker types and engagement classifications are not yet fully configured in the tenant.',
      items: [],
    },

    customFields: {
      configured: false,
      note: 'Custom fields are not yet configured in the tenant.',
      items: [],
    },

    notifications: {
      configured: false,
      note: 'Notification and escalation rules are not yet configured in the tenant.',
      items: [],
    },

    policy: {
      configured: false,
      note: 'Nova policy extraction and enforcement rules are not yet configured in the tenant.',
      items: [],
    },
  },

  integrations: {
    sso: {
      configured: false,
      note: 'SSO is not yet configured in the tenant.',
      provider: '',
      loginMethod: '',
      matchingStrategy: '',
    },

    users: {
      configured: false,
      note: 'No formal user master data integration is configured yet.',
      sourceSystem: '',
      direction: '',
      frequency: '',
      keyFields: [],
    },

    workers: {
      configured: false,
      note: 'No worker or engagement data integration is configured yet.',
      sourceSystem: '',
      downstreamTargets: [],
      syncMode: '',
    },

    suppliers: {
      configured: false,
      note: 'No supplier master data integration is configured yet.',
      sourceSystem: '',
      downstreamTargets: [],
      onboardingFields: [],
    },

    'cost-centres': {
      configured: false,
      note: 'No cost centre or financial master data integration is configured yet.',
      sourceSystem: '',
      direction: '',
      frequency: '',
      keyFields: [],
    },

    rates: {
      configured: false,
      note: 'No rates or rate card integration is configured yet.',
      ownership: '',
      downstreamUsage: [],
      syncMode: '',
    },

    transactions: {
      configured: false,
      note: 'No transactional integrations are configured yet.',
      outboundObjects: [],
      integrationStyle: '',
      controls: [],
    },

    audit: {
      configured: false,
      note: 'No integration monitoring or audit configuration is defined yet.',
      logging: '',
      retryPolicy: '',
      supportModel: '',
    },
  },
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody

    if (!body?.documentType || !Array.isArray(body.sections) || body.sections.length === 0) {
      return Response.json(
        { error: 'Document type and at least one section are required.' },
        { status: 400 }
      )
    }

    const snapshot = await getTenantSnapshot()
    const document = process.env.OPENAI_API_KEY
      ? await generateDocumentWithOpenAI(body.documentType, body.sections, snapshot)
      : generateFallbackDocument(body.documentType, body.sections, snapshot)

    const rtf = buildRtf(document)
    const date = new Date().toISOString().slice(0, 10)

    return new Response(rtf, {
      headers: {
        'Content-Type': 'application/rtf',
        'Content-Disposition': `attachment; filename="${
          body.documentType === 'configuration'
            ? 'Tenant_Configuration_Document'
            : 'Integration_Specification'
        }_${date}.rtf"`,
      },
    })
  } catch (err: any) {
    console.error('[tenant-docs]', err)
    return Response.json(
      { error: err?.message ?? 'Failed to generate tenant documentation.' },
      { status: 500 }
    )
  }
}

async function generateDocumentWithOpenAI(
  documentType: DocumentType,
  sections: string[],
  snapshot: TenantSnapshot
): Promise<GeneratedDocument> {
  const { default: OpenAI } = await import('openai')
  const client = new OpenAI()
  const prompt = buildPrompt(documentType, sections, snapshot)

  const response = await client.responses.create({
      model: 'gpt-5.4',
      input: prompt,
      text: {
        format: {
          type: 'json_schema',
          name: 'tenant_document',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              subtitle: { type: 'string' },
              generatedAt: { type: 'string' },
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    title: { type: 'string' },
                    narrative: { type: 'string' },
                    bullets: {
                      anyOf: [
                        {
                          type: 'array',
                          items: { type: 'string' },
                        },
                        { type: 'null' },
                      ],
                    },
                    table: {
                      anyOf: [
                        {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            columns: {
                              type: 'array',
                              items: { type: 'string' },
                            },
                            rows: {
                              type: 'array',
                              items: {
                                type: 'array',
                                items: { type: 'string' },
                              },
                            },
                          },
                          required: ['columns', 'rows'],
                        },
                        { type: 'null' },
                      ],
                    },
                  },
                  required: ['title', 'narrative', 'bullets', 'table'],
                },
              },
            },
            required: ['title', 'subtitle', 'generatedAt', 'sections'],
          },
        },
      },
    })

  return JSON.parse(response.output_text) as GeneratedDocument
}

function generateFallbackDocument(
  documentType: DocumentType,
  sections: string[],
  snapshot: TenantSnapshot
): GeneratedDocument {
  const title =
    documentType === 'configuration'
      ? 'Tenant Configuration Document'
      : 'Integration Specification Document'

  return {
    title,
    subtitle: `${snapshot.tenant.companyName} - ${snapshot.tenant.environment}`,
    generatedAt: snapshot.tenant.generatedAt || new Date().toISOString(),
    sections: sections.map((section) => ({
      title: humanizeSection(section),
      narrative:
        'This local draft was generated from the current tenant snapshot. Configure OpenAI credentials to generate a richer narrative document.',
      bullets: [
        `Tenant: ${snapshot.tenant.companyName}`,
        `Environment: ${snapshot.tenant.environment}`,
        'Source: local tenant documentation snapshot',
      ],
      table: null,
    })),
  }
}

function humanizeSection(section: string) {
  return section
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function getTenantSnapshot(): Promise<TenantSnapshot> {
  const now = new Date().toLocaleString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return {
    ...tenantSnapshot,
    tenant: {
      ...tenantSnapshot.tenant,
      generatedAt: now,
    },
  }
}

function buildPrompt(
  documentType: DocumentType,
  selectedSections: string[],
  snapshot: TenantSnapshot
) {
  const modeLabel =
    documentType === 'configuration'
      ? 'Tenant Configuration Document'
      : 'Integration Specification Document'

  return `
You are generating an official ${modeLabel} for Levv, an AI-native vendor management platform.

Return JSON only. Follow the schema exactly.

Writing rules:
- Use the actual tenant snapshot provided
- Be specific and concrete
- Avoid generic consulting filler
- Each selected section should result in one section in the output
- Narrative should be 2-4 sharp sentences
- Set "bullets" to null when there are no bullets
- Set "table" to null when a table is not needed
- If a selected area is not configured, say so clearly
- Do not invent settings, workflows, rules, integrations, or controls that do not exist
- For unconfigured areas, explicitly state that the area is not yet configured in the current tenant
- If useful, present empty or partial configuration as a table with zero or limited records
- Prefer tables for concrete configured records like users, currencies, expense codes, and workflows
- This is admin-grade documentation, not marketing copy

Selected sections:
${JSON.stringify(selectedSections, null, 2)}

Tenant snapshot:
${JSON.stringify(snapshot, null, 2)}
`
}

function buildRtf(doc: GeneratedDocument) {
  const rtfSections = doc.sections
    .map((section) => {
      const title = `\\pard\\sb300\\sa120\\b\\fs28 ${escapeRtf(section.title)}\\b0\\fs22\\par`
      const narrative = `\\pard\\sa160 ${escapeRtf(section.narrative)}\\par`

      const bullets = (section.bullets ?? [])
        .map((bullet) => `\\pard\\fi-360\\li720\\tx720\\bullet ${escapeRtf(bullet)}\\par`)
        .join('\n')

      const table = section.table ? buildTableRtf(section.table.columns, section.table.rows) : ''

      return [title, narrative, bullets, table].filter(Boolean).join('\n')
    })
    .join('\n')

  return `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Calibri;}{\\f1 Arial;}}
{\\colortbl ;\\red17\\green17\\blue17;\\red102\\green102\\blue102;\\red235\\green239\\blue245;}
\\f0\\fs22\\cf1
\\pard\\sb0\\sa200\\b\\fs40 ${escapeRtf(doc.title)}\\b0\\par
\\pard\\sa120\\fs22 ${escapeRtf(doc.subtitle)}\\par
\\pard\\sa320\\fs18\\cf2 Generated ${escapeRtf(doc.generatedAt)}\\cf1\\par
${rtfSections}
}`
}

function buildTableRtf(columns: string[], rows: string[][]) {
  if (!columns.length) return ''

  const safeRows = rows.length ? rows : [['No records configured', '', '', '', '', '', ''].slice(0, columns.length)]

  const header = buildTableRow(columns, true)
  const body = safeRows.map((row) => buildTableRow(padRow(row, columns.length), false)).join('\n')

  return `\\pard\\sa120\\par\n${header}\n${body}\n\\pard\\sa160\\par`
}

function buildTableRow(cells: string[], isHeader: boolean) {
  const widths = getCellWidths(cells.length)
  const cellDefs = widths.map((w) => `\\cellx${w}`).join('')
  const cellText = cells
    .map((cell) =>
      isHeader
        ? `\\intbl\\b ${escapeRtf(cell || '')}\\b0\\cell`
        : `\\intbl ${escapeRtf(cell || '')}\\cell`
    )
    .join('')

  return `\\trowd\\trgaph108\\trleft0${cellDefs}\n${cellText}\\row`
}

function getCellWidths(count: number) {
  const base = 9000
  const step = Math.floor(base / count)
  const widths: number[] = []
  for (let i = 1; i <= count; i++) widths.push(step * i)
  return widths
}

function padRow(row: string[], length: number) {
  const next = [...row]
  while (next.length < length) next.push('')
  return next.slice(0, length)
}

function escapeRtf(str: string) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/[^\x00-\x7F]/g, (c) => `\\u${c.charCodeAt(0)}?`)
}

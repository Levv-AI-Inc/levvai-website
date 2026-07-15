#!/usr/bin/env node

const START_KEY = '__start__'
const END_KEY = '__end__'
const DEFAULT_BASE_URL = 'http://localhost:3000'

function usage() {
  console.log(`
Workflow graph backend round-trip diagnostic

Usage:
  COOKIE='csrftoken=...; sessionid=...' node scripts/workflow-graph-roundtrip.mjs

Options via env:
  BASE_URL       Same-origin frontend or backend URL. Default: ${DEFAULT_BASE_URL}
  COOKIE         Authenticated browser cookie header. Required.
  CSRF_TOKEN     CSRF token. If omitted, read from csrftoken in COOKIE.
  WORKFLOW_ID    Existing workflow id to PATCH instead of creating a new one.
  CLEANUP        Delete newly-created workflow after test. Default: true.

Example:
  BASE_URL=http://localhost:3000 \\
  COOKIE='csrftoken=abc; sessionid=xyz' \\
  node scripts/workflow-graph-roundtrip.mjs
`)
}

function readCookie(cookieHeader, name) {
  const parts = cookieHeader.split(';').map((part) => part.trim())
  const match = parts.find((part) => part.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
}

function endpoint(baseUrl, path) {
  return new URL(path, baseUrl.replace(/\/+$/, '')).toString()
}

async function request(path, { method = 'GET', body } = {}) {
  const cookie = process.env.COOKIE || ''
  const csrfToken = process.env.CSRF_TOKEN || readCookie(cookie, 'csrftoken')
  const headers = {
    Accept: 'application/json',
    Cookie: cookie,
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    if (csrfToken) headers['X-CSRFToken'] = csrfToken
  }

  const response = await fetch(endpoint(process.env.BASE_URL || DEFAULT_BASE_URL, path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let payload = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text }
  }

  if (!response.ok) {
    const error = new Error(`${method} ${path} failed with ${response.status}`)
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

function mockWorkflowPayload() {
  const suffix = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const blocks = [
    {
      client_key: `roundtrip_identity_${suffix}`,
      sequence: 1,
      block_type: 'requirement',
      name: `Roundtrip Identity ${suffix}`,
      gate_type: 'hard',
      layout: {
        level: 1,
        position: 1,
        workflow_graph: {
          incoming: [START_KEY],
          outgoing: [`roundtrip_workday_${suffix}`],
        },
      },
      config: {
        workflow_graph: {
          incoming: [START_KEY],
          outgoing: [`roundtrip_workday_${suffix}`],
        },
      },
      requirements: [
        {
          sequence: 1,
          name: 'Roundtrip Photo ID',
          owner: 'worker',
        },
      ],
    },
    {
      client_key: `roundtrip_workday_${suffix}`,
      sequence: 2,
      block_type: 'system',
      name: `Roundtrip Workday ${suffix}`,
      gate_type: 'hard',
      integration_type: 'api_call',
      layout: {
        level: 2,
        position: 2,
        workflow_graph: {
          incoming: [`roundtrip_identity_${suffix}`],
          outgoing: [`roundtrip_vendor_${suffix}`],
        },
      },
      config: {
        endpoint_key: 'roundtrip_workday',
        workflow_graph: {
          incoming: [`roundtrip_identity_${suffix}`],
          outgoing: [`roundtrip_vendor_${suffix}`],
        },
      },
      requirements: [],
    },
    {
      client_key: `roundtrip_vendor_${suffix}`,
      sequence: 3,
      block_type: 'requirement',
      name: `Roundtrip Vendor ${suffix}`,
      gate_type: 'soft',
      layout: {
        level: 3,
        position: 3,
        workflow_graph: {
          incoming: [`roundtrip_workday_${suffix}`],
          outgoing: [`roundtrip_legal_${suffix}`],
        },
      },
      config: {
        workflow_graph: {
          incoming: [`roundtrip_workday_${suffix}`],
          outgoing: [`roundtrip_legal_${suffix}`],
        },
      },
      requirements: [
        {
          sequence: 1,
          name: 'Roundtrip COI',
          owner: 'supplier',
        },
      ],
    },
    {
      client_key: `roundtrip_legal_${suffix}`,
      sequence: 4,
      block_type: 'requirement',
      name: `Roundtrip Legal ${suffix}`,
      gate_type: 'hard',
      layout: {
        level: 4,
        position: 4,
        workflow_graph: {
          incoming: [`roundtrip_vendor_${suffix}`],
          outgoing: [END_KEY],
        },
      },
      config: {
        workflow_graph: {
          incoming: [`roundtrip_vendor_${suffix}`],
          outgoing: [END_KEY],
        },
      },
      requirements: [
        {
          sequence: 1,
          name: 'Roundtrip NDA',
          owner: 'worker',
        },
      ],
    },
  ]

  return {
    expectedEdges: [
      [START_KEY, blocks[0].client_key],
      [blocks[0].client_key, blocks[1].client_key],
      [blocks[1].client_key, blocks[2].client_key],
      [blocks[2].client_key, blocks[3].client_key],
      [blocks[3].client_key, END_KEY],
    ],
    payload: {
      name: `Graph Roundtrip ${suffix}`,
      workflow_type: 'onboarding',
      status: 'draft',
      is_active: true,
      policy_scope: {
        worker_type: 'contingent',
        fields: [],
      },
      blocks,
      dependencies: [
        { from_block_key: START_KEY, to_block_key: blocks[0].client_key },
        { from_block_key: blocks[0].client_key, to_block_key: blocks[1].client_key },
        { from_block_key: blocks[1].client_key, to_block_key: blocks[2].client_key },
        { from_block_key: blocks[2].client_key, to_block_key: blocks[3].client_key },
        { from_block_key: blocks[3].client_key, to_block_key: END_KEY },
      ],
    },
  }
}

function returnedEdgesFromDependencies(workflow) {
  return (workflow.dependencies || [])
    .map((dependency) => [dependency.from_block_key, dependency.to_block_key])
    .filter(([from, to]) => from && to)
}

function returnedEdgesFromGraphConfig(workflow, source) {
  const edges = []
  for (const block of workflow.blocks || []) {
    const graph =
      source === 'config'
        ? block.config?.workflow_graph
        : block.layout?.workflow_graph
    if (!graph) continue
    for (const from of graph.incoming || []) edges.push([from, block.client_key])
    for (const to of graph.outgoing || []) edges.push([block.client_key, to])
  }
  return edges
}

function edgeKey([from, to]) {
  return `${from}->${to}`
}

function compareEdges(label, expectedEdges, actualEdges) {
  const expected = new Set(expectedEdges.map(edgeKey))
  const actual = new Set(actualEdges.map(edgeKey))
  const missing = [...expected].filter((key) => !actual.has(key))
  const extra = [...actual].filter((key) => !expected.has(key))
  return { label, ok: missing.length === 0 && extra.length === 0, missing, extra }
}

function summarizeWorkflow(workflow) {
  return {
    id: workflow.id,
    name: workflow.name,
    block_count: workflow.blocks?.length ?? 0,
    dependency_count: workflow.dependencies?.length ?? 0,
    blocks: (workflow.blocks || []).map((block) => ({
      id: block.id,
      client_key: block.client_key,
      name: block.name,
      layout: block.layout,
      config_workflow_graph: block.config?.workflow_graph,
    })),
    dependencies: workflow.dependencies || [],
  }
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage()
    return
  }
  if (!process.env.COOKIE) {
    usage()
    throw new Error('COOKIE is required so the backend sees an authenticated session.')
  }

  const { payload, expectedEdges } = mockWorkflowPayload()
  const workflowId = process.env.WORKFLOW_ID
  const cleanup = process.env.CLEANUP !== 'false' && !workflowId
  const path = workflowId
    ? `/api/compliance/workflows/${encodeURIComponent(workflowId)}/`
    : '/api/compliance/workflows/'
  const method = workflowId ? 'PATCH' : 'POST'

  console.log(`Writing mock workflow graph via ${method} ${path}`)
  const saved = await request(path, { method, body: payload })
  const id = saved.id || workflowId
  console.log(`Saved workflow id: ${id}`)

  const fetched = await request(`/api/compliance/workflows/${encodeURIComponent(String(id))}/`)
  const checks = [
    compareEdges('dependencies[]', expectedEdges, returnedEdgesFromDependencies(fetched)),
    compareEdges('block.config.workflow_graph', expectedEdges, returnedEdgesFromGraphConfig(fetched, 'config')),
    compareEdges('block.layout.workflow_graph', expectedEdges, returnedEdgesFromGraphConfig(fetched, 'layout')),
  ]

  console.log('\nBackend round-trip summary:')
  console.log(JSON.stringify(summarizeWorkflow(fetched), null, 2))

  console.log('\nRelationship checks:')
  for (const check of checks) {
    console.log(`- ${check.ok ? 'PASS' : 'FAIL'} ${check.label}`)
    if (check.missing.length) console.log(`  missing: ${check.missing.join(', ')}`)
    if (check.extra.length) console.log(`  extra: ${check.extra.join(', ')}`)
  }

  if (cleanup) {
    await request(`/api/compliance/workflows/${encodeURIComponent(String(id))}/`, {
      method: 'DELETE',
    })
    console.log(`\nDeleted test workflow ${id}`)
  }

  if (checks.some((check) => !check.ok)) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error.message)
  if (error.payload) console.error(JSON.stringify(error.payload, null, 2))
  process.exitCode = 1
})

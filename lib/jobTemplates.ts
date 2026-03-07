'use client'

export type JobTemplate = {
  id: number | string
  role: string
  description: string
  country: string
  region_in_country?: string
  region?: string
  created_at?: string
  updated_at?: string
}

export type JobTemplateListParams = {
  search?: string
  q?: string
  country?: string
  region?: string
}

export type JobTemplateUploadInput = {
  role: string
  description: string
  country: string
  region: string
}

export type JobTemplateUploadError = {
  row: number
  errors: Record<string, string[] | string>
}

export type JobTemplateUploadResponse = {
  created: number
  updated: number
  failed: number
  errors?: JobTemplateUploadError[]
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || ''
  return ''
}

function normalizeTemplate(template: JobTemplate): JobTemplate {
  return {
    ...template,
    region:
      template.region ||
      template.region_in_country ||
      '',
  }
}

async function parseJsonSafe(response: Response) {
  return response.json().catch(() => ({}))
}

function formatApiError(body: unknown, fallback: string) {
  if (!body || typeof body !== 'object') return fallback
  const payload = body as Record<string, unknown>
  if (typeof payload.detail === 'string') return payload.detail
  if (typeof payload.message === 'string') return payload.message
  return fallback
}

export async function getJobTemplates(
  params: JobTemplateListParams = {},
): Promise<JobTemplate[]> {
  const query = new URLSearchParams()

  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  } else if (params.q?.trim()) {
    query.set('q', params.q.trim())
  }

  if (params.country?.trim()) {
    query.set('country', params.country.trim())
  }

  if (params.region?.trim()) {
    query.set('region', params.region.trim())
  }

  const suffix = query.toString()
  const target = suffix
    ? `/admin/job-templates/?${suffix}`
    : '/admin/job-templates/'

  const response = await fetch(target, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new Error(
      formatApiError(
        body,
        `Failed to load templates (${response.status})`,
      ),
    )
  }

  const rows = Array.isArray(body)
    ? body
    : Array.isArray((body as { results?: unknown[] }).results)
    ? (body as { results: unknown[] }).results
    : []

  return rows
    .filter(
      (row): row is JobTemplate =>
        Boolean(row) && typeof row === 'object',
    )
    .map((row) => normalizeTemplate(row))
}

export async function uploadJobTemplatesJson(
  templates: JobTemplateUploadInput[],
): Promise<JobTemplateUploadResponse> {
  const csrfToken = getCookie('csrftoken')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken
  }

  const response = await fetch('/admin/job-templates/upload/', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ templates }),
  })

  const body =
    (await parseJsonSafe(response)) as JobTemplateUploadResponse
  if (!response.ok) {
    throw new Error(
      formatApiError(
        body,
        `Failed to upload templates (${response.status})`,
      ),
    )
  }

  return body
}

export async function uploadJobTemplatesCsv(
  file: File,
): Promise<JobTemplateUploadResponse> {
  const csrfToken = getCookie('csrftoken')
  const headers: Record<string, string> = {}
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken
  }

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/admin/job-templates/upload/', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  })

  const body =
    (await parseJsonSafe(response)) as JobTemplateUploadResponse
  if (!response.ok) {
    throw new Error(
      formatApiError(
        body,
        `Failed to upload CSV (${response.status})`,
      ),
    )
  }

  return body
}

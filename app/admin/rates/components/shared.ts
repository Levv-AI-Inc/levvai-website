import type {
  RateLookupOption,
  RateStructureComponent,
} from '@/lib/api/rates'

export function formatTimestamp(value: string): string {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function createClientId() {
  return Math.random().toString(36).slice(2, 10)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function getRateComponentKey(
  component: Pick<RateStructureComponent, 'id' | 'code' | 'sequence' | 'label'>,
) {
  if (component.code?.trim()) return component.code.trim()
  if (component.id !== undefined) return `component_${component.id}`

  const slug = slugify(component.label || `component_${component.sequence}`)
  return slug || `component_${component.sequence}`
}

export function lookupLabel(
  options: RateLookupOption[],
  value: string,
) {
  return options.find((option) => option.value === value)?.label || value
}

export function statusBadgeClass(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700'
    case 'archived':
      return 'bg-slate-200 text-slate-700'
    default:
      return 'bg-amber-100 text-amber-700'
  }
}

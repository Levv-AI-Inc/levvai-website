'use client'

export type QualificationType =
  | 'skill'
  | 'certification'
  | 'education'
  | 'language'
  | 'tool'
  | 'other'

export type QualificationGroup = 'must_have' | 'nice_to_have'

export type ProficiencyLevel =
  | 'Beginner'
  | 'Intermediate'
  | 'Advanced'
  | 'Expert'

export type ResponseMode = 'years' | 'rating' | 'yes_no' | 'text'

export type Qualification = {
  id: string
  name: string
  type: QualificationType
  group: QualificationGroup
  description: string
  mandatory: boolean
  knockout: boolean
  responseMode: ResponseMode
  minYears: number
  proficiency: ProficiencyLevel
  weight: number
  tags: string[]
}

export type QualificationLibraryItem = {
  name: string
  type: QualificationType
  description?: string
  tags?: string[]
}

export const QUALIFICATION_LIBRARY: QualificationLibraryItem[] = [
  {
    name: 'Microsoft Excel',
    type: 'tool',
    tags: ['finance', 'analysis', 'reporting'],
  },
  {
    name: 'Microsoft Word',
    type: 'tool',
    tags: ['documentation'],
  },
  {
    name: 'PowerPoint',
    type: 'tool',
    tags: ['presentation'],
  },
  {
    name: 'SAP Fieldglass',
    type: 'tool',
    tags: ['vms', 'external workforce'],
  },
  {
    name: 'Vendor Management',
    type: 'skill',
    tags: ['procurement'],
  },
  {
    name: 'Statement of Work',
    type: 'skill',
    tags: ['services procurement'],
  },
  {
    name: 'Procurement Operations',
    type: 'skill',
    tags: ['source-to-pay'],
  },
  {
    name: 'Data Analysis',
    type: 'skill',
    tags: ['excel', 'analytics'],
  },
  {
    name: 'Project Management',
    type: 'skill',
    tags: ['delivery'],
  },
  {
    name: 'Stakeholder Management',
    type: 'skill',
    tags: ['communication'],
  },
  {
    name: 'Lean Six Sigma',
    type: 'certification',
    tags: ['process improvement'],
  },
  {
    name: 'PMP',
    type: 'certification',
    tags: ['project management'],
  },
  {
    name: "Bachelor's Degree",
    type: 'education',
    tags: ['degree'],
  },
  {
    name: 'English',
    type: 'language',
    tags: ['communication'],
  },
]

export function createQualificationId() {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID()
  }

  return Math.random().toString(36).slice(2, 10)
}

export function createCustomQualification(
  group: QualificationGroup,
): Qualification {
  return {
    id: createQualificationId(),
    name: 'New Qualification',
    type: 'skill',
    group,
    description: '',
    mandatory: group === 'must_have',
    knockout: false,
    responseMode: 'years',
    minYears: 1,
    proficiency: 'Intermediate',
    weight: group === 'must_have' ? 3 : 2,
    tags: [],
  }
}

export function createQualificationFromLibrary(
  item: QualificationLibraryItem,
  group: QualificationGroup,
): Qualification {
  return {
    id: createQualificationId(),
    name: item.name,
    type: item.type,
    group,
    description: item.description ?? '',
    mandatory: group === 'must_have',
    knockout: false,
    responseMode: item.type === 'certification' ? 'yes_no' : 'years',
    minYears: item.type === 'certification' ? 0 : 1,
    proficiency: 'Intermediate',
    weight: group === 'must_have' ? 4 : 2,
    tags: item.tags ?? [],
  }
}

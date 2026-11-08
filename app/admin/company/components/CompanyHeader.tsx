import type { ComponentProps } from 'react'
import { LevvRecordHeader } from '@/components/ui/levv-app'

type CompanyHeaderProps = Pick<
  ComponentProps<typeof LevvRecordHeader>,
  'statement' | 'figures' | 'actions'
>

export default function CompanyHeader(props: CompanyHeaderProps) {
  return <LevvRecordHeader trail="Admin settings / Company" title="Company" {...props} />
}

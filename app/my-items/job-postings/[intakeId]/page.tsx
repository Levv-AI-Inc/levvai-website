'use client'

import JobPostingDetailClient from '../../../cw/job-postings/[intakeId]/JobPostingDetailClient'

export default function MyItemsJobPostingDetailPage() {
  return (
    <JobPostingDetailClient
      backHref="/cw/job-postings"
      backLabel="Back to job postings"
    />
  )
}

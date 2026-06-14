'use client'

import JobPostingDetailClient from './JobPostingDetailClient'

export default function ContingentJobPostingDetailPage() {
  return (
    <JobPostingDetailClient
      backHref="/cw/job-postings"
      backLabel="Back to job postings"
    />
  )
}

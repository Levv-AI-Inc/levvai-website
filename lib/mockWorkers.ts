export type MockWorker = {
  cwsId: string
  hrSystemId: string
  name: string
  workerType: 'Contingent' | 'SOW'
  supplier: string
  role: string
  owner: string
  status: 'Active' | 'Onboarding' | 'Offboarded'
  start: string
  end: string
  location: string
  compliance: 'Compliant' | 'Review Required' | 'Non-Compliant'
  email: string
  department: string
}

/**
 * Shared demo worker directory.
 *
 * Keep mock worker records here so the Workers page and Nova always receive
 * the same names and lifecycle details.
 */
export const MOCK_WORKERS: MockWorker[] = [
  {
    cwsId: 'CWS-000231',
    hrSystemId: 'WD-784512',
    name: 'James Carter',
    workerType: 'Contingent',
    supplier: 'TEKsystems',
    role: 'Senior Backend Engineer',
    owner: 'Alex Morgan',
    status: 'Active',
    start: 'Jan 15, 2024',
    end: 'Dec 31, 2024',
    location: 'Remote – US',
    compliance: 'Compliant',
    email: 'j.carter@contractor.com',
    department: 'Engineering - Fintech',
  },
  {
    cwsId: 'CWS-000198',
    hrSystemId: 'WD-772903',
    name: 'Priya Shah',
    workerType: 'Contingent',
    supplier: 'Randstad',
    role: 'Business Analyst',
    owner: 'Rachel Adams',
    status: 'Onboarding',
    start: 'Apr 22, 2024',
    end: 'Oct 31, 2024',
    location: 'Toronto, ON',
    compliance: 'Review Required',
    email: 'p.shah@contractor.com',
    department: 'Transformation Office',
  },
  {
    cwsId: 'CWS-000164',
    hrSystemId: 'WD-761442',
    name: 'Daniel Wong',
    workerType: 'SOW',
    supplier: 'Insight Global',
    role: 'QA Automation Engineer',
    owner: 'Daniel Lee',
    status: 'Offboarded',
    start: 'Jul 01, 2023',
    end: 'Mar 31, 2024',
    location: 'New York, NY',
    compliance: 'Compliant',
    email: 'd.wong@consultant.com',
    department: 'Quality Assurance',
  },
  {
    cwsId: 'CWS-000245',
    hrSystemId: 'WD-791002',
    name: 'Elena Rossi',
    workerType: 'Contingent',
    supplier: 'TEKsystems',
    role: 'UX Researcher',
    owner: 'Alex Morgan',
    status: 'Active',
    start: 'Feb 01, 2024',
    end: 'Jan 31, 2025',
    location: 'Remote – US',
    compliance: 'Non-Compliant',
    email: 'e.rossi@contractor.com',
    department: 'Product Design',
  },
]

export function formatMockWorkersForNova() {
  return MOCK_WORKERS.map(
    (worker) =>
      `• ${worker.name} — ${worker.role} | CWS ID: ${worker.cwsId} | Type: ${worker.workerType} | Supplier: ${worker.supplier} | Owner: ${worker.owner} | Status: ${worker.status} | Started: ${worker.start} | Ends: ${worker.end} | Location: ${worker.location} | Compliance: ${worker.compliance} | Department: ${worker.department}`,
  ).join('\n')
}

import { NovaFinding } from './parseNovaResponse'

export function assignSeverity(finding: NovaFinding) {
  if (finding.type === 'missing') return 'RISK'
  if (finding.confidence === 'high') return 'CAUTION'
  return 'INFO'
}

import RateRuleEditorPage from '../../components/RateRuleEditorPage'

export default function EditRateRulePage({
  params,
}: {
  params: { ruleId: string }
}) {
  return <RateRuleEditorPage ruleId={params.ruleId} />
}

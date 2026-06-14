import RateCardEditorPage from '../../components/RateCardEditorPage'

export default function EditRateCardPage({
  params,
}: {
  params: { cardId: string }
}) {
  return <RateCardEditorPage cardId={params.cardId} />
}

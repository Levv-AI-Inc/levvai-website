import RateStructureEditorPage from '../../components/RateStructureEditorPage'

export default function EditRateStructurePage({
  params,
}: {
  params: { structureId: string }
}) {
  return <RateStructureEditorPage structureId={params.structureId} />
}

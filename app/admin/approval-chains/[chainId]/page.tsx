import ApprovalChainEditorPage from '../components/ApprovalChainEditorPage'

export default function EditApprovalChainPage({
  params,
}: {
  params: { chainId: string }
}) {
  return <ApprovalChainEditorPage chainId={params.chainId} />
}

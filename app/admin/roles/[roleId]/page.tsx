import RoleEditorPage from '../components/RoleEditorPage'

export default function EditRolePage({
  params,
}: {
  params: { roleId: string }
}) {
  return <RoleEditorPage roleId={params.roleId} />
}

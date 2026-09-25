import { RolesSection } from '../../components/settings/RolesSection'

export function RolesList() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Roles</h1>
      <div className="mt-4">
        <RolesSection />
      </div>
    </>
  )
}

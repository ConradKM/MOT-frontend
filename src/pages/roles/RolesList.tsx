import { RolesSection } from '../../components/settings/RolesSection'
import { SettingsPageHeader } from '../../components/settings/SettingsUI'

export function RolesList() {
  return (
    <>
      <SettingsPageHeader
        title="Roles"
        description={
          <>
            Tags you can assign to employees. "OWNER" is protected - every business has one
            and it can't be renamed or deleted.
          </>
        }
      />
      <div className="mt-6">
        <RolesSection />
      </div>
    </>
  )
}

import { richFieldBoxClass, richFieldPlaceholderClass } from './richFieldStyles'

interface RichStaticFieldProps {
  id?: string
  title?: string | null
  description?: string | null
  placeholder?: string
}

/**
 * A non-interactive field that matches RichDropdown's closed-state appearance exactly —
 * title plus a muted description line. For showing a value that sits in a form alongside
 * real RichDropdown/RichTextInput fields but isn't itself editable (e.g. a derived or
 * server-set value). No chevron, no click/keyboard handling — it's plain text, not a control.
 */
export function RichStaticField({ id, title, description, placeholder = '—' }: RichStaticFieldProps) {
  return (
    <div id={id} className={richFieldBoxClass}>
      {title ? (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-900">{title}</span>
          {description && <span className="block truncate text-xs text-slate-500">{description}</span>}
        </span>
      ) : (
        <span className={`flex-1 truncate ${richFieldPlaceholderClass}`}>{placeholder}</span>
      )}
    </div>
  )
}

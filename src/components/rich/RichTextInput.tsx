import type { ChangeEvent } from 'react'
import {
  richFieldBoxClass,
  richFieldDisabledClass,
  richFieldFocusClass,
} from './richFieldStyles'

interface RichTextInputProps {
  id?: string
  /** Ids of the elements describing this field (e.g. its validation message). */
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'time' | 'datetime-local'
  min?: string | number
  required?: boolean
  disabled?: boolean
  className?: string
}

/**
 * A typeable sibling to RichDropdown/RichStaticField — same box, border, and grey
 * placeholder-when-empty styling, but a real <input> instead of a picker or static display.
 */
export function RichTextInput({
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  value,
  onChange,
  placeholder,
  type = 'text',
  min,
  required,
  disabled,
  className = '',
}: RichTextInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)

  return (
    <input
      id={id}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      type={type}
      min={min}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={`${richFieldBoxClass} ${richFieldFocusClass} ${richFieldDisabledClass} placeholder:text-slate-400 ${className}`}
    />
  )
}

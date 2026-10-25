import { useEffect, useState, type FormEvent } from 'react'
import { Copy, Plus } from 'lucide-react'
import {
  useCreateDiscountCode,
  useDiscountCodes,
  useLoyaltySettings,
  useResendDiscountCodeEmail,
  useUpdateDiscountCode,
  useUpdateLoyaltySettings,
} from '../../api/queries'
import {
  discountLabel,
  type DiscountCode,
  type DiscountCodeListParams,
  type DiscountSource,
  type DiscountStatus,
  type DiscountType,
  type LoyaltySettings,
} from '../../api/loyalty'
import {
  EXPAND_PANEL_CLASS,
  ExpandableRow,
  ExpandToggle,
  SettingsTable,
  Td,
  Th,
} from '../../components/settings/ExpandableRow'
import { StatusBadge } from '../../components/loyalty/DiscountStatusBadge'
import {
  FieldLabel,
  SettingsCard,
  SettingsPageHeader,
  SettingsSection,
} from '../../components/settings/SettingsUI'
import { useToast } from '../../components/Toast'
import { useIsOwner } from '../../hooks/useIsOwner'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'

const PAGE_SIZE = 25
const OWNER_ONLY = 'Only the business owner can change discounts.'

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500'
const primaryClass =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:min-h-0'
const secondaryClass =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:min-h-0'

function ownerError(err: unknown): string {
  return isApiError(err) && err.code === 403 ? OWNER_ONLY : errorMessage(err)
}

/** Settings -> Discounts: the loyalty rule and every discount code. The
 * server works out every price and status shown here; this page only
 * displays and edits. */
export function DiscountsSettings() {
  const isOwner = useIsOwner()
  return (
    <>
      <SettingsPageHeader
        title="Discounts"
        description="Reward returning customers with a code after every few visits, and create promo codes. Customers enter a code when they book online; staff can add one to an appointment."
      />
      <div className="mt-8 space-y-10">
        <LoyaltyProgramme isOwner={isOwner} />
        <DiscountCodes isOwner={isOwner} />
      </div>
    </>
  )
}

// --- Loyalty programme --------------------------------------------------------

function LoyaltyProgramme({ isOwner }: { isOwner: boolean }) {
  const { data, isLoading, isError } = useLoyaltySettings()
  return (
    <SettingsSection
      title="Loyalty programme"
      info="When an appointment is marked completed, the customer's completed visits are counted. Every time they reach the number below, they're emailed a personal code that only they can use, once. Visits from before you switch this on still count, but switching it on never sends codes for past visits."
    >
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : isError || !data ? (
        <p className="text-sm text-red-700">Couldn't load the loyalty programme.</p>
      ) : (
        <LoyaltyForm settings={data} isOwner={isOwner} />
      )}
    </SettingsSection>
  )
}

function LoyaltyForm({ settings, isOwner }: { settings: LoyaltySettings; isOwner: boolean }) {
  const update = useUpdateLoyaltySettings()
  const { showToast } = useToast()
  const [enabled, setEnabled] = useState(settings.enabled)
  const [visits, setVisits] = useState(String(settings.visits_required))
  const [type, setType] = useState<DiscountType>(settings.discount_type)
  const [value, setValue] = useState(String(Number(settings.discount_value)))
  const [days, setDays] = useState(String(settings.expiry_days))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const validate = (): Record<string, string> => {
    const out: Record<string, string> = {}
    const v = Number(visits)
    if (!Number.isInteger(v) || v < 1 || v > 100) out.visits_required = 'Enter a whole number from 1 to 100.'
    const amount = Number(value)
    if (!value || !Number.isFinite(amount) || amount <= 0) out.discount_value = 'Enter an amount above zero.'
    else if (type === 'PERCENTAGE' && amount > 100) out.discount_value = 'A percentage can be at most 100.'
    else if (!/^\d+(\.\d{1,2})?$/.test(value)) out.discount_value = 'Use at most two decimal places.'
    const d = Number(days)
    if (!Number.isInteger(d) || d < 1 || d > 3650) out.expiry_days = 'Enter a whole number of days from 1 to 3650.'
    return out
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      await update.mutateAsync({
        enabled,
        visits_required: Number(visits),
        discount_type: type,
        discount_value: Number(value).toFixed(2),
        expiry_days: Number(days),
      })
      showToast('Loyalty programme saved.', 'success')
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(ownerError(err))
    }
  }

  const disabled = !isOwner || update.isPending

  return (
    <SettingsCard>
      <form onSubmit={submit} noValidate>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-900">
          <input
            type="checkbox"
            role="switch"
            aria-checked={enabled}
            checked={enabled}
            disabled={disabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5"
          />
          Reward returning customers
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel
              htmlFor="loyalty-visits"
              info="Counts completed appointments only. With 5, a code is sent on the 5th, 10th, 15th visit and so on."
            >
              Reward after every … completed visits
            </FieldLabel>
            <input
              id="loyalty-visits"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={visits}
              disabled={disabled}
              onChange={(e) => setVisits(e.target.value)}
              aria-invalid={errors.visits_required ? true : undefined}
              aria-describedby={errors.visits_required ? 'loyalty-visits-error' : undefined}
              className={inputClass}
            />
            {errors.visits_required && (
              <p id="loyalty-visits-error" className="mt-1 text-sm text-red-700">
                {errors.visits_required}
              </p>
            )}
          </div>
          <div>
            <FieldLabel htmlFor="loyalty-days" info="Counted from the day the code is sent.">
              Code valid for (days)
            </FieldLabel>
            <input
              id="loyalty-days"
              type="number"
              inputMode="numeric"
              min={1}
              value={days}
              disabled={disabled}
              onChange={(e) => setDays(e.target.value)}
              aria-invalid={errors.expiry_days ? true : undefined}
              aria-describedby={errors.expiry_days ? 'loyalty-days-error' : undefined}
              className={inputClass}
            />
            {errors.expiry_days && (
              <p id="loyalty-days-error" className="mt-1 text-sm text-red-700">
                {errors.expiry_days}
              </p>
            )}
          </div>
          <DiscountValueFields
            idPrefix="loyalty"
            type={type}
            value={value}
            onType={setType}
            onValue={setValue}
            disabled={disabled}
            error={errors.discount_value}
          />
        </div>

        {formError && <p className="mt-4 text-sm text-red-700">{formError}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={disabled} className={primaryClass}>
            {update.isPending ? 'Saving…' : 'Save loyalty programme'}
          </button>
          {!isOwner && <p className="text-sm text-slate-600">{OWNER_ONLY}</p>}
        </div>
      </form>
    </SettingsCard>
  )
}

function DiscountValueFields({
  idPrefix,
  type,
  value,
  onType,
  onValue,
  disabled,
  error,
}: {
  idPrefix: string
  type: DiscountType
  value: string
  onType: (type: DiscountType) => void
  onValue: (value: string) => void
  disabled?: boolean
  error?: string
}) {
  return (
    <>
      <div>
        <FieldLabel htmlFor={`${idPrefix}-type`}>Discount type</FieldLabel>
        <select
          id={`${idPrefix}-type`}
          value={type}
          disabled={disabled}
          onChange={(e) => onType(e.target.value as DiscountType)}
          className={inputClass}
        >
          <option value="PERCENTAGE">Percentage off</option>
          <option value="FIXED">Fixed amount off (£)</option>
        </select>
      </div>
      <div>
        <FieldLabel
          htmlFor={`${idPrefix}-value`}
          info="Taken off the booking total, add-ons included. Never more than the total."
        >
          {type === 'PERCENTAGE' ? 'Percentage off' : 'Amount off (£)'}
        </FieldLabel>
        <input
          id={`${idPrefix}-value`}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={value}
          disabled={disabled}
          onChange={(e) => onValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${idPrefix}-value-error` : undefined}
          className={inputClass}
        />
        {error && (
          <p id={`${idPrefix}-value-error`} className="mt-1 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </>
  )
}

// --- Discount codes ----------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** A date input's YYYY-MM-DD as the start (or end) of that local day, in ISO. */
function dayToIso(day: string, endOfDay = false): string | null {
  if (!day) return null
  const date = new Date(`${day}T${endOfDay ? '23:59:59' : '00:00:00'}`)
  return date.toISOString()
}

function isoToDay(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function emailNote(code: DiscountCode): string | null {
  if (code.source !== 'LOYALTY') return null
  switch (code.email_status) {
    case 'SENT':
      return `Emailed ${formatDate(code.emailed_at)}`
    case 'FAILED':
      return "Email couldn't be sent"
    case 'NO_EMAIL':
      return 'No email on file - pass the code on yourself'
    case 'OPTED_OUT':
      return 'Not emailed - customer opted out of offers'
    default:
      return null
  }
}

function DiscountCodes({ isOwner }: { isOwner: boolean }) {
  const [source, setSource] = useState<DiscountSource | ''>('')
  const [status, setStatus] = useState<DiscountStatus | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Search as you type, without a request per keystroke.
  // Only when the text really changed - otherwise the first render's timer
  // would reset a page the user has since moved to.
  useEffect(() => {
    const next = searchInput.trim()
    if (next === search) return
    const handle = setTimeout(() => {
      setSearch(next)
      setPage(0)
    }, 300)
    return () => clearTimeout(handle)
  }, [searchInput, search])

  const params: DiscountCodeListParams = {
    source: source || undefined,
    status: status || undefined,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }
  const { data, isLoading, isError } = useDiscountCodes(params)
  const total = data?.total ?? 0
  const items = data?.items ?? []
  const filtered = Boolean(source || status || search)

  return (
    <SettingsSection
      title="Discount codes"
      info="Loyalty codes are created automatically and belong to one customer. Promo codes are ones you make, like SUMMER10, that anyone can use within the limits you set. Customers can use one code per booking."
      actions={
        isOwner && !creating ? (
          <button type="button" onClick={() => setCreating(true)} className={primaryClass}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create code
          </button>
        ) : undefined
      }
    >
      {creating && <CreateCodeForm onClose={() => setCreating(false)} />}

      <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <label htmlFor="discount-search" className="sr-only">
            Search codes
          </label>
          <input
            id="discount-search"
            type="search"
            placeholder="Search by code or customer"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${inputClass} mt-0`}
          />
        </div>
        <div>
          <label htmlFor="discount-source" className="sr-only">
            Source
          </label>
          <select
            id="discount-source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value as DiscountSource | '')
              setPage(0)
            }}
            className={`${inputClass} mt-0`}
          >
            <option value="">All sources</option>
            <option value="LOYALTY">Loyalty</option>
            <option value="MANUAL">Promo</option>
          </select>
        </div>
        <div>
          <label htmlFor="discount-status" className="sr-only">
            Status
          </label>
          <select
            id="discount-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as DiscountStatus | '')
              setPage(0)
            }}
            className={`${inputClass} mt-0`}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="USED">Used</option>
            <option value="EXPIRED">Expired</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-red-700">Couldn't load discount codes.</p>
      ) : items.length === 0 ? (
        <SettingsCard>
          <p className="text-sm text-slate-600">
            {filtered
              ? 'No codes match these filters.'
              : 'No discount codes yet. Loyalty codes appear here as customers earn them' +
                (isOwner ? ', or create a promo code above.' : '.')}
          </p>
        </SettingsCard>
      ) : (
        <>
          <SettingsTable
            label="Discount codes"
            minWidth="min-w-[66rem]"
            columns={['w-56', 'w-28', 'w-24', undefined, 'w-28', 'w-20', 'w-28', 'w-24']}
            head={
              <tr>
                <Th>Code</Th>
                <Th>Discount</Th>
                <Th>Source</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Uses</Th>
                <Th>Expires</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            }
          >
            {items.map((code) => (
              <ExpandableRow
                key={code.id}
                colSpan={8}
                expanded={editingId === code.id}
                onClose={() => setEditingId(null)}
                label={`Manage ${code.code}`}
                summary={(toggle) => (
                  <>
                    <Td>
                      <CodeCell code={code.code} />
                    </Td>
                    <Td>{discountLabel(code.discount_type, code.discount_value)}</Td>
                    <Td>{code.source === 'LOYALTY' ? 'Loyalty' : 'Promo'}</Td>
                    <Td>
                      {code.customer ? (
                        <>
                          <span className="block text-slate-900">
                            {code.customer.first_name} {code.customer.last_name}
                          </span>
                          {emailNote(code) && (
                            <span className="block text-xs text-slate-600">{emailNote(code)}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-500">Anyone</span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={code.status} />
                    </Td>
                    <Td>
                      {code.uses}
                      {code.max_uses != null ? ` / ${code.max_uses}` : ''}
                    </Td>
                    <Td>{formatDate(code.expires_at)}</Td>
                    <Td>
                      <ExpandToggle
                        {...toggle}
                        label={isOwner ? 'Manage' : 'Details'}
                        onClick={() => setEditingId(editingId === code.id ? null : code.id)}
                      />
                    </Td>
                  </>
                )}
              >
                <ManageCode code={code} isOwner={isOwner} onDone={() => setEditingId(null)} />
              </ExpandableRow>
            ))}
          </SettingsTable>
          <Pagination page={page} total={total} onPage={setPage} />
        </>
      )}
    </SettingsSection>
  )
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  if (total <= PAGE_SIZE) return null
  const first = page * PAGE_SIZE + 1
  const last = Math.min(total, first + PAGE_SIZE - 1)
  return (
    <nav aria-label="Discount code pages" className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-slate-600">
        Showing {first}–{last} of {total}
      </p>
      <div className="flex gap-2">
        <button type="button" className={secondaryClass} disabled={page === 0} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button
          type="button"
          className={secondaryClass}
          disabled={last >= total}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  )
}

function CodeCell({ code }: { code: string }) {
  const { showToast } = useToast()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      showToast(`Copied ${code}.`, 'success')
    } catch {
      showToast("Couldn't copy - select the code and copy it instead.")
    }
  }
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="truncate font-mono text-[13px] font-semibold text-slate-900">{code}</span>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${code}`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:h-7 sm:w-7"
      >
        <Copy className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  )
}

function LimitsFields({
  idPrefix,
  validFrom,
  expires,
  maxUses,
  perCustomer,
  set,
  disabled,
  showUseLimits = true,
  errors,
}: {
  idPrefix: string
  validFrom: string
  expires: string
  maxUses: string
  perCustomer: string
  set: (field: 'validFrom' | 'expires' | 'maxUses' | 'perCustomer', value: string) => void
  disabled?: boolean
  showUseLimits?: boolean
  errors: Record<string, string>
}) {
  return (
    <>
      <div>
        <FieldLabel htmlFor={`${idPrefix}-from`} info="Leave blank to start straight away.">
          Valid from
        </FieldLabel>
        <input
          id={`${idPrefix}-from`}
          type="date"
          value={validFrom}
          disabled={disabled}
          onChange={(e) => set('validFrom', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <FieldLabel htmlFor={`${idPrefix}-until`} info="The last day the code works. Leave blank for no end date.">
          Valid until
        </FieldLabel>
        <input
          id={`${idPrefix}-until`}
          type="date"
          value={expires}
          disabled={disabled}
          onChange={(e) => set('expires', e.target.value)}
          aria-invalid={errors.expires_at ? true : undefined}
          aria-describedby={errors.expires_at ? `${idPrefix}-until-error` : undefined}
          className={inputClass}
        />
        {errors.expires_at && (
          <p id={`${idPrefix}-until-error`} className="mt-1 text-sm text-red-700">
            {errors.expires_at}
          </p>
        )}
      </div>
      {showUseLimits && (
        <>
          <div>
            <FieldLabel htmlFor={`${idPrefix}-max`} info="Across all customers. Leave blank for no limit.">
              Total uses allowed
            </FieldLabel>
            <input
              id={`${idPrefix}-max`}
              type="number"
              inputMode="numeric"
              min={1}
              value={maxUses}
              disabled={disabled}
              onChange={(e) => set('maxUses', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor={`${idPrefix}-per`} info="Leave blank for no limit.">
              Uses per customer
            </FieldLabel>
            <input
              id={`${idPrefix}-per`}
              type="number"
              inputMode="numeric"
              min={1}
              value={perCustomer}
              disabled={disabled}
              onChange={(e) => set('perCustomer', e.target.value)}
              className={inputClass}
            />
          </div>
        </>
      )}
    </>
  )
}

function useLimits(code?: DiscountCode) {
  const [limits, setLimits] = useState({
    validFrom: isoToDay(code?.valid_from ?? null),
    expires: isoToDay(code?.expires_at ?? null),
    maxUses: code?.max_uses != null ? String(code.max_uses) : '',
    perCustomer: code?.max_uses_per_customer != null ? String(code.max_uses_per_customer) : '',
  })
  const set = (field: keyof typeof limits, value: string) => setLimits((l) => ({ ...l, [field]: value }))
  const check = (): Record<string, string> => {
    const out: Record<string, string> = {}
    if (limits.validFrom && limits.expires && limits.expires < limits.validFrom) {
      out.expires_at = 'The end date must be on or after the start date.'
    }
    for (const [key, field] of [
      ['maxUses', 'max_uses'],
      ['perCustomer', 'max_uses_per_customer'],
    ] as const) {
      const v = limits[key]
      if (v && (!Number.isInteger(Number(v)) || Number(v) < 1)) out[field] = 'Enter a whole number of 1 or more.'
    }
    return out
  }
  const payload = (includeUses: boolean) => ({
    valid_from: dayToIso(limits.validFrom),
    expires_at: dayToIso(limits.expires, true),
    ...(includeUses
      ? {
          max_uses: limits.maxUses ? Number(limits.maxUses) : null,
          max_uses_per_customer: limits.perCustomer ? Number(limits.perCustomer) : null,
        }
      : {}),
  })
  return { limits, set, check, payload }
}

function CreateCodeForm({ onClose }: { onClose: () => void }) {
  const create = useCreateDiscountCode()
  const { showToast } = useToast()
  const [code, setCode] = useState('')
  const [type, setType] = useState<DiscountType>('PERCENTAGE')
  const [value, setValue] = useState('')
  const { limits, set, check, payload } = useLimits()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const found = check()
    const amount = Number(value)
    if (!value || !Number.isFinite(amount) || amount <= 0) found.discount_value = 'Enter an amount above zero.'
    else if (type === 'PERCENTAGE' && amount > 100) found.discount_value = 'A percentage can be at most 100.'
    const trimmed = code.replace(/[\s-]/g, '')
    if (code.trim() && (trimmed.length < 3 || trimmed.length > 32 || !/^[a-z0-9]+$/i.test(trimmed))) {
      found.code = 'Use 3-32 letters and numbers (spaces and dashes are ignored).'
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      const created = await create.mutateAsync({
        code: code.trim() || null,
        discount_type: type,
        discount_value: amount.toFixed(2),
        ...payload(true),
      })
      showToast(`Created ${created.code}.`, 'success')
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(ownerError(err))
    }
  }

  return (
    <div role="region" aria-label="Create a discount code" className={`${EXPAND_PANEL_CLASS} mb-4`}>
      <form onSubmit={submit} noValidate>
        <h3 className="text-base font-semibold text-slate-900">Create a promo code</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="new-code" info="Letters and numbers, like SUMMER10. Leave blank and we'll make one up.">
              Code
            </FieldLabel>
            <input
              id="new-code"
              value={code}
              placeholder="Leave blank to generate one"
              autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              aria-invalid={errors.code ? true : undefined}
              aria-describedby={errors.code ? 'new-code-error' : undefined}
              className={`${inputClass} font-mono`}
            />
            {errors.code && (
              <p id="new-code-error" className="mt-1 text-sm text-red-700">
                {errors.code}
              </p>
            )}
          </div>
          <DiscountValueFields
            idPrefix="new-code"
            type={type}
            value={value}
            onType={setType}
            onValue={setValue}
            error={errors.discount_value}
          />
          <LimitsFields idPrefix="new-code" {...limits} set={set} errors={errors} />
        </div>
        {formError && <p className="mt-4 text-sm text-red-700">{formError}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="submit" disabled={create.isPending} className={primaryClass}>
            {create.isPending ? 'Creating…' : 'Create code'}
          </button>
          <button type="button" onClick={onClose} className={secondaryClass}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function ManageCode({ code, isOwner, onDone }: { code: DiscountCode; isOwner: boolean; onDone: () => void }) {
  const update = useUpdateDiscountCode()
  const resend = useResendDiscountCodeEmail()
  const { showToast } = useToast()
  const isLoyalty = code.source === 'LOYALTY'
  const { limits, set, check, payload } = useLimits(code)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const disabled = !isOwner || update.isPending

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const found = check()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      await update.mutateAsync({ id: code.id, data: payload(!isLoyalty) })
      showToast(`Saved ${code.code}.`, 'success')
      onDone()
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(ownerError(err))
    }
  }

  const toggleEnabled = async () => {
    setFormError(null)
    const next = code.stored_status === 'DISABLED' ? 'ACTIVE' : 'DISABLED'
    try {
      await update.mutateAsync({ id: code.id, data: { status: next } })
      showToast(next === 'DISABLED' ? `Disabled ${code.code}.` : `Enabled ${code.code}.`, 'success')
    } catch (err) {
      setFormError(ownerError(err))
    }
  }

  const resendEmail = async () => {
    setFormError(null)
    try {
      const updated = await resend.mutateAsync(code.id)
      if (updated.email_status === 'SENT') showToast(`Email sent to ${code.customer?.email}.`, 'success')
      else setFormError(emailNote(updated) ?? "The email couldn't be sent.")
    } catch (err) {
      setFormError(ownerError(err))
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-base font-semibold text-slate-900">{code.code}</h3>
        <StatusBadge status={code.status} />
        {isLoyalty && code.issued_for_visit_count != null && (
          <span className="text-sm text-slate-600">for visit {code.issued_for_visit_count}</span>
        )}
      </div>
      {code.customer && (
        <p className="mt-2 text-sm text-slate-700">
          {code.customer.first_name} {code.customer.last_name}
          {code.customer.email ? ` · ${code.customer.email}` : ''}
          {emailNote(code) ? ` · ${emailNote(code)}` : ''}
        </p>
      )}
      {isLoyalty && (
        <p className="mt-1 text-sm text-slate-600">
          Single use, for this customer only - you can change its dates or disable it.
        </p>
      )}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <LimitsFields
          idPrefix={`code-${code.id}`}
          {...limits}
          set={set}
          disabled={disabled}
          showUseLimits={!isLoyalty}
          errors={errors}
        />
      </div>
      {formError && <p className="mt-4 text-sm text-red-700">{formError}</p>}
      {isOwner ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="submit" disabled={disabled} className={primaryClass}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" disabled={disabled} onClick={() => void toggleEnabled()} className={secondaryClass}>
            {code.stored_status === 'DISABLED' ? 'Enable code' : 'Disable code'}
          </button>
          {isLoyalty && (
            <button
              type="button"
              disabled={resend.isPending || !code.customer?.email || code.customer.marketing_email_opt_out}
              onClick={() => void resendEmail()}
              className={secondaryClass}
            >
              {resend.isPending ? 'Sending…' : 'Resend email'}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">{OWNER_ONLY}</p>
      )}
    </form>
  )
}

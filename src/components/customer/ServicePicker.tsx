import { useId, useState } from 'react'
import { Check } from 'lucide-react'
import type {
  DisplayMode,
  PublicAppointmentType,
  PublicAppointmentTypeGroup,
} from '../../api/publicGarage'
import { serviceMinutes } from '../../lib/availability'

/**
 * "What are you booking?" - the wizard's first step.
 *
 * Two presentations, because the right one depends on what the business
 * sells. A hair or tinting business sells on a picture: the customer is
 * choosing a *look* and cannot judge the options from a name, so GRID gives
 * each service a large image-led card. A repair business sells on
 * information: the customer already knows what they need and decides on
 * price, duration and what's included, so LIST puts those in a row where they
 * can be compared. The mode is the business's own setting, resolved
 * server-side per group.
 */
export function ServicePicker({
  groups,
  services,
  businessDisplayMode,
  selectedId,
  onSelect,
}: {
  groups: PublicAppointmentTypeGroup[]
  services: PublicAppointmentType[]
  businessDisplayMode: DisplayMode
  selectedId: string
  onSelect: (id: string) => void
}) {
  const ungrouped = services.filter((s) => s.group_id === null)

  return (
    <div>
      <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">What would you like to book?</h2>
      <p className="mt-1 text-sm text-slate-500">
        Choose a service and we'll show you when we're free.
      </p>

      <div className="mt-4 space-y-6">
        {groups.map((group) => (
          <ServiceGroup
            key={group.id}
            group={group}
            services={services.filter((s) => s.group_id === group.id)}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}

        {ungrouped.length > 0 && (
          <ServiceList
            services={ungrouped}
            // An ungrouped service has no group to inherit from, so it falls
            // back to the business's own setting.
            displayMode={businessDisplayMode}
            selectedId={selectedId}
            onSelect={onSelect}
            // Only label this block when it sits alongside named groups -
            // on its own it *is* the list and needs no heading.
            heading={groups.length > 0 ? 'Other services' : undefined}
          />
        )}
      </div>
    </div>
  )
}

function ServiceGroup({
  group,
  services,
  selectedId,
  onSelect,
}: {
  group: PublicAppointmentTypeGroup
  services: PublicAppointmentType[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  // Closed to begin with, so a long menu reads as its headings; each group
  // opens on its own (not an accordion). Open regardless if the current
  // selection is inside - a customer stepping back to change their mind
  // must see what they picked.
  const [open, setOpen] = useState(false)
  const holdsSelection = services.some((s) => s.id === selectedId)
  const expanded = open || holdsSelection
  const panelId = useId()

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 border-b border-slate-200 pb-2 text-left"
      >
        <span>
          <span className="text-sm font-semibold text-slate-900">{group.name}</span>
          {group.description && (
            <span className="mt-0.5 block text-xs text-slate-500">{group.description}</span>
          )}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${
            expanded ? 'rotate-180' : ''
          }`}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Always mounted so it can animate shut as well as open (0fr -> 1fr);
          `inert` + aria-hidden keep a closed group out of reach. */}
      <div
        id={panelId}
        inert={!expanded}
        aria-hidden={!expanded}
        data-state={expanded ? 'open' : 'closed'}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-3">
            <ServiceList
              services={services}
              displayMode={group.display_mode}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function ServiceList({
  services,
  displayMode,
  selectedId,
  onSelect,
  heading,
}: {
  services: PublicAppointmentType[]
  displayMode: DisplayMode
  selectedId: string
  onSelect: (id: string) => void
  heading?: string
}) {
  if (services.length === 0) return null

  return (
    <div>
      {heading && (
        <p className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">
          {heading}
        </p>
      )}
      <ul
        className={
          displayMode === 'GRID'
            ? `${heading ? 'mt-3 ' : ''}grid grid-cols-2 gap-3 sm:grid-cols-3`
            : `${heading ? 'mt-3 ' : ''}space-y-2`
        }
      >
        {services.map((service) =>
          displayMode === 'GRID' ? (
            <ServiceCard
              key={service.id}
              service={service}
              selected={service.id === selectedId}
              onSelect={onSelect}
            />
          ) : (
            <ServiceRow
              key={service.id}
              service={service}
              selected={service.id === selectedId}
              onSelect={onSelect}
            />
          ),
        )}
      </ul>
    </div>
  )
}

/** Price and duration, as one line. Either may be absent - a service can be
 * "ask us" on both and still be bookable. */
function metaLine(service: PublicAppointmentType): string {
  const minutes = serviceMinutes(service)
  return [
    service.base_price != null ? `£${service.base_price}` : null,
    minutes != null ? `${minutes} min` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function ServiceCard({
  service,
  selected,
  onSelect,
}: {
  service: PublicAppointmentType
  selected: boolean
  onSelect: (id: string) => void
}) {
  const meta = metaLine(service)

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(service.id)}
        className={`relative flex h-full w-full flex-col overflow-hidden rounded-lg border text-left transition ${
          selected
            ? 'border-slate-900 ring-2 ring-slate-900'
            : 'border-slate-200 hover:border-slate-400'
        }`}
      >
        <span className="block aspect-[4/3] w-full overflow-hidden bg-slate-100">
          {service.image_url ? (
            <img
              src={service.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            // A business that has picked GRID but not uploaded images yet
            // still gets usable cards, never a broken-image icon.
            <span className="flex h-full w-full items-center justify-center text-2xl text-slate-300">
              {service.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-0.5 p-3">
          <span className="flex items-start justify-between gap-2 text-sm font-medium text-slate-900">
            {service.name}
            {selected && <SelectedMark />}
          </span>
          {meta && <span className="text-xs text-slate-500">{meta}</span>}
        </span>
      </button>
    </li>
  )
}

function ServiceRow({
  service,
  selected,
  onSelect,
}: {
  service: PublicAppointmentType
  selected: boolean
  onSelect: (id: string) => void
}) {
  const meta = metaLine(service)

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(service.id)}
        className={`w-full rounded-md border px-3 py-2 text-left transition ${
          selected
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-300 hover:border-slate-500'
        }`}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-medium">
            {selected && <SelectedMark />}
            {service.name}
          </span>
          {meta && (
            <span className={`text-sm ${selected ? 'text-slate-200' : 'text-slate-500'}`}>
              {meta}
            </span>
          )}
        </span>
        {service.description && (
          <span
            className={`mt-0.5 block text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}
          >
            {service.description}
          </span>
        )}
      </button>
    </li>
  )
}

/** A tick beside the chosen service, so the choice never rests on colour
 * alone. Announced through the button's aria-pressed, so hidden here. */
function SelectedMark() {
  return <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" data-testid="selected-mark" />
}

/** "What's included" for the chosen service - the customer-visible checklist
 * steps only. Rendered next to the picker rather than inside a card, so it
 * reads the same in both display modes. */
export function IncludedItems({ service }: { service: PublicAppointmentType | undefined }) {
  if (!service || service.included_items.length === 0) return null

  return (
    <details className="mt-4 text-sm text-slate-600">
      <summary className="cursor-pointer font-medium text-slate-700">
        What's included in {service.name}
      </summary>
      <ul className="mt-2 space-y-1 pl-1">
        {service.included_items.map((item, i) => (
          <li key={i}>
            <span aria-hidden="true">✓</span> {item.label}
            {item.description && <span className="text-slate-400"> — {item.description}</span>}
          </li>
        ))}
      </ul>
    </details>
  )
}

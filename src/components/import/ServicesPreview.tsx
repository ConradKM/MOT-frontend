import type { ImportResult, ServiceNormalised } from '../../types'
import { IssueList, ItemStatusBadge, WarningBadge } from './parts'

/** A services preview as a table: what each row resolved to, and what is
 * wrong with it. Scrolls inside its own box on a narrow screen rather than
 * pushing the page sideways. */
export function ServicesPreview({ result }: { result: ImportResult }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <caption className="sr-only">Services in this import</caption>
        <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
          <tr>
            <th scope="col" className="px-3 py-2">
              #
            </th>
            <th scope="col" className="px-3 py-2">
              Status
            </th>
            <th scope="col" className="px-3 py-2">
              Name
            </th>
            <th scope="col" className="px-3 py-2">
              Price
            </th>
            <th scope="col" className="px-3 py-2">
              Duration
            </th>
            <th scope="col" className="px-3 py-2">
              Group
            </th>
            <th scope="col" className="px-3 py-2">
              Problems
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {result.items.map((item) => {
            const service = item.normalised as ServiceNormalised
            return (
              <tr key={item.index} className="align-top">
                <td className="px-3 py-2 text-slate-500">{item.index + 1}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col items-start gap-1">
                    <ItemStatusBadge status={item.status} />
                    <WarningBadge count={item.warnings.length} />
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-900">
                  {service.name ?? '—'}
                  {service.existing ? (
                    <span className="block text-xs text-slate-500">
                      Matches “{service.existing.name}”
                    </span>
                  ) : null}
                  {service.description ? (
                    <span className="block text-xs text-slate-500">{service.description}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {service.base_price != null ? `£${service.base_price}` : '—'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {service.default_duration_minutes != null
                    ? `${service.default_duration_minutes} min`
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  {service.group ?? '—'}
                  {service.group && service.group_is_new ? (
                    <span className="block text-xs text-slate-500">new group</span>
                  ) : null}
                </td>
                <td className="min-w-48 px-3 py-2">
                  <IssueList errors={item.errors} warnings={item.warnings} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

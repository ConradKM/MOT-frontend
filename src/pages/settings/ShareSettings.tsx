import { useAppointmentTypeGroups, useAppointmentTypes, useGarageTerms } from '../../api/queries'
import { BookingQrCard } from '../../components/BookingQrCard'
import { SettingsPageHeader, SettingsSection } from '../../components/settings/SettingsUI'
import { useGarageId } from '../../hooks/useGarageId'
import { queueUrl, termsUrl } from '../../lib/bookingUrl'
import { ShareLinksPanel } from './share/ShareLinksPanel'

/**
 * Settings › Share your business: every public link a business hands out,
 * in one place - the booking page and its QR code, links that open it on one
 * service or group, and the walk-in queue and terms pages. The walk-in queue
 * and terms cards are also on their own settings pages; this page collects
 * them, it doesn't move them.
 *
 * Nothing here changes anything, so there is no owner gate of its own: each
 * card shows what the API returns to whoever is signed in.
 */
export function ShareSettings() {
  const garageId = useGarageId()
  const groups = useAppointmentTypeGroups()
  const services = useAppointmentTypes()
  const terms = useGarageTerms()

  return (
    <div className="max-w-3xl">
      <SettingsPageHeader
        title="Share your business"
        description="Links and QR codes customers use to find you: your booking page, links straight to one service or group, the walk-in queue and your terms."
      />

      <div className="mt-8 space-y-10">
        <BookingQrCard garageId={garageId} className="" />

        <SettingsSection
          title="Links for your website"
          info="Put any of these behind a button on your own website. Each one opens your booking page with the choice already made."
        >
          {groups.isLoading || services.isLoading ? (
            <p className="text-sm text-slate-600">Loading…</p>
          ) : (
            <ShareLinksPanel groups={groups.data ?? []} services={services.data ?? []} />
          )}
        </SettingsSection>

        <BookingQrCard
          garageId={garageId}
          url={queueUrl(garageId)}
          title="Walk-in queue link"
          description="Print this QR code for your reception or forecourt. Customers scan it to join the queue and watch their place — no account needed."
          filenameStem="walk-in-queue-qr"
          qrLabel="Walk-in queue QR code"
          className=""
        />

        {terms.data?.terms_and_conditions && (
          <BookingQrCard
            garageId={garageId}
            url={termsUrl(garageId)}
            title="Public terms page"
            description="Link to your terms from your own website. This page always shows your current version."
            filenameStem="terms-qr"
            qrLabel="Terms and conditions page QR code"
            className=""
          />
        )}
      </div>
    </div>
  )
}

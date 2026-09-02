import { Link, useParams } from 'react-router-dom'
import { usePublicGarage } from '../../api/queries'

export function CustomerLanding() {
  const { garageId } = useParams<{ garageId: string }>()
  const { data: garage, isLoading, isError } = usePublicGarage(garageId)

  const heading = garageId
    ? isLoading
      ? 'Loading…'
      : garage
        ? `Book your MOT or service at ${garage.name}`
        : 'Book your MOT or service'
    : 'Book your MOT or service'

  return (
    <div>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">{heading}</h1>
        {garageId && isError && (
          <p className="mx-auto mt-2 max-w-md text-sm text-amber-600">
            We couldn't find that garage — you can still start a booking below and pick one.
          </p>
        )}
        <p className="mx-auto mt-3 max-w-md text-slate-600">
          Tell us about you, your vehicle, and when suits you — we'll take it from there.
        </p>
        <Link
          to={garageId && garage ? `/book/${garageId}` : '/book'}
          className="mt-6 inline-block rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800"
        >
          Start a booking
        </Link>
        <p className="mt-4 text-sm text-slate-500">
          Already booked with us?{' '}
          <Link to="/customer/login" className="font-medium text-slate-900 hover:underline">
            View your account
          </Link>
        </p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        <Feature title="MOT & Service" body="Book a standalone MOT or bundle it with a full service." />
        <Feature title="Pick your slot" body="Choose the date and time that works for you." />
        <Feature
          title="We'll confirm"
          body="The garage reviews your request and gets back to you to confirm."
        />
      </div>
    </div>
  )
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  )
}

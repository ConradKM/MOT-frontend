import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BOOKING_BASE_URL } from '../lib/bookingUrl'
import { BookingQrCard } from './BookingQrCard'

describe('BookingQrCard', () => {
  it('defaults to the business booking link', async () => {
    render(<BookingQrCard garageId="g1" />)
    expect(screen.getByRole('heading', { name: 'Public booking link' })).toBeInTheDocument()
    expect(screen.getByText(`${BOOKING_BASE_URL}/book/g1`)).toBeInTheDocument()
    expect(await screen.findByLabelText('Booking link QR code')).toBeInTheDocument()
  })

  it('can be pointed at another public link', async () => {
    render(
      <BookingQrCard
        garageId="g1"
        url="https://example.test/queue/g1"
        title="Walk-in queue link"
        description="Scan to join."
        qrLabel="Walk-in queue QR code"
      />,
    )
    expect(screen.getByRole('heading', { name: 'Walk-in queue link' })).toBeInTheDocument()
    expect(screen.getByText('Scan to join.')).toBeInTheDocument()
    expect(screen.getByText('https://example.test/queue/g1')).toBeInTheDocument()
    const qr = await screen.findByLabelText('Walk-in queue QR code')
    // The QR itself renders once generated - the download buttons enable then.
    await screen.findByRole('button', { name: 'Download SVG', hidden: false })
    expect(qr).toBeInTheDocument()
  })
})

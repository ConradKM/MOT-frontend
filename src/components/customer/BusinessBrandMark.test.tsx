import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BusinessBrandMark } from './BusinessBrandMark'

describe('BusinessBrandMark', () => {
  it('renders the logo when a url is given', () => {
    render(<BusinessBrandMark name="Bennett Motors" logoUrl="https://storage.example/logo.png" />)

    const img = screen.getByRole('img', { name: 'Bennett Motors logo' })
    expect(img).toHaveAttribute('src', 'https://storage.example/logo.png')
  })

  it('renders an initials badge with no logo url', () => {
    render(<BusinessBrandMark name="Bennett Motors" logoUrl={null} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('falls back to the initials badge if the logo fails to load', () => {
    render(<BusinessBrandMark name="Bennett Motors" logoUrl="https://storage.example/expired.png" />)

    fireEvent.error(screen.getByRole('img', { name: 'Bennett Motors logo' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})

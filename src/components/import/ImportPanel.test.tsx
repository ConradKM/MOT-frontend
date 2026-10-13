import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { ImportPanel, type ImportPanelProps } from './ImportPanel'
import { ServicesPreview } from './ServicesPreview'
import { ApiError } from '../../api/client'
import { makeQueryClient } from '../../test/utils'
import { makeImportFormats, makeImportItem, makeImportResult } from '../../test/fixtures'
import type { ImportResult } from '../../types'

const PAYLOAD = '{"services": [{"name": "MOT"}]}'

function renderPanel(overrides: Partial<ImportPanelProps> = {}) {
  const props: ImportPanelProps = {
    kind: 'services',
    format: makeImportFormats().services,
    promptValues: { service_names: ['Tyres'] },
    preview: vi.fn(async () => makeImportResult([makeImportItem({ normalised: { name: 'MOT' } })])),
    commit: { label: () => 'Import them', run: vi.fn(async () => undefined) },
    renderItems: (result) => <ServicesPreview result={result} />,
    ...overrides,
  }
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <ImportPanel {...props} />
    </QueryClientProvider>,
  )
  return props
}

function paste(text: string) {
  // fireEvent rather than user.type: JSON's braces are user-event key syntax.
  fireEvent.change(screen.getByLabelText('Paste JSON'), { target: { value: text } })
}

describe('ImportPanel', () => {
  it('shows where invalid JSON breaks and will not preview it', async () => {
    renderPanel()
    paste('{"services": [\n  {"name": "MOT",}\n]}')

    expect(await screen.findByText(/not valid json — line 2/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()
  })

  it('previews through the server and shows the summary', async () => {
    const user = userEvent.setup()
    const props = renderPanel()
    paste(PAYLOAD)
    await user.click(await screen.findByRole('button', { name: 'Preview' }))

    expect(props.preview).toHaveBeenCalledWith({ services: [{ name: 'MOT' }] })
    expect(await screen.findByRole('list', { name: 'Preview summary' })).toHaveTextContent(/New1/)
    expect(screen.getByRole('cell', { name: 'MOT' })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText(/preview ready: 1 new/i)).toBeInTheDocument(),
    )
  })

  it('will not import while any row has an error', async () => {
    const user = userEvent.setup()
    renderPanel({
      preview: async () =>
        makeImportResult([
          makeImportItem({
            status: 'ERROR',
            errors: [{ path: 'services[0].name', message: 'Required.' }],
          }),
        ]),
    })
    paste(PAYLOAD)
    await user.click(await screen.findByRole('button', { name: 'Preview' }))

    expect(await screen.findByText('services[0].name')).toBeInTheDocument()
    expect(screen.getByText(/nothing can be imported until/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import them' })).toBeDisabled()
  })

  it('needs an explicit "import anyway" when rows have warnings', async () => {
    const user = userEvent.setup()
    const props = renderPanel({
      preview: async () =>
        makeImportResult([
          makeImportItem({ warnings: [{ path: 'services[0].colour', message: 'Ignored.' }] }),
        ]),
    })
    paste(PAYLOAD)
    await user.click(await screen.findByRole('button', { name: 'Preview' }))

    const importButton = await screen.findByRole('button', { name: 'Import them' })
    expect(importButton).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /import anyway/i }))
    await user.click(importButton)

    expect(props.commit.run).toHaveBeenCalledWith(
      { services: [{ name: 'MOT' }] },
      expect.objectContaining({ counts: expect.objectContaining({ warning: 1 }) }),
      true,
    )
  })

  it('treats any edit after a preview as needing a new preview', async () => {
    const user = userEvent.setup()
    renderPanel()
    paste(PAYLOAD)
    await user.click(await screen.findByRole('button', { name: 'Preview' }))
    await screen.findByRole('button', { name: 'Import them' })

    paste('{"services": [{"name": "MOT test"}]}')

    expect(await screen.findByText(/changed since this preview/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import them' })).toBeDisabled()
  })

  it('shows the fresh result when the server refuses the commit', async () => {
    const user = userEvent.setup()
    const refused: ImportResult = makeImportResult([
      makeImportItem({
        status: 'ERROR',
        errors: [{ path: 'services[0].name', message: 'Someone else took it.' }],
      }),
    ])
    renderPanel({
      commit: {
        label: () => 'Import them',
        run: async () => {
          throw new ApiError({ code: 422, status: 'Unprocessable', ...refused } as never, 'x')
        },
      },
    })
    paste(PAYLOAD)
    await user.click(await screen.findByRole('button', { name: 'Preview' }))
    await user.click(await screen.findByRole('button', { name: 'Import them' }))

    expect(await screen.findByText(/someone else took it/i)).toBeInTheDocument()
  })

  it('copies the AI prompt filled in with real values', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderPanel()

    await user.click(screen.getByText('JSON format and AI prompt'))
    await user.click(screen.getByRole('button', { name: 'Copy AI prompt' }))

    expect(writeText).toHaveBeenCalledWith('Extract services. Existing: "Tyres"')
    expect(await screen.findByText('AI prompt copied.')).toBeInTheDocument()
  })

  it('shows a data-protection note for appointments only', async () => {
    const user = userEvent.setup()
    renderPanel({ kind: 'appointments', format: makeImportFormats().appointments })
    await user.click(screen.getByText('JSON format and AI prompt'))
    expect(screen.getByText(/data protection/i)).toBeInTheDocument()
  })

  it('reads a chosen .json file into the box', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.upload(
      screen.getByLabelText(/choose a \.json file/i),
      new File([PAYLOAD], 'services.json', { type: 'application/json' }),
    )
    expect(await screen.findByDisplayValue(PAYLOAD)).toBeInTheDocument()
    expect(screen.getByText('Valid JSON.')).toBeInTheDocument()
  })
})

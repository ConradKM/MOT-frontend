import { afterEach, describe, expect, it } from 'vitest'
import { loadSquareSdk, resetSquareSdkLoader, SQUARE_SDK_URLS } from './squareSdk'

function injected() {
  return Array.from(document.querySelectorAll<HTMLScriptElement>('script[data-square-sdk]'))
}

afterEach(() => {
  injected().forEach((s) => s.remove())
  delete window.Square
  resetSquareSdkLoader()
})

describe('loadSquareSdk', () => {
  it('injects the environment-specific script once, however often it is asked', async () => {
    const first = loadSquareSdk('sandbox')
    const second = loadSquareSdk('sandbox')
    expect(injected()).toHaveLength(1)
    expect(injected()[0].src).toBe(SQUARE_SDK_URLS.sandbox)

    window.Square = { payments: () => ({ card: async () => ({}) as never }) }
    injected()[0].dispatchEvent(new Event('load'))
    await expect(first).resolves.toBe(window.Square)
    await expect(second).resolves.toBe(window.Square)
    await expect(loadSquareSdk('sandbox')).resolves.toBe(window.Square)
    expect(injected()).toHaveLength(1)
  })

  it('uses the production host for production', () => {
    void loadSquareSdk('production').catch(() => {})
    expect(injected()[0].src).toBe('https://web.squarecdn.com/v1/square.js')
  })

  it('rejects on a load failure and allows a clean retry', async () => {
    const failed = loadSquareSdk('sandbox')
    injected()[0].dispatchEvent(new Event('error'))
    await expect(failed).rejects.toThrow('failed to load')
    expect(injected()).toHaveLength(0)

    void loadSquareSdk('sandbox').catch(() => {})
    expect(injected()).toHaveLength(1)
  })
})

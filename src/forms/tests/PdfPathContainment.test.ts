/** @jest-environment node */
import { PDFDocument } from 'pdf-lib'
import { createPdfDownloader } from '../../../server/utils/pdf-downloader'
import { downloadPDF } from 'ustaxes/core/pdfFiller/pdfHandler'

/** Retains main's twelve cases with real PDF positives and no live networking. */
describe('form path containment', () => {
  const downloader = createPdfDownloader('Y2025')

  it('loads a legitimate relative path from the actual bundle', async () => {
    expect((await downloader('irs/f1040.pdf')).getPageCount()).toBe(2)
  })

  it.each([
    '../../../../etc/passwd',
    'irs/../../../../etc/passwd',
    'irs/../../Y2024/irs/f1040.pdf'
  ])(
    'refuses a path that climbs out of the year directory: %s',
    async (bad) => {
      await expect(downloader(bad)).rejects.toThrow(
        'Invalid bundled PDF template path'
      )
    }
  )

  it('refuses an absolute filesystem path', async () => {
    await expect(downloader('/etc/passwd')).rejects.toThrow(
      'Invalid bundled PDF template path'
    )
  })
})

describe('browser form downloader', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(global, 'window')
  const originalFetch = Object.getOwnPropertyDescriptor(global, 'fetch')
  beforeEach(() => {
    Object.defineProperty(global, 'window', { value: {}, configurable: true })
  })
  afterEach(() => {
    if (originalFetch) Object.defineProperty(global, 'fetch', originalFetch)
    else Reflect.deleteProperty(global, 'fetch')
    if (originalWindow) Object.defineProperty(global, 'window', originalWindow)
    else Reflect.deleteProperty(global, 'window')
  })

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'https://evil.example/f1040.pdf',
    'file:///etc/passwd',
    '//evil.example/f1040.pdf'
  ])('refuses a URL that names a scheme or host: %s', async (bad) => {
    const spy = jest.fn().mockRejectedValue(new Error('Unexpected fetch'))
    global.fetch = spy
    await expect(downloadPDF(bad)).rejects.toThrow(
      'Refusing to fetch a form from a non-relative URL'
    )
    expect(spy).not.toHaveBeenCalled()
  })

  it.each([
    '/forms/Y2025/irs/f1040.pdf',
    '/forms/Y2024/irs/f1040sh.pdf',
    '/forms/Y2026/irs/f1040s1a.pdf'
  ])('loads the template URL shape callers build: %s', async (ok) => {
    const pdf = await PDFDocument.create()
    pdf.addPage()
    const bytes = await pdf.save()
    const spy = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(bytes)
    })
    global.fetch = spy
    expect((await downloadPDF(ok)).getPageCount()).toBe(1)
    expect(spy).toHaveBeenCalledWith(ok, { redirect: 'error' })
  })
})

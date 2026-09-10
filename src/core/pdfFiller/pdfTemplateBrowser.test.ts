/** @jest-environment jsdom */
import { PDFDocument } from 'pdf-lib'
import { downloadPDF } from './pdfHandler'

describe('bundled browser PDF requests', () => {
  const previous = global.fetch
  afterEach(() => {
    global.fetch = previous
  })
  it.each([
    'https://example.com/a.pdf',
    'http://127.0.0.1/a.pdf',
    '//example.com/a.pdf',
    '/forms/Y2025/irs/../../x.pdf',
    '/forms/Y2025/irs/%2fsecret.pdf',
    '/forms/Y2025/irs/f1040.pdf?url=http://localhost',
    'data:application/pdf,example'
  ])('rejects %s without a network request', async (path) => {
    const spy = jest.fn()
    global.fetch = spy
    await expect(downloadPDF(path)).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })
  it('fetches only the root-relative bundled template and forbids redirects', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage()
    const bytes = await pdf.save()
    const spy = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(bytes)
    })
    global.fetch = spy
    expect(
      (await downloadPDF('/forms/Y2025/irs/f1040.pdf')).getPageCount()
    ).toBe(1)
    expect(spy).toHaveBeenCalledWith('/forms/Y2025/irs/f1040.pdf', {
      redirect: 'error'
    })
  })
  it('refuses a failed download before interpreting HTML as a PDF', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 })
    await expect(downloadPDF('/forms/Y2025/irs/f1040.pdf')).rejects.toThrow(
      '404'
    )
  })
})

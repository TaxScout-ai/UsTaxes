import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { createPdfDownloader } from '../../../server/utils/pdf-downloader'
import { downloadPDF } from 'ustaxes/core/pdfFiller/pdfHandler'

/**
 * Form paths come from the form definitions, not from the request body, and
 * these tests are what keeps that true. Both refusals guard a service that
 * handles tax returns: one against reading a file outside the form directory,
 * one against aiming the browser downloader at a host.
 */
describe('form path containment', () => {
  const downloader = createPdfDownloader('Y2025')

  it('lets a legitimate relative path through to the real file', async () => {
    // pdf-lib rejects a Node Buffer under the jsdom test environment, so the
    // assertion is on the containment decision and the file it resolves to,
    // not on parsing the document.
    const formsDir =
      process.env.FORMS_DIR ?? join(__dirname, '../../../public/forms')
    const target = resolve(formsDir, 'Y2025', 'irs/f1040.pdf')
    expect(existsSync(target)).toBe(true)
    await expect(downloader('irs/f1040.pdf')).rejects.not.toThrow(
      /Refusing to read a form outside/
    )
  })

  it.each([
    '../../../../etc/passwd',
    'irs/../../../../etc/passwd',
    'irs/../../Y2024/irs/f1040.pdf'
  ])(
    'refuses a path that climbs out of the year directory: %s',
    async (bad) => {
      await expect(downloader(bad)).rejects.toThrow(
        /Refusing to read a form outside the Y2025 form directory/
      )
    }
  )

  it('refuses an absolute filesystem path', async () => {
    await expect(downloader('/etc/passwd')).rejects.toThrow(
      /Refusing to read a form outside/
    )
  })
})

describe('browser form downloader', () => {
  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'https://evil.example/f1040.pdf',
    'file:///etc/passwd',
    '//evil.example/f1040.pdf'
  ])('refuses a URL that names a scheme or host: %s', async (bad) => {
    const spy = jest.spyOn(global, 'fetch')
    await expect(downloadPDF(bad)).rejects.toThrow(
      /Refusing to fetch a form from a non-relative URL/
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

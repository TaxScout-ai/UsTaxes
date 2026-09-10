/** @jest-environment node */
import { PDFDocument } from 'pdf-lib'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join, relative } from 'path'
import { TaxYear } from 'ustaxes/core/data'
import { createPdfDownloader } from '../../../server/utils/pdf-downloader'
import { downloadPDF } from './pdfHandler'
import { bundledTemplateUrl } from './templatePath'

const attacks = [
  '../f1040.pdf',
  'irs/../../secret.pdf',
  '/etc/passwd',
  'irs\\..\\secret.pdf',
  'irs/%2e%2e%2fsecret.pdf',
  'irs/f1040.pdf?url=https://example.com',
  'irs/f1040.pdf#fragment',
  'irs/f1040.pdf\u0000',
  'http://127.0.0.1:1/secret.pdf',
  '//example.com/f.pdf',
  'irs/f1040.pdf/../x.pdf',
  'irs/.pdf',
  'irs/f1040.pdf\n'
]
describe('PDF template filesystem boundary', () => {
  let directory: string
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'ustaxes-template-'))
  })
  afterEach(() => rmSync(directory, { recursive: true, force: true }))
  it('loads only a genuine PDF from the configured bundle', async () => {
    const folder = join(directory, 'forms', 'Y2025', 'irs')
    mkdirSync(folder, { recursive: true })
    const pdf = await PDFDocument.create()
    pdf.addPage()
    writeFileSync(join(folder, 'f1040.pdf'), await pdf.save())
    expect(
      (
        await createPdfDownloader(
          'Y2025',
          join(directory, 'forms')
        )('irs/f1040.pdf')
      ).getPageCount()
    ).toBe(1)
  })
  it.each(attacks)('rejects %s before attempting a file read', async (path) => {
    await expect(createPdfDownloader('Y2025', directory)(path)).rejects.toThrow(
      'Invalid bundled PDF template path'
    )
  })
  it.each(['../Y2025', 'Y2025/..', 'Y2027', 'https://example.com', 'Y2025%00'])(
    'rejects year %s',
    (year) => {
      expect(() => createPdfDownloader(year as TaxYear, directory)).toThrow(
        'Unsupported PDF template year'
      )
    }
  )
  it('rejects a valid-looking template whose symlink escapes the root', async () => {
    const root = join(directory, 'forms')
    const folder = join(root, 'Y2025', 'irs')
    mkdirSync(folder, { recursive: true })
    const outside = join(directory, 'outside.pdf')
    writeFileSync(outside, 'not a template')
    symlinkSync(outside, join(folder, 'f1040.pdf'))
    await expect(
      createPdfDownloader('Y2025', root)('irs/f1040.pdf')
    ).rejects.toThrow('outside the configured tax-year forms directory')
  })
  it.each(['file', 'year-directory'])(
    'rejects a %s symlink into another tax year',
    async (kind) => {
      const root = join(directory, 'forms')
      const old = join(root, 'Y2024', 'irs')
      mkdirSync(old, { recursive: true })
      const pdf = await PDFDocument.create()
      pdf.addPage()
      writeFileSync(join(old, 'f1040.pdf'), await pdf.save())
      if (kind === 'file') {
        mkdirSync(join(root, 'Y2025', 'irs'), { recursive: true })
        symlinkSync(
          join(old, 'f1040.pdf'),
          join(root, 'Y2025', 'irs', 'f1040.pdf')
        )
      } else symlinkSync(join(root, 'Y2024'), join(root, 'Y2025'))
      await expect(
        createPdfDownloader('Y2025', root)('irs/f1040.pdf')
      ).rejects.toThrow('outside the configured tax-year forms directory')
    }
  )
  it('accepts every existing bundled PDF path without relaxing traversal guards', () => {
    const root = join(process.cwd(), 'public/forms')
    let count = 0
    const walk = (folder: string) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (entry.name.endsWith('.pdf')) {
          const parts = relative(root, path).split(/[\\/]/)
          const year = parts.shift()
          expect(
            bundledTemplateUrl(`/forms/${String(year)}/${parts.join('/')}`)
          ).toBe(`/forms/${String(year)}/${parts.join('/')}`)
          count++
        }
      }
    }
    walk(root)
    expect(count).toBeGreaterThan(100)
  })
  it('blocks the browser downloader on a server even for valid template paths', async () => {
    const previous = global.fetch
    const spy = jest.fn()
    global.fetch = spy
    try {
      await expect(downloadPDF('/forms/Y2025/irs/f1040.pdf')).rejects.toThrow(
        'requires a filesystem downloader'
      )
      expect(spy).not.toHaveBeenCalled()
    } finally {
      global.fetch = previous
    }
  })
})

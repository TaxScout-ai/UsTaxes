import { PDFDocument } from 'pdf-lib'
import { readFileSync, realpathSync } from 'fs'
import { join, relative, isAbsolute, resolve } from 'path'
import { PDFDownloader } from 'ustaxes/core/pdfFiller/pdfHandler'
import { TaxYear } from 'ustaxes/core/data'
import {
  relativeTemplatePath,
  templateYear
} from 'ustaxes/core/pdfFiller/templatePath'

/**
 * PDF forms base directory. In the Docker image, these are
 * copied from public/forms/ into /app/forms/ during build.
 * Locally, they live in public/forms/.
 */
const FORMS_DIR = process.env.FORMS_DIR ?? join(__dirname, '../../public/forms')

/**
 * Creates a year-aware filesystem PDF downloader.
 *
 * When setDownloader() replaces the default downloader, it receives
 * just the relative part like `irs/f1040.pdf` (without the year prefix).
 * The default downloader in CreateForms prepends `/forms/{year}/`, but
 * setDownloader bypasses that. So we need to add the year prefix here.
 */
export function createPdfDownloader(
  taxYear: TaxYear,
  formsDirectory = FORMS_DIR
): PDFDownloader {
  const year = templateYear(taxYear)
  // formsDirectory is trusted deployment configuration, never an HTTP parameter.
  const root = resolve(realpathSync(formsDirectory), year)
  return async (url: string): Promise<PDFDocument> => {
    const template = relativeTemplatePath(url)
    const filePath = realpathSync(resolve(root, template))
    // Preserve main's per-year boundary after resolving the actual target.
    // A file or year-directory symlink may not cross into a different tax year.
    const within = relative(root, filePath)
    if (!within || within.startsWith('..') || isAbsolute(within))
      throw new Error(
        'PDF template resolves outside the configured tax-year forms directory'
      )
    const bytes = readFileSync(filePath)
    return PDFDocument.load(bytes)
  }
}

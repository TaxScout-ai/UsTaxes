import {
  PDFDocument,
  PDFDict,
  PDFRef,
  PDFName,
  PDFString,
  PDFHexString
} from 'pdf-lib'
import Fill from './Fill'
import { fillPDF } from './fillPdf'
import { bundledTemplateUrl } from './templatePath'

export interface FileDownloader<T> {
  (url: string): Promise<T>
}

export type PDFDownloader = FileDownloader<PDFDocument>

/** Direct same-origin guard retained from main's CodeQL-reviewed change. */
const FORM_URL =
  /^\/forms\/[A-Za-z0-9][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9][A-Za-z0-9_.-]*)*$/

export const downloadPDF: PDFDownloader = async (url) => {
  // Server callers must install the filesystem downloader. This function is
  // exclusively for browser/WebView access to this application's bundled forms.
  if (typeof window === 'undefined')
    throw new Error('Server PDF loading requires a filesystem downloader')
  if (!FORM_URL.test(url))
    throw new Error(`Refusing to fetch a form from a non-relative URL: ${url}`)
  const download = await fetch(bundledTemplateUrl(url), { redirect: 'error' })
  if (!download.ok)
    throw new Error(`Bundled PDF template request failed (${download.status})`)
  const buffer = await download.arrayBuffer()
  return await PDFDocument.load(buffer)
}

export const combinePdfs = async (
  pdfFiles: PDFDocument[]
): Promise<PDFDocument> => {
  const rest = await Promise.all(
    pdfFiles.map(async (pdf) => PDFDocument.load(await pdf.save()))
  )
  const head = rest.shift()
  if (!head) throw new Error('Cannot combine an empty PDF packet')

  // Make sure we combine the documents from left to right and preserve order
  return rest.reduce(async (l, r, index) => {
    const doc = await PDFDocument.load(await (await l).save())
    return await doc.copyPages(r, r.getPageIndices()).then((pgs) => {
      const roots = new Map<string, PDFRef>()
      for (const page of pgs) {
        doc.addPage(page)
        // copyPages copies widget annotations but does not register their field
        // trees in the target AcroForm. Register each copied root exactly once.
        for (const entry of page.node.Annots()?.asArray() ?? []) {
          if (!(entry instanceof PDFRef)) continue
          let ref = entry
          let field = doc.context.lookup(ref, PDFDict)
          if (field.get(PDFName.of('Subtype')) !== PDFName.of('Widget'))
            continue
          const visited = new Set<string>()
          while (field.has(PDFName.of('Parent'))) {
            if (visited.has(ref.toString()))
              throw new Error('Cyclic PDF field tree')
            visited.add(ref.toString())
            ref = field.get(PDFName.of('Parent')) as PDFRef
            field = doc.context.lookup(ref, PDFDict)
          }
          roots.set(ref.toString(), ref)
        }
      }
      for (const ref of Array.from(roots.values())) {
        const field = doc.context.lookup(ref, PDFDict)
        const name = field.get(PDFName.of('T'))
        if (!(name instanceof PDFString) && !(name instanceof PDFHexString))
          throw new Error('Imported PDF field root has no name')
        // IRS forms reuse topmostSubform. A prefix prevents cross-form aliasing.
        field.set(
          PDFName.of('T'),
          PDFHexString.fromText(`attachment_${index + 1}_${name.decodeText()}`)
        )
        doc.getForm().acroForm.addField(ref)
      }
      return doc
    })
  }, Promise.resolve(head))
}

export const getPdfs = async (
  formData: Array<[Fill, PDFDocument]>
): Promise<PDFDocument[]> => {
  // Insert the values from each field into the PDF
  const pdfFiles: Array<Promise<PDFDocument>> = formData.map(
    async ([data, f]) => {
      fillPDF(f, data.renderedFields(), 'Not Set')
      const pageBytes = await f.save()
      return await PDFDocument.load(pageBytes)
    }
  )

  return await Promise.all(pdfFiles)
}

import { PDFDocument, StandardFonts } from 'pdf-lib'
import { FormStatement } from '../irsForms/Form'

/** Explicit supporting pages; never truncate overflow items in an IRS form. */
export async function statementsPdf(
  statements: FormStatement[]
): Promise<PDFDocument> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (const statement of statements) {
    let page = pdf.addPage([612, 792])
    let y = 740
    const write = (text: string) => {
      const words = text.split(/\s+/)
      let line = ''
      const flush = () => {
        if (y < 50) {
          page = pdf.addPage([612, 792])
          y = 740
        }
        page.drawText(line, { x: 36, y, size: 10, font })
        y -= 15
        line = ''
      }
      for (const word of words) {
        if (font.widthOfTextAtSize(word, 10) > 540)
          throw new Error(
            'Supporting statement contains an unbreakable oversized value'
          )
        const candidate = line ? `${line} ${word}` : word
        if (font.widthOfTextAtSize(candidate, 10) > 540) flush()
        line = line ? `${line} ${word}` : word
      }
      flush()
    }
    write(statement.title)
    y -= 10
    statement.lines.forEach(write)
  }
  return pdf
}

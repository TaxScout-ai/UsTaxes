import { PDFDocument, PDFCheckBox, PDFTextField, PDFName } from 'pdf-lib'
import { Field } from '.'
import { displayRound } from '../irsForms/util'
import _ from 'lodash'

/**
 * Fill a PDF by FIELD NAME (not by array index).
 *
 * This is the preferred method for Y2025+ forms. It decouples the code
 * from the PDF field ordering, so IRS can add/remove fields without
 * breaking all downstream mappings.
 *
 * @param pdf - The PDF document to fill
 * @param namedValues - Record of field name → value
 * @param formName - Form name for error messages
 */
export function fillPDFByName(
  pdf: PDFDocument,
  namedValues: Record<string, Field>,
  formName: string
): PDFDocument {
  const allFields = pdf.getForm().getFields()
  for (const [fieldName, value] of Object.entries(namedValues)) {
    if (value === undefined || value === null) continue
    const exact = allFields.filter((f) => f.getName() === fieldName)
    const matches =
      exact.length > 0
        ? exact
        : allFields.filter(
            (f) =>
              f.getName().endsWith(`.${fieldName}[0]`) ||
              f.getName().endsWith(`.${fieldName}`)
          )
    if (matches.length !== 1)
      throw new Error(
        `${formName}: field ${fieldName} resolves to ${matches.length} controls`
      )
    const field = matches[0]
    if (_.isObject(value) && 'select' in value) {
      const widgets = field.acroField.getWidgets()
      if (
        !Number.isInteger(value.select) ||
        value.select < 0 ||
        value.select >= widgets.length
      )
        throw new Error(`${formName}: invalid radio selection for ${fieldName}`)
      const selected = widgets[value.select].getOnValue()
      if (selected === undefined)
        throw new Error(`${formName}: radio ${fieldName} has no on value`)
      field.acroField.dict.set(PDFName.of('V'), selected)
      widgets.forEach((w, i) =>
        w.setAppearanceState(i === value.select ? selected : PDFName.of('Off'))
      )
    } else if (field instanceof PDFCheckBox) {
      if (typeof value !== 'boolean')
        throw new Error(`${formName}: checkbox ${fieldName} requires a boolean`)
      if (value) field.check()
      else field.uncheck()
    } else if (field instanceof PDFTextField) {
      if (typeof value !== 'string' && typeof value !== 'number')
        throw new Error(
          `${formName}: text ${fieldName} requires text or a number`
        )
      if (typeof value === 'number' && !Number.isFinite(value))
        throw new Error(`${formName}: non-finite value for ${fieldName}`)
      // The calculator owns money rounding. Strings include EINs, QMIDs, rates
      // and dates and must never be coerced into numbers by the PDF renderer.
      field.setMaxLength(undefined)
      field.setText(String(value))
    } else
      throw new Error(`${formName}: unsupported field type for ${fieldName}`)
    field.enableReadOnly()
  }
  return pdf
}

/**
 * Legacy: Fill a PDF by positional array index.
 * Used by Y2020-Y2024 forms. Y2025+ should use fillPDFByName.
 *
 * TOLERANT MODE: Instead of throwing on type mismatches
 * (boolean→text, number→checkbox), it skips the field with a warning.
 * This prevents PDF generation failures from minor mapping errors.
 */
export function fillPDF(
  pdf: PDFDocument,
  fieldValues: Field[],
  formName: string
): PDFDocument {
  const formFields = pdf.getForm().getFields()

  formFields.forEach((pdfField, index) => {
    const value: Field = fieldValues[index]

    // First handle radio groups
    if (_.isObject(value)) {
      const children = pdfField.acroField.getWidgets()
      if (value.select >= children.length) {
        console.warn(
          `${formName} Field ${index}: radio select ${value.select} exceeds ${children.length} children`
        )
        return
      }
      const setValue = children[value.select].getOnValue()
      if (setValue !== undefined) {
        pdfField.acroField.dict.set(PDFName.of('V'), setValue)
        children[value.select].setAppearanceState(setValue)
      }
    } else if (pdfField instanceof PDFCheckBox) {
      if (value === true) {
        pdfField.check()
      } else if (value !== false && value !== undefined) {
        // TOLERANT: non-boolean for checkbox — skip instead of throwing
        console.warn(
          `${formName} Field ${index} (${pdfField.getName()}): expected boolean for checkbox, got ${typeof value} — skipped`
        )
        return
      }
    } else if (pdfField instanceof PDFTextField) {
      try {
        pdfField.setMaxLength(undefined)

        // TOLERANT: skip booleans going to text fields
        if (typeof value === 'boolean') {
          return
        }

        const showValue =
          !isNaN(value as number) &&
          value &&
          Array.from(value as string)[0] !== '0'
            ? displayRound(value as number)?.toString()
            : value?.toString()
        pdfField.setText(showValue)
      } catch (err) {
        console.warn(
          `${formName} Field ${index} (${pdfField.getName()}): skipped – ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }
    } else if (value !== undefined) {
      // TOLERANT: unknown field type — warn instead of throwing
      console.warn(
        `${formName} Field ${index} (${pdfField.getName()}): unknown field type — skipped`
      )
      return
    }
    pdfField.enableReadOnly()
  })

  return pdf
}

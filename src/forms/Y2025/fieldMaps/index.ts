/**
 * Y2025 Named Field Maps
 *
 * Maps semantic field names to IRS 2025 PDF field IDs.
 * Used by fillPDFByName to write values to the correct PDF fields
 * regardless of field ordering changes between tax years.
 *
 * When IRS releases 2026 forms, create new maps here — the form
 * calculation code doesn't need to change.
 */

// Form 1040 Page 1 + Page 2
export const F1040_FIELDS: Record<string, string> = {
  // Page 1 — Header
  first_name: 'f1_14',
  last_name: 'f1_15',
  ssn: 'f1_16',
  spouse_first_name: 'f1_17',
  spouse_last_name: 'f1_18',
  spouse_ssn: 'f1_19',
  address: 'f1_20',
  apt_no: 'f1_21',
  city: 'f1_22',
  state: 'f1_23',
  zip: 'f1_24',
  foreign_country: 'f1_25',
  foreign_province: 'f1_26',
  foreign_postal_code: 'f1_27',

  // Filing status: five independent c1_8 checkboxes in the TY2025 template
  filing_status_single:
    'topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[0]',
  filing_status_mfj: 'topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[1]',
  filing_status_mfs: 'topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[2]',
  filing_status_hoh: 'topmostSubform[0].Page1[0].c1_8[0]',
  filing_status_qss: 'topmostSubform[0].Page1[0].c1_8[1]',
  mfs_spouse_name: 'f1_28',
  hoh_child_name: 'f1_29',
  nonresident_spouse_name: 'f1_30',

  // Checkboxes
  campaign_you: 'c1_6',
  campaign_spouse: 'c1_7',
  digital_assets_yes: 'c1_10',
  // Dependent checkboxes are handled by the form's _depField methods

  // Dependents (4 rows × 4 columns)
  dep1_first_name: 'f1_31',
  dep1_last_name: 'f1_35',
  dep1_ssn: 'f1_39',
  dep1_rel: 'f1_43',
  dep2_first_name: 'f1_32',
  dep2_last_name: 'f1_36',
  dep2_ssn: 'f1_40',
  dep2_rel: 'f1_44',
  dep3_first_name: 'f1_33',
  dep3_last_name: 'f1_37',
  dep3_ssn: 'f1_41',
  dep3_rel: 'f1_45',
  dep4_first_name: 'f1_34',
  dep4_last_name: 'f1_38',
  dep4_ssn: 'f1_42',
  dep4_rel: 'f1_46',

  // Income
  line_1a: 'f1_47',
  line_1b: 'f1_48',
  line_1c: 'f1_49',
  line_1d: 'f1_50',
  line_1e: 'f1_51',
  line_1f: 'f1_52',
  line_1g: 'f1_53',
  line_1h_text: 'f1_54',
  line_1h: 'f1_55',
  line_1i: 'f1_56',
  line_1z: 'f1_57',
  line_2a: 'f1_58',
  line_2b: 'f1_59',
  line_3a: 'f1_60',
  line_3b: 'f1_61',
  line_4a: 'f1_62',
  line_4b: 'f1_63',
  line_4c: 'f1_64',
  line_5a: 'f1_65',
  line_5b: 'f1_66',
  line_5c: 'f1_67',
  line_6a: 'f1_68',
  line_6b: 'f1_69',
  line_7: 'f1_70',
  line_8: 'f1_72',
  line_9: 'f1_73',
  line_10: 'f1_74',
  line_11: 'f1_75', // AGI

  // Page 2
  born_before_1961_01_02: 'c2_5',
  blind: 'c2_6',
  spouse_born_before_1961_01_02: 'c2_7',
  spouse_blind: 'c2_8',
  line_11b: 'f2_01',
  line_12: 'f2_02', // Deductions
  line_13a: 'f2_03', // QBI
  line_13b: 'f2_04',
  line_14: 'f2_05', // Total deductions
  line_15: 'f2_06', // Taxable income
  line_16_form: 'f2_07',
  line_16: 'f2_08', // Tax
  line_17: 'f2_09',
  line_18: 'f2_10',
  line_19: 'f2_11',
  line_20: 'f2_12',
  line_21: 'f2_13',
  line_22: 'f2_14',
  line_23: 'f2_15',
  line_24: 'f2_16', // Total tax
  line_25a: 'f2_17',
  line_25b: 'f2_18',
  line_25c: 'f2_19',
  line_25d: 'f2_20',
  line_26: 'f2_21',
  line_27a: 'f2_23',
  line_27c: 'c2_13', // Election not to claim EIC (not an age test)
  line_28: 'f2_24',
  line_29: 'f2_25',
  line_30: 'f2_26',
  line_31: 'f2_27',
  line_32: 'f2_28',
  line_33: 'f2_29', // Total payments
  line_34: 'f2_30',
  line_35a: 'f2_31', // Refund
  routing_number: 'f2_32',
  account_number: 'f2_33',
  line_36: 'f2_34',
  line_37: 'f2_35', // Amount owed
  line_38: 'f2_36',
  // Sign here
  designee_name: 'f2_37',
  designee_phone: 'f2_38',
  designee_pin: 'f2_39',
  your_occupation: 'f2_40',
  your_ip_pin: 'f2_41',
  spouse_occupation: 'f2_42',
  spouse_ip_pin: 'f2_43',
  phone: 'f2_44',
  email: 'f2_45'
}

// Schedule 1
export const SCHEDULE1_FIELDS: Record<string, string> = {
  name: 'f1_01',
  ssn: 'f1_02',
  line_1: 'f1_03',
  line_2a: 'f1_04',
  line_2b: 'f1_05',
  line_3: 'f1_06',
  line_4: 'f1_07',
  schedule_c_check: 'c1_1',
  schedule_f_check: 'c1_2',
  line_5: 'f1_08',
  line_6: 'f1_09',
  line_7: 'f1_10',
  line_8a: 'f1_13',
  line_8b: 'f1_14',
  line_8c: 'f1_15',
  line_8d: 'f1_16',
  line_8e: 'f1_17',
  line_8f: 'f1_18',
  line_8g: 'f1_19',
  line_8h: 'f1_20',
  line_8i: 'f1_21',
  line_8j: 'f1_22',
  line_8k: 'f1_23',
  line_8l: 'f1_24',
  line_8m: 'f1_25',
  line_8n: 'f1_26',
  line_8o: 'f1_27',
  line_8p: 'f1_28',
  line_8q: 'f1_29',
  line_8r: 'f1_30',
  line_8s: 'f1_31',
  line_8t: 'f1_32',
  line_8u: 'f1_33',
  line_8v: 'f1_34',
  line_8z_desc: 'f1_35',
  line_8z: 'f1_36',
  line_9: 'f1_37',
  line_10: 'f1_38',
  // Page 2
  name_p2: 'f2_01',
  ssn_p2: 'f2_02',
  line_11: 'f2_03',
  line_12: 'f2_04',
  line_13: 'f2_05',
  line_14: 'f2_06',
  line_15: 'f2_07',
  line_16: 'f2_08',
  line_17: 'f2_09',
  line_18: 'f2_10',
  line_19a: 'f2_11',
  line_19b: 'f2_12',
  line_19c: 'f2_13',
  line_20: 'f2_14',
  line_21: 'f2_15',
  line_23: 'f2_16',
  line_24a: 'f2_17',
  line_24b: 'f2_18',
  line_24c: 'f2_19',
  line_24d: 'f2_20',
  line_24e: 'f2_21',
  line_24f: 'f2_22',
  line_24g: 'f2_23',
  line_24h: 'f2_24',
  line_24i: 'f2_25',
  line_24j: 'f2_26',
  line_24k: 'f2_27',
  line_24z_desc: 'f2_28',
  line_24z: 'f2_29',
  line_25: 'f2_30'
}

// Schedule A
export const SCHEDULE_A_FIELDS: Record<string, string> = {
  name: 'f1_1',
  ssn: 'f1_2',
  line_1: 'f1_3',
  line_2: 'f1_4',
  line_3: 'f1_5',
  line_4: 'f1_6',
  sales_tax_check: 'c1_1',
  line_5a: 'f1_7',
  line_5b: 'f1_8',
  line_5c: 'f1_9',
  line_5d: 'f1_10',
  line_5e: 'f1_11',
  line_6_desc1: 'f1_12',
  line_6_desc2: 'f1_13',
  line_6: 'f1_14',
  mortgage_check: 'c1_2',
  line_8a: 'f1_15',
  line_8b_desc: 'f1_16',
  line_8b: 'f1_17',
  line_8c: 'f1_18',
  line_8d: 'f1_19',
  line_8e: 'f1_20',
  line_9: 'f1_21',
  line_10: 'f1_22',
  line_11: 'f1_23',
  line_12: 'f1_24',
  line_13: 'f1_25',
  line_14: 'f1_26',
  line_15: 'f1_27',
  line_16: 'f1_28',
  line_17: 'f1_29',
  line_18: 'f1_30',
  itemize_check: 'c1_3'
}

// Schedule 2 — Additional Taxes
export const SCHEDULE2_FIELDS: Record<string, string> = {
  name: 'f1_01',
  ssn: 'f1_02',
  // Part I
  line_1a: 'f1_03',
  line_1b: 'f1_04',
  line_1c: 'f1_05',
  line_1d: 'f1_06',
  line_1e: 'f1_07',
  line_1f: 'f1_08',
  line_1y: 'f1_09',
  line_1z: 'f1_10',
  line_2: 'f1_11',
  line_3: 'f1_12',
  // Part II
  line_4: 'f1_13',
  line_5: 'f1_14',
  line_6: 'f1_15',
  line_7: 'f1_16',
  line_8: 'f1_17',
  line_9: 'f1_18',
  line_10: 'f1_19',
  line_11: 'f1_20', // Additional Medicare Tax
  line_12: 'f1_21', // NIIT
  line_13: 'f1_22',
  line_14: 'f1_23',
  line_15: 'f1_24',
  line_16: 'f1_25',
  // Page 2
  line_17a_desc: 'f2_01',
  line_17a: 'f2_02',
  line_17b: 'f2_03',
  line_17c: 'f2_04',
  line_17d: 'f2_05',
  line_17e: 'f2_06',
  line_17f: 'f2_07',
  line_17g: 'f2_08',
  line_17h: 'f2_09',
  line_17i: 'f2_10',
  line_17j: 'f2_11',
  line_17k: 'f2_12',
  line_17l: 'f2_13',
  line_17m: 'f2_14',
  line_17n: 'f2_15',
  line_17o: 'f2_16',
  line_17p: 'f2_17',
  line_17q: 'f2_18',
  line_17z_desc: 'f2_19',
  line_17z: 'f2_20',
  line_18: 'f2_21',
  line_19: 'f2_22',
  line_20: 'f2_23',
  line_21: 'f2_24'
}

// Form 8889 — HSA
export const F8889_FIELDS: Record<string, string> = {
  name: 'f1_1',
  ssn: 'f1_2',
  self_only: 'c1_1',
  family: 'c1_1[1]',
  // Part I
  line_2: 'f1_3',
  line_3: 'f1_4',
  line_4: 'f1_5',
  line_5: 'f1_6',
  line_6: 'f1_7',
  line_7: 'f1_8',
  line_8: 'f1_9',
  line_9: 'f1_10',
  line_10: 'f1_11',
  line_11: 'f1_12',
  line_12: 'f1_13',
  line_13: 'f1_14', // HSA deduction
  // Part II
  line_14a: 'f1_15',
  line_14b: 'f1_16',
  line_14c: 'f1_17',
  line_15: 'f1_18',
  line_16: 'f1_19',
  line_17b: 'f1_20',
  // Part III
  line_18: 'f1_21',
  line_19: 'f1_22',
  line_20: 'f1_23',
  line_21: 'f1_24'
}

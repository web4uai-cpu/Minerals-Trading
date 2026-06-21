// @khanij/finance — Financial operations domain logic (invoicing, GST calculation, settlement rules)

export { computeGst, type GstInput, type GstBreakdown } from './logic/gst-calculator';
export {
  generateInvoice,
  paiseToWords,
  type InvoiceInput,
  type InvoiceLineItem,
  type GeneratedInvoice,
} from './logic/invoice-generator';
export {
  determineSettlement,
  type SettlementAction,
  type SettlementContext,
} from './logic/settlement-rules';

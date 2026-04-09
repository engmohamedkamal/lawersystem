import mongoose, { Types } from "mongoose";

export const CASE_STATUSES    = ["قيد التحضير", "قيد التنفيذ", "منتهية", "موقوفة", "مؤرشفة"] as const;
export const PAYMENT_METHODS  = ["كاش", "تحويل بنكي", "شيك"] as const;
export const PAYMENT_STATUSES = ["لم يُسدد", "سُدد جزئياً", "سُدد بالكامل"] as const;
export const CASE_PRIORITIES  = ["منخفضة", "متوسطة", "عالية", "عاجلة"] as const;

export type CaseStatus    = (typeof CASE_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type CasePriority  = (typeof CASE_PRIORITIES)[number];

export interface IFees {
  totalAmount:    number;
  paidAmount:     number;
  paymentMethod?: PaymentMethod;
  paymentStatus:  PaymentStatus;
  notes?:         string;
}

export interface IExtraPayment {
  amount:         number;
  description:    string;
  items:          { description: string; amount: number }[]; 
  paymentMethod?: PaymentMethod;
  paidAt:         Date;
  invoiceId?:     Types.ObjectId;
}



export interface IAttachment {
  url:        string;
  publicId:   string;
  name:       string;
  uploadedAt: Date;
}

export interface ILegalCase extends mongoose.Document {
  _id:           Types.ObjectId;
  officeId:      Types.ObjectId;
  caseNumber:    string;
  caseType:      Types.ObjectId;
  status:        CaseStatus;
  priority:      CasePriority;
  openedAt:      Date;
  closedAt?:     Date;
  court?:        string;
  city?:         string;
  description?:  string;
  client:        Types.ObjectId;
  assignedTo?:   Types.ObjectId;
  team:          Types.ObjectId[];
  fees:          IFees;
  extraPayments: IExtraPayment[];
  attachments:   IAttachment[];
  createdBy:     Types.ObjectId;
  isDeleted:     boolean;
  deletedAt?:    Date;
  deletedBy?:    Types.ObjectId;
}

const FeesSchema = new mongoose.Schema<IFees>(
  {
    totalAmount:   { type: Number, default: 0, min: 0 },
    paidAmount:    { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "لم يُسدد" },
    notes:         { type: String, trim: true, maxLength: 500 },
  },
  { _id: false }
);

const ExtraPaymentSchema = new mongoose.Schema<IExtraPayment>(
  {
    amount:        { type: Number, required: true, min: 0 },
    description:   { type: String, required: true, trim: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS },
    paidAt:        { type: Date, default: Date.now },
    invoiceId:     { type: Types.ObjectId, ref: "Invoice" },
    items: { type: [{ description: String, amount: Number }], default: [] },
  },
  { _id: true }
);

const AttachmentSchema = new mongoose.Schema<IAttachment>(
  {
    url:        { type: String, required: true },
    publicId:   { type: String, required: true },
    name:       { type: String, required: true, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const LegalCaseSchema = new mongoose.Schema<ILegalCase>(
  {
    officeId:      { type: Types.ObjectId, ref: "Office", required: false },
    caseNumber:    { type: String, required: true, trim: true },
    caseType:      { type: Types.ObjectId, ref: "CaseType",  required: true },
    client:        { type: Types.ObjectId, ref: "Client",    required: true },
    status:        { type: String, enum: CASE_STATUSES,   default: "قيد التحضير", required: true },
    priority:      { type: String, enum: CASE_PRIORITIES, default: "متوسطة",      required: true },
    openedAt:      { type: Date, required: true },
    closedAt:      { type: Date },
    court:         { type: String, trim: true, maxLength: 200 },
    city:          { type: String, trim: true, maxLength: 100 },
    description:   { type: String, trim: true, maxLength: 4000 },
    assignedTo:    { type: Types.ObjectId, ref: "User" },
    team:          [{ type: Types.ObjectId, ref: "User" }],
    fees:          { type: FeesSchema, default: () => ({}) },
    extraPayments: { type: [ExtraPaymentSchema], default: [] },
    attachments:   { type: [AttachmentSchema], default: [] },
    createdBy:     { type: Types.ObjectId, ref: "User", required: true },
    isDeleted:     { type: Boolean, default: false },
    deletedAt:     { type: Date },
    deletedBy:     { type: Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON:   { virtuals: true },
  }
);

LegalCaseSchema.virtual("fees.remainingAmount").get(function () {
  return Math.max((this.fees?.totalAmount ?? 0) - (this.fees?.paidAmount ?? 0), 0);
});

LegalCaseSchema.virtual("totalPaidAll").get(function () {
  const feesPaid  = this.fees?.paidAmount ?? 0;
  const extraPaid = (this.extraPayments ?? []).reduce((sum: number, p: IExtraPayment) => sum + (p.amount ?? 0), 0);
  return feesPaid + extraPaid;
});

export const calcPaymentStatus = (totalAmount: number, paidAmount: number): PaymentStatus => {
  if (paidAmount <= 0)           return "لم يُسدد";
  if (paidAmount >= totalAmount) return "سُدد بالكامل";
  return "سُدد جزئياً";
};

LegalCaseSchema.index({ client: 1, status: 1 });
LegalCaseSchema.index({ caseType: 1, status: 1 });
LegalCaseSchema.index({ assignedTo: 1, status: 1 });
LegalCaseSchema.index({ isDeleted: 1, status: 1 });
LegalCaseSchema.index({ caseNumber: 1, officeId: 1 }, { unique: true });

const LegalCaseModel = mongoose.models.LegalCase || mongoose.model<ILegalCase>("LegalCase", LegalCaseSchema);
export default LegalCaseModel;
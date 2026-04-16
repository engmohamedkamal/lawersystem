import mongoose, { Types } from "mongoose";
import { PAYMENT_METHODS, PaymentMethod } from "./LegalCase.model";

export const CLIENT_TYPES = ["فرد", "شركة"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export interface IExtraPaymentItem {
  description: string;
  amount:      number;
}


export interface IDocument {
  url:        string;
  publicId:   string;
  name:       string;
  sizeBytes:  number;
  uploadedAt: Date;
}

export interface IClientExtraPayment {
  amount:         number;
  description:    string;
  items:          IExtraPaymentItem[];
  paymentMethod?: PaymentMethod;
  paidAt:         Date;
  legalCaseId?:   Types.ObjectId;
  invoiceId?:     Types.ObjectId;
}

export interface IClientExtraPayment {
  amount:         number;
  description:    string;
  paymentMethod?: PaymentMethod;
  paidAt:         Date;
  legalCaseId?:   Types.ObjectId;
  invoiceId?:     Types.ObjectId;
}

export interface IClient extends mongoose.Document {
  _id:           Types.ObjectId;
  officeId:      Types.ObjectId;
  type:          ClientType;
  fullName:      string;
  crNumber:      string;
  email?:        string;
  phone:         string;
  address?:      string;
  notes?:        string;
  documents:     IDocument[];
  extraPayments: IClientExtraPayment[];
  createdBy:     Types.ObjectId;
  isDeleted:     boolean;
  deletedAt?:    Date;
  deletedBy?:    Types.ObjectId;
}

const DocumentSchema = new mongoose.Schema<IDocument>(
  {
    url:        { type: String, required: true },
    publicId:   { type: String, required: true },
    name:       { type: String, required: true, trim: true },
    sizeBytes:  { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ExtraPaymentItemSchema = new mongoose.Schema<IExtraPaymentItem>(
  {
    description: { type: String, required: true, trim: true },
    amount:      { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ClientExtraPaymentSchema = new mongoose.Schema<IClientExtraPayment>(
  {
    amount:        { type: Number, required: true, min: 0 },
    description:   { type: String, required: true, trim: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS },
    paidAt:        { type: Date, default: Date.now },
    legalCaseId:   { type: Types.ObjectId, ref: "LegalCase" },
    invoiceId:     { type: Types.ObjectId, ref: "Invoice" },
    items: { type: [ExtraPaymentItemSchema], default: [] },
  },
  { _id: true }
);

const ClientSchema = new mongoose.Schema<IClient>(
  {
    officeId:      { type: Types.ObjectId, ref: "Office", required: false },
    type:          { type: String, enum: CLIENT_TYPES, required: true, default: "فرد" },
    fullName:      { type: String, required: true, trim: true, maxLength: 100 },
    crNumber:      { type: String, trim: true, required: true },
    email:         { type: String, trim: true, lowercase: true },
    phone:         { type: String, required: true, trim: true },
    address:       { type: String, trim: true, maxLength: 300 },
    notes:         { type: String, trim: true, maxLength: 1000 },
    documents:     { type: [DocumentSchema], default: [] },
    extraPayments: { type: [ClientExtraPaymentSchema], default: [] },
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

ClientSchema.index({ phone: 1 });
ClientSchema.index({ fullName: 1 });
ClientSchema.index({ isDeleted: 1 });
ClientSchema.index({ crNumber: 1, officeId: 1 }, { unique: true });


ClientSchema.virtual("totalPaid").get(function () {
  return (this.extraPayments ?? []).reduce((sum: number, p: IClientExtraPayment) => sum + (p.amount ?? 0), 0)
});

const ClientModel = mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);
export default ClientModel;
import mongoose, { Types } from "mongoose";

export type DocumentStatus = "draft" | "final";

export interface IDocumentSection {
  key:     string;
  label:   string;
  content: string;
  visible: boolean;
  order:   number;
}

export interface IDocumentStyle {
  fontFamily:  string;
  fontSize:    number;
  lineHeight:  number;
  textAlign:   "right" | "left" | "center" | "justify";
  marginTop:   number;
  marginBottom: number;
  marginLeft:  number;
  marginRight: number;
}

export interface ILegalDocument extends mongoose.Document {
  _id:        Types.ObjectId;
  officeId:   Types.ObjectId;
  userId:     Types.ObjectId;
  templateId: Types.ObjectId;
  title:      string;
  type:       string;
  status:     DocumentStatus;
  fields:     Map<string, string>;
  sections:   IDocumentSection[];
  style:      IDocumentStyle;
  isDeleted:  boolean;
  deletedAt?: Date;
  createdAt:  Date;
  updatedAt:  Date;
}

const DocumentSectionSchema = new mongoose.Schema<IDocumentSection>(
  {
    key:     { type: String, required: true, trim: true },
    label:   { type: String, required: true, trim: true },
    content: { type: String, default: "", trim: true },
    visible: { type: Boolean, default: true },
    order:   { type: Number, default: 0 },
  },
  { _id: false }
);

const DocumentStyleSchema = new mongoose.Schema<IDocumentStyle>(
  {
    fontFamily:   { type: String, default: "Cairo" },
    fontSize:     { type: Number, default: 14 },
    lineHeight:   { type: Number, default: 1.8 },
    textAlign:    { type: String, enum: ["right", "left", "center", "justify"], default: "right" },
    marginTop:    { type: Number, default: 40 },
    marginBottom: { type: Number, default: 40 },
    marginLeft:   { type: Number, default: 50 },
    marginRight:  { type: Number, default: 50 },
  },
  { _id: false }
);

const LegalDocumentSchema = new mongoose.Schema<ILegalDocument>(
  {
    officeId:   { type: mongoose.Types.ObjectId, ref: "Office", required: false },
    userId:     { type: mongoose.Types.ObjectId, ref: "User",             required: true },
    templateId: { type: mongoose.Types.ObjectId, ref: "DocumentTemplate", required: true },
    title:      { type: String, required: true, trim: true },
    type:       { type: String, required: true, trim: true },
    status:     { type: String, enum: ["draft", "final"], default: "draft" },
    fields:     { type: Map, of: String, default: {} },
    sections:   { type: [DocumentSectionSchema], default: [] },
    style:      { type: DocumentStyleSchema, default: () => ({}) },
    isDeleted:  { type: Boolean, default: false },
    deletedAt:  { type: Date },
  },
  {
    timestamps: true,
    toObject:   { virtuals: true },
    toJSON:     { virtuals: true },
  }
);

LegalDocumentSchema.index({ userId: 1, status: 1 });
LegalDocumentSchema.index({ userId: 1, type: 1 });
LegalDocumentSchema.index({ isDeleted: 1 });

const LegalDocumentModel =
  mongoose.models.LegalDocument ||
  mongoose.model<ILegalDocument>("LegalDocument", LegalDocumentSchema);

export default LegalDocumentModel;

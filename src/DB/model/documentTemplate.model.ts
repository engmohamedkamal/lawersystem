import mongoose, { Types } from "mongoose";

export type FieldType = "text" | "date" | "textarea" | "number";

export interface ITemplateField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
}

export interface ITemplateSection {
  key: string;
  label: string;
  placeholder?: string;
  order: number;
}

export interface IDocumentTemplate extends mongoose.Document {
  _id: Types.ObjectId;
  officeId: Types.ObjectId;
  name: string;
  type: string;
  description?: string;
  defaultFields: ITemplateField[];
  defaultSections: ITemplateSection[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateFieldSchema = new mongoose.Schema<ITemplateField>(
  {
    key:         { type: String, required: true, trim: true },
    label:       { type: String, required: true, trim: true },
    type:        { type: String, enum: ["text", "date", "textarea", "number"], default: "text" },
    required:    { type: Boolean, default: false },
    placeholder: { type: String, trim: true },
  },
  { _id: false }
);

const TemplateSectionSchema = new mongoose.Schema<ITemplateSection>(
  {
    key:         { type: String, required: true, trim: true },
    label:       { type: String, required: true, trim: true },
    placeholder: { type: String, trim: true },
    order:       { type: Number, default: 0 },
  },
  { _id: false }
);

const DocumentTemplateSchema = new mongoose.Schema<IDocumentTemplate>(
  {
    officeId:         { type: Types.ObjectId, ref: "Office", required: false },
    name:             { type: String, required: true, trim: true },
    type:             { type: String, required: true, trim: true },
    description:      { type: String, trim: true },
    defaultFields:    { type: [TemplateFieldSchema],   default: [] },
    defaultSections:  { type: [TemplateSectionSchema], default: [] },
    isActive:         { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toObject:   { virtuals: true },
    toJSON:     { virtuals: true },
  }
);

DocumentTemplateSchema.index({ type: 1, isActive: 1 });

const DocumentTemplateModel =
  mongoose.models.DocumentTemplate ||
  mongoose.model<IDocumentTemplate>("DocumentTemplate", DocumentTemplateSchema);

export default DocumentTemplateModel;

import mongoose, { Types } from "mongoose";

export const CLIENT_TYPES = ["فرد", "شركة"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export interface IDocument {
  url: string;
  publicId:  string;
  name: string;
  uploadedAt: Date;
}

export interface IClient extends mongoose.Document {
  _id: Types.ObjectId;
  type: ClientType;
  fullName:  string;
  crNumber: string;        
  email?: string;
  phone:  string;
  address?: string;
  notes?:  string;
  documents: IDocument[];
  createdBy: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}

const DocumentSchema = new mongoose.Schema<IDocument>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ClientSchema = new mongoose.Schema<IClient>(
  {
    type: { type: String, enum: CLIENT_TYPES, required: true, default: "فرد" },
    fullName: { type: String, required: true, trim: true, maxLength: 100 },
    crNumber: { type: String, trim: true , required : true , unique : true},
    email:  { type: String, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true  },
    address: { type: String, trim: true, maxLength: 300 },
    notes: { type: String, trim: true, maxLength: 1000 },
    documents: { type: [DocumentSchema], default: [] },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Types.ObjectId, ref: "User" },
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

const ClientModel = mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);
export default ClientModel;
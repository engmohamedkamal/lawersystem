import mongoose, { Types } from "mongoose";

export interface ICaseType extends mongoose.Document {
  _id: Types.ObjectId;
  name: string;          
  isActive: boolean;     
  createdBy?: Types.ObjectId; 
}

const CaseTypeSchema = new mongoose.Schema<ICaseType>(
  {
    name: { type: String, required: true, trim: true, minLength: 2, maxLength: 50 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const CaseTypeModel = mongoose.models.CaseType || mongoose.model<ICaseType>("CaseType", CaseTypeSchema);

export default CaseTypeModel;
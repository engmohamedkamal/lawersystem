import mongoose, { Types } from "mongoose";

export interface ILaw extends mongoose.Document {
  _id: Types.ObjectId;
  title: string;
  category: "EGYPTIAN_LAW" | "CONSTITUTION";
  fileUrl?: string;
  filePublicId?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LawSchema = new mongoose.Schema<ILaw>(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["EGYPTIAN_LAW", "CONSTITUTION"],
      required: true,
    },
    fileUrl: { type: String },
    filePublicId: { type: String },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

const LawModel = mongoose.models.Law || mongoose.model<ILaw>("Law", LawSchema);
export default LawModel;
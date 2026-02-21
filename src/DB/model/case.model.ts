import mongoose, { Types } from "mongoose";

export const CASE_STATUSES = ["مفتوحة", "قيد التنفيذ", "مغلقة", "مؤرشفة"] as const;

export const CASE_PRIORITIES = ["منخفضة", "متوسطة", "عالية"] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CasePriority = (typeof CASE_PRIORITIES)[number];



const CaseNoteSchema = new mongoose.Schema(
  {
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxLength: 2000 },
  },
  { timestamps: true } 
);

const CaseHistorySchema = new mongoose.Schema(
  {
    from: { type: String, trim: true },
    to: { type: String, trim: true, required: true },
    changedBy: { type: Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String, trim: true, maxLength: 1000 },
  },
  { _id: true }
);

export interface ICase extends mongoose.Document {
  _id: Types.ObjectId;
  caseNumber: string;
  title: string;
  description?: string;
  client: Types.ObjectId;
  caseType: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  status: CaseStatus;
  priority: CasePriority;
  openedAt: Date;
  closedAt?: Date;
  courtName?: string;
  circuit?: string;
  opponentName?: string;
  courtFileNo?: string;
  notes: Array<{ createdBy: Types.ObjectId; text: string }>;
  history: Array<{
    from?: string;
    to: string;
    changedBy: Types.ObjectId;
    changedAt: Date;
    reason?: string;
  }>;

  createdBy: Types.ObjectId;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}


const CaseSchema = new mongoose.Schema<ICase>(
  {
    caseNumber: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true, minLength: 2, maxLength: 150 },
    description: { type: String, trim: true, maxLength: 4000 },
    client: { type: Types.ObjectId, ref: "Client", required: true },
    caseType: { type: Types.ObjectId, ref: "CaseType", required: true },
    assignedTo: { type: Types.ObjectId, ref: "User" },
    status: { type: String, enum: CASE_STATUSES, default: "مفتوحة", required: true },
    priority: { type: String, enum: CASE_PRIORITIES, default: "متوسطة", required: true },
    openedAt: { type: Date, default: Date.now, required: true },
    closedAt: { type: Date },
    courtName: { type: String, trim: true, maxLength: 200 },
    circuit: { type: String, trim: true, maxLength: 200 },
    opponentName: { type: String, trim: true, maxLength: 200 },
    courtFileNo: { type: String, trim: true, maxLength: 100 },
    notes: { type: [CaseNoteSchema], default: [] },
    history: { type: [CaseHistorySchema], default: [] },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true, 
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

CaseSchema.index({ caseNumber: 1 }, { unique: true });
CaseSchema.index({ client: 1, createdAt: -1 });
CaseSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
CaseSchema.index({ caseType: 1, createdAt: -1 });

const CaseModel = mongoose.models.Case || mongoose.model<ICase>("Case", CaseSchema);

export default CaseModel;

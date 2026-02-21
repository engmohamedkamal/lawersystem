import mongoose, { Types } from "mongoose";

export const SESSION_TYPES = ["جلسة محكمة", "جلسة استماع", "اجتماع", "مكالمة", "أخرى"] as const;
export const SESSION_STATUSES = ["مجدولة", "تمت", "مؤجلة", "ملغية"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];



export interface ISession extends mongoose.Document {
  _id: Types.ObjectId;
  case: Types.ObjectId;
  type: SessionType;
  startAt: Date;
  endAt?: Date;
  status: SessionStatus;
  courtName?: string;
  city?: string,
  circuit?: string;
  result?: string;
  nextSessionAt?: Date;
  notes?: string;
  assignedTo?: Types.ObjectId;
  createdBy: Types.ObjectId;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}


const SessionSchema = new mongoose.Schema<ISession>(
  {
    case: { type: Types.ObjectId, ref: "Case", required: true },
    type: { type: String, enum: SESSION_TYPES, default: "جلسة محكمة", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    status: { type: String, enum: SESSION_STATUSES, default: "مجدولة", required: true },
    city: { type: String, trim: true, maxLength: 100 },
    courtName: { type: String, trim: true, maxLength: 200 },
    circuit: { type: String, trim: true, maxLength: 200 },
    result: { type: String, trim: true, maxLength: 4000 },
    nextSessionAt: { type: Date },
    notes: { type: String, trim: true, maxLength: 4000 },
    assignedTo: { type: Types.ObjectId, ref: "User" },
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


SessionSchema.index({ case: 1, startAt: 1 });

SessionSchema.index({ startAt: 1, status: 1 });

SessionSchema.index({ assignedTo: 1, startAt: 1 });


const SessionModel = mongoose.models.Session || mongoose.model<ISession>("Session", SessionSchema);

export default SessionModel;

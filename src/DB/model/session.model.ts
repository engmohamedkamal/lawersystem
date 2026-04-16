import mongoose, { Types } from "mongoose";

export const SESSION_TYPES    = ["نيابة","جلسة محكمة", "جلسة استماع", "اجتماع", "مكالمة", "أخرى"] as const;
export const SESSION_STATUSES = ["مجدولة", "تمت", "مؤجلة", "ملغية"] as const;
export type SessionType   = (typeof SESSION_TYPES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface ISessionAttachment {
    url:        string
    publicId:   string
    name:       string
    sizeBytes:  number
    uploadedAt: Date
}

export interface ISession extends mongoose.Document {
  _id: Types.ObjectId;
  officeId: Types.ObjectId;
  legalCase : Types.ObjectId;
  type: SessionType;
  startAt: Date;
  endAt?: Date;
  status: SessionStatus;
  courtName?: string;
  city?: string;
  circuit?: string;
  notes?: string;
  assignedTo: Types.ObjectId;
  attachments: ISessionAttachment[];
  team: Types.ObjectId[];
  createdBy: Types.ObjectId;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}

const SessionAttachmentSchema = new mongoose.Schema<ISessionAttachment>(
    {
        url:        { type: String, required: true },
        publicId:   { type: String, required: true },
        name:       { type: String, required: true },
        sizeBytes:  { type: Number, default: 0 },
        uploadedAt: { type: Date,   default: Date.now },
    },
    { _id: false }
)

const SessionSchema = new mongoose.Schema<ISession>(
  {
    officeId: { type: Types.ObjectId, ref: "Office", required: false },
    legalCase:{ type: Types.ObjectId , ref: "LegalCase" , required: true},
    type: { type: String, enum: SESSION_TYPES,    default: "جلسة محكمة", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    status: { type: String, enum: SESSION_STATUSES, default: "مجدولة", required: true },
    city: { type: String, trim: true, maxLength: 100 },
    courtName: { type: String, trim: true, maxLength: 200 },
    circuit: { type: String, trim: true, maxLength: 200 },
    notes: { type: String, trim: true, maxLength: 4000 },
    assignedTo: { type: Types.ObjectId, ref: "User" , required: true },
    team: [{ type: Types.ObjectId, ref: "User"}],
    attachments: { type: [SessionAttachmentSchema], default: [] },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Types.ObjectId, ref: "User" },
  },{
    timestamps: true,
    toObject: { virtuals: true },
    toJSON:   { virtuals: true },
  }
);

SessionSchema.index({ case: 1, startAt: 1 });
SessionSchema.index({ startAt: 1, status: 1 });
SessionSchema.index({ assignedTo: 1, startAt: 1 });

const SessionModel = mongoose.models.Session || mongoose.model<ISession>("Session", SessionSchema);

export default SessionModel;
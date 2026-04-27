import mongoose, { Schema, Types, Document } from "mongoose";

export const ACTIVITY_ACTIONS = [
    "created",
    "updated",
    "status_changed",
    "attachment_added",
    "deleted",
    "restored",
    "subtask_added",
    "subtask_updated",
    "comment_added",
    "priority_changed",
    "due_date_changed",
    "assigned_changed",
    "subtask_completed",
    "comment_deleted"
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface IActivityLog extends Document {
    officeId: Types.ObjectId;
    userId: Types.ObjectId;
    entityType: "Task" | "LegalCase" | "Client" | "Appointment";
    entityId: Types.ObjectId;
    action: ActivityAction;
    details?: Record<string, any>;
    createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
    {
        officeId: { type: Schema.Types.ObjectId, ref: "Office", required: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        entityType: { type: String, required: true, enum: ["Task", "LegalCase", "Client", "Appointment"] },
        entityId: { type: Schema.Types.ObjectId, required: true },
        action: { type: String, required: true, enum: ACTIVITY_ACTIONS },
        details: { type: Schema.Types.Mixed },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityLogSchema.index({ entityId: 1 });
ActivityLogSchema.index({ officeId: 1, createdAt: -1 });

const ActivityLogModel = mongoose.models.ActivityLog || mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
export default ActivityLogModel;

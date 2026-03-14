import mongoose, { Types } from "mongoose"

export const NOTIFICATION_TYPES = [
    "task_assigned",    // مهمة جديدة
    "task_updated",     // تحديث مهمة
    "task_completed",   // مهمة مكتملة
    "task_overdue",     // مهمة متأخرة
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface INotification extends mongoose.Document {
    _id:      Types.ObjectId
    user:     Types.ObjectId   // المستلم
    type:     NotificationType
    title:    string
    body:     string
    isRead:   boolean
    task?:    Types.ObjectId
    createdAt: Date
}

const NotificationSchema = new mongoose.Schema<INotification>(
    {
        user:   { type: Types.ObjectId, ref: "User", required: true },
        type:   { type: String, enum: NOTIFICATION_TYPES, required: true },
        title:  { type: String, required: true },
        body:   { type: String, required: true },
        isRead: { type: Boolean, default: false },
        task:   { type: Types.ObjectId, ref: "Task" },
    },
    { timestamps: true }
)

NotificationSchema.index({ user: 1, isRead: 1 })
NotificationSchema.index({ createdAt: -1 })

const NotificationModel = mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema)
export default NotificationModel
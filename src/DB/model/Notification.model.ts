import mongoose, { Types } from "mongoose"

export const NOTIFICATION_TYPES = [
    "task_assigned", 
    "task_updated",  
    "task_completed", 
    "task_overdue",     
    "case_assigned",    
    "payroll_transaction", 
    "payroll_approved",    
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]


export interface INotification extends mongoose.Document {
    _id:      Types.ObjectId
    officeId: Types.ObjectId
    user:     Types.ObjectId 
    type:     NotificationType
    title:    string
    body:     string
    isRead:   boolean
    taskId?:  Types.ObjectId  
    taskTitle?:  string           
    clientName?: string
    clientPhone?: string | undefined
    clientEmail?: string | undefined         
    dueDate?:    Date
    caseId?:  Types.ObjectId
    caseNumber?: string
    amount?: number
    month?: number
    year?: number
    createdAt: Date
}

const NotificationSchema = new mongoose.Schema<INotification>(
    {
        officeId:    { type: Types.ObjectId, ref: "Office", required: false },
        user:        { type: Types.ObjectId, ref: "User",  required: true },
        type:        { type: String, enum: NOTIFICATION_TYPES, required: true },
        title:       { type: String, required: true },
        body:        { type: String, required: true },
        isRead:      { type: Boolean, default: false },
        taskId:      { type: Types.ObjectId, ref: "Task" },
        taskTitle:   { type: String },
        clientName:  { type: String },
        clientPhone:  { type: String },
        clientEmail:  { type: String },
        dueDate:     { type: Date },
        caseId:      { type: Types.ObjectId, ref: "LegalCase" },
        caseNumber:  { type: String },
        amount:      { type: Number },
        month:       { type: Number },
        year:        { type: Number },
    },
    { timestamps: true }
)

NotificationSchema.index({ user: 1, isRead: 1 })
NotificationSchema.index({ createdAt: -1 })

const NotificationModel = mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema)
export default NotificationModel
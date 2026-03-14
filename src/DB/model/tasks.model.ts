import mongoose, { Types } from "mongoose"

export const TASK_STATUSES   = ["قيد التنفيذ", "مكتملة", "متأخرة", "ملغية"] as const
export const TASK_PRIORITIES = ["منخفضة", "متوسطة", "عالية", "عاجلة"] as const

export type TaskStatus   = (typeof TASK_STATUSES)[number]
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export interface ITask extends mongoose.Document {
    _id:         Types.ObjectId
    title:       string
    description?: string
    assignedTo:  Types.ObjectId       
    assignedBy:  Types.ObjectId
    client:      Types.ObjectId
    legalCase?:  Types.ObjectId   
    status:      TaskStatus
    priority:    TaskPriority
    dueDate?:    Date
    attachments: { url: string; publicId: string; name: string }[]
    isDeleted:   boolean
    createdAt:   Date
    updatedAt:   Date
}

const TaskSchema = new mongoose.Schema<ITask>(
    {
        title:       { type: String, required: true, trim: true, maxlength: 300 },
        description: { type: String, trim: true, maxlength: 2000 },
        assignedTo:  { type: Types.ObjectId, ref: "User", required: true },
        assignedBy:  { type: Types.ObjectId, ref: "User", required: true },
        client:      {type : Types.ObjectId , ref: "Client", required: true},
        legalCase:   { type: Types.ObjectId, ref: "LegalCase" },
        status:      { type: String, enum: TASK_STATUSES,   default: "قيد التنفيذ" },
        priority:    { type: String, enum: TASK_PRIORITIES, default: "متوسطة" },
        dueDate:     { type: Date },
        attachments: {
            type: [{
                url:       { type: String, required: true },
                publicId:  { type: String, required: true },
                name:      { type: String, required: true },
            }],
            default: [],
        },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
)

TaskSchema.index({ assignedTo: 1, status: 1 })
TaskSchema.index({ assignedBy: 1 })
TaskSchema.index({ legalCase: 1 })
TaskSchema.index({ isDeleted: 1, status: 1 })

const TaskModel = mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema)
export default TaskModel
import mongoose, { Schema, Types, Document } from "mongoose";

export interface ITaskComment extends Document {
    taskId: Types.ObjectId;
    userId: Types.ObjectId;
    content: string;
    parentCommentId?: Types.ObjectId;
    attachments: { url: string; publicId: string; name: string; sizeBytes: number }[];
    createdAt: Date;
    updatedAt: Date;
}

const TaskCommentSchema = new Schema<ITaskComment>(
    {
        taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        content: { type: String, required: true, trim: true },
        parentCommentId: { type: Schema.Types.ObjectId, ref: "TaskComment" },
        attachments: [
            {
                url: { type: String, required: true },
                publicId: { type: String, required: true },
                name: { type: String, required: true },
                sizeBytes: { type: Number, default: 0 },
            },
        ],
    },
    { timestamps: true }
);

TaskCommentSchema.index({ taskId: 1 , createdAt: 1 });
TaskCommentSchema.index({ parentCommentId: 1 });

const TaskCommentModel = mongoose.models.TaskComment || mongoose.model<ITaskComment>("TaskComment", TaskCommentSchema);
export default TaskCommentModel;

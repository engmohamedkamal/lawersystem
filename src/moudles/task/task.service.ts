import { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/classError";
import UserModel, { Role } from "../../DB/model/user.model";
import TaskModel from "../../DB/model/tasks.model";
import { sendNotification } from "./notification.service";
import { emitItemAssigned } from "../../utils/EmailEvent";
import ClientModel from "../../DB/model/client.model";
import NotificationModel from "../../DB/model/Notification.model";
import { uploadBuffer } from "../../utils/cloudinaryHelpers";
import cloudinary from "../../utils/cloudInary";
import { assertFeatureEnabled } from "../../helpers/planFeature.helper";
import { checkStorageAvailable, reserveStorage, releaseStorage } from "../../helpers/storage.helper";
import { PLAN_FEATURES } from "../SASS/constants/planFeatures";
import OfficeModel from "../../DB/model/SaaSModels/Office.model";
import TaskCommentModel from "../../DB/model/taskComment.model";
import ActivityLogModel, { ActivityAction } from "../../DB/model/activityLog.model";

class taskService {
    constructor() { }

    private logActivity = async (params: {
        officeId: any;
        userId: any;
        entityType: "Task" | "LegalCase" | "Client" | "Appointment";
        entityId: any;
        action: ActivityAction;
        details?: any;
    }) => {
        try {
            await ActivityLogModel.create(params);
        } catch (error) {
            console.error("Failed to log activity:", error);
        }
    };


    createTask = async (req: Request, res: Response, next: NextFunction) => {
        const { title, description, assignedTo, client, legalCase, priority, dueDate } = req.body

        const officeId = req.user?.officeId
        const office = await OfficeModel.findById(req.user?.officeId);
        if (!office) {
            throw new AppError("office not found", 404);
        }
        assertFeatureEnabled(office, PLAN_FEATURES.TASK_ENABLED)

        const lawyer = await UserModel.findOne({ _id: assignedTo, isDeleted: false, role: Role.LAWYER, officeId })
        if (!lawyer) throw new AppError("المحامي غير موجود", 404)

        let clientDoc = null
        if (client) {
            clientDoc = await ClientModel.findOne({ _id: client, isDeleted: false, officeId })
            if (!clientDoc) throw new AppError("العميل غير موجود", 404)
        }


        const attachments: { url: string; publicId: string; name: string }[] = []

        const task = await TaskModel.create({
            title,
            description,
            assignedTo,
            assignedBy: req.user?.id,
            client,
            legalCase: legalCase ?? undefined,
            priority,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            attachments,
            officeId,
        })

        if (req.file) {
            await checkStorageAvailable(officeId as any, req.file.size || req.file.buffer.length);

            const ext = req.file.originalname.split(".").pop()?.toLowerCase() || ""
            const imageExts = ["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"]
            const safeName = Buffer.from(req.file.originalname, "latin1").toString("utf8")

            const resourceType: "image" | "raw" = imageExts.includes(ext) ? "image" : "raw"

            const baseName = safeName.replace(/\.[^/.]+$/, "")
            const sanitizedBaseName = baseName.replace(/[^\w\-]+/g, "-")
            const finalPublicId = `${sanitizedBaseName}.${ext}`

            const { secure_url, public_id, bytes } = await uploadBuffer(
                req.file.buffer,
                `tasks/${task._id}/attachments`,
                resourceType,
                finalPublicId
            )

            let storageReserved = false;
            try {
              await reserveStorage(officeId as any, bytes);
              storageReserved = true;

              task.attachments.push({
                  url: secure_url,
                  publicId: public_id,
                  name: safeName,
                  sizeBytes: bytes,
              } as any)

              await task.save()
            } catch (err) {
              await cloudinary.uploader.destroy(public_id).catch(() => {});
              if (storageReserved) await releaseStorage(officeId as any, bytes).catch(() => {});
              throw err;
            }
        }

        this.logActivity({
            officeId,
            userId: req.user?.id,
            entityType: "Task",
            entityId: task._id,
            action: "created",
            details: { title }
        });


        const populated = await TaskModel.findById(task._id)
            .populate("assignedTo", "UserName email ProfilePhoto")
            .populate("assignedBy", "UserName email")
            .populate("client", "fullName phone type")
            .populate("legalCase", "caseNumber status")

        const dueDateFormatted = dueDate
            ? new Date(dueDate).toLocaleDateString("ar-EG")
            : null

        await sendNotification({
            userId: assignedTo,
            type: "task_assigned",
            title: "مهمة جديدة",
            body: `تم تكليفك بمهمة: ${title}${clientDoc ? ` — العميل: ${clientDoc.fullName}` : ""}${dueDateFormatted ? ` — الموعد: ${dueDateFormatted}` : ""}`,
            taskId: task._id,
            taskTitle: title,
            clientName: clientDoc?.fullName,
            clientPhone: clientDoc?.phone,
            clientEmail: clientDoc?.email ?? undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined,
        })

        emitItemAssigned({
            userIds: [assignedTo],
            title: "مهمة جديدة",
            body: `تم تكليفك بمهمة: ${title}${clientDoc ? ` — العميل: ${clientDoc.fullName}` : ""}${dueDateFormatted ? ` — الموعد: ${dueDateFormatted}` : ""}`,
        });

        return res.status(201).json({ message: "Task created successfully", task: populated })
    }

    getTasks = async (req: Request, res: Response, next: NextFunction) => {
        const { status, priority, assignedTo, client, legalCase, page = "1", limit = "10" } = req.query
        const role = req.user?.role
        const userId = req.user?.id

        const filter: Record<string, any> = { isDeleted: false, officeId: req.user?.officeId }

        if (role === Role.LAWYER) {
            filter.assignedTo = userId
        } else {
            if (assignedTo) filter.assignedTo = assignedTo
        }

        if (status) filter.status = status
        if (priority) filter.priority = priority
        if (client) filter.client = client
        if (legalCase) filter.legalCase = legalCase

        const pageNum = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
        const skip = (pageNum - 1) * limitNum

        const [tasks, total] = await Promise.all([
            TaskModel.find(filter)
                .populate("assignedTo", "UserName email ProfilePhoto jobTitle")
                .populate("assignedBy", "UserName email")
                .populate("client", "fullName phone type")
                .populate("legalCase", "caseNumber status")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            TaskModel.countDocuments(filter),
        ])

        const [pending, completed, overdue] = await Promise.all([
            TaskModel.countDocuments({ ...filter, status: "قيد التنفيذ" }),
            TaskModel.countDocuments({ ...filter, status: "مكتملة" }),
            TaskModel.countDocuments({ ...filter, status: "متأخرة" }),
        ])

        return res.status(200).json({
            message: "success",
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            stats: { pending, completed, overdue, total },
            tasks,
        })
    }

    getTasksByLawyer = async (req: Request, res: Response, next: NextFunction) => {
        const { userId } = req.params
        const { status, page = "1", limit = "10" } = req.query

        const filter: Record<string, any> = { assignedTo: userId, isDeleted: false, officeId: req.user?.officeId }
        if (status) filter.status = status

        const pageNum = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
        const skip = (pageNum - 1) * limitNum

        const [tasks, total] = await Promise.all([
            TaskModel.find(filter)
                .populate("assignedBy", "UserName email")
                .populate("client", "fullName phone type")
                .populate("legalCase", "caseNumber status")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            TaskModel.countDocuments(filter),
        ])

        const [pending, completed, overdue] = await Promise.all([
            TaskModel.countDocuments({ assignedTo: userId, isDeleted: false, officeId: req.user?.officeId, status: "قيد التنفيذ" }),
            TaskModel.countDocuments({ assignedTo: userId, isDeleted: false, officeId: req.user?.officeId, status: "مكتملة" }),
            TaskModel.countDocuments({ assignedTo: userId, isDeleted: false, officeId: req.user?.officeId, status: "متأخرة" }),
        ])

        return res.status(200).json({
            message: "success",
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            stats: { pending, completed, overdue, total },
            tasks,
        })
    }

    getTaskById = async (req: Request, res: Response, next: NextFunction) => {
        const { taskId } = req.params
        const role = req.user?.role
        const userId = req.user?.id

        const task = await TaskModel.findOne({ _id: taskId, isDeleted: false, officeId: req.user?.officeId })
            .populate("assignedTo", "UserName email ProfilePhoto jobTitle")
            .populate("assignedBy", "UserName email")
            .populate("client", "fullName phone type")
            .populate("legalCase", "caseNumber status")

        if (!task) throw new AppError("المهمة غير موجودة", 404)

        if (role === Role.LAWYER && task.assignedTo._id.toString() !== userId) {
            throw new AppError("غير مصرح", 403)
        }

        return res.status(200).json({ message: "success", task })
    }

    updateTask = async (req: Request, res: Response, next: NextFunction) => {
        const taskId = req.params.taskId as string
        const data = req.body

        const task = await TaskModel.findOne({ _id: taskId, isDeleted: false, officeId: req.user?.officeId })
        if (!task) throw new AppError("المهمة غير موجودة", 404)

        const updated = await TaskModel.findOneAndUpdate(
            { _id: taskId, officeId: req.user?.officeId },
            { $set: data },
            { new: true }
        )
            .populate("assignedTo", "UserName email ProfilePhoto")
            .populate("assignedBy", "UserName email")
            .populate("client", "fullName phone type")
            .populate("legalCase", "caseNumber status")

        await sendNotification({
            userId: task.assignedTo.toString(),
            type: "task_updated",
            title: "تم تعديل مهمة",
            body: `تم تعديل المهمة: ${task.title}`,
            taskId: taskId,
        })

        this.logActivity({
            officeId: req.user?.officeId,
            userId: req.user?.id,
            entityType: "Task",
            entityId: task._id,
            action: "updated",
            details: data
        });

        return res.status(200).json({ message: "تم تحديث المهمة بنجاح", task: updated })
    }

    updateTaskStatus = async (req: Request, res: Response, next: NextFunction) => {
        const taskId = req.params.taskId as string
        const { status } = req.body
        const role = req.user?.role
        const userId = req.user?.id

        const task = await TaskModel.findOne({ _id: taskId, isDeleted: false, officeId: req.user?.officeId })
        if (!task) throw new AppError("المهمة غير موجودة", 404)

        if (role === Role.LAWYER && task.assignedTo?.toString() !== userId) {
            throw new AppError("غير مصرح", 403)
        }

        const updated = await TaskModel.findOneAndUpdate(
            { _id: taskId, officeId: req.user?.officeId },
            { $set: { status } },
            { new: true }
        )

        if (status === "مكتملة") {
            await sendNotification({
                userId: task.assignedBy.toString(),
                type: "task_completed",
                title: "مهمة مكتملة",
                body: `أكمل المحامي المهمة: ${task.title}`,
                taskId: taskId,
            })
        }

        this.logActivity({
            officeId: req.user?.officeId,
            userId: req.user?.id,
            entityType: "Task",
            entityId: task._id,
            action: "status_changed",
            details: { from: task.status, to: status }
        });

        return res.status(200).json({ message: "تم تحديث الحالة بنجاح", task: updated })
    }

    deleteTask = async (req: Request, res: Response, next: NextFunction) => {
        const taskId = req.params.taskId as string

        const task = await TaskModel.findOne({ _id: taskId, isDeleted: false, officeId: req.user?.officeId })
        if (!task) throw new AppError("المهمة غير موجودة", 404)

        await TaskModel.findOneAndUpdate({ _id: taskId, officeId: req.user?.officeId }, { isDeleted: true })

        this.logActivity({
            officeId: req.user?.officeId,
            userId: req.user?.id,
            entityType: "Task",
            entityId: task._id,
            action: "deleted"
        });


        return res.status(200).json({ message: "Task deleted successfully" })
    }

    getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id

        const notifications = await NotificationModel.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(50)


        const unreadCount = await NotificationModel.countDocuments({ user: userId, isRead: false })

        return res.status(200).json({ message: "success", unreadCount, notifications })
    }

    markNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id

        await NotificationModel.updateMany(
            { user: userId, isRead: false },
            { $set: { isRead: true } }
        )

        return res.status(200).json({ message: "Notifications marked as read" })
    }

    addTaskComment = async (req: Request, res: Response, next: NextFunction) => {
        const { taskId } = req.params;
        const { content, parentCommentId } = req.body;
        const officeId = req.user?.officeId;

        const filter: any = { _id: taskId, isDeleted: false, officeId };
        if (req.user?.role === Role.LAWYER) {
            filter.assignedTo = req.user?.id;
        }
        const task = await TaskModel.findOne(filter);
        if (!task) throw new AppError("المهمة غير موجودة أو غير مصرح لك", 404);

        if(parentCommentId){
            const parent = await TaskCommentModel.findOne({
                _id: parentCommentId,
                taskId: taskId
            })
            if(!parent) throw new AppError("التعليق غير موجود", 404);
        }

        

        const attachments: { url: string; publicId: string; name: string; sizeBytes: number }[] = [];
        
        if (req.file) {
            await checkStorageAvailable(officeId as any, req.file.size || req.file.buffer.length);

            const ext = req.file.originalname.split(".").pop()?.toLowerCase() || ""
            const imageExts = ["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"]
            const safeName = Buffer.from(req.file.originalname, "latin1").toString("utf8")

            const resourceType: "image" | "raw" = imageExts.includes(ext) ? "image" : "raw"

            const baseName = safeName.replace(/\.[^/.]+$/, "")
            const sanitizedBaseName = baseName.replace(/[^\w\-]+/g, "-")
            const finalPublicId = `${sanitizedBaseName}.${ext}`

            const { secure_url, public_id, bytes } = await uploadBuffer(
                req.file.buffer,
                `tasks/${taskId}/comments/attachments`,
                resourceType,
                finalPublicId
            )

            let storageReserved = false;
            try {
                await reserveStorage(officeId as any, bytes);
                storageReserved = true;

                attachments.push({
                    url: secure_url,
                    publicId: public_id,
                    name: safeName,
                    sizeBytes: bytes,
                });
            } catch (err) {
                await cloudinary.uploader.destroy(public_id).catch(() => {});
                if (storageReserved) await releaseStorage(officeId as any, bytes).catch(() => {});
                throw err;
            }
        }

        const comment = await TaskCommentModel.create({
            taskId,
            userId: req.user?.id,
            content,
            parentCommentId: parentCommentId || undefined,
            attachments
        });

        const populated = await TaskCommentModel.findById(comment._id).populate("userId", "UserName ProfilePhoto");

        this.logActivity({
            officeId,
            userId: req.user?.id,
            entityType: "Task",
            entityId: taskId as any,
            action: "comment_added",
            details: { commentId: comment._id }
        });

        return res.status(201).json({ message: "تمت إضافة التعليق بنجاح", comment: populated });
    }

    getTaskComments = async (req: Request, res: Response, next: NextFunction) => {
        const { taskId } = req.params;
        const officeId = req.user?.officeId;

        const filter: any = { _id: taskId, isDeleted: false, officeId };
        if (req.user?.role === Role.LAWYER) {
            filter.assignedTo = req.user?.id;
        }
        const task = await TaskModel.findOne(filter);
        if (!task) throw new AppError("المهمة غير موجودة أو غير مصرح لك", 404);

        const comments = await TaskCommentModel.find({ taskId })
            .populate("userId", "UserName ProfilePhoto jobTitle")
            .sort({ createdAt: 1 });

        return res.status(200).json({ message: "success", comments });
    }

    addSubtask = async (req: Request, res: Response, next: NextFunction) => {
        const { taskId } = req.params;
        const { title } = req.body;
        const officeId = req.user?.officeId;

        const filter: any = { _id: taskId, isDeleted: false, officeId };
        if (req.user?.role === Role.LAWYER) {
            filter.assignedTo = req.user?.id;
        }

        const task = await TaskModel.findOneAndUpdate(
            filter,
            { $push: { subtasks: { title, isCompleted: false } } },
            { new: true }
        );

        if (!task) throw new AppError("المهمة غير موجودة أو غير مصرح لك", 404);

        this.logActivity({
            officeId,
            userId: req.user?.id,
            entityType: "Task",
            entityId: taskId as any,
            action: "subtask_added",
            details: { title }
        });

        return res.status(200).json({ message: "Subtask added", subtasks: task.subtasks });
    }

    updateSubtask = async (req: Request, res: Response, next: NextFunction) => {
        const { taskId, subtaskId } = req.params;
        const { title, isCompleted } = req.body;
        const officeId = req.user?.officeId;

        const update: any = {};

        if (req.user?.role === Role.LAWYER) {
            if (title !== undefined) {
                throw new AppError("المحامي غير مصرح له بتعديل عنوان الخطوة", 403);
            }
        } else {
            if (title !== undefined) update["subtasks.$.title"] = title;
        }

        if (isCompleted !== undefined) update["subtasks.$.isCompleted"] = isCompleted;

        const filter: any = { _id: taskId, "subtasks._id": subtaskId, isDeleted: false, officeId };
        if (req.user?.role === Role.LAWYER) {
            filter.assignedTo = req.user?.id;
        }

        const task = await TaskModel.findOneAndUpdate(
            filter,
            { $set: update },
            { new: true }
        );

        if (!task) throw new AppError("المهمة أو الخطوة غير موجودة أو غير مصرح لك", 404);

        this.logActivity({
            officeId,
            userId: req.user?.id,
            entityType: "Task",
            entityId: taskId as any,
            action: "subtask_updated",
            details: { subtaskId, isCompleted }
        });

        return res.status(200).json({ message: "Subtask updated", subtasks: task.subtasks });
    }

    deleteSubtask = async (req: Request, res: Response, next: NextFunction) => {
        const { taskId, subtaskId } = req.params;
        const officeId = req.user?.officeId;

        const filter: any = { _id: taskId, isDeleted: false, officeId };
        if (req.user?.role === Role.LAWYER) {
            filter.assignedTo = req.user?.id;
        }

        const task = await TaskModel.findOneAndUpdate(
            filter,
            { $pull: { subtasks: { _id: subtaskId } } },
            { new: true }
        );

        if (!task) throw new AppError("المهمة غير موجودة أو غير مصرح لك", 404);

        return res.status(200).json({ message: "Subtask deleted", subtasks: task.subtasks });
    }

    getTaskActivityLog = async (req: Request, res: Response, next: NextFunction) => {
        const { taskId } = req.params;
        const officeId = req.user?.officeId;

        const filter: any = { _id: taskId, isDeleted: false, officeId };
        if (req.user?.role === Role.LAWYER) {
            filter.assignedTo = req.user?.id;
        }
        const task = await TaskModel.findOne(filter);
        if (!task) throw new AppError("المهمة غير موجودة أو غير مصرح لك", 404);

        const logs = await ActivityLogModel.find({ entityId: taskId, officeId })
            .populate("userId", "UserName ProfilePhoto")
            .sort({ createdAt: -1 });

        return res.status(200).json({ message: "success", logs });
    }



}

export default new taskService();
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
class taskService {
    constructor() { }

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

        return res.status(200).json({ message: "Task updated successfully", task: updated })
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

        return res.status(200).json({ message: "Status updated successfully", task: updated })
    }

    deleteTask = async (req: Request, res: Response, next: NextFunction) => {
        const taskId = req.params.taskId as string

        const task = await TaskModel.findOne({ _id: taskId, isDeleted: false, officeId: req.user?.officeId })
        if (!task) throw new AppError("المهمة غير موجودة", 404)

        await TaskModel.findOneAndUpdate({ _id: taskId, officeId: req.user?.officeId }, { isDeleted: true })

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


}

export default new taskService();
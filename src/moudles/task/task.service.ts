import { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/classError";
import UserModel, { Role } from "../../DB/model/user.model";
import TaskModel from "../../DB/model/tasks.model";
import { sendNotification } from "./notification.service";
import ClientModel from "../../DB/model/client.model";

class taskService {
  constructor() {}

  createTask = async (req: Request, res: Response, next: NextFunction) => {
        const { title, description, assignedTo,client, legalCase, priority, dueDate } = req.body
 


        const [lawyer, clientDoc] = await Promise.all([

               UserModel.findOne({ _id: assignedTo, isDeleted: false, role: Role.LAWYER }),
               ClientModel.findOne({ _id: client, isDeleted: false }),

        ])
        
        if (!lawyer) throw new AppError("المحامي غير موجود", 404)
        if (!clientDoc) throw new AppError("العميل غير موجود", 404)

 
        const task = await TaskModel.create({
            title,
            description,
            assignedTo,
            assignedBy: req.user?.id,
            client,
            legalCase:  legalCase ?? undefined,
            priority,
            dueDate:    dueDate ? new Date(dueDate) : undefined,
        })
 
        const populated = await TaskModel.findById(task._id)
            .populate("assignedTo", "UserName email ProfilePhoto")
            .populate("assignedBy", "UserName email")
            .populate("client",     "fullName phone type")
            .populate("legalCase",  "caseNumber status")
 
        await sendNotification({
            userId: assignedTo,
            type:   "task_assigned",
            title:  "مهمة جديدة",
            body:   `تم تكليفك بمهمة جديدة: ${title}`,
            taskId: task._id.toString(),
        })
 
        return res.status(201).json({ message: "Task created successfully", task: populated })
    }

  getTasks = async (req: Request, res: Response, next: NextFunction) => {
        const { status, priority, assignedTo, client, legalCase, page = "1", limit = "10" } = req.query
        const role   = req.user?.role
        const userId = req.user?.id
 
        const filter: Record<string, any> = { isDeleted: false }
 
        if (role === Role.LAWYER) {
            filter.assignedTo = userId
        } else {
            if (assignedTo) filter.assignedTo = assignedTo
        }
 
        if (status)    filter.status    = status
        if (priority)  filter.priority  = priority
        if (client)    filter.client    = client
        if (legalCase) filter.legalCase = legalCase
 
        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
        const skip     = (pageNum - 1) * limitNum
 
        const [tasks, total] = await Promise.all([
            TaskModel.find(filter)
                .populate("assignedTo", "UserName email ProfilePhoto jobTitle")
                .populate("assignedBy", "UserName email")
                .populate("client",     "fullName phone type")
                .populate("legalCase",  "caseNumber status")
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
            page:       pageNum,
            totalPages: Math.ceil(total / limitNum),
            stats: { pending, completed, overdue, total },
            tasks,
        })
    }

  getTasksByLawyer = async (req: Request, res: Response, next: NextFunction) => {
        const { userId } = req.params
        const { status, page = "1", limit = "10" } = req.query
 
        const filter: Record<string, any> = { assignedTo: userId, isDeleted: false }
        if (status) filter.status = status
 
        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
        const skip     = (pageNum - 1) * limitNum
 
        const [tasks, total] = await Promise.all([
            TaskModel.find(filter)
                .populate("assignedBy", "UserName email")
                .populate("client",     "fullName phone type")
                .populate("legalCase",  "caseNumber status")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            TaskModel.countDocuments(filter),
        ])
 
        const [pending, completed, overdue] = await Promise.all([
            TaskModel.countDocuments({ assignedTo: userId, isDeleted: false, status: "قيد التنفيذ" }),
            TaskModel.countDocuments({ assignedTo: userId, isDeleted: false, status: "مكتملة" }),
            TaskModel.countDocuments({ assignedTo: userId, isDeleted: false, status: "متأخرة" }),
        ])
 
        return res.status(200).json({
            message: "success",
            total,
            page:       pageNum,
            totalPages: Math.ceil(total / limitNum),
            stats: { pending, completed, overdue, total },
            tasks,
        })
    }

  getTaskById = async (req: Request, res: Response, next: NextFunction) => {
        const { taskId } = req.params
        const role       = req.user?.role
        const userId     = req.user?.id
 
        const task = await TaskModel.findOne({ _id: taskId, isDeleted: false })
            .populate("assignedTo", "UserName email ProfilePhoto jobTitle")
            .populate("assignedBy", "UserName email")
            .populate("client",     "fullName phone type")
            .populate("legalCase",  "caseNumber status")
 
        if (!task) throw new AppError("المهمة غير موجودة", 404)
 
        if (role === Role.LAWYER && task.assignedTo._id.toString() !== userId) {
            throw new AppError("غير مصرح", 403)
        }
 
        return res.status(200).json({ message: "success", task })
    }

    updateTask = async (req: Request, res: Response, next: NextFunction) => {
        const taskId = req.params.taskId as string
        const data = req.body
 
        const task = await TaskModel.findOne({ _id: taskId, isDeleted: false })
        if (!task) throw new AppError("المهمة غير موجودة", 404)
 
        const updated = await TaskModel.findByIdAndUpdate(
            taskId,
            { $set: data },
            { new: true }
        )
            .populate("assignedTo", "UserName email ProfilePhoto")
            .populate("assignedBy", "UserName email")
            .populate("client",     "fullName phone type")
            .populate("legalCase",  "caseNumber status")
 
        await sendNotification({
            userId: task.assignedTo.toString(),
            type:   "task_updated",
            title:  "تم تعديل مهمة",
            body:   `تم تعديل المهمة: ${task.title}`,
            taskId: taskId,
        })
 
        return res.status(200).json({ message: "Task updated successfully", task: updated })
    }
 
    updateTaskStatus = async (req: Request, res: Response, next: NextFunction) => {
        const taskId  = req.params.taskId as string
        const { status } = req.body
        const role       = req.user?.role
        const userId     = req.user?.id
 
        const task = await TaskModel.findOne({ _id: taskId, isDeleted: false })
        if (!task) throw new AppError("المهمة غير موجودة", 404)
 
        if (role === Role.LAWYER && task.assignedTo.toString() !== userId) {
            throw new AppError("غير مصرح", 403)
        }
 
        const updated = await TaskModel.findByIdAndUpdate(
            taskId,
            { $set: { status } },
            { new: true }
        )
 
        if (status === "مكتملة") {
            await sendNotification({
                userId: task.assignedBy.toString(),
                type:   "task_completed",
                title:  "مهمة مكتملة",
                body:   `أكمل المحامي المهمة: ${task.title}`,
                taskId: taskId,
            })
        }
 
        return res.status(200).json({ message: "Status updated successfully", task: updated })
    }

  
}

export default new taskService();
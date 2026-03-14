import { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/classError";
import UserModel, { Role } from "../../DB/model/user.model";
import TaskModel from "../../DB/model/tasks.model";
import { sendNotification } from "./notification.service";

class taskService {
  constructor() {}

  createTask = async (req: Request, res: Response, next: NextFunction) => {
        const { title, description, assignedTo, legalCase, priority, dueDate } = req.body
 
        const lawyer = await UserModel.findOne({ _id: assignedTo, isDeleted: false, role: Role.LAWYER })
        if (!lawyer) throw new AppError("المحامي غير موجود", 404)
 
        const task = await TaskModel.create({
            title,
            description,
            assignedTo,
            assignedBy: req.user?.id,
            legalCase:  legalCase ?? undefined,
            priority,
            dueDate:    dueDate ? new Date(dueDate) : undefined,
        })
 
        const populated = await TaskModel.findById(task._id)
            .populate("assignedTo", "UserName email ProfilePhoto")
            .populate("assignedBy", "UserName email")
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

  

}

export default new taskService();
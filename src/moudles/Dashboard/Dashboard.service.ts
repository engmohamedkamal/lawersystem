import { NextFunction, Request, Response } from "express";
import LegalCaseModel from "../../DB/model/LegalCase.model";
import ClientModel from "../../DB/model/client.model";
import InvoiceModel from "../../DB/model/invoice.model";
import SessionModel from "../../DB/model/session.model";
import TaskModel from "../../DB/model/tasks.model";
import { Role } from "../../DB/model/user.model";


class DashboardService {
    constructor() {}

    getStats = async (req: Request, res: Response, next: NextFunction) => {
        const now          = new Date()
        const nextWeek     = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const role         = req.user?.role
        const userId       = req.user?.id

        if (role === Role.LAWYER) {
            const [
                myCases,
                myPendingTasks,
                upcomingSessions,
                myTasksByPriority,
                myRecentCases,
            ] = await Promise.all([
                LegalCaseModel.countDocuments({
                    isDeleted: false,
                    officeId: req.user?.officeId,
                    status:    { $nin: ["منتهية", "مؤرشفة"] },
                    $or: [{ assignedTo: userId }, { team: userId }],
                }),
 
                TaskModel.countDocuments({
                    isDeleted:  false,
                    officeId:   req.user?.officeId,
                    status:     "قيد التنفيذ",
                    assignedTo: userId,
                }),
 
                SessionModel.find({
                    isDeleted: false,
                    officeId:  req.user?.officeId,
                    status:    "مجدولة",
                    startAt:   { $gte: now, $lte: nextWeek },
                    $or: [{ assignedTo: userId }, { team: userId }],
                })
                    .populate("legalCase",  "caseNumber status client")
                    .populate("assignedTo", "UserName email")
                    .sort({ startAt: 1 })
                    .limit(10),
 
                TaskModel.aggregate([
                    {
                        $match: {
                            isDeleted:  false,
                            officeId:   req.user?.officeId,
                            assignedTo: userId,
                            status:     { $nin: ["مكتملة", "ملغية"] },
                        }
                    },
                    { $group: { _id: "$priority", count: { $sum: 1 } } },
                ]),
 
                LegalCaseModel.find({
                    isDeleted: false,
                    officeId:  req.user?.officeId,
                    $or: [{ assignedTo: userId }, { team: userId }],
                })
                    .populate("client",    "fullName phone type")
                    .populate("caseType",  "name")
                    .populate("assignedTo","UserName email")
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .select("caseNumber status priority openedAt client caseType assignedTo"),
            ])
 
            const priorityMap: Record<string, number> = {
                "عاجلة": 0, "عالية": 0, "متوسطة": 0, "منخفضة": 0,
            }
            myTasksByPriority.forEach((p: any) => {
                if (p._id in priorityMap) priorityMap[p._id] = p.count
            })
 
            return res.status(200).json({
                message: "success",
                stats: {
                    myCases,
                    myPendingTasks,
                },
                upcomingSessions,
                tasksByPriority: priorityMap,
                recentCases:     myRecentCases,
            })
        }
 
        const [
            activeCases,
            activeClients,
            pendingTasks,
 
            revenueResult,
 
            upcomingSessions,
 
            tasksByPriority,
 
            recentCases,
        ] = await Promise.all([
            LegalCaseModel.countDocuments({
                isDeleted: false,
                officeId:  req.user?.officeId,
                status:    { $nin: ["منتهية", "مؤرشفة"] },
            }),
 
            LegalCaseModel.distinct("client", {
                isDeleted: false,
                officeId:  req.user?.officeId,
                status:    { $nin: ["منتهية", "مؤرشفة"] },
            }).then(ids =>
                ClientModel.countDocuments({ _id: { $in: ids }, isDeleted: false, officeId: req.user?.officeId })
            ),
 
            TaskModel.countDocuments({
                isDeleted: false,
                officeId:  req.user?.officeId,
                status:    "قيد التنفيذ",
            }),
 
            InvoiceModel.aggregate([
                { $match: { isDeleted: false, officeId: req.user?.officeId, status: { $ne: "ملغية" } } },
                { $group: { _id: null, total: { $sum: "$paidAmount" } } },
            ]),
 
            SessionModel.find({
                isDeleted: false,
                officeId:  req.user?.officeId,
                status:    "مجدولة",
                startAt:   { $gte: now, $lte: nextWeek },
            })
                .populate("legalCase", "caseNumber status client")
                .populate("assignedTo", "UserName email")
                .sort({ startAt: 1 })
                .limit(10),
 
            TaskModel.aggregate([
                { $match: { isDeleted: false, officeId: req.user?.officeId, status: { $nin: ["مكتملة", "ملغية"] } } },
                { $group: { _id: "$priority", count: { $sum: 1 } } },
            ]),
 
            LegalCaseModel.find({ isDeleted: false, officeId: req.user?.officeId })
                .populate("client",    "fullName phone type")
                .populate("caseType",  "name")
                .populate("assignedTo","UserName email")
                .sort({ createdAt: -1 })
                .limit(5)
                .select("caseNumber status priority openedAt client caseType assignedTo fees"),
        ])
 
        const priorityMap: Record<string, number> = {
            "عاجلة":   0,
            "عالية":   0,
            "متوسطة":  0,
            "منخفضة":  0,
        }
        tasksByPriority.forEach((p: any) => {
            if (p._id in priorityMap) priorityMap[p._id] = p.count
        })
 
        return res.status(200).json({
            message: "success",
            stats: {
                activeCases,
                activeClients,
                pendingTasks,
                totalRevenue: revenueResult[0]?.total ?? 0,
            },
            upcomingSessions,
            tasksByPriority: priorityMap,
            recentCases,
        })
    }
   
}

export default new DashboardService()
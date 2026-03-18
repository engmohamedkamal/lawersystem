import { NextFunction, Request, Response } from "express";
import LegalCaseModel from "../../DB/model/LegalCase.model";
import ClientModel from "../../DB/model/client.model";
import InvoiceModel from "../../DB/model/invoice.model";
import SessionModel from "../../DB/model/session.model";
import TaskModel from "../../DB/model/tasks.model";


class DashboardService {
    constructor() {}

    getStats = async (req: Request, res: Response, next: NextFunction) => {
        const now          = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const nextWeek     = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
 
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
                status:    { $nin: ["منتهية", "مؤرشفة"] },
            }),
 
            LegalCaseModel.distinct("client", {
                isDeleted: false,
                status:    { $nin: ["منتهية", "مؤرشفة"] },
            }).then(ids =>
                ClientModel.countDocuments({ _id: { $in: ids }, isDeleted: false })
            ),
 
            TaskModel.countDocuments({
                isDeleted: false,
                status:    "قيد التنفيذ",
            }),
 
            InvoiceModel.aggregate([
                { $match: { isDeleted: false, status: { $ne: "ملغية" } } },
                { $group: { _id: null, total: { $sum: "$paidAmount" } } },
            ]),
 
            SessionModel.find({
                isDeleted: false,
                status:    "مجدولة",
                startAt:   { $gte: now, $lte: nextWeek },
            })
                .populate("legalCase", "caseNumber status client")
                .populate("assignedTo", "UserName email")
                .sort({ startAt: 1 })
                .limit(10),
 
            TaskModel.aggregate([
                { $match: { isDeleted: false, status: { $nin: ["مكتملة", "ملغية"] } } },
                { $group: { _id: "$priority", count: { $sum: 1 } } },
            ]),
 
            LegalCaseModel.find({ isDeleted: false })
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
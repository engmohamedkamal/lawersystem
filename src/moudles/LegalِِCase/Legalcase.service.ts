import { NextFunction, Request, Response } from "express";
import LegalCaseModel, { calcPaymentStatus } from "../../DB/model/LegalCase.model";
import { CreateCaseType } from "./Legalcase.validation";
import { AppError } from "../../utils/classError";
import ClientModel from "../../DB/model/client.model";
import SessionModel from "../../DB/model/session.model";

class LegalCaseService {
    constructor() {}


    createCase = async (req: Request, res: Response, next: NextFunction) => {
        const { initialSession, ...caseData }: CreateCaseType = req.body

        const existing = await LegalCaseModel.findOne({ caseNumber: caseData.caseNumber })
        if (existing) throw new AppError("case number already exists", 409)

        const client = await ClientModel.findOne({ _id: caseData.client, isDeleted: false })
        if (!client) throw new AppError("client not found", 404)

        if (caseData.fees) {
            caseData.fees.paymentStatus = caseData.fees.paymentStatus
                ?? calcPaymentStatus(caseData.fees.totalAmount ?? 0, caseData.fees.paidAmount ?? 0)
        }

        const legalCase = await LegalCaseModel.create({
            ...caseData,
            createdBy: req.user?.id,
        })

        if (initialSession) {
            await SessionModel.create({
                ...initialSession,
                case: legalCase._id,
                createdBy: req.user?.id,
            })
        }

        const populated = await LegalCaseModel.findById(legalCase._id)
            .populate("client", "fullName phone type")
            .populate("caseType",  "name")
            .populate("assignedTo", "UserName email")

        return res.status(201).json({ message: "Case created successfully", case: populated })
    }

    getCases = async (req: Request, res: Response, next: NextFunction) => {
            const { status, caseType, assignedTo, priority, page = "1", limit = "10" } = req.query

            const filter: Record<string, any> = { isDeleted: false }
            if (status)     filter.status     = status
            if (caseType)   filter.caseType   = caseType
            if (assignedTo) filter.assignedTo = assignedTo
            if (priority)   filter.priority   = priority

            const pageNum  = Math.max(Number(page), 1)
            const limitNum = Math.min(Math.max(Number(limit), 1), 100)
            const skip     = (pageNum - 1) * limitNum

            const [cases, total] = await Promise.all([
                LegalCaseModel.find(filter)
                    .populate("client",     "fullName phone type")
                    .populate("caseType",   "name")
                    .populate("assignedTo", "UserName email")
                    .populate("team",       "UserName email")
                    .populate("createdBy",  "UserName email")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum),
                LegalCaseModel.countDocuments(filter),
            ])

            return res.status(200).json({
                message:    "success",
                total,
                page:       pageNum,
                totalPages: Math.ceil(total / limitNum),
                cases,
            })
    }


}

export default new LegalCaseService()
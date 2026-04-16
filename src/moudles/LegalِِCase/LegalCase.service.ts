import { NextFunction, Request, Response } from "express";
import LegalCaseModel, { calcPaymentStatus } from "../../DB/model/LegalCase.model";
import { CreateCaseType , UpdateCaseType, UpdateFeesType, UpdateTeamType } from "./LegalCase.validation";
import { AppError } from "../../utils/classError";
import ClientModel from "../../DB/model/client.model";
import { Role } from "../../DB/model/user.model";
import { uploadBuffer } from "../../utils/cloudinaryHelpers";
import cloudinary from "../../utils/cloudInary";
import SessionModel from "../../DB/model/session.model";
import { sendNotification } from "../task/notification.service";
import { emitItemAssigned } from "../../utils/EmailEvent";
import { assertFeatureLimitNotReached } from "../../helpers/planFeature.helper";
import { checkStorageLimit, incrementStorage, decrementStorage } from "../../helpers/storage.helper";
import { PLAN_FEATURES } from "../SASS/constants/planFeatures";
import OfficeModel from "../../DB/model/SaaSModels/Office.model";

class LegalCaseService {
    constructor() {}

    createCase = async (req: Request, res: Response, next: NextFunction) => {
        const  caseData : CreateCaseType = req.body

        const officeId = req.user?.officeId
        const office = await OfficeModel.findById(officeId);
            if (!office) {
            throw new AppError("office not found", 404);
        }

        const casesCount = await LegalCaseModel.countDocuments({ officeId, isDeleted: false })
        assertFeatureLimitNotReached(office, PLAN_FEATURES.LEGALCASE_MAX, casesCount)

        const existing = await LegalCaseModel.findOne({ caseNumber: caseData.caseNumber, officeId })
        if (existing) throw new AppError("case number already exists", 409)

        const client = await ClientModel.findOne({ _id: caseData.client, isDeleted: false, officeId })
        if (!client) throw new AppError("client not found", 404)

        if (caseData.fees) {
            caseData.fees.paymentStatus = caseData.fees.paymentStatus
                ?? calcPaymentStatus(caseData.fees.totalAmount ?? 0, caseData.fees.paidAmount ?? 0)
        }

        const legalCase = await LegalCaseModel.create({
            ...caseData,
            createdBy: req.user?.id,
            officeId,
        })

        const populated = await LegalCaseModel.findById(legalCase._id)
            .populate("client", "fullName phone type")
            .populate("caseType",  "name")
            .populate("assignedTo", "UserName email")

        const notifyUsers = [];
        if (caseData.assignedTo) {
            notifyUsers.push(caseData.assignedTo);
        }
        if (caseData.team && Array.isArray(caseData.team)) {
            notifyUsers.push(...caseData.team);
        }
        
        const uniqueNotifyUsers = [...new Set(notifyUsers.map(String))];

        for (const userId of uniqueNotifyUsers) {
            await sendNotification({
                userId,
                type: "case_assigned",
                title: "قضية جديدة",
                body: `تم إضافتك في قضية جديدة رقم: ${caseData.caseNumber} — العميل: ${client.fullName}`,
                caseId: legalCase._id.toString(),
                caseNumber: caseData.caseNumber,
            });
        }

        emitItemAssigned({
            userIds: uniqueNotifyUsers,
            title: "قضية جديدة",
            body: `تم إضافتك في قضية جديدة رقم: ${caseData.caseNumber} — العميل: ${client.fullName}`,
        });

        return res.status(201).json({ message: "Case created successfully", case: populated })
    }

    getCases = async (req: Request, res: Response, next: NextFunction) => {
        const { status, caseType, assignedTo, priority, page = "1", limit = "10" } = req.query
        const userId = req.user?.id
        const role   = req.user?.role

        const filter: Record<string, any> = { isDeleted: false, officeId: req.user?.officeId }
        if (status)     filter.status   = status
        if (caseType)   filter.caseType = caseType
        if (priority)   filter.priority = priority

        if (role === Role.LAWYER) {
            filter.$or = [
                { assignedTo: userId },
                { team: userId },
            ]
        } else {
            if (assignedTo) filter.assignedTo = assignedTo
        }

        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
        const skip     = (pageNum - 1) * limitNum

        const lawyerSelect = "-fees -createdBy"

        const query = LegalCaseModel.find(filter)
            .populate("client",     "fullName phone type")
            .populate("caseType",   "name")
            .populate("assignedTo", "UserName email")
            .populate("team",       "UserName email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)

        if (role === Role.LAWYER) query.select(lawyerSelect)

        const [cases, total] = await Promise.all([
            query,
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

    getLawyerCases = async (req: Request, res: Response, next: NextFunction) => {
        const { lawyerId } = req.params;
        const { status, caseType, priority, page = "1", limit = "10" } = req.query;

        const filter: Record<string, any> = { 
            isDeleted: false,
            officeId: req.user?.officeId,
            $or: [
                { assignedTo: lawyerId },
                { team: lawyerId },
            ]
        };
        
        if (status)     filter.status   = status;
        if (caseType)   filter.caseType = caseType;
        if (priority)   filter.priority = priority;

        const pageNum  = Math.max(Number(page), 1);
        const limitNum = Math.min(Math.max(Number(limit), 1), 100);
        const skip     = (pageNum - 1) * limitNum;

        const [cases, total] = await Promise.all([
            LegalCaseModel.find(filter)
                .populate("client",     "fullName phone type")
                .populate("caseType",   "name")
                .populate("assignedTo", "UserName email")
                .populate("team",       "UserName email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            LegalCaseModel.countDocuments(filter),
        ]);

        return res.status(200).json({
            message:    "success",
            total,
            page:       pageNum,
            totalPages: Math.ceil(total / limitNum),
            cases,
        });
    }

    getCaseById = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        const role   = req.user?.role
        const userId = req.user?.id

        const legalCase = await LegalCaseModel.findOne({ _id: id, isDeleted: false, officeId: req.user?.officeId })
            .populate("client",     "fullName phone type email address")
            .populate("caseType",   "name")
            .populate("assignedTo", "UserName email")
            .populate("team",       "UserName email")
            .populate("createdBy",  "UserName email")

        if (!legalCase) throw new AppError("case not found", 404)

        if (role === Role.LAWYER) {
            const inTeam = legalCase.team.some((t: any) => t._id.toString() === userId)
            const isAssigned = (legalCase.assignedTo as any)?._id?.toString() === userId

            if (!inTeam && !isAssigned) {
                throw new AppError("access denied", 403)
            }

            const { fees, createdBy, ...caseData } = legalCase.toObject()
            return res.status(200).json({ message: "success", case: caseData })
        }

        const sessions = await SessionModel.find({ 
            legalCase: id, 
            isDeleted: false 
        })
        .populate("assignedTo", "UserName email")
        .populate("team", "UserName email")
        .sort({ startAt: -1 })

        return res.status(200).json({ message: "success", case: legalCase , sessions  })
    }

    updateCase = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        const data: UpdateCaseType = req.body

        const legalCase = await LegalCaseModel.findOne({ _id: id, isDeleted: false, officeId: req.user?.officeId })
        if (!legalCase) throw new AppError("case not found", 404)
        if (legalCase.status === "مؤرشفة") throw new AppError("cannot update an archived case", 400)

        if (data.caseNumber && data.caseNumber !== legalCase.caseNumber) {
            const existing = await LegalCaseModel.findOne({ caseNumber: data.caseNumber, officeId: req.user?.officeId })
            if (existing) throw new AppError("case number already exists", 409)
        }

        const updated = await LegalCaseModel.findOneAndUpdate(
            { _id: id, officeId: req.user?.officeId },
            { $set: data },
            { new: true }
        ).populate("caseType", "name").populate("assignedTo", "UserName email")

        return res.status(200).json({ message: "Case updated successfully", case: updated })
    }

    updateFees = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        const data: UpdateFeesType = req.body

        const legalCase = await LegalCaseModel.findOne({ _id: id, isDeleted: false, officeId: req.user?.officeId })
        if (!legalCase) throw new AppError("case not found", 404)

        const totalAmount = data.totalAmount ?? legalCase.fees?.totalAmount ?? 0
        const paidAmount  = data.paidAmount  ?? legalCase.fees?.paidAmount  ?? 0

        const paymentStatus = data.paymentStatus ?? calcPaymentStatus(totalAmount, paidAmount)

        const updated = await LegalCaseModel.findOneAndUpdate(
            { _id: id, officeId: req.user?.officeId },
            { $set: { fees: { ...legalCase.fees?.toObject?.() ?? {}, ...data, paymentStatus } } },
            { new: true }
        )

        return res.status(200).json({ message: "Fees updated successfully", case: updated })
    }

    addTeamMember = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        const { userId }: UpdateTeamType = req.body

        const legalCase = await LegalCaseModel.findOne({ _id: id, isDeleted: false, officeId: req.user?.officeId })
        if (!legalCase) throw new AppError("case not found", 404)

        if (legalCase.team.map((t: { toString(): string }) => t.toString()).includes(userId)) {
            throw new AppError("user already in team", 409)
        }

        const updated = await LegalCaseModel.findOneAndUpdate(
            { _id: id, officeId: req.user?.officeId },
            { $push: { team: userId } },
            { new: true }
        ).populate("team", "UserName email")

        return res.status(200).json({ message: "Team member added successfully", case: updated })
    }

    removeTeamMember = async (req: Request, res: Response, next: NextFunction) => {
        const { id }  = req.params
        const { userId }: UpdateTeamType = req.body

        const legalCase = await LegalCaseModel.findOne({ _id: id, isDeleted: false, officeId: req.user?.officeId })
        if (!legalCase) throw new AppError("case not found", 404)

       if (!legalCase.team.map((t: any) => t.toString()).includes(userId)) {
           throw new AppError("user not in team", 404)
       }

        const updated = await LegalCaseModel.findOneAndUpdate(
            { _id: id, officeId: req.user?.officeId },
            { $pull: { team: userId } },
            { new: true }
        ).populate("team", "UserName email")

        return res.status(200).json({ message: "Team member removed successfully", case: updated })
    }

    uploadAttachment = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        if (!req.file) throw new AppError("No file uploaded", 400)

        const legalCase = await LegalCaseModel.findOne({ _id: id, isDeleted: false, officeId: req.user?.officeId })
        if (!legalCase) throw new AppError("case not found", 404)

        const officeId = req.user?.officeId;
        await checkStorageLimit(officeId as any, req.file.size || req.file.buffer.length);

        const ext = req.file.originalname.split(".").pop()?.toLowerCase() || ""
        const imageExts = ["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"]
        const safeName = Buffer.from(req.file.originalname, "latin1").toString("utf8")

        const resourceType: "image" | "raw" = imageExts.includes(ext) ? "image" : "raw"

        const baseName = safeName.replace(/\.[^/.]+$/, "")
        const sanitizedBaseName = baseName.replace(/[^\w\-]+/g, "-")
        const finalPublicId = `${sanitizedBaseName}.${ext}`

        const { secure_url, public_id, bytes } = await uploadBuffer(req.file.buffer,
             `cases/${id}/attachments`,
            resourceType,
            finalPublicId
        )

        const updated = await LegalCaseModel.findOneAndUpdate(
            { _id: id, officeId: req.user?.officeId },
            {
                $push: {
                    attachments: {
                        url:        secure_url,
                        publicId:   public_id,
                        name:       safeName,
                        sizeBytes:  bytes,
                        uploadedAt: new Date(),
                    },
                },
            },
            { new: true }
        )

        await incrementStorage(officeId as any, bytes);

        return res.status(200).json({ message: "Attachment uploaded successfully", case: updated })
    }

    deleteAttachment = async (req: Request, res: Response, next: NextFunction) => {
        const { id }  = req.params
        const { publicId } = req.body

        const legalCase = await LegalCaseModel.findOne({ _id: id, isDeleted: false, officeId: req.user?.officeId })
        if (!legalCase) throw new AppError("case not found", 404)

        const attachment = legalCase.attachments.find((a: any) => a.publicId === decodeURIComponent(publicId))
        if (!attachment) throw new AppError("attachment not found", 404)

        await cloudinary.uploader.destroy(attachment.publicId)
        await decrementStorage(req.user?.officeId as any, attachment.sizeBytes || 0);

        const updated = await LegalCaseModel.findOneAndUpdate(
            { _id: id, officeId: req.user?.officeId },
            { $pull: { attachments: { publicId: attachment.publicId } } },
            { new: true }
        )

        return res.status(200).json({ message: "Attachment deleted successfully", case: updated })
    }

    deleteCase = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params

        const LegalCase = await LegalCaseModel.findOne({ _id : id , isDeleted : false, officeId: req.user?.officeId})

        if(!LegalCase) throw new AppError("case not found", 404)

        await LegalCaseModel.findOneAndUpdate({ _id: id, officeId: req.user?.officeId } , {
            isDeleted : true,
            DeletedAt : Date.now(),
            DeletedBy : req.user?.id
        })

        return res.status(200).json({ message: "Case deleted successfully" })

    }
}

export default new LegalCaseService()
import { NextFunction, Request, Response } from "express";
import UserModel, { Role } from "../../DB/model/user.model";
import { AppError } from "../../utils/classError";
import { sendNotification } from "../task/notification.service";
import { emitItemAssigned } from "../../utils/EmailEvent";
import LegalCaseModel from "../../DB/model/LegalCase.model";
import SessionModel from "../../DB/model/session.model";
import cloudinary from "../../utils/cloudInary";
import { uploadBuffer } from "../../utils/cloudinaryHelpers";
import { assertFeatureLimitNotReached } from "../../helpers/planFeature.helper";
import { checkStorageAvailable, reserveStorage, releaseStorage } from "../../helpers/storage.helper";
import { PLAN_FEATURES } from "../SASS/constants/planFeatures";
import OfficeModel from "../../DB/model/SaaSModels/Office.model";

const notifySessionParticipants = async (
    session:    any,
    type:       "session_created" | "session_reminder",
    title:      string,
    bodyFn:     (name: string) => string,
) => {
    const recipients: string[] = []
 
    if (session.assignedTo) {
        recipients.push(
            typeof session.assignedTo === "object"
                ? session.assignedTo._id.toString()
                : session.assignedTo.toString()
        )
    }
 
    if (session.team?.length) {
        session.team.forEach((m: any) => {
            const id = typeof m === "object" ? m._id.toString() : m.toString()
            if (!recipients.includes(id)) recipients.push(id)
        })
    }
 
    await Promise.all(
        recipients.map(userId =>
            sendNotification({
                userId,
                type: "task_assigned" as any,
                title,
                body: bodyFn(userId),
                taskId: undefined,
                taskTitle: undefined,
            })
        )
    )

    emitItemAssigned({
        userIds: recipients,
        title,
        body: bodyFn(""),
    })
}

class sessionService {
    constructor(){}


    createSession = async (req: Request, res: Response, next: NextFunction) => {
        const {
            legalCase: legalCaseId,
            type, startAt, endAt,
            status, courtName, city, circuit,
            notes, assignedTo, team,
        } = req.body
 
        const officeId = req.user?.officeId
        const office = await OfficeModel.findById(officeId);
        if (!office) {
            throw new AppError("office not found", 404);
        }

        const sessionsCount = await SessionModel.countDocuments({ officeId, isDeleted: false })
        assertFeatureLimitNotReached(office, PLAN_FEATURES.SESSION_MAX, sessionsCount)

        const legalCase = await LegalCaseModel.findOne({ _id: legalCaseId, isDeleted: false, officeId })
            .populate("client", "fullName")
            .populate("assignedTo","UserName")
            .populate("team", "UserName")
        if (!legalCase) throw new AppError("legal case not found", 404)
 
        const lawyer = await UserModel.findOne({ _id: assignedTo, isDeleted: false, role: Role.LAWYER, officeId })
        if (!lawyer) throw new AppError("assigned lawyer not found", 404)
 
        if (team?.length) {
            const teamMembers = await UserModel.find({ _id: { $in: team }, isDeleted: false, officeId })
            if (teamMembers.length !== team.length) {
                throw new AppError("one or more team members not found", 404)
            }
        }
 
        const session = await SessionModel.create({
            legalCase: legalCaseId,
            type,
            startAt:   new Date(startAt),
            endAt:     endAt ? new Date(endAt) : undefined,
            status:    status ?? "مجدولة",
            courtName,
            city,
            circuit,
            notes,
            assignedTo,
            team:      team ?? [],
            createdBy: req.user?.id,
            officeId,
        })
 
        const populated = await SessionModel.findById(session._id)
            .populate("legalCase",  "caseNumber status client")
            .populate("assignedTo", "UserName email phone")
            .populate("team",       "UserName email")
            .populate("createdBy",  "UserName email")
 
        const caseNumber  = (legalCase as any).caseNumber
        const sessionDate = new Date(startAt).toLocaleDateString("ar-EG")
        const sessionTime = new Date(startAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
 
        await notifySessionParticipants(
            session,
            "session_created",
            "جلسة جديدة",
            () => `تم تحديد جلسة جديدة في القضية ${caseNumber} — ${sessionDate} الساعة ${sessionTime} — ${courtName ?? ""}`,
        )
 
        return res.status(201).json({ message: "Session created successfully", session: populated })
    }

    getCaseSessions = async (req: Request, res: Response, next: NextFunction) => {
        const { legalCaseId } = req.params
        const { status, page = "1", limit = "10" } = req.query
 
        const legalCase = await LegalCaseModel.findOne({
            _id:legalCaseId,
            isDeleted: false,
            officeId: req.user?.officeId
        })

        if(!legalCase)throw new AppError("case not found", 404)

        const filter: any = { legalCase: legalCaseId , isDeleted: false, officeId: req.user?.officeId}

        if (status) filter.status = status
 
        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
        const skip     = (pageNum - 1) * limitNum
 
        const [sessions, total] = await Promise.all([
            SessionModel.find(filter)
                .populate("assignedTo", "UserName email phone")
                .populate("team",       "UserName email")
                .populate("createdBy",  "UserName email")
                .sort({ startAt: -1 })
                .skip(skip)
                .limit(limitNum),
            SessionModel.countDocuments(filter),
        ])
 
        return res.status(200).json({
            message: "success",
            total,
            page:       pageNum,
            totalPages: Math.ceil(total / limitNum),
            sessions,
        })
    }
 
    getSessionById = async (req: Request, res: Response, next: NextFunction) => {
        const { sessionId } = req.params
 
        const session = await SessionModel.findOne({ _id: sessionId, isDeleted: false, officeId: req.user?.officeId })
            .populate("legalCase",  "caseNumber status client court city")
            .populate("assignedTo", "UserName email phone ProfilePhoto")
            .populate("team",       "UserName email phone ProfilePhoto")
            .populate("createdBy",  "UserName email")
 
        if (!session) throw new AppError("session not found", 404)

        const sessionObj = session.toObject();

        if (sessionObj.legalCase) {
          delete sessionObj.legalCase.fees;
          delete sessionObj.legalCase.totalPaidAll;
        }
 
        return res.status(200).json({ message: "success", session : sessionObj })
    }
 
    updateSession = async (req: Request, res: Response, next: NextFunction) => {
        const { sessionId } = req.params
        const data          = req.body
 
        const session = await SessionModel.findOne({ _id: sessionId, isDeleted: false, officeId: req.user?.officeId })
        if (!session) throw new AppError("session not found", 404)
 
        if (session.status === "ملغية") throw new AppError("cannot update a cancelled session", 400)
 
        if (data.startAt) data.startAt = new Date(data.startAt)
        if (data.endAt)   data.endAt   = new Date(data.endAt)
 
        const updated = await SessionModel.findOneAndUpdate(
            { _id: sessionId, officeId: req.user?.officeId },
            { $set: data },
            { new: true }
        )
            .populate("legalCase",  "caseNumber status")
            .populate("assignedTo", "UserName email phone")
            .populate("team",       "UserName email")
 
        return res.status(200).json({ message: "Session updated successfully", session: updated })
    }
 
    updateSessionStatus = async (req: Request, res: Response, next: NextFunction) => {
        const { sessionId } = req.params
        const { status, result, nextSessionAt } = req.body
 
        const session = await SessionModel.findOne({ _id: sessionId, isDeleted: false, officeId: req.user?.officeId })
        if (!session) throw new AppError("session not found", 404)
 
        const updateData: any = { status }
        if (result) updateData.result        = result
        if (nextSessionAt) updateData.nextSessionAt = new Date(nextSessionAt)
 
        const updated = await SessionModel.findOneAndUpdate(
            { _id: sessionId, officeId: req.user?.officeId },
            { $set: updateData },
            { new: true }
        )
 
        return res.status(200).json({ message: "Status updated successfully", session: updated })
    }

    uploadAttachment = async (req: Request, res: Response, next: NextFunction) => {
        const { sessionId } = req.params
        if (!req.file) throw new AppError("No file uploaded", 400)
 
        const session = await SessionModel.findOne({ _id: sessionId, isDeleted: false, officeId: req.user?.officeId })
        if (!session) throw new AppError("session not found", 404)

        const officeId = req.user?.officeId;

        await checkStorageAvailable(officeId as any, req.file.size || req.file.buffer.length);

        const ext     = req.file.originalname.split(".").pop()?.toLowerCase() || ""
        const imageExts = ["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"]
        const safeName = Buffer.from(req.file.originalname, "latin1").toString("utf8")

        const resourceType: "image" | "raw" = imageExts.includes(ext) ? "image" : "raw"

        const baseName = safeName.replace(/\.[^/.]+$/, "")
        const sanitizedBaseName = baseName.replace(/[^\w\-]+/g, "-")
        const finalPublicId = `${sanitizedBaseName}.${ext}`
 
        const { secure_url, public_id, bytes } = await uploadBuffer(req.file.buffer,
            `sessions/${sessionId}/attachments`,
            resourceType,
            finalPublicId
        )

        let storageReserved = false;
        try {
          await reserveStorage(officeId as any, bytes);
          storageReserved = true;

          const updated = await SessionModel.findOneAndUpdate(
              { _id: sessionId, officeId: req.user?.officeId },
              {
                  $push: {
                      attachments: {
                          url:        secure_url,
                          publicId:   public_id,
                          name:       safeName,
                          sizeBytes:  bytes,
                          uploadedAt: new Date(),
                      }
                  }
              },
              { new: true }
          )
 
          return res.status(200).json({ message: "Attachment uploaded successfully", session: updated })
        } catch (err) {
          await cloudinary.uploader.destroy(public_id).catch(() => {});
          if (storageReserved) await releaseStorage(officeId as any, bytes).catch(() => {});
          throw err;
        }
    }
 
    deleteAttachment = async (req: Request, res: Response, next: NextFunction) => {
        const { sessionId } = req.params
        const { publicId }  = req.body
 
        const session = await SessionModel.findOne({ _id: sessionId, isDeleted: false, officeId: req.user?.officeId })
        if (!session) throw new AppError("session not found", 404)
 
        const attachment = session.attachments.find(
            (a: any) => a.publicId === decodeURIComponent(publicId)
        )
        if (!attachment) throw new AppError("attachment not found", 404)
 
        await cloudinary.uploader.destroy(attachment.publicId)
        await releaseStorage(req.user?.officeId as any, attachment.sizeBytes || 0);
 
        const updated = await SessionModel.findOneAndUpdate(
            { _id: sessionId, officeId: req.user?.officeId },
            { $pull: { attachments: { publicId: attachment.publicId } } },
            { new: true }
        )
 
        return res.status(200).json({ message: "Attachment deleted successfully", session: updated })
    }
 
    deleteSession = async (req: Request, res: Response, next: NextFunction) => {
        const { sessionId } = req.params
 
        const session = await SessionModel.findOne({ _id: sessionId, isDeleted: false, officeId: req.user?.officeId })
        if (!session) throw new AppError("session not found", 404)
 
        await SessionModel.findOneAndUpdate({ _id: sessionId, officeId: req.user?.officeId }, {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: req.user?.id,
        })
 
        return res.status(200).json({ message: "Session deleted successfully" })
    }
 
    getLawyerSessions = async (req: Request, res: Response, next: NextFunction) => {
        const { userId } = req.params
        const { status, page = "1", limit = "10" } = req.query
 
        const filter: any = {
            isDeleted: false,
            officeId: req.user?.officeId,
            $or: [{ assignedTo: userId }, { team: userId }],
        }
        if (status) filter.status = status
 
        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
        const skip     = (pageNum - 1) * limitNum
 
        const [sessions, total] = await Promise.all([
            SessionModel.find(filter)
                .populate("legalCase",  "caseNumber status client")
                .populate("assignedTo", "UserName email")
                .populate("team",       "UserName email")
                .sort({ startAt: 1 })
                .skip(skip)
                .limit(limitNum),
            SessionModel.countDocuments(filter),
        ])
 
        return res.status(200).json({
            message: "success",
            total,
            page:       pageNum,
            totalPages: Math.ceil(total / limitNum),
            sessions,
        })
    }

    getAllSessions = async (req: Request, res: Response, next: NextFunction) => {
        const { status, page = "1", limit = "10" } = req.query;
 
        const filter: any = { isDeleted: false, officeId: req.user?.officeId };
        
        if (req.user?.role === Role.LAWYER) {
            filter.$or = [{ assignedTo: req.user?.id }, { team: req.user?.id }];
        }
 
        if (status) filter.status = status;
 
        const pageNum  = Math.max(Number(page), 1);
        const limitNum = Math.min(Math.max(Number(limit), 1), 100);
        const skip     = (pageNum - 1) * limitNum;
 
        const [sessions, total] = await Promise.all([
            SessionModel.find(filter)
                .populate("legalCase",  "caseNumber status client court city description")
                .populate("assignedTo", "UserName email phone ProfilePhoto")
                .populate("team",       "UserName email phone ProfilePhoto")
                .populate("createdBy",  "UserName email")
                .sort({ startAt: -1 })
                .skip(skip)
                .limit(limitNum),
            SessionModel.countDocuments(filter),
        ]);
 
        return res.status(200).json({
            message: "success",
            total,
            page:       pageNum,
            totalPages: Math.ceil(total / limitNum),
            sessions,
        });
    }

}



export default new sessionService()


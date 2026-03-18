import { NextFunction, Request, Response } from "express";
import UserModel, { Role } from "../../DB/model/user.model";
import { AppError } from "../../utils/classError";
import { sendNotification } from "../task/notification.service";
import LegalCaseModel from "../../DB/model/LegalCase.model";
import SessionModel from "../../DB/model/session.model";

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
 
        const legalCase = await LegalCaseModel.findOne({ _id: legalCaseId, isDeleted: false })
            .populate("client", "fullName")
            .populate("assignedTo","UserName")
            .populate("team", "UserName")
        if (!legalCase) throw new AppError("legal case not found", 404)
 
        const lawyer = await UserModel.findOne({ _id: assignedTo, isDeleted: false, role: Role.LAWYER })
        if (!lawyer) throw new AppError("assigned lawyer not found", 404)
 
        if (team?.length) {
            const teamMembers = await UserModel.find({ _id: { $in: team }, isDeleted: false })
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




}



export default new sessionService()


import SessionModel from "../DB/model/session.model"
import { sendNotification } from "../moudles/task/notification.service"


export const sessionReminderJob = async () => {
    const now      = new Date()
    const in24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const in23h    = new Date(now.getTime() + 23 * 60 * 60 * 1000)

    const sessions = await SessionModel.find({
        isDeleted: false,
        status:    "مجدولة",
        startAt:   { $gte: in23h, $lte: in24h },
    })
        .populate("assignedTo", "UserName")
        .populate("legalCase",  "caseNumber")

    for (const session of sessions) {
        const caseNumber  = (session.legalCase as any)?.caseNumber ?? ""
        const sessionDate = new Date(session.startAt).toLocaleDateString("ar-EG")
        const sessionTime = new Date(session.startAt).toLocaleTimeString("ar-EG", {
            hour: "2-digit", minute: "2-digit"
        })

        const recipients: string[] = []

        if (session.assignedTo) {
            recipients.push(
                typeof session.assignedTo === "object"
                    ? (session.assignedTo as any)._id.toString()
                    : session.assignedTo.toString()
            )
        }

        session.team?.forEach((m: any) => {
            const id = typeof m === "object" ? m._id.toString() : m.toString()
            if (!recipients.includes(id)) recipients.push(id)
        })

        await Promise.all(
            recipients.map(userId =>
                sendNotification({
                    userId,
                    type:  "task_assigned" as any,
                    title: "تذكير بجلسة قادمة",
                    body:  `تذكير: جلسة في القضية ${caseNumber} غداً ${sessionDate} الساعة ${sessionTime} — ${session.courtName ?? ""}`,
                })
            )
        )
    }

    console.log(`session reminders sent: ${sessions.length}`)
}
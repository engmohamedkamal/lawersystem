import NotificationModel, { NotificationType } from "../../DB/model/Notification.model"
import { emitToUser } from "../../utils/socket"


export const sendNotification = async ({
    userId,
    type,
    title,
    body,
    taskId,
    taskTitle,
    clientName,
    clientPhone,
    clientEmail,
    dueDate,
    caseId,
    caseNumber,
    amount,
    month,
    year,
}: {
    userId: string
    type:   NotificationType
    title:  string
    body:   string
    taskId?: string | undefined
    taskTitle?:  string | undefined
    clientName?: string | undefined
    clientPhone?: string | undefined
    clientEmail?: string | undefined
    dueDate?:    Date | undefined
    caseId?: string | undefined
    caseNumber?: string | undefined
    amount?: number | undefined
    month?: number | undefined
    year?: number | undefined
}) => {
    const notification = await NotificationModel.create({
        user: userId,
        type,
        title,
        body,
        isRead: false,
        taskId,
        taskTitle,
        clientName,
        clientPhone,
        clientEmail,
        dueDate,
        caseId,
        caseNumber,
        amount,
        month,
        year,
    })

    emitToUser(userId, "notification", {
        _id:    notification._id,
        type,
        title,
        body,
        isRead: false,
        taskId,
        taskTitle,
        clientName,
        clientPhone,
        clientEmail,
        dueDate,
        caseId,
        caseNumber,
        amount,
        month,
        year,
        createdAt: notification.createdAt,
    })

    return notification
}
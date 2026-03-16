import NotificationModel, { NotificationType } from "../../DB/model/Notification.model"
import { emitToUser } from "../../utils/soket"


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
        createdAt: notification.createdAt,
    })

    return notification
}
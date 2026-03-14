import NotificationModel, { NotificationType } from "../../DB/model/Notification.model"
import { emitToUser } from "../../utils/soket"


export const sendNotification = async ({
    userId,
    type,
    title,
    body,
    taskId,
}: {
    userId: string
    type:   NotificationType
    title:  string
    body:   string
    taskId?: string
}) => {
    const notification = await NotificationModel.create({
        user:   userId,
        type,
        title,
        body,
        task:   taskId,
        isRead: false,
    })

    emitToUser(userId, "notification", {
        _id:    notification._id,
        type,
        title,
        body,
        taskId,
        isRead: false,
        createdAt: notification.createdAt,
    })

    return notification
}
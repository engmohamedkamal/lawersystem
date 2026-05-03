import TaskModel from "../DB/model/tasks.model";
import UserModel, { Role } from "../DB/model/user.model";
import { sendNotification } from "../moudles/task/notification.service";

/**
 * Automatically marks tasks as "متأخرة" (overdue) if their due date has passed.
 * Only applies to tasks with status "قيد التنفيذ" (In Progress).
 */
export const updateOverdueTasks = async () => {
  try {
    const now = new Date();

    const overdueTasks = await TaskModel.find({
      isDeleted: false,
      status: "قيد التنفيذ",
      dueDate: { $lt: now },
    });

    if (overdueTasks.length === 0) return;

    const taskIds = overdueTasks.map(t => t._id);

    const result = await TaskModel.updateMany(
      { _id: { $in: taskIds } },
      { $set: { status: "متأخرة" } }
    );

    if (result.modifiedCount > 0) {
      console.log(`[JOB] ${result.modifiedCount} tasks marked as overdue.`);

      const adminsByOffice: Record<string, string[]> = {};

      for (const task of overdueTasks) {
        const officeIdStr = task.officeId?.toString();
        if (!officeIdStr) continue;

        if (!adminsByOffice[officeIdStr]) {
          const admins = await UserModel.find({
            officeId: task.officeId,
            role: Role.ADMIN,
            isDeleted: false,
          }).select("_id");
          adminsByOffice[officeIdStr] = admins.map(a => a._id.toString());
        }

        const notifyUserIds = new Set<string>();

        if (task.assignedTo) {
          notifyUserIds.add(task.assignedTo.toString());
        }

        const adminIds = adminsByOffice[officeIdStr];
        for (const adminId of adminIds) {
          notifyUserIds.add(adminId);
        }

        for (const userId of notifyUserIds) {
          await sendNotification({
            userId,
            type: "task_overdue",
            title: "مهمة متأخرة",
            body: `المهمة "${task.title}" قد تأخرت عن موعد تسليمها.`,
            taskId: task._id.toString(),
            taskTitle: task.title,
            dueDate: task.dueDate
          }).catch(err => {
            console.error(`Failed to send overdue task notification for user ${userId}:`, err);
          });
        }
      }
    }
  } catch (error) {
    console.error("[JOB ERROR] updateOverdueTasks:", error);
    throw error;
  }
};

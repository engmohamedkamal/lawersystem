import { Router } from "express";
import { validation } from "../../middleware/validation";
import * as TV from "./task.validation";
import TS from "./task.service";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { authorization } from "../../middleware/authorization";
import { Role } from "../../DB/model/user.model";
import { allowedExtensions, MulterHost } from "../../middleware/multer";
import { tenantMiddleware } from "../../middleware/tenant";

const taskRouter = Router();

// Notifications
taskRouter.get(
    "/notifications",
    authentication(TokenType.access),
    TS.getMyNotifications
)

taskRouter.patch(
    "/notifications/read",
    authentication(TokenType.access),
    TS.markNotificationsRead
)

// List all tasks
taskRouter.get(
    "/",
    authentication(TokenType.access),
    TS.getTasks
)

// List tasks by lawyer
taskRouter.get(
    "/lawyer/:userId",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    TS.getTasksByLawyer
)

// Create task
taskRouter.post(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    tenantMiddleware,
    MulterHost({ customExtension: [...allowedExtensions.image, ...allowedExtensions.uploadAnyFiles] }).single("file"),
    validation(TV.createTaskSchema),
    TS.createTask
)


// Comments
taskRouter.post(
    "/:taskId/comments",
    authentication(TokenType.access),
    tenantMiddleware,
    validation(TV.addTaskCommentSchema),
    TS.addTaskComment
)

taskRouter.get(
    "/:taskId/comments",
    authentication(TokenType.access),
    TS.getTaskComments
)

// Subtasks
taskRouter.post(
    "/:taskId/subtasks",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    tenantMiddleware,
    validation(TV.addSubtaskSchema),
    TS.addSubtask
)

taskRouter.patch(
    "/:taskId/subtasks/:subtaskId",
    authentication(TokenType.access),
    tenantMiddleware,
    validation(TV.updateSubtaskSchema),
    TS.updateSubtask
)

taskRouter.delete(
    "/:taskId/subtasks/:subtaskId",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    tenantMiddleware,
    TS.deleteSubtask
)

taskRouter.get(
    "/:taskId/activity",
    authentication(TokenType.access),
    TS.getTaskActivityLog
)

taskRouter.patch(
    "/:taskId/status",
    authentication(TokenType.access),
    validation(TV.updateTaskStatusSchema),
    tenantMiddleware,
    TS.updateTaskStatus
)


taskRouter.get(
    "/:taskId",
    authentication(TokenType.access),
    TS.getTaskById
)

taskRouter.patch(
    "/:taskId",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    tenantMiddleware,
    validation(TV.updateTaskSchema),
    TS.updateTask
)

taskRouter.delete(
    "/:taskId",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    tenantMiddleware,
    TS.deleteTask
)

export default taskRouter;

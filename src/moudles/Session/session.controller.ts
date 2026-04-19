import { Router } from "express";
import { validation } from "../../middleware/validation";
import * as SV  from "../Session/session.validation";
import  SS from "./session.service";
import { authorization } from "../../middleware/authorization";
import { Role } from "../../DB/model/user.model";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { allowedExtensions, MulterHost } from "../../middleware/multer";
import { tenantMiddleware } from "../../middleware/tenant";

const sessionRouter = Router()

sessionRouter.post(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    tenantMiddleware,
    validation(SV.createSessionSchema),
    SS.createSession
)

sessionRouter.get(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    SS.getAllSessions
)

sessionRouter.get(
    "/case/:legalCaseId",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    validation(SV.caseSessionsSchema),
    SS.getCaseSessions
)

sessionRouter.get(
    "/:sessionId",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    validation(SV.sessionParamsSchema),
    SS.getSessionById
)
 
sessionRouter.patch(
    "/:sessionId",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    tenantMiddleware,
    validation(SV.updateSessionSchema),
    SS.updateSession
)

sessionRouter.patch(
    "/:sessionId/status",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    tenantMiddleware,
    validation(SV.updateStatusSchema),
    SS.updateSessionStatus
)

sessionRouter.post(
    "/:sessionId/attachments",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    tenantMiddleware,
    MulterHost({ customExtension: [...allowedExtensions.image, ...allowedExtensions.uploadAnyFiles], fileSizeMB: 10 }).single("file"),
    SS.uploadAttachment
)
 
sessionRouter.delete(
    "/:sessionId/attachments",
    authentication(TokenType.access),
    tenantMiddleware,
    authorization(Role.ADMIN, Role.STAFF),
    SS.deleteAttachment
)
 
sessionRouter.delete(
    "/:sessionId",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    tenantMiddleware,
    validation(SV.sessionParamsSchema),
    SS.deleteSession
)

sessionRouter.get(
    "/lawyer/:userId",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    SS.getLawyerSessions
)


export default sessionRouter
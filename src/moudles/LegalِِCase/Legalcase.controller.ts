import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import { authorization } from "../../middleware/authorization";
import { validation } from "../../middleware/validation";
import * as CV from "./LegalCase.validation";
import { allowedExtensions, MulterHost } from "../../middleware/multer";
import invoiceRouter from "../invoice/invoice.controller";
import CS from "./Legalcase.service";




const LegalCaseRouter = Router({ mergeParams: true });
LegalCaseRouter.use("/:id/invoices", invoiceRouter);

LegalCaseRouter.post(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.createCaseSchema),
    CS.createCase
);

LegalCaseRouter.get(
    "/",
    authentication(TokenType.access),
    authorization(),
    CS.getCases
);

LegalCaseRouter.get(
    "/:id",
    authentication(TokenType.access),
    authorization(),
    validation(CV.caseParamsSchema),
    CS.getCaseById
);

LegalCaseRouter.put(
    "/:id",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.updateCaseSchema),
    CS.updateCase
)

LegalCaseRouter.patch(
    "/:id/status",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.updateCaseStatusSchema),
    CS.updateCaseStatus
);

LegalCaseRouter.patch(
    "/:id/fees",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.updateFeesSchema),
    CS.updateFees
);

LegalCaseRouter.post(
    "/:id/team",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    validation(CV.updateTeamSchema),
    CS.addTeamMember
);


LegalCaseRouter.delete(
    "/:id/team",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    validation(CV.updateTeamSchema),
    CS.removeTeamMember
);

LegalCaseRouter.post(
    "/:id/attachments",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    MulterHost({ customExtension: [...allowedExtensions.image, "application/pdf"], fileSizeMB: 10 }).single("file"),
    CS.uploadAttachment
);

LegalCaseRouter.delete(
    "/:id/attachments",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.caseParamsSchema),
    CS.deleteAttachment
);

LegalCaseRouter.delete(
    "/:id",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    validation(CV.caseParamsSchema),
    CS.deleteCase
);


LegalCaseRouter.use("/:id/invoices", invoiceRouter);




export default LegalCaseRouter
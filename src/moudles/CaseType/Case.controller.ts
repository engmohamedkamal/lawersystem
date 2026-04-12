import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";
import { Role } from "../../DB/model/user.model";
import { TokenType } from "../../utils/token";
import CS from "./Case.service";
import { validation } from "../../middleware/validation";
import * as CV  from "../CaseType/Case.validation";



const CaseTypeRouter = Router()

CaseTypeRouter.post(
  "/createCaseType",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF),
  CS.createCaseType
)

CaseTypeRouter.get(
    "/public/:subdomain",
    CS.getPublicCaseTypes
);

CaseTypeRouter.get(
    "/",
    authentication(TokenType.access),
    CS.getCaseTypes
);

CaseTypeRouter.get(
    "/all",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    CS.getAllCaseTypes
);

CaseTypeRouter.patch(
    "/:id/enable",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.caseTypeParamsSchema),
    CS.enableCaseType
);

CaseTypeRouter.patch(
    "/:id/disable",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.caseTypeParamsSchema),
    CS.disableCaseType
);


CaseTypeRouter.delete(
    "/:id/delete",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.caseTypeParamsSchema),
    CS.deleteCaseType
);

export default CaseTypeRouter
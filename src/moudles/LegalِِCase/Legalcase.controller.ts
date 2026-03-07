import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import { authorization } from "../../middleware/authorization";
import { validation } from "../../middleware/validation";
import CS from "./Legalcase.service";
import * as CV from "./Legalcase.validation";



const LegalCaseRouter = Router()


LegalCaseRouter.post(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.createCaseSchema),
    CS.createCase
);




export default LegalCaseRouter
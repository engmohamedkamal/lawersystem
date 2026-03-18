import { Router } from "express";
import { validation } from "../../middleware/validation";
import * as SV  from "../Session/session.validation";
import  SS from "./session.service";
import { authorization } from "../../middleware/authorization";
import { Role } from "../../DB/model/user.model";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { allowedExtensions, MulterHost } from "../../middleware/multer";

const sessionRouter = Router()

sessionRouter.post(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(SV.createSessionSchema),
    SS.createSession
)


export default sessionRouter
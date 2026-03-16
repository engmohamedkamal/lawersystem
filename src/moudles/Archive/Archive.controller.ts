import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import { authorization } from "../../middleware/authorization";
import AS from "./Archive.service";



const archiveRouter  = Router()

archiveRouter.get(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    AS.getDocuments
)


export default archiveRouter 
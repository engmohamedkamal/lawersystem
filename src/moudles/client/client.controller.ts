import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import { authorization } from "../../middleware/authorization";
import { validation } from "../../middleware/validation";
import CS from "./client.service";
import * as CV from "./client.validation";



const clientRouter = Router()

clientRouter.get(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    CS.getStats
);

clientRouter.post(
    "/create",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.createClientSchema),
    CS.createClient
);

clientRouter.get(
    "/export",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    CS.exportExcel
);


export default clientRouter
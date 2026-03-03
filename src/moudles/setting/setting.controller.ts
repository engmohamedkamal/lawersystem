import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import SS from "./setting.service";




const SettingsRouter = Router()

SettingsRouter.get("/",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    SS.getSettings
)


export default SettingsRouter
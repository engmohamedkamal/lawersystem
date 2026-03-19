import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import { authorization } from "../../middleware/authorization";
import DS from "./Dashboard.service";



const DashboardRouter = Router()

DashboardRouter.get(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    DS.getStats
)


export default DashboardRouter
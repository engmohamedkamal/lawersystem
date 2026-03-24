import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";
import { Role } from "../../DB/model/user.model";
import { TokenType } from "../../utils/token";
import CS from "./Calendar.service";



const CalendarRouter = Router()



CalendarRouter.get(
    "/stats",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    CS.getStats
)

CalendarRouter.get(
    "/range",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    CS.getRange
)

CalendarRouter.get(
    "/day/:date",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    CS.getDay
)




export default CalendarRouter
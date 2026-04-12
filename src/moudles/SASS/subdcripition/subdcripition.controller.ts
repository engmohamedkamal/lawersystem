import { Router } from "express"
import SS from "./subscription.service"
import { validation } from "../../../middleware/validation"
import * as SV from "./subscription.validation"
 
const saasRouter = Router()
 
saasRouter.get("/plans/public", SS.getPublicPlans)
saasRouter.post("/register", validation(SV.registerOfficeSchema), SS.registerOffice)
saasRouter.post("/payments/webhook", SS.paymobWebhook)
saasRouter.post("/coupons/apply", SS.applyCoupon)
export default saasRouter
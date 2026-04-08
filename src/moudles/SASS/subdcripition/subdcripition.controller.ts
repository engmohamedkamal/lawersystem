import { Router } from "express"
import SS from "./subscription.service"
 
const saasRouter = Router()
 
saasRouter.get("/plans/public", SS.getPublicPlans)
saasRouter.post("/register", SS.registerOffice)
saasRouter.post("/payments/webhook", SS.paymobWebhook)
saasRouter.post("/coupons/validate", SS.validateCoupon)

export default saasRouter
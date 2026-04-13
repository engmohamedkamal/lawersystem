import { Router } from "express";
import MS from "./Mysubscription.service"
import { authentication } from "../../../middleware/authentication";
import { TokenType } from "../../../utils/token";
import { authorization } from "../../../middleware/authorization";
import { Role } from "../../../DB/model/user.model";


const mySubscriptionRouter = Router()

mySubscriptionRouter.get("/",
 authentication(TokenType.access),
 authorization(Role.ADMIN),
 MS.getMySubscription)

mySubscriptionRouter.get("/payment-methods",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  MS.getPaymentMethods)

mySubscriptionRouter.get("/plans",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  MS.getAvailablePlans)

mySubscriptionRouter.post("/renew",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  MS.initiateRenewal)

mySubscriptionRouter.get("/payments",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  MS.getMyPayments)

mySubscriptionRouter.delete("/card",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  MS.removeCard)

export default mySubscriptionRouter
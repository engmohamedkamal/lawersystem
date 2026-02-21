import { Router } from "express";
import { validation } from "../../middleware/validation";
import * as AV from "./auth.validation";
import  AS from "./auth.service";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";



const authRouter = Router()

authRouter.post("/authRegister" , validation(AV.signupSchema) , AS.register)
authRouter.post("/authSignin" , validation(AV.signinSchema) , AS.signin)
authRouter.post("/logout", authentication(TokenType.access), AS.logout);
authRouter.post("/refreshToken", AS.refreshToken);

export default authRouter
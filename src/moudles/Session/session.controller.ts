import { Router } from "express";
import { validation } from "../../middleware/validation";
import * as UV  from "../users/users.validation";
import  US from "./session.service";
import { authorization } from "../../middleware/authorization";
import { Role } from "../../DB/model/user.model";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { allowedExtensions, MulterHost } from "../../middleware/multer";

const sessionRouter = Router()



export default sessionRouter
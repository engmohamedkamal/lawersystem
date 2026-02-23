import { Router } from "express";
import { validation } from "../../middleware/validation";
import * as UV  from "../users/users.validation";
import  AS from "./users.service";
import { authorization } from "../../middleware/authorization";
import { Role } from "../../DB/model/user.model";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";

const userRouter = Router()

userRouter.post("/addUsers",validation(UV.addUsersByAdminSchema),
authentication(TokenType.access),
authorization(Role.ADMIN , Role.STAFF),
AS.addUsersByAdmin)

userRouter.get("/",validation(UV.getUsersSchema),
authentication(TokenType.access),
authorization(Role.ADMIN , Role.STAFF),
 AS.getUsers);

userRouter.get("/:userId",validation(UV.getUserByIdSchema),
authentication(TokenType.access),
authorization(Role.ADMIN , Role.STAFF),
AS.getUsersById);

userRouter.patch("/updateUser/:userId",validation(UV.updateUserSchema),
authentication(TokenType.access),
authorization(Role.ADMIN),
AS.updateUsersByAdmin);

export default userRouter
import { Router } from "express";
import { validation } from "../../middleware/validation";
import * as UV  from "../users/users.validation";
import  US from "./users.service";
import { authorization } from "../../middleware/authorization";
import { Role } from "../../DB/model/user.model";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { allowedExtensions, MulterHost } from "../../middleware/multer";

const userRouter = Router()

userRouter.post(
  "/addUsers",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF),
  MulterHost({ customExtension: allowedExtensions.image }).single("profile"),
  validation(UV.addUsersByAdminSchema),
  US.addUsersByAdmin
);

userRouter.get("/",
  validation(UV.getUsersSchema),
  authentication(TokenType.access),
  authorization(Role.ADMIN , Role.STAFF),
  US.getUsers
);

userRouter.get("/:userId",
  validation(UV.getUserByIdSchema),
  authentication(TokenType.access),
  authorization(Role.ADMIN , Role.STAFF),
  US.getUsersById
);

userRouter.patch("/updateUser/:userId",
  validation(UV.updateUserSchema),
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  US.updateUsersByAdmin
);

userRouter.patch("/deleteUser/:userId",
  validation(UV.deleteUserSchema),
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  US.deleteUsersByAdmin
);

userRouter.patch("/:userId/freeze",
  authentication(TokenType.access),
  authorization(Role.ADMIN), 
  validation(UV.freezeUserSchema),
  US.freezeUser
);


userRouter.patch("/:userId/unfreeze",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  validation(UV.unfreezeUserSchema),
  US.unfreezeUser
);

userRouter.patch(
  "/updateProfilePhoto",
  authentication(TokenType.access),
  MulterHost({ customExtension: allowedExtensions.image, fileSizeMB: 3 }).single("profile"),
  US.updateProfilePhoto
);

export default userRouter
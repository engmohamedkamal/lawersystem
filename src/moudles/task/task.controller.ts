import { Router } from "express";
import { validation } from "../../middleware/validation";
import * as TV from "./task.validation";
import TS from "./task.service";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { authorization } from "../../middleware/authorization";
import { Role } from "../../DB/model/user.model";

const taskRouter = Router();

//CRUD
taskRouter.post(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(TV.createTaskSchema),
    TS.createTask
)


export default taskRouter;

import { Router } from "express";
import { validation } from "../../middleware/validation";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import * as SV  from "../Slots/Slots.validation";
import  SS from "./Slots.service";


const slotsRouter = Router();

slotsRouter.post(
  "/create",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  validation(SV.createSlotSchema),
  SS.create
);

slotsRouter.get("/available", validation(SV.availableSlotsSchema), SS.available);

export default slotsRouter;
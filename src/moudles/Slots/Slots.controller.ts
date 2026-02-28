import { Router } from "express";
import { validation } from "../../middleware/validation";
import * as SV from "./Slots.validation";
import SS from "./Slots.service";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { authorization } from "../../middleware/authorization";
import { Role } from "../../DB/model/user.model";

const slotRouter = Router();

slotRouter.post(
  "/createSlot",
  authentication(TokenType.access),
  authorization(Role.ADMIN , Role.STAFF),
  validation(SV.createSlotSchema),
  SS.createSlot
);

slotRouter.get("/",
  authentication(TokenType.access),
  authorization(Role.ADMIN , Role.STAFF),
  SS.getSlots);

slotRouter.get(
  "/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN , Role.STAFF),
  validation(SV.slotParamsSchema),
  SS.getSlotById
);

slotRouter.put(
  "/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN , Role.STAFF),
  validation(SV.updateSlotSchema),
  SS.updateSlot
);

slotRouter.delete(
  "/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN , Role.STAFF),
  validation(SV.slotParamsSchema),
  SS.deleteSlot
);

export default slotRouter;

import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import { validation } from "../../middleware/validation";
import { allowedExtensions, MulterHost } from "../../middleware/multer";
import LR from "./lawReminder.service";
import * as LV from "./lawReminder.validation";

const lawReminderRouter = Router();

lawReminderRouter.get(
  "/",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  validation(LV.getAllLawsSchema),
  LR.getAllLaws
);

lawReminderRouter.post(
  "/upload",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF),
  MulterHost({ customExtension: ["application/pdf"], fileSizeMB: 10 }).single("file"),
  validation(LV.uploadLawSchema),
  LR.uploadLawPdf
);

lawReminderRouter.get(
  "/:lawId/articles",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  validation(LV.getLawArticlesSchema),
  LR.getLawArticles
);

lawReminderRouter.get(
  "/:lawId/reminder",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  validation(LV.getReminderSchema),
  LR.getReminderArticle
);

lawReminderRouter.delete(
  "/:lawId",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  validation(LV.deleteLawSchema),
  LR.deleteLaw
);

export default lawReminderRouter;
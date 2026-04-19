import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import SS from "./setting.service";
import { validation } from "../../middleware/validation";
import * as SV from "./setting.validation";
import { allowedExtensions, MulterHost } from "../../middleware/multer";
import { tenantMiddleware } from "../../middleware/tenant";




const SettingsRouter = Router()

SettingsRouter.get("/",
    authentication(TokenType.access),
    SS.getSettings
);

SettingsRouter.get("/public/:subdomain",
    SS.getPublicSettings
);

SettingsRouter.put(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    tenantMiddleware,
    validation(SV.upsertSettingsSchema),
    SS.upsertSettings
);

SettingsRouter.put(
    "/work-hours",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    tenantMiddleware,
    validation(SV.updateWorkHoursSchema),
    SS.updateWorkHours
);

SettingsRouter.delete(
   "/work-hours",
   authentication(TokenType.access),
   authorization(Role.ADMIN),
   tenantMiddleware,
   validation(SV.deleteWorkHourSchema),
   SS.deleteWorkHour
);

SettingsRouter.patch(
    "/logo",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    tenantMiddleware,
    MulterHost({ customExtension: allowedExtensions.image, fileSizeMB: 3 }).single("logo"),
    SS.updateLogo
);

SettingsRouter.delete(
    "/logo",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    tenantMiddleware,
    SS.deleteLogo
);


export default SettingsRouter
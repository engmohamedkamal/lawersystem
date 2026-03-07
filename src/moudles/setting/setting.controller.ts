import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import SS from "./setting.service";
import { validation } from "../../middleware/validation";
import * as SV from "./setting.validation";
import { allowedExtensions, MulterHost } from "../../middleware/multer";




const SettingsRouter = Router()

SettingsRouter.get("/",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    SS.getSettings
);

SettingsRouter.put(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    validation(SV.upsertSettingsSchema),
    SS.upsertSettings
);

SettingsRouter.put(
    "/work-hours",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    validation(SV.updateWorkHoursSchema),
    SS.updateWorkHours
);

SettingsRouter.delete(
   "/work-hours/:day",
   authentication(TokenType.access),
   authorization(Role.ADMIN),
   validation(SV.deleteWorkHourSchema),
   SS.deleteWorkHour
);

SettingsRouter.patch(
    "/logo",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    MulterHost({ customExtension: allowedExtensions.image, fileSizeMB: 3 }).single("logo"),
    SS.updateLogo
);

SettingsRouter.delete(
    "/logo",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    SS.deleteLogo
);

SettingsRouter.put(
    "/map",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    validation(SV.updateMapSchema),
    SS.UpdateMap
);



export default SettingsRouter
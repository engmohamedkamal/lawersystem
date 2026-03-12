import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import { authorization } from "../../middleware/authorization";
import { validation } from "../../middleware/validation";
import CS from "./client.service";
import * as CV from "./client.validation";
import { allowedExtensions, MulterHost } from "../../middleware/multer";



const clientRouter = Router()

clientRouter.get(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    CS.getStats
);

clientRouter.post(
    "/create",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.createClientSchema),
    CS.createClient
);

clientRouter.get(
    "/export",
    authentication(TokenType.access),
    authorization(Role.ADMIN , Role.STAFF),
    CS.exportToExcel
);

clientRouter.get(
    "/all",
    authentication(TokenType.access),
    authorization(Role.ADMIN , Role.STAFF),
    CS.getClients
);

clientRouter.get(
    "/:id",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.clientParamsSchema),
    CS.getClientById
);

clientRouter.put(
    "/:id",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.updateClientSchema),
    CS.updateClient
);

clientRouter.post(
    "/:id/documents",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    MulterHost({
        customExtension: [...allowedExtensions.uploadAnyFiles],
        fileSizeMB: 10,
    }).single("file"),
    CS.uploadDocument
);

clientRouter.delete(
    "/:id/deleteDocuments",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(CV.deleteDocumentSchema),
    CS.deleteDocument
);

clientRouter.delete(
    "/:id",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    validation(CV.clientParamsSchema),
    CS.deleteClient
);

clientRouter.patch(
    "/:id",
    authentication(TokenType.access),
    authorization(Role.ADMIN),
    validation(CV.clientParamsSchema),
    CS.unDeleteClient
);


export default clientRouter
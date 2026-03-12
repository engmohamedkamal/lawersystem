import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";
import { authorization } from "../../middleware/authorization";
import { validation } from "../../middleware/validation";
import IS from "./invoice.service";
import * as IV from "./invoice.validation";
import { allowedExtensions, MulterHost } from "../../middleware/multer";



const invoiceRouter = Router({ mergeParams: true })

invoiceRouter.post(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(IV.createInvoiceSchema),
    IS.createInvoice
)

invoiceRouter.get(
    "/:invoiceId/print",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    IS.printInvoice
)

invoiceRouter.post(
    "/standalone",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(IV.createStandaloneInvoiceSchema),
    IS.createStandaloneInvoice
)

invoiceRouter.get(
    "/",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    IS.getCaseInvoices
)

invoiceRouter.get(
    "/:invoiceId",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    IS.getInvoiceById
)

invoiceRouter.put(
    "/:invoiceId",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF),
    validation(IV.caseInvoiceParamsSchema),
    IS.updateInvoice
)

invoiceRouter.get(
    "/client/:clientId/print-all",
    authentication(TokenType.access),
    authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
    IS.printAllClientInvoices
)



export default invoiceRouter
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
    validation(IV.caseInvoiceParamsSchema),
    IS.printInvoice
)



export default invoiceRouter
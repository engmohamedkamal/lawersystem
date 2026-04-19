import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { authorization }  from "../../middleware/authorization";
import { validation }     from "../../middleware/validation";
import { TokenType }      from "../../utils/token";
import { Role }           from "../../DB/model/user.model";
import LD                 from "./LegalDocument.service";
import * as LV            from "./LegalDocument.validation";
import { tenantMiddleware } from "../../middleware/tenant";

const legalDocumentRouter = Router();


legalDocumentRouter.get(
  "/templates",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  LD.getAllTemplates
);

legalDocumentRouter.get(
  "/templates/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  validation(LV.templateParamsSchema),
  LD.getTemplateById
);

legalDocumentRouter.post(
  "/templates",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  tenantMiddleware,
  validation(LV.createTemplateSchema),
  LD.createTemplate
);

legalDocumentRouter.patch(
  "/templates/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  tenantMiddleware,
  validation(LV.updateTemplateSchema),
  LD.updateTemplate
);

legalDocumentRouter.delete(
  "/templates/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  tenantMiddleware,
  validation(LV.templateParamsSchema),
  LD.deleteTemplate
);


legalDocumentRouter.post(
  "/",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  tenantMiddleware,
  validation(LV.createDocumentSchema),
  LD.createDocument
);

legalDocumentRouter.get(
  "/",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  validation(LV.listDocumentsSchema),
  LD.getUserDocuments
);


legalDocumentRouter.get(
  "/:id/export/pdf",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  validation(LV.documentParamsSchema),
  LD.exportPDF
);


legalDocumentRouter.get(
  "/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  validation(LV.documentParamsSchema),
  LD.getDocumentById
);

legalDocumentRouter.patch(
  "/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  tenantMiddleware,
  validation(LV.updateDocumentSchema),
  LD.updateDocument
);

legalDocumentRouter.delete(
  "/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  tenantMiddleware,
  validation(LV.documentParamsSchema),
  LD.deleteDocument
);

export default legalDocumentRouter;

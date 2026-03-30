import { Router } from "express";
import { authentication } from "../../middleware/authentication";
import { authorization }  from "../../middleware/authorization";
import { validation }     from "../../middleware/validation";
import { TokenType }      from "../../utils/token";
import { Role }           from "../../DB/model/user.model";
import LD                 from "./LegalDocument.service";
import * as LV            from "./LegalDocument.validation";

const legalDocumentRouter = Router();

// ── Templates ──────────────────────────────────────────────────────────────────

// GET — جلب كل القوالب النشطة (كل الأدوار)
legalDocumentRouter.get(
  "/templates",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  LD.getAllTemplates
);

// GET — جلب قالب واحد (كل الأدوار)
legalDocumentRouter.get(
  "/templates/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  validation(LV.templateParamsSchema),
  LD.getTemplateById
);

// POST — إضافة قالب جديد (Admin فقط)
legalDocumentRouter.post(
  "/templates",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  validation(LV.createTemplateSchema),
  LD.createTemplate
);

// PATCH — تعديل قالب (Admin فقط)
legalDocumentRouter.patch(
  "/templates/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  validation(LV.updateTemplateSchema),
  LD.updateTemplate
);

// DELETE — حذف (تعطيل) قالب (Admin فقط)
legalDocumentRouter.delete(
  "/templates/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  validation(LV.templateParamsSchema),
  LD.deleteTemplate
);

// ── Documents ─────────────────────────────────────────────────────────────────

legalDocumentRouter.post(
  "/",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
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

// ── Export (قبل /:id عشان Express لا يعتبر "export" كـ id) ──────────────────

legalDocumentRouter.get(
  "/:id/export/pdf",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  validation(LV.documentParamsSchema),
  LD.exportPDF
);

// ── Single Document ───────────────────────────────────────────────────────────

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
  validation(LV.updateDocumentSchema),
  LD.updateDocument
);

legalDocumentRouter.delete(
  "/:id",
  authentication(TokenType.access),
  authorization(Role.ADMIN, Role.STAFF, Role.LAWYER),
  validation(LV.documentParamsSchema),
  LD.deleteDocument
);

export default legalDocumentRouter;

import { Request, Response, NextFunction } from "express";
import { AppError }               from "../../utils/classError";
import DocumentTemplateModel      from "../../DB/model/documentTemplate.model";
import LegalDocumentModel         from "../../DB/model/legalDocument.model";
import { generateLegalDocumentPDF } from "../../utils/legalDocumentPdf";
import {
  CreateDocumentBodyType,
  UpdateDocumentBodyType,
  DocumentParamsType,
  TemplateParamsType,
  CreateTemplateBodyType,
  UpdateTemplateBodyType,
} from "./LegalDocument.validation";
import SettingsModel from "../../DB/model/settings.model";
import { assertFeatureLimitNotReached } from "../../helpers/planFeature.helper";
import { PLAN_FEATURES } from "../SASS/constants/planFeatures";

class LegalDocumentService {
  constructor() {}

  getAllTemplates = async (req: Request, res: Response, next: NextFunction) => {
    const templates = await DocumentTemplateModel.find({ isActive: true, officeId: req.user?.officeId })
      .select("_id name type description defaultFields defaultSections")
      .sort({ type: 1, name: 1 })
      .lean();

    return res.status(200).json({ message: "done", templates });
  };

  getTemplateById = async (req: Request, res: Response, next: NextFunction) => {
    const { id }: TemplateParamsType = req.params as any;

    const template = await DocumentTemplateModel.findOne({ _id: id, isActive: true, officeId: req.user?.officeId });
    if (!template) throw new AppError("template not found", 404);

    return res.status(200).json({ message: "done", template });
  };

  createTemplate = async (req: Request, res: Response, next: NextFunction) => {
    const body: CreateTemplateBodyType = req.body;

    const template = await DocumentTemplateModel.create({
      name:            body.name,
      type:            body.type,
      description:     body.description,
      defaultFields:   body.defaultFields   ?? [],
      defaultSections: body.defaultSections ?? [],
      isActive:        body.isActive        ?? true,
      officeId:        req.user?.officeId,
    });

    return res.status(201).json({ message: "done, template created", template });
  };

  updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
    const { id }: TemplateParamsType = req.params as any;
    const body: UpdateTemplateBodyType = req.body;

    const template = await DocumentTemplateModel.findOne({ _id: id, officeId: req.user?.officeId });
    if (!template) throw new AppError("template not found", 404);

    if (body.name            !== undefined) template.name            = body.name;
    if (body.type            !== undefined) template.type            = body.type;
    if (body.description     !== undefined) template.description     = body.description;
    if (body.defaultFields   !== undefined) template.defaultFields   = body.defaultFields   as any;
    if (body.defaultSections !== undefined) template.defaultSections = body.defaultSections as any;
    if (body.isActive        !== undefined) template.isActive        = body.isActive;

    await template.save();

    return res.status(200).json({ message: "done, template updated", template });
  };

  deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
    const { id }: TemplateParamsType = req.params as any;

    const template = await DocumentTemplateModel.findOne({ _id: id, officeId: req.user?.officeId });
    if (!template) throw new AppError("template not found", 404);

    template.isActive = false;
    await template.save();

    return res.status(200).json({ message: "done, template deactivated" });
  };

  createDocument = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?._id;
  const { templateId, title, status, fields, sections }: CreateDocumentBodyType = req.body;

  const template = await DocumentTemplateModel.findOne({ _id: templateId, isActive: true, officeId: req.user?.officeId });
  if (!template) throw new AppError("template not found", 404);

  const office = (req as any).office
  const docsCount = await LegalDocumentModel.countDocuments({ officeId: req.user?.officeId, isDeleted: false })
  assertFeatureLimitNotReached(office, PLAN_FEATURES.LEGALDOCUMENTS_MAX, docsCount)

  const templateFields = Array.isArray(template.defaultFields) ? template.defaultFields : [];
  const templateSections = Array.isArray(template.defaultSections) ? template.defaultSections : [];

  const incomingFields = (fields ?? {}) as Record<string, unknown>;
  const resolvedFields = Object.fromEntries(
    templateFields.map((field: any) => [field.key, incomingFields[field.key] ?? ""])
  );

  const incomingSectionsMap = new Map(
    ((sections ?? []) as any[]).map((section) => [section.key, section])
  );

  const resolvedSections = templateSections.map((section: any) => {
    const incoming = incomingSectionsMap.get(section.key);

    return {
      key: section.key,
      label: section.label,
      content: incoming?.content ?? "",
      visible: incoming?.visible ?? true,
      order: section.order,
    };
  });

  const document = await LegalDocumentModel.create({
    userId,
    templateId,
    title,
    type: template.type,
    status: status ?? "draft",
    fields: resolvedFields,
    sections: resolvedSections,
    style: {},
    officeId: req.user?.officeId,
  });

  return res.status(201).json({
    message: "done, document created",
    document,
  });
};

  getUserDocuments = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;
    const { status, type, page = 1, limit = 20 } = req.query as any;

    const filter: Record<string, unknown> = { userId, isDeleted: false, officeId: req.user?.officeId };
    if (status) filter.status = status;
    if (type)   filter.type   = type;

    const skip = (Number(page) - 1) * Number(limit);

    const [documents, total] = await Promise.all([
      LegalDocumentModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("_id title type status createdAt updatedAt")
        .populate("templateId", "name type"),
      LegalDocumentModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: "done",
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      documents,
    });
  };

  getDocumentById = async (req: Request, res: Response, next: NextFunction) => {
    const { id }: DocumentParamsType = req.params as any;
    const userId = req.user?._id;

    const document = await LegalDocumentModel.findOne({ _id: id, userId, isDeleted: false, officeId: req.user?.officeId })
      .populate("templateId", "name type defaultFields");

    if (!document) throw new AppError("document not found", 404);

    return res.status(200).json({ message: "done", document });
  };

  updateDocument = async (req: Request, res: Response, next: NextFunction) => {
    const { id }: DocumentParamsType = req.params as any;
    const userId = req.user?._id;
    const updates: UpdateDocumentBodyType = req.body;

    const document = await LegalDocumentModel.findOne({ _id: id, userId, isDeleted: false, officeId: req.user?.officeId });
    if (!document) throw new AppError("document not found", 404);

    if (updates.title    !== undefined) document.title    = updates.title;
    if (updates.status   !== undefined) document.status   = updates.status;
    if (updates.sections !== undefined) document.sections = updates.sections as any;
    if (updates.style    !== undefined) Object.assign(document.style, updates.style);

    if (updates.fields) {
      for (const [k, v] of Object.entries(updates.fields)) {
        document.fields.set(k, v);
      }
    }

    await document.save();

    return res.status(200).json({ message: "done, document updated", document });
  };


  deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
    const { id }: DocumentParamsType = req.params as any;
    const userId = req.user?._id;

    const document = await LegalDocumentModel.findOne({ _id: id, userId, isDeleted: false, officeId: req.user?.officeId });
    if (!document) throw new AppError("document not found", 404);

    document.isDeleted = true;
    document.deletedAt = new Date();
    await document.save();

    return res.status(200).json({ message: "done, document deleted" });
  };

  exportPDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id }: DocumentParamsType = req.params as any;
    const userId = req.user?._id;

    const document = await LegalDocumentModel.findOne({
      _id: id,
      userId,
      isDeleted: false,
      officeId: req.user?.officeId,
    }).populate("templateId", "name type defaultFields defaultSections");

    if (!document) throw new AppError("document not found", 404);
    const settings = await SettingsModel.findOne()

    const pdfBuffer = await generateLegalDocumentPDF(document , settings);

    const rawTitle = String(document.title || "document").trim();

    const fallbackName =
      rawTitle
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 80) || "legal-document";

    const utf8FileName = `${rawTitle}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fallbackName}.pdf"; filename*=UTF-8''${encodeURIComponent(utf8FileName)}`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (error) {
    console.error("EXPORT PDF ERROR =>", error);
    return next(error);
  }
};
}

export default new LegalDocumentService();

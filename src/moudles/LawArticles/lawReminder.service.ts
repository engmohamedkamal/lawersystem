import { Request, Response } from "express";
import { AppError } from "../../utils/classError";
import { uploadBuffer } from "../../utils/cloudinaryHelpers";
import cloudinary from "../../utils/cloudInary";
import LawModel from "../../DB/model/law.model";
import LawArticleModel from "../../DB/model/lawArticle.model";
import UserLawReminderModel from "../../DB/model/userLawReminder.model";
import {getLawArticlesParamsType,getReminderParamsType,deleteLawParamsType,uploadLawBodyType,} from "./lawReminder.validation";
import pdf from "pdf-parse";
import { assertFeatureEnabled } from "../../helpers/planFeature.helper";
import { checkStorageLimit, incrementStorage, decrementStorage } from "../../helpers/storage.helper";
import { PLAN_FEATURES } from "../SASS/constants/planFeatures";
import OfficeModel from "../../DB/model/SaaSModels/Office.model";

const extractArticles = (text: string) => {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  const regex = /((?:المادة|مادة)\s*\(?(\d+)\)?)([\s\S]*?)(?=((?:المادة|مادة)\s*\(?\d+\)?)|$)/g;

  const articles: {
    articleNumber: number;
    title: string;
    content: string;
  }[] = [];

  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    const title = match[1] ?? "";
    const articleNumberRaw = match[2] ?? "";
    const content = match[3] ?? "";

    const articleNumber = Number(articleNumberRaw);

    if (!articleNumber || !content.trim()) continue;

    articles.push({
      articleNumber,
      title: title.trim(),
      content: content.trim()
    });
  }

  return articles;
};

class lawReminderService {
  constructor() {}

  uploadLawPdf = async (req: Request, res: Response) => {
    const { title, category }: uploadLawBodyType = req.body;

    const office = await OfficeModel.findById(req.user?.officeId);
      if (!office) {
      throw new AppError("office not found", 404);
    }

    assertFeatureEnabled(office, PLAN_FEATURES.LAW_ARTICLW_ENABLED)

    if (!req.file) {
      throw new AppError("No file uploaded", 400);
    }

    const officeId = req.user?.officeId;
    await checkStorageLimit(officeId as any, req.file.size || req.file.buffer.length);

    const parsed = await pdf(req.file.buffer);
    const extractedArticles = extractArticles(parsed.text);

    if (!extractedArticles.length) {
      throw new AppError("No articles found in PDF", 400);
    }

    const articleNumbers = extractedArticles.map((a) => a.articleNumber);
    const duplicates = articleNumbers.filter(
      (num, index) => articleNumbers.indexOf(num) !== index
    );

    if (duplicates.length) {
      throw new AppError(
        `Duplicate article numbers found in PDF: ${[...new Set(duplicates)].join(", ")}`,
        400
      );
    }

    const uploadResult = await uploadBuffer(req.file.buffer, "lawyerSystem/laws");

    const law = await LawModel.create({
      title,
      category,
      fileUrl: uploadResult.secure_url,
      filePublicId: uploadResult.public_id,
      fileSizeBytes: uploadResult.bytes,
      createdBy: req.user?._id,
      officeId,
    });

    await incrementStorage(officeId as any, uploadResult.bytes);

    try {
      await LawArticleModel.insertMany(
        extractedArticles.map((article) => ({
          lawId: law._id,
          articleNumber: article.articleNumber,
          title: article.title,
          content: article.content,
        }))
      );
    } catch (err) {
      await LawModel.findByIdAndDelete(law._id);
      if (uploadResult.public_id) {
        await cloudinary.uploader.destroy(uploadResult.public_id, {
          resource_type: "raw",
        });
        await decrementStorage(officeId as any, uploadResult.bytes);
      }
      throw new AppError("Failed to save articles. Law upload rolled back.", 500);
    }

    return res.status(201).json({
      message: "done, law uploaded successfully",
      law,
      articlesCount: extractedArticles.length,
    });
  };

  getAllLaws = async (req: Request, res: Response) => {
    const { category, page = "1", limit = "10" } = req.query as {
      category?: string;
      page?: string;
      limit?: string;
    };

    const filter: Record<string, unknown> = { officeId: req.user?.officeId };
    if (category) filter.category = category;

    const skip = (Number(page) - 1) * Number(limit);

    const [laws, total] = await Promise.all([
      LawModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("_id title category fileUrl createdAt"),
      LawModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: "done",
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      laws,
    });
  };

  getLawArticles = async (req: Request, res: Response) => {
    const { lawId }: getLawArticlesParamsType = req.params as any;

    const law = await LawModel.findOne({ _id: lawId, officeId: req.user?.officeId });
    if (!law) throw new AppError("law not found", 404);

    const articles = await LawArticleModel.find({ lawId })
      .sort({ articleNumber: 1 })
      .select("_id articleNumber title content");

    return res.status(200).json({ message: "done", law, articles });
  };

  getReminderArticle = async (req: Request, res: Response) => {
    const { lawId }: getReminderParamsType = req.params as any;
    const userId = req.user?._id;

    const law = await LawModel.findOne({ _id: lawId, officeId: req.user?.officeId });
    if (!law) throw new AppError("law not found", 404);

    const articles = await LawArticleModel.find({ lawId })
      .sort({ articleNumber: 1 })
      .select("_id articleNumber title content");

    if (!articles.length) {
      throw new AppError("No articles found for this law", 404);
    }

    let reminder = await UserLawReminderModel.findOne({ userId, lawId });

    if (!reminder) {
      reminder = await UserLawReminderModel.create({
        userId,
        lawId,
        lastArticleId: articles[0]._id,
        lastShownAt: new Date(),
      });

      return res.status(200).json({
        message: "done",
        reminder: {
          lawTitle: law.title,
          article: articles[0],
        },
      });
    }

    const currentIndex = articles.findIndex(
      (article) => article._id.toString() === reminder.lastArticleId?.toString()
    );

    const nextIndex =
      currentIndex === -1 || currentIndex === articles.length - 1
        ? 0
        : currentIndex + 1;

    reminder.lastArticleId = articles[nextIndex]._id;
    reminder.lastShownAt = new Date();
    await reminder.save();

    return res.status(200).json({
      message: "done",
      reminder: {
        lawTitle: law.title,
        article: articles[nextIndex],
      },
    });
  };

  deleteLaw = async (req: Request, res: Response) => {
    const { lawId }: deleteLawParamsType = req.params as any;

    const law = await LawModel.findOne({ _id: lawId, officeId: req.user?.officeId });
    if (!law) throw new AppError("law not found", 404);

    if (law.filePublicId) {
      await cloudinary.uploader.destroy(law.filePublicId, {
        resource_type: "raw",
      });
      await decrementStorage(req.user?.officeId as any, law.fileSizeBytes || 0);
    }

    await Promise.all([
      LawArticleModel.deleteMany({ lawId }),
      UserLawReminderModel.deleteMany({ lawId }),
      LawModel.findByIdAndDelete(lawId),
    ]);

    return res.status(200).json({
      message: "done, law and all related data deleted successfully",
    });
  };

  getLawsDropdown = async (req: Request, res: Response) => {
    const laws = await LawModel.find({ officeId: req.user?.officeId })
      .sort({ createdAt: -1 })
      .select("_id title category fileUrl");

    return res.status(200).json({
      message: "done",
      laws,
    });
  };
}

export default new lawReminderService();
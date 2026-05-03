import { Types } from "mongoose";
import OfficeModel from "../DB/model/SaaSModels/Office.model";
import { getFeatureValue } from "./planFeature.helper";
import { PLAN_FEATURES } from "../moudles/SASS/constants/planFeatures";
import { AppError } from "../utils/classError";

/**
 * Pre-flight check — verifies the office has enough storage
 * WITHOUT incrementing the counter.
 * Call this BEFORE uploading to Cloudinary to fail fast.
 */
export const checkStorageAvailable = async (
  officeId: string | Types.ObjectId,
  estimatedBytes: number
) => {
  const office = await OfficeModel.findById(officeId);
  if (!office) throw new AppError("المكتب غير موجود", 404);

  const maxStorageGB = getFeatureValue(office, PLAN_FEATURES.STORAGE_MAX);
  if (typeof maxStorageGB !== "number" || maxStorageGB < 0) {
    throw new AppError("Feature 'STORAGE_MAX' is not configured properly", 500);
  }

  const maxStorageBytes = maxStorageGB * 1024 * 1024 * 1024;
  const currentUsage = office.storageUsedBytes || 0;
  
  if (currentUsage + estimatedBytes > maxStorageBytes) {
    throw new AppError("مساحة التخزين المتوفرة في خطتك الحالية غير كافية", 403);
  }
};

export const reserveStorage = async (
  officeId: string | Types.ObjectId,
  fileBytes: number
) => {
  if (!fileBytes || fileBytes <= 0) {
    throw new AppError("حجم الملف غير صالح", 400);
  }

  const office = await OfficeModel.findById(officeId);
  if (!office) {
    throw new AppError("المكتب غير موجود", 404);
  }

  const maxStorageGB = getFeatureValue(office, PLAN_FEATURES.STORAGE_MAX);

  if (typeof maxStorageGB !== "number" || maxStorageGB < 0) {
    throw new AppError("Feature 'STORAGE_MAX' is not configured properly", 500);
  }

  const maxStorageBytes = maxStorageGB * 1024 * 1024 * 1024;

  const updatedOffice = await OfficeModel.findOneAndUpdate(
    {
      _id: officeId,
      $expr: {
        $lte: [
          { $add: [{ $ifNull: ["$storageUsedBytes", 0] }, fileBytes] },
          maxStorageBytes
        ]
      }
    },
    {
      $inc: { storageUsedBytes: fileBytes }
    },
    {
      new: true
    }
  );

  if (!updatedOffice) {
    throw new AppError("مساحة التخزين المتوفرة في خطتك الحالية غير كافية", 403);
  }

  return updatedOffice;
};

export const releaseStorage = async (
  officeId: string | Types.ObjectId,
  bytes: number
) => {
  if (!bytes || bytes <= 0) return;

  const updatedOffice = await OfficeModel.findOneAndUpdate(
    { _id: officeId },
    { $inc: { storageUsedBytes: -bytes } },
    { new: true }
  );

  if (!updatedOffice) {
    throw new AppError("المكتب غير موجود", 404);
  }

  return updatedOffice;
};
import { Types } from "mongoose";
import OfficeModel from "../DB/model/SaaSModels/Office.model";
import { getFeatureValue } from "./planFeature.helper";
import { PLAN_FEATURES } from "../moudles/SASS/constants/planFeatures";
import { AppError } from "../utils/classError";


export const checkStorageLimit = async (officeId: string | Types.ObjectId, fileBytes: number) => {
  const office = await OfficeModel.findById(officeId);
  if (!office) throw new AppError("المكتب غير موجود", 404);

  const maxStorage = getFeatureValue(office, PLAN_FEATURES.STORAGE_MAX);
  if (typeof maxStorage !== "number") {
    throw new AppError("Feature 'STORAGE_MAX' is not configured properly", 500);
  }

  const currentUsed = office.storageUsedBytes || 0;

  if (currentUsed + fileBytes > maxStorage) {
    throw new AppError("مساحة التخزين المتوفرة في خطتك الحالية غير كافية", 403);
  }

  return office;
};


export const incrementStorage = async (officeId: string | Types.ObjectId, bytes: number) => {
  await OfficeModel.findByIdAndUpdate(officeId, {
    $inc: { storageUsedBytes: bytes }
  });
};

export const decrementStorage = async (officeId: string | Types.ObjectId, bytes: number) => {
  if (!bytes || bytes <= 0) return;
  await OfficeModel.findByIdAndUpdate(officeId, {
    $inc: { storageUsedBytes: -bytes }
  });
};

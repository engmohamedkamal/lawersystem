import multer from "multer";
import { AppError } from "../utils/classError";

export const allowedExtensions = {
    image: ["image/png", "image/jpeg"],
    video: ["video/mp4"],
};

type MulterCloudOptions = {
  customExtension?: string[];
  fileSizeMB?: number;
};

export const MulterHost = ({ customExtension = [], fileSizeMB = 3 }: MulterCloudOptions = {}) => {
  const storage = multer.memoryStorage(); 

  const fileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
    if (customExtension.length && !customExtension.includes(file.mimetype)) {
      return cb(new AppError("invalid file type", 400) as any, false);
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: fileSizeMB * 1024 * 1024 },
  });
};
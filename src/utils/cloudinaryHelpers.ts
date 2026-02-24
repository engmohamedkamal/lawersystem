import { AppError } from "./classError";
import cloudinary from "./cloudInary";

export const uploadBuffer = (buffer: Buffer, folder: string) => {
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) return reject(new AppError("Image upload failed", 500));
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );

    stream.end(buffer);
  });
};
import { AppError } from "./classError"
import cloudinary from "./cloudInary"
import { UploadApiOptions } from "cloudinary"

export const uploadBuffer = (
  buffer: Buffer,
  folder: string,
  resourceType: "auto" | "raw" | "image" = "raw",
  publicId?: string
) => {
  return new Promise<{ secure_url: string; public_id: string; bytes: number }>((resolve, reject) => {
    const options: UploadApiOptions = {
      folder,
      resource_type: resourceType,
    }

    if (publicId) {
      options.public_id = publicId
    }

    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error || !result) {
          return reject(new AppError("file upload failed", 500))
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          bytes: result.bytes,
        })
      }
    )

    stream.end(buffer)
  })
}
import { NextFunction, Request, Response } from "express";
import SettingsModel from "../../DB/model/settings.model";
import { AppError } from "../../utils/classError";
import { UpsertSettingsType } from "./setting.validation";
import cloudinary from "../../utils/cloudInary";
import { uploadBuffer } from "../../utils/cloudinaryHelpers";


class SettingsService {

    getSettings = async (req: Request, res: Response, next: NextFunction) =>{

        const Settings = await SettingsModel.findOne()
        if(!Settings) throw new AppError("Settings not configured yet", 404)
        return res.status(200).json({ message: "success", Settings })

    }

    upsertSettings = async (req: Request, res: Response, next: NextFunction) => {
        
        const data : UpsertSettingsType = req.body

        const settings = await SettingsModel.findOneAndUpdate(
          {},
          { $set: data },
          { new: true, upsert: true }
        )

        return res.status(200).json({ message: "Settings saved successfully", settings })
    }

    updateLogo = async (req: Request, res: Response, next: NextFunction) => {
         if (!req.file) throw new AppError("No image uploaded", 400)

         const existing = await SettingsModel.findOne()
         if (existing?.logoPublicId) {
           await cloudinary.uploader.destroy(existing.logoPublicId)
         }

         const { secure_url, public_id } = await uploadBuffer(req.file.buffer, "settings/logo")

         const settings = await SettingsModel.findOneAndUpdate(
           {},
           { $set: { logo: secure_url, logoPublicId: public_id } },
           { new: true, upsert: true }
         )

         return res.status(200).json({ message: "Logo updated successfully", settings })
  }




} 

export default new SettingsService
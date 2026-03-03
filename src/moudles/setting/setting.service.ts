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


    deleteLogo = async (req: Request, res: Response, next: NextFunction) => {
        
         const settings = await SettingsModel.findOne()
         if (!settings) throw new AppError("Settings not found", 404)
         if (!settings.logo) throw new AppError("No logo to delete", 400)

         if (settings.logoPublicId) {
           await cloudinary.uploader.destroy(settings.logoPublicId)
         }

         settings.logo        = undefined
         settings.logoPublicId = undefined
         await settings.save()

         return res.status(200).json({ message: "Logo deleted successfully" })
       }
  }


export default new SettingsService
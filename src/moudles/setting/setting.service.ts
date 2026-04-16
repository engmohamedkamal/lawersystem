import { NextFunction, Request, Response } from "express";
import SettingsModel from "../../DB/model/settings.model";
import { AppError } from "../../utils/classError";
import { UpdateWorkHoursType, UpsertSettingsType } from "./setting.validation";
import cloudinary from "../../utils/cloudInary";
import { uploadBuffer } from "../../utils/cloudinaryHelpers";
import OfficeModel from "../../DB/model/SaaSModels/Office.model";
import { checkStorageLimit, incrementStorage, decrementStorage } from "../../helpers/storage.helper";


class SettingsService {

    getSettings = async (req: Request, res: Response, next: NextFunction) =>{

        const Settings = await SettingsModel.findOne({ officeId: req.user?.officeId })
        if(!Settings) throw new AppError("Settings not configured yet", 404)
        return res.status(200).json({ message: "success", Settings })

    }

    getPublicSettings = async (req: Request, res: Response, next: NextFunction) =>{
        const { subdomain } = req.params;

        if (!subdomain) {
            throw new AppError("Subdomain is required", 400)
        }

        const office = await OfficeModel.findOne({ subdomain: String(subdomain).toLowerCase(), isActive: true })
        if(!office) throw new AppError("Office not found or inactive", 404)

        const Settings = await SettingsModel.findOne({ officeId: office._id })
        if(!Settings) throw new AppError("Settings not configured yet", 404)
        return res.status(200).json({ message: "success", Settings })
    }

    upsertSettings = async (req: Request, res: Response, next: NextFunction) => {
        
        const data : UpsertSettingsType = req.body

        const settings = await SettingsModel.findOneAndUpdate(
          { officeId: req.user?.officeId },
          { $set: { ...data, officeId: req.user?.officeId } },
          { new: true, upsert: true }
        )

        return res.status(200).json({ message: "Settings saved successfully", settings })
    }

    updateWorkHours = async (req: Request, res: Response, next: NextFunction) => {
      
          const { workHours }: UpdateWorkHoursType = req.body

          const allDays = workHours.flatMap(w => w.days)
          if (new Set(allDays).size !== allDays.length) {
            throw new AppError("duplicate days are not allowed", 400)
          }

          const existing = await SettingsModel.findOne({ officeId: req.user?.officeId })
          const existingDays = existing?.workHours.flatMap((w: { days: string[] }) => w.days) ?? []
          const newDays = workHours.flatMap(w => w.days)
          const hasDuplicate = newDays.some(d => existingDays.includes(d))
          if (hasDuplicate) throw new AppError("day already exists", 400)

          const settings = await SettingsModel.findOneAndUpdate(
            { officeId: req.user?.officeId },
            { $push: { workHours: { $each: workHours } } },
            { new: true, upsert: true }
          )
          return res.status(200).json({ message: "Work hours updated successfully", settings })
    }

    deleteWorkHour = async (req: Request, res: Response, next: NextFunction) => {
         const { days } = req.body as { days: string[] } 

         const settings = await SettingsModel.findOne({ officeId: req.user?.officeId })
         if (!settings) throw new AppError("Settings not configured yet", 404)

         const existingDays = settings.workHours.flatMap((w: { days: string[] }) => w.days)
         const notFound     = days.filter(d => !existingDays.includes(d))
         if (notFound.length > 0) throw new AppError(`days not found: ${notFound.join(", ")}`, 404)

         const updatedWorkHours = (settings.workHours as Array<{ days: string[]; from: string; to: string }>)
           .map(w => ({
             from: w.from,
             to:   w.to,
             days: w.days.filter(d => !days.includes(d)),
           }))
           .filter(w => w.days.length > 0)

         const updated = await SettingsModel.findOneAndUpdate(
           { officeId: req.user?.officeId },
           { $set: { workHours: updatedWorkHours } },
           { new: true }
         )
         return res.status(200).json({ message: "Days removed successfully", settings: updated })
    }

    updateLogo = async (req: Request, res: Response, next: NextFunction) => {
         if (!req.file) throw new AppError("No image uploaded", 400)

         const officeId = req.user?.officeId;
         await checkStorageLimit(officeId as any, req.file.size || req.file.buffer.length);

         const existing = await SettingsModel.findOne({ officeId })
         const oldSizeBytes = existing?.logoSizeBytes || 0;

         const { secure_url, public_id, bytes } = await uploadBuffer(req.file.buffer, "settings/logo")

         const settings = await SettingsModel.findOneAndUpdate(
           { officeId },
           { $set: { logo: secure_url, logoPublicId: public_id, logoSizeBytes: bytes } },
           { new: true, upsert: true }
         )

         await incrementStorage(officeId as any, bytes);

         if (existing?.logoPublicId) {
           await cloudinary.uploader.destroy(existing.logoPublicId)
           await decrementStorage(officeId as any, oldSizeBytes);
         }

         return res.status(200).json({ message: "Logo updated successfully", settings })
    }

    deleteLogo = async (req: Request, res: Response, next: NextFunction) => {
         const officeId = req.user?.officeId;
         const settings = await SettingsModel.findOne({ officeId })
         if (!settings) throw new AppError("Settings not found", 404)
         if (!settings.logo) throw new AppError("No logo to delete", 400)

         if (settings.logoPublicId) {
           await cloudinary.uploader.destroy(settings.logoPublicId)
           await decrementStorage(officeId as any, settings.logoSizeBytes || 0);
         }

         settings.logo        = undefined
         settings.logoPublicId = undefined
         settings.logoSizeBytes = 0
         await settings.save()

         return res.status(200).json({ message: "Logo deleted successfully" })
    }

  }


export default new SettingsService
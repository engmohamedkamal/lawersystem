import { NextFunction, Request, Response } from "express";
import SettingsModel from "../../DB/model/settings.model";
import { AppError } from "../../utils/classError";
import { UpdateMapType, UpdateWorkHoursType, UpsertSettingsType } from "./setting.validation";
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

    updateWorkHours = async (req: Request, res: Response, next: NextFunction) => {
      
          const { workHours }: UpdateWorkHoursType = req.body

          const allDays = workHours.flatMap(w => w.days)
          if (new Set(allDays).size !== allDays.length) {
            throw new AppError("duplicate days are not allowed", 400)
          }

          const existing = await SettingsModel.findOne()
          const existingDays = existing?.workHours.flatMap((w: { days: string[] }) => w.days) ?? []
          const newDays = workHours.flatMap(w => w.days)
          const hasDuplicate = newDays.some(d => existingDays.includes(d))
          if (hasDuplicate) throw new AppError("day already exists", 400)

          const settings = await SettingsModel.findOneAndUpdate(
            {},
            { $push: { workHours: { $each: workHours } } },
            { new: true, upsert: true }
          )
          return res.status(200).json({ message: "Work hours updated successfully", settings })
    }

    deleteWorkHour = async (req: Request, res: Response, next: NextFunction) =>{

      const settings = await SettingsModel.findOne()
      const { day } = req.params as { day: string }
      if (!settings) throw new AppError("Settings not configured yet", 404)

      const exists = settings.workHours.some((w: { days: string[] }) => w.days.includes(day))
      if (!exists) throw new AppError(`day "${day}" not found in work hours`, 404)

      
      const updatedWorkHours = (settings.workHours as Array<{ days: string[]; from: string; to: string }>)
        .map(w => ({
          from: w.from,
          to:   w.to,
          days: w.days.filter(d => d !== day),
        }))
        .filter(w => w.days.length > 0)

         const updated = await SettingsModel.findOneAndUpdate(
        {},
        { $set: { workHours: updatedWorkHours } },
        { new: true }
    )
        return res.status(200).json({ message: `Day "${day}" removed successfully`, settings: updated })
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


    UpdateMap = async (req: Request, res: Response, next: NextFunction) => {

      const { mapEmbedUrl } : UpdateMapType = req.body
      const settings = await SettingsModel.findOneAndUpdate(
        {},
        { $set: { mapEmbedUrl } },
        { new: true, upsert: true }
      )
      return res.status(200).json({ message: "Map updated successfully", settings })
    }


  }


export default new SettingsService
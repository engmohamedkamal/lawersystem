import { NextFunction, Request, Response } from "express";
import SettingsModel from "../../DB/model/settings.model";
import { AppError } from "../../utils/classError";


class SettingsService {

    getSettings = async (req: Request, res: Response, next: NextFunction) =>{

        const Settings = await SettingsModel.findOne()
        if(!Settings) throw new AppError("Settings not configured yet", 404)
        return res.status(200).json({ message: "success", Settings })

    }
} 

export default new SettingsService
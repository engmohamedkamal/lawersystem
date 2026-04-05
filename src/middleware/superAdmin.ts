import { NextFunction, Request, Response } from "express"
import { AppError } from "../utils/classError"
 
export const isSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    const superAdminId = process.env.SUPER_ADMIN_ID
 
    if (!superAdminId) {
        throw new AppError("super admin not configured", 500)
    }
 
    if (req.user?.id !== superAdminId) {
        throw new AppError("access denied — super admin only", 403)
    }
 
    next()
}
 
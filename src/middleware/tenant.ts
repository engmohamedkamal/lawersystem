import { NextFunction, Request, Response } from "express"
import OfficeModel from "../DB/model/SaaSModels/Office.model"
import { AppError } from "../utils/classError"

export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const officeId = (req.user as any)?.officeId

    if (!officeId) {
        return next()
    }

    const office = await OfficeModel.findById(officeId).select(
        "subscription isActive features name subdomain"
    )

    if (!office) {
        throw new AppError("لم يتم العثور على المكتب", 404)
    }

    if (!office.isActive) {
        throw new AppError("تم إيقاف هذا المكتب", 403)
    }

    if (!office.subscription?.status) {
        throw new AppError("بيانات الاشتراك غير صالحة", 500)
    }

    if (!office.subscription?.endDate) {
        throw new AppError("تاريخ انتهاء الاشتراك غير موجود", 500)
    }

    const now = new Date()

    if (office.subscription.endDate < now) {
        if (office.subscription.status === "active") {
            await OfficeModel.findByIdAndUpdate(officeId, {
                $set: {
                    "subscription.status": "expired",
                    isActive: false,
                },
            })
        }

        throw new AppError("انتهى اشتراكك — يرجى التجديد", 402)
    }

    if (office.subscription.status !== "active") {
        throw new AppError("الاشتراك غير نشط", 402)
    }

    ;(req as any).office = office

    next()
}
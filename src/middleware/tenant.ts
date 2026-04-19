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
        throw new AppError("تم إيقاف هذا المكتب إدارياً - يرجى التواصل مع الدعم", 403)
    }

    if (office.subscription?.status === "pending") {
        throw new AppError("حسابك بانتظار التفعيل، يرجى سداد الرسوم أو التواصل مع الإدارة", 402)
    }

    const now = new Date()
    const isExpired = office.subscription.endDate < now || office.subscription.status === "expired";

    if (isExpired) {
        if (office.subscription.status === "active") {
            await OfficeModel.findByIdAndUpdate(officeId, {
                $set: { "subscription.status": "expired" },
            })
            office.subscription.status = "expired";
        }

        if (req.method !== 'GET') {
            throw new AppError("انتهى اشتراكك — يرجى التجديد لتتمكن من إضافة أو تعديل البيانات", 402)
        }
    }

    if (office.subscription.status !== "active" && office.subscription.status !== "expired") {
        throw new AppError("الاشتراك غير مفعّل", 402)
    }

    ;(req as any).office = office

    next()
}
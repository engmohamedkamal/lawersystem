import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createPlanSchema = {
  body: z.object({
    name: z.string().min(2, "الاسم مطلوب ويجب ألا يقل عن حرفين"),
    slug: z.string().min(2, "الـ (slug) مطلوب ويجب ألا يقل عن حرفين"),
    description: z.string().optional(),
    monthlyPrice: z.number().min(0, "السعر الشهري يجب أن يكون أكبر من أو يساوي الصفر"),
    yearlyPrice: z.number().min(0, "السعر السنوي يجب أن يكون أكبر من أو يساوي الصفر"),
    features: z.array(z.any()).optional(),
    isPopular: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
};

export const updatePlanSchema = {
  params: z.object({
    planId: z.string().regex(objectIdRegex, "معرف الخطة غير صحيح"),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    slug: z.string().min(2).optional(),
    description: z.string().optional(),
    monthlyPrice: z.number().min(0).optional(),
    yearlyPrice: z.number().min(0).optional(),
    features: z.array(z.any()).optional(),
    isPopular: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "يجب إرسال حقل واحد على الأقل للتحديث",
  }),
};

export const planIdParamSchema = {
  params: z.object({
    planId: z.string().regex(objectIdRegex, "معرف الخطة غير صحيح"),
  }),
};



export const addFeatureSchema = {
  params: z.object({
    planId: z.string().regex(objectIdRegex, "معرف الخطة غير صحيح"),
  }),
  body: z.object({
    key: z.string().min(1, "المفتاح (key) مطلوب"),
    label: z.string().min(1, "العنوان (label) مطلوب"),
    valueType: z.string().min(1, "نوع القيمة مطلوب"),
    defaultValue: z.any(),
    unit: z.string().optional(),
    visible: z.boolean().optional(),
  }),
};

export const updateFeatureSchema = {
  params: z.object({
    planId: z.string().regex(objectIdRegex, "معرف الخطة غير صحيح"),
    key: z.string().min(1, "المفتاح (key) مطلوب"),
  }),
  body: z.object({
    label: z.string().optional(),
    valueType: z.string().optional(),
    defaultValue: z.any().optional(),
    unit: z.string().optional(),
    visible: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "يجب إرسال حقل واحد على الأقل للتحديث",
  }),
};

export const featureParamSchema = {
  params: z.object({
    planId: z.string().regex(objectIdRegex, "معرف الخطة غير صحيح"),
    key: z.string().min(1, "المفتاح (key) مطلوب"),
  }),
};



export const setPlanOfferSchema = {
  params: z.object({
    planId: z.string().regex(objectIdRegex, "معرف الخطة غير صحيح"),
  }),
  body: z.object({
    label: z.string().min(1, "العنوان (label) مطلوب"),
    discountPercent: z.number().min(0).max(100, "يجب أن تكون نسبة الخصم بين 0 و 100"),
    validUntil: z.coerce.date().refine((date) => date > new Date(), {
      message: "تاريخ الانتهاء يجب أن يكون في المستقبل",
    }).optional(),
    isActive: z.boolean().optional(),
  }),
};



export const createCouponSchema = {
  body: z.object({
    code: z.string().min(2, "كود الكوبون مطلوب ويجب ألا يقل عن حرفين"),
    type: z.enum(["percent", "fixed"]),
    value: z.number().positive("قيمة الكوبون يجب أن تكون أكبر من الصفر"),
    maxUses: z.number().int().min(-1).optional(),
    plans: z.array(z.string().regex(objectIdRegex, "معرف الخطة غير صحيح")).optional(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
  }).superRefine((data, ctx) => {
    if (data.type === "percent" && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "قيمة الخصم المئوي لا يمكن أن تتجاوز 100",
      });
    }
    if (data.validUntil <= data.validFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validUntil"],
        message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء",
      });
    }
  }),
};

export const couponIdParamSchema = {
  params: z.object({
    couponId: z.string().regex(objectIdRegex, "معرف الكوبون غير صحيح"),
  }),
};



export const officeIdParamSchema = {
  params: z.object({
    officeId: z.string().regex(objectIdRegex, "معرف المكتب غير صحيح"),
  }),
};

export const updateOfficeSubscriptionSchema = {
  params: z.object({
    officeId: z.string().regex(objectIdRegex, "معرف المكتب غير صحيح"),
  }),
  body: z.object({
    planSlug: z.string().optional(),
    status: z.enum(["active", "suspended", "expired", "cancelled"]).optional(),
    endDate: z.coerce.date().optional(),
    billingInterval: z.enum(["monthly", "yearly"]).optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "يجب إرسال تحديث واحد على الأقل",
  }),
};

export const updateOfficeFeaturesSchema = {
  params: z.object({
    officeId: z.string().regex(objectIdRegex, "معرف المكتب غير صحيح"),
  }),
  body: z.object({
    features: z.record(z.string(), z.any()),
  }),
};

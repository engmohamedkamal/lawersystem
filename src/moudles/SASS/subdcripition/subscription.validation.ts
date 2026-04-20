import { z } from "zod";
import { ARAB_PHONE_REGEX, ARAB_PHONE_ERROR_MSG } from "../../../utils/phoneValidation";

export const registerOfficeSchema = {
  body: z.object({
    subdomain: z
      .string()
      .min(3, "اسم النطاق الفرعي (subdomain) مطلوب ومسار يجب ألا يقل عن 3 أحرف")
      .max(63, "اسم النطاق الفرعي يجب ألا يتجاوز 63 حرفاً")
      .regex(/^[a-zA-Z0-9-]+$/, "اسم النطاق الفرعي يجب أن يحتوي على أحرف إنجليزية، أرقام، وشرطات (-) فقط"),
      
    email: z
      .string()
      .min(1, "البريد الإلكتروني مطلوب")
      .email("صيغة البريد الإلكتروني غير صحيحة"),
    
    password: z
      .string()
      .min(8, "كلمة المرور مطلوبة ويجب ألا تقل عن 8 أحرف")
      .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/, "كلمة المرور يجب أن تحتوي على الأقل على حرف كبير، حرف صغير، ورقم"),
    
    phone: z
      .string()
      .min(1, "رقم الهاتف مطلوب")
      .regex(ARAB_PHONE_REGEX, ARAB_PHONE_ERROR_MSG),
      
    UserName: z
      .string()
      .min(2, "اسم المستخدم مطلوب ويجب ألا يقل عن حرفين")
      .max(50, "اسم المستخدم يجب ألا يتجاوز 50 حرفاً"),
    
    officeName: z
      .string()
      .min(2, "اسم المكتب مطلوب ويجب ألا يقل عن حرفين")
      .max(100, "اسم المكتب يجب ألا يتجاوز 100 حرف"),
    
    planId: z
      .string()
      .min(1, "معرف الخطة مطلوب")
      .regex(/^[0-9a-fA-F]{24}$/, "صيغة معرف الخطة غير صحيحة"),
    
    billingInterval: z
      .enum(["monthly", "yearly"])
      .optional(),
    
    couponCode: z.string().optional(),
    
    saveCard: z.boolean().optional(),
    
    walletPhone: z
      .string()
      .regex(ARAB_PHONE_REGEX, ARAB_PHONE_ERROR_MSG)
      .optional(),
    
    paymentMethod: z
      .enum(["card", "wallet"])
      .optional(),
  }).refine((data) => {
    if (data.paymentMethod === "wallet") {
      return !!data.walletPhone;
    }
    return true;
  }, {
    message: "رقم المحفظة مطلوب عند اختيار الدفع بالمحافظ الإلكترونية",
    path: ["walletPhone"],
  }),
};



export type RegisterOfficeSchemaType = z.infer<typeof registerOfficeSchema.body>;

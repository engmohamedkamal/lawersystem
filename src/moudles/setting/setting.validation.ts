import z from "zod"

export const upsertSettingsSchema = {
  body: z.object({
    officeName: z.string().trim().min(2).max(100),
    crNumber: z.string().trim().optional(),
    officialEmail: z.string().trim().toLowerCase().email("invalid email format").optional(),
    phone: z.string().trim().optional(),
    addressDetail: z.string().trim().max(300).optional(),
    governorate: z.string().trim().optional(),
    country: z.string().trim().optional(),
  }),
}

export type UpsertSettingsType = z.infer<typeof upsertSettingsSchema.body>
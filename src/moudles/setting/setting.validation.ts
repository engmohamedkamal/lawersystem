import z from "zod"
import { DAYS } from "../../DB/model/settings.model"

export const upsertSettingsSchema = {
  body: z.object({
    officeName: z.string().trim().min(2).max(100),
    crNumber: z.string().trim().optional(),
    officialEmail: z.string().trim().toLowerCase().email("invalid email format").optional(),
    phone: z.string().trim().optional(),
    addressDetail: z.string().trim().max(300).optional(),
    governorate: z.string().trim().optional(),
    country: z.string().trim().optional(),
    mapEmbedUrl: z.string()
      .trim().url("invalid URL").refine((val) => val.startsWith("https://www.google.com/maps/embed"),{ message: "must be a valid Google Maps embed URL" }),
    
  }),
}


const workHourSchema = z.object({
  days: z.array(z.enum([...DAYS] as [string, ...string[]])).min(1, "at least one day required"),
  from: z.string().regex(/^\d{2}:\d{2}$/, "format must be HH:MM e.g. 09:00"),
  to:   z.string().regex(/^\d{2}:\d{2}$/, "format must be HH:MM e.g. 17:00"),
}).refine(data => data.from < data.to, {
  message: "to must be after from",
  path: ["to"]
})

export const deleteWorkHourSchema = {
  body: z.object({
    days: z.array(z.enum([...DAYS] as [string, ...string[]])).min(1, "at least one day required"),
  }),
}

export const updateWorkHoursSchema = {
  body: z.object({
    workHours: z.array(workHourSchema).min(1, "at least one entry required"),
  }),
}

export type UpsertSettingsType = z.infer<typeof upsertSettingsSchema.body>
export type UpdateWorkHoursType = z.infer<typeof updateWorkHoursSchema.body>

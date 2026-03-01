import z from "zod"
import { APPOINTMENT_STATUSES } from "../../DB/model/Appointment.model";




export const createAppointmentSchema = {
  body: z
    .object({
      fullName: z.string().trim().min(2).max(50),
      phone: z.string().trim().min(6),
      email: z.string().trim().toLowerCase().email("invalid email format").optional(),
      slot: z.string().min(1, "slot is required"),
      serviceType: z.string().trim().min(2).max(100),
      caseType: z.string().min(1, "caseType is required"),
      description: z.string().trim().max(2000).optional(),
    })
    .required(),
};


export const paramsSchema = {
    params: z.object({
        id: z.string().min(1),
    }),
}


export const updateStatusSchema = {
    params: z.object({
        id: z.string().min(1),
    }),
    body: z.object({
        status: z.enum(APPOINTMENT_STATUSES, {
            error: () => ({ message: `status must be one of: ${APPOINTMENT_STATUSES.join(", ")}` }),
        }),
    }),
}

export type bookSchemaType = z.infer<typeof createAppointmentSchema.body >
export type updateStatusType = z.infer<typeof updateStatusSchema.body >

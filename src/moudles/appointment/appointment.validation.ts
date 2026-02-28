import z from "zod"




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

export type bookSchemaType = z.infer<typeof createAppointmentSchema.body >

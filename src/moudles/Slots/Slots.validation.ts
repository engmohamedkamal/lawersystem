import z from "zod";

export const createSlotSchema = {
  body: z.object({
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  }).required().refine((data) => data.endAt > data.startAt, {
    message: "endAt must be after startAt",
    path: ["endAt"],
  }),
};

export const updateSlotSchema = {
  body: z.object({
    status: z.enum(["AVAILABLE", "BOOKED", "CANCELLED"]).optional(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
  }),
  params: z.object({
    id: z.string().min(1),
  }),
};

export const slotParamsSchema = {
  params: z.object({
    id: z.string().min(1),
  }),
};

export type CreateSlotType = z.infer<typeof createSlotSchema.body>;
export type UpdateSlotType = z.infer<typeof updateSlotSchema.body>;
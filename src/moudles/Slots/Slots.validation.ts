import z from "zod";

export const createSlotSchema = {
  body: z
    .object({
      assignedTo: z.string().min(1),
      startAt: z.string().datetime(),
      endAt: z.string().datetime(),
    })
    .required(),
};

export const availableSlotsSchema = {
  query: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
    })
    .required(),
};

export type createSlotSchemaType = z.infer<typeof createSlotSchema.body>;
export type availableSlotsSchemaType = z.infer<typeof availableSlotsSchema.query>;
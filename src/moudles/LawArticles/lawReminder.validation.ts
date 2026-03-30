import z from "zod";

export const uploadLawSchema = {
  body: z.object({
    title: z.string().trim().min(2).max(200),
    category: z.enum(["EGYPTIAN_LAW", "CONSTITUTION"]),
  }),
};

export const getLawArticlesSchema = {
  params: z.object({
    lawId: z.string().min(1, "lawId is required"),
  }),
};

export const getReminderSchema = {
  params: z.object({
    lawId: z.string().min(1, "lawId is required"),
  }),
};

export const deleteLawSchema = {
  params: z.object({
    lawId: z.string().min(1, "lawId is required"),
  }),
};

export const getAllLawsSchema = {
  query: z.object({
    category: z.enum(["EGYPTIAN_LAW", "CONSTITUTION"]).optional(),
    page: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : 1))
      .refine((v) => v > 0, "page must be > 0"),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : 10))
      .refine((v) => v > 0 && v <= 100, "limit must be between 1 and 100"),
  }),
};

export type uploadLawBodyType = z.infer<typeof uploadLawSchema.body>;
export type getLawArticlesParamsType = z.infer<typeof getLawArticlesSchema.params>;
export type getReminderParamsType = z.infer<typeof getReminderSchema.params>;
export type deleteLawParamsType = z.infer<typeof deleteLawSchema.params>;
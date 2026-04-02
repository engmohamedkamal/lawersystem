import z from "zod";

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

const sectionSchema = z.object({
  key:     z.string().trim().min(1),
  label:   z.string().trim().min(1),
  content: z.string().default(""),
  visible: z.boolean().default(true),
  order:   z.number().int().default(0),
});

const styleSchema = z.object({
  fontFamily:   z.string().trim().optional(),
  fontSize:     z.number().min(8).max(32).optional(),
  lineHeight:   z.number().min(1).max(4).optional(),
  textAlign:    z.enum(["right", "left", "center", "justify"]).optional(),
  marginTop:    z.number().min(0).max(200).optional(),
  marginBottom: z.number().min(0).max(200).optional(),
  marginLeft:   z.number().min(0).max(200).optional(),
  marginRight:  z.number().min(0).max(200).optional(),
}).optional();


export const createDocumentSchema = {
  body: z.object({
    templateId: z.string().min(1, "templateId is required"),
    title:      z.string().trim().min(2).max(300),
    type:       z.string().trim().min(1),
    status:     z.enum(["draft", "final"]).optional(),
    fields:     z.record(z.string(), z.string()).optional(),
    sections:   z.array(sectionSchema).optional(),
    style:      styleSchema,
  }),
};


export const updateDocumentSchema = {
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    title:    z.string().trim().min(2).max(300).optional(),
    status:   z.enum(["draft", "final"]).optional(),
    fields:   z.record(z.string(), z.string()).optional(),
    sections: z.array(sectionSchema).optional(),
    style:    styleSchema,
  }),
};


export const documentParamsSchema = {
  params: z.object({ id: z.string().min(1, "id is required") }),
};


export const templateParamsSchema = {
  params: z.object({ id: z.string().min(1, "id is required") }),
};


const templateFieldSchema = z.object({
  key:         z.string().trim().min(1),
  label:       z.string().trim().min(1),
  type:        z.enum(["text", "date", "textarea", "number"]).default("text"),
  required:    z.boolean().default(false),
  placeholder: z.string().trim().optional(),
});

const templateSectionSchema = z.object({
  key:         z.string().trim().min(1),
  label:       z.string().trim().min(1),
  placeholder: z.string().trim().optional(),
  order:       z.number().int().min(0).default(0),
});

export const createTemplateSchema = {
  body: z.object({
    name:            z.string().trim().min(2).max(200),
    type:            z.string().trim().min(1).max(100),
    description:     z.string().trim().optional(),
    defaultFields:   z.array(templateFieldSchema).optional(),
    defaultSections: z.array(templateSectionSchema).optional(),
    isActive:        z.boolean().optional(),
  }),
};

export const updateTemplateSchema = {
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name:            z.string().trim().min(2).max(200).optional(),
    type:            z.string().trim().min(1).max(100).optional(),
    description:     z.string().trim().optional(),
    defaultFields:   z.array(templateFieldSchema).optional(),
    defaultSections: z.array(templateSectionSchema).optional(),
    isActive:        z.boolean().optional(),
  }),
};

export type CreateTemplateBodyType = z.infer<typeof createTemplateSchema.body>;
export type UpdateTemplateBodyType = z.infer<typeof updateTemplateSchema.body>;


export const listDocumentsSchema = {
  query: z.object({
    status: z.enum(["draft", "final"]).optional(),
    type:   z.string().trim().optional(),
    page:   z.string().optional().transform((v) => (v ? Math.max(Number(v), 1) : 1)),
    limit:  z.string().optional().transform((v) => (v ? Math.min(Math.max(Number(v), 1), 100) : 20)),
  }),
};


export type CreateDocumentBodyType  = z.infer<typeof createDocumentSchema.body>;
export type UpdateDocumentBodyType  = z.infer<typeof updateDocumentSchema.body>;
export type DocumentParamsType      = z.infer<typeof documentParamsSchema.params>;
export type TemplateParamsType      = z.infer<typeof templateParamsSchema.params>;

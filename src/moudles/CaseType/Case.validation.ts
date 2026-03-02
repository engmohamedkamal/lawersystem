import z from "zod"

export const createCaseTypeSchema = {
    body: z.object({
        name: z.string().trim().min(2).max(50),
    }),
}

export const caseTypeParamsSchema = {
    params: z.object({
        id: z.string().min(1),
    }),
}



export type CreateCaseTypeType = z.infer<typeof createCaseTypeSchema.body>

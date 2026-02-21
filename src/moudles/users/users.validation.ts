import z from "zod"


export const addUsersByAdminSchema = {
    body : z.object({
    email: z
    .string()
    .trim()
    .toLowerCase()
    .email("invalid email format"),
    password : z.string().regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/),
    UserName : z.string().min(3).max(40).trim(),
    phone : z.string()
}).required()
}


export type addUsersByAdminSchemaType = z.infer<typeof addUsersByAdminSchema.body >
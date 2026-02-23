import z from "zod"


export const signupSchema = {
    body : z.object({
    email: z
    .string()
    .trim()
    .toLowerCase()
    .email("invalid email format"),
    password : z.string().regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/),
}).required()
}

export const signinSchema = {
    body : z.object({
    email: z
    .string()
    .trim()
    .toLowerCase()
    .email("invalid email format"),
    password : z.string(),
}).required()
}


export type signupSchemaType = z.infer<typeof signupSchema.body >
export type signinSchemaType = z.infer<typeof signinSchema.body >
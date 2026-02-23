import z from "zod"
import { Role } from "../../DB/model/user.model";


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

export const getUsersSchema = {
  query: z.object({
      role: z.nativeEnum(Role)!.optional(),
    })
    .required(),
};


export const getUserByIdSchema = {
  params: z
    .object({
      userId: z.string().min(1, "userId is required"),
    })
    .required(),
};



export type getUsersSchemaType = z.infer<typeof getUsersSchema.query>;
export type addUsersByAdminSchemaType = z.infer<typeof addUsersByAdminSchema.body >
export type getUserByIdParamsType = z.infer<typeof getUserByIdSchema.params>;
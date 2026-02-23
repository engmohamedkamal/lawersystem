import z, { object } from "zod"
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
    }).required(),
};


export const updateUserSchema = {
    params: z
    .object({
        userId: z.string().min(1, "userId is required"),
    }),
    body: z
    .object({
        email: z
    .string()
    .trim()
    .toLowerCase()
    .email("invalid email format")
    .optional(),
    password : z.string().regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/).optional(),
    UserName : z.string().min(3).max(40).trim().optional(),
    phone : z.string().optional()
    }).refine((data => Object.keys(data).length > 0) , {message : "send at least one filed to update"})
}

export const deleteUserSchema = {
  params: z
    .object({
      userId: z.string().min(1, "userId is required"),
    })
    .required(),
};

export const freezeUserSchema = {
  params: z.object({
    userId: z.string().min(1, "userId is required"),
  }).required(),
};

export const unfreezeUserSchema = {
  params: z.object({
    userId: z.string().min(1, "userId is required"),
  }).required(),
};


export type getUsersSchemaType = z.infer<typeof getUsersSchema.query>;
export type addUsersByAdminSchemaType = z.infer<typeof addUsersByAdminSchema.body >
export type getUserByIdParamsType = z.infer<typeof getUserByIdSchema.params>;
export type updateUserParamsType = z.infer<typeof updateUserSchema.params>;
export type updateUserBodyType = z.infer<typeof updateUserSchema.body>;
export type deleteUserParamsType = z.infer<typeof deleteUserSchema.params>;
export type freezeUserParamsType = z.infer<typeof freezeUserSchema.params>;
export type unfreezeUserParamsType = z.infer<typeof unfreezeUserSchema.params>;
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
    UserName : z.string().min(2).max(50).trim(),
    phone : z.string().regex(/^01[0125][0-9]{8}$/),
    department : z.string(),
    role : z.nativeEnum(Role)!,
    lawyerRegistrationNo : z.string().min(7).max(7),
    jobTitle : z.string(),
    salary: z.coerce.number().min(0),
    employmentDate: z.coerce.date().optional(),
    leavingDate: z.coerce.date().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.role === Role.LAWYER && !data.lawyerRegistrationNo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lawyerRegistrationNo"],
          message: "lawyerRegistrationNo is required for LAWYER role",
        })
      }

      if (data.role !== Role.LAWYER && data.lawyerRegistrationNo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lawyerRegistrationNo"],
          message: "lawyerRegistrationNo allowed only for LAWYER role",
        })
      }

      if (
       data.leavingDate &&
       data.employmentDate &&
       data.leavingDate < data.employmentDate
     ) {
       ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["leavingDate"],
         message: "leavingDate cannot be before employmentDate",
       })
     }
    }),
}

export const getUsersSchema = {
  query: z.object({
      role: z.nativeEnum(Role)!.optional(),
      includeDeleted: z.coerce.boolean().optional(),
      includeInactive: z.coerce.boolean().optional(),
    })
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
    phone : z.string().optional(),
    department: z.string().trim().min(2).optional(),
    role: z.nativeEnum(Role).optional(),
    lawyerRegistrationNo: z.string().min(7).max(7).optional(),
    jobTitle: z.string().trim().min(2).optional(),
    salary: z.number().min(0).optional(),
    employmentDate: z.coerce.date().optional(),
    leavingDate: z.coerce.date().nullable().optional(),
    isActiveEmployee: z.boolean().optional(),
    permissions: z.array(z.string()).optional(),
    })
    .refine(data => Object.keys(data).length > 0, {
      message: "send at least one field to update",
    }),
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
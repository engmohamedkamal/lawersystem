import { CLIENT_TYPES } from "../../DB/model/client.model";
import z from "zod";
import { ARAB_PHONE_REGEX, ARAB_PHONE_ERROR_MSG } from "../../utils/phoneValidation";



export const createClientSchema = {
    body: z.object({
        type:     z.enum([...CLIENT_TYPES] as [string, ...string[]]).optional(),
        fullName: z.string().trim().min(2).max(100),
        crNumber: z.string().trim().regex(/^\d{14}$/, "crNumber must be exactly 14 digits"),
        email:    z.string().trim().toLowerCase().email("invalid email").optional(),
        phone:    z.string().trim().regex(ARAB_PHONE_REGEX, ARAB_PHONE_ERROR_MSG),
        address:  z.string().trim().max(300).optional(),
        notes:    z.string().trim().max(1000).optional(),
    }),
}

export const updateClientSchema = {
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
        type:     z.enum([...CLIENT_TYPES] as [string, ...string[]]).optional(),
        fullName: z.string().trim().min(2).max(100).optional(),
        crNumber: z.string().trim().optional(),
        email:    z.string().trim().toLowerCase().email("invalid email").optional(),
        phone:    z.string().trim().regex(ARAB_PHONE_REGEX, ARAB_PHONE_ERROR_MSG).optional(),
        address:  z.string().trim().max(300).optional(),
        notes:    z.string().trim().max(1000).optional(),
    }),
}


export const clientParamsSchema = {
    params: z.object({ id: z.string().min(1) }),
}

export const deleteDocumentSchema = {
    params: z.object({ id: z.string().min(1) }),
    body:   z.object({ publicId: z.string().min(1) }),
}


export type CreateClientType = z.infer<typeof createClientSchema.body>
export type UpdateClientType = z.infer<typeof updateClientSchema.body>




import { CLIENT_TYPES } from "../../DB/model/client.model";
import z from "zod";



export const createClientSchema = {
    body: z.object({
        type:     z.enum([...CLIENT_TYPES] as [string, ...string[]]).optional(),
        fullName: z.string().trim().min(2).max(100),
        crNumber: z.string().trim(),
        email:    z.string().trim().toLowerCase().email("invalid email").optional(),
        phone:    z.string().trim().min(7),
        address:  z.string().trim().max(300).optional(),
        notes:    z.string().trim().max(1000).optional(),
    }),
}

export type CreateClientType = z.infer<typeof createClientSchema.body>

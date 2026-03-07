import z from "zod";
import { SESSION_STATUSES, SESSION_TYPES } from "../../DB/model/session.model";
import { CASE_PRIORITIES, CASE_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from "../../DB/model/LegalCase.model";

const feesSchema = z.object({
    totalAmount:   z.number().min(0).optional(),
    paidAmount:    z.number().min(0).optional(),
    paymentMethod: z.enum([...PAYMENT_METHODS]  as [string, ...string[]]).optional(),
    paymentStatus: z.enum([...PAYMENT_STATUSES] as [string, ...string[]]).optional(),
    notes:         z.string().trim().max(500).optional(),
})

const initialSessionSchema = z.object({
    type:          z.enum([...SESSION_TYPES]    as [string, ...string[]]).optional(),
    startAt:       z.coerce.date(),
    endAt:         z.coerce.date().optional(),
    status:        z.enum([...SESSION_STATUSES] as [string, ...string[]]).optional(),
    courtName:     z.string().trim().max(200).optional(),
    city:          z.string().trim().max(100).optional(),
    circuit:       z.string().trim().max(200).optional(),
    notes:         z.string().trim().max(4000).optional(),
    assignedTo:    z.string().optional(),
    nextSessionAt: z.coerce.date().optional(),
}).refine(data => !data.endAt || data.endAt > data.startAt, {
    message: "endAt must be after startAt",
    path: ["endAt"],
})


export const createCaseSchema = {
    body: z.object({
        caseNumber: z.string().trim().min(1),
        caseType: z.string().min(1, "caseType is required"),
        client: z.string().min(1, "client is required"),  
        status: z.enum([...CASE_STATUSES]   as [string, ...string[]]).optional(),
        priority: z.enum([...CASE_PRIORITIES] as [string, ...string[]]).optional(),
        openedAt: z.coerce.date(),
        closedAt: z.coerce.date().optional(),
        court: z.string().trim().max(200).optional(),
        city: z.string().trim().max(100).optional(),
        description: z.string().trim().max(4000).optional(),
        assignedTo: z.string().optional(),
        team: z.array(z.string()).optional(),
        fees: feesSchema.optional(),
        initialSession: initialSessionSchema.optional(),
    }),
}


export type CreateCaseType = z.infer<typeof createCaseSchema.body>

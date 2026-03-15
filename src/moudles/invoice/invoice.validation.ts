import z, { optional } from "zod";
import { INVOICE_STATUSES } from "../../DB/model/invoice.model";

const invoiceItemSchema = z.object({
    description: z.string().min(1),
    amount:      z.number().min(0).optional().default(0),
})

export const createInvoiceSchema = {
    body: z.object({
        items:         z.array(invoiceItemSchema).min(1, "at least one item required"),
        paidAmount:    z.number().min(0).default(0),
        discount:      z.number().min(0).max(100).default(0),
        tax:           z.number().min(0).max(100).default(0),
        isFromFees:    z.boolean().optional().default(true),
        paymentMethod: z.string().trim().optional(),
        dueDate:       z.string().optional(),
        notes:         z.string().trim().max(1000).optional(),
    }),
}

export const invoiceParamsSchema = {
    params: z.object({
        id: z.string().min(1),
    }),
}

export const caseInvoiceParamsSchema = {
    params: z.object({
        id:        z.string().min(1),
        invoiceId: z.string().min(1),
    }),
}

export const createStandaloneInvoiceSchema = {
    body: z.object({
        clientId:      z.string().min(1, "clientId required"),
        items:         z.array(invoiceItemSchema).optional().default([]),
        discount:      z.number().min(0).max(100).default(0),
        tax:           z.number().min(0).max(100).default(0),
        paidAmount:    z.number().min(0).default(0),
        paymentMethod: z.string().trim().optional(),
        dueDate:       z.string().optional(),
        notes:         z.string().trim().max(1000).optional(),
    }),
}

export const updateInvoiceSchema = z.object({params: z.object({
        invoiceId: z.string(), 
    }),
    body: z.object({
        items:         z.array(invoiceItemSchema).min(1).optional(),
        discount:      z.number().min(0).max(100).optional(),
        tax:           z.number().min(0).max(100).optional(),
        paymentMethod: z.string().trim().optional(),
        dueDate:       z.string().optional(),
        notes:         z.string().trim().max(1000).optional(),
        paidAmount:    z.number().min(0).optional(),
        status:        z.enum([...INVOICE_STATUSES] as [string, ...string[]]).optional(),
    }),
})

export type CreateStandaloneInvoiceType = z.infer<typeof createStandaloneInvoiceSchema.body>
export type CreateInvoiceType = z.infer<typeof createInvoiceSchema.body>
export type UpdateInvoiceType = z.infer<typeof updateInvoiceSchema.shape.body>
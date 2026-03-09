import z from "zod";

const invoiceItemSchema = z.object({
    description: z.string().trim().min(1, "description required"),
    amount:      z.number().min(0, "amount must be positive"),
})

export const createInvoiceSchema = {
    body: z.object({
        items:         z.array(invoiceItemSchema).min(1, "at least one item required"),
        discount:      z.number().min(0).max(100).default(0),
        tax:           z.number().min(0).max(100).default(0),
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



export type CreateInvoiceType = z.infer<typeof createInvoiceSchema.body>

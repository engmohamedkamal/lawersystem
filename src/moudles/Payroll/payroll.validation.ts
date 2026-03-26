import z from "zod"
import { AdvanceMode, PayrollTransactionType } from "../../DB/model/PayrollTransaction.model"

export const createPayrollTransactionSchema = {
  body: z
    .object({
      employee: z.string().min(1),
      type: z.nativeEnum(PayrollTransactionType),
      amount: z.number().positive(),
      note: z.string().trim().optional(),
      date: z.coerce.date(),
      advanceMode: z.nativeEnum(AdvanceMode).optional(),
      installmentMonths: z.number().int().min(2).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.type === PayrollTransactionType.ADVANCE) {
        if (!data.advanceMode) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["advanceMode"],
            message: "advanceMode is required for ADVANCE",
          })
        }

        if (data.advanceMode === AdvanceMode.INSTALLMENT && !data.installmentMonths) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["installmentMonths"],
            message: "installmentMonths is required for installment advance",
          })
        }

        if (data.advanceMode === AdvanceMode.ONE_TIME && data.installmentMonths) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["installmentMonths"],
            message: "installmentMonths not allowed for one time advance",
          })
        }
      } else {
        if (data.advanceMode || data.installmentMonths) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["advanceMode"],
            message: "advance fields allowed only for ADVANCE",
          })
        }
      }
    }),
}

export const getPayrollMonthlySchema = {
  query: z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().optional(),
  }),
}

export const getPayrollEmployeeSchema = {
  params: z.object({
    userId: z.string().min(1),
  }),
  query: z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000),
  }),
}

export const getPayrollEmployeeHistorySchema = {
  params: z.object({
    userId: z.string().min(1),
  }),
}

export const approvePayrollSchema = {
  body: z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000),
  }),
}

export const updatePayrollTransactionSchema = {
  params: z.object({
    transactionId: z.string().min(1),
  }),
  body: z
    .object({
      amount: z.number().positive().optional(),
      note: z.string().trim().optional(),
    })
    .refine(data => Object.keys(data).length > 0, {
      message: "send at least one field to update",
    }),
}

export const deletePayrollTransactionSchema = {
  params: z.object({
    transactionId: z.string().min(1),
  }),
}

export type createPayrollTransactionSchemaType = z.infer<typeof createPayrollTransactionSchema.body>
export type getPayrollMonthlySchemaType = z.infer<typeof getPayrollMonthlySchema.query>
export type getPayrollEmployeeSchemaType = z.infer<typeof getPayrollEmployeeSchema.query>
export type getPayrollEmployeeParamsType = z.infer<typeof getPayrollEmployeeSchema.params>
export type getPayrollEmployeeHistoryParamsType = z.infer<typeof getPayrollEmployeeHistorySchema.params>
export type approvePayrollSchemaType = z.infer<typeof approvePayrollSchema.body>
export type updatePayrollTransactionSchemaType = z.infer<typeof updatePayrollTransactionSchema.body>
export type updatePayrollTransactionParamsType = z.infer<typeof updatePayrollTransactionSchema.params>
export type deletePayrollTransactionParamsType = z.infer<typeof deletePayrollTransactionSchema.params>
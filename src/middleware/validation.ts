import { ZodType } from "zod"
import { Request, Response, NextFunction } from "express"
import { AppError } from "../utils/classError"

type ReqType = keyof Request
type schemaType = Partial<Record<ReqType, ZodType>>

export const validation = (schema: schemaType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validationErrors: { field: string; errors: ReturnType<any["flatten"]> }[] = []

    for (const key of Object.keys(schema) as ReqType[]) {
      if (!schema[key]) continue

      const result = schema[key]!.safeParse(req[key])
      if (!result.success) {
        validationErrors.push({
          field: String(key),
          errors: result.error.flatten().fieldErrors,
        })
      }
    }

    if (validationErrors.length) {
      return next(new AppError("Validation Error", 422, validationErrors))
    }

    next()
  }
}
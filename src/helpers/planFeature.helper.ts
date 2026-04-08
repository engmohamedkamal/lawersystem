import { AppError } from "../utils/classError"

//for get feature value
export const getFeatureValue = (office: any, key: string ) => {
    return office?.features?.[key]
}   

//for boolean features
export const assertFeatureEnabled = (
  office: any,
  key: string,
  message?: string
) => {
  const value = getFeatureValue(office, key)

  if (value !== true) {
    throw new AppError(message || "الميزة غير متاحة في خطتك الحالية", 403)
  }
}

 //for number features
export const assertFeatureLimitNotReached = (
  office: any,
  key: string,
  currentCount: number,
  message?: string
) => {
  const value = getFeatureValue(office, key)

  if (typeof value !== "number") {
    throw new AppError(`Feature '${key}' must be a number`, 500)
  }

  if (currentCount > value) {
    throw new AppError(message || "لقد وصلت للحد الأقصى في خطتك الحالية", 403)
  }
}
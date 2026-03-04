import { Request } from "express";

export const getClientIp = (req: Request): string => {
  const xff = req.headers["x-forwarded-for"];

  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0]!.trim();
  }

  return req.ip || "";
};
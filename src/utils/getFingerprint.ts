import crypto from "crypto";
import { Request } from "express";

export function getFingerprint(req: Request) {

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    req.ip ||
    "";

  const userAgent = req.headers["user-agent"] || "";
  const language = req.headers["accept-language"] || "";

  const raw = `${ip}-${userAgent}-${language}`;

  return crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex");
}
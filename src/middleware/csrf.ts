import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { AppError } from "../utils/classError";

export const csrfTokenGenerator = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token = req.cookies["csrf-token"];

  if (!token) {
    token = crypto.randomUUID();

    res.cookie("csrf-token", token, {
      httpOnly: false, 
      secure: true, // Must be true for sameSite: 'none'
      sameSite: "none", // Allows the cookie to be sent cross-origin (Frontend to API)
      maxAge: 1000 * 60 * 60 * 24, 
    });
  }

  (req as any).csrfToken = token;
  next();
};

export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies["csrf-token"];
  const headerToken = req.headers["x-csrf-token"];


  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(
      new AppError(
        "فشل التحقق من CSRF Token. تأكد من إرسال x-csrf-token في الـ headers.",
        403
      )
    );
  }

  next();
};
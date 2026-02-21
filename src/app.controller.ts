import { resolve } from "path";
import { config } from "dotenv";
config({ path: resolve("./config/.env") });

import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { AppError } from "./utils/classError";
import connectionDB from "./DB/connectionDb";
import authRouter from "./moudles/auth/auth.controller";
import userRouter from "./moudles/users/users.controller";
import slotsRouter from "./moudles/Slots/Slots.controller";

const app: express.Application = express();

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  ipv6Subnet: 56,
});

// middlewares
app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(helmet());
app.use(limiter);
app.use(cookieParser());

// routes
app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/slots", slotsRouter);

connectionDB();

app.get("/", (req: Request, res: Response) => {
  return res.status(200).json({ message: "welcome on my app" });
});

app.all("*", (req: Request, res: Response, next: NextFunction) => {
  return next(new AppError(`invalid url ${req.originalUrl}`, 404));
});

// error handler
app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
  return res
    .status((err.cause as unknown as number) || 500)
    .json({ message: err.message, stack: err.stack });
});

export default app;
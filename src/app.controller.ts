import {resolve} from "path"
import {config} from "dotenv"
config({path : resolve("./config/.env")})
import express, { Request , Response , NextFunction } from "express"
import rateLimit from "express-rate-limit"
import cors from "cors"
import helmet from "helmet"
import { AppError } from "./utils/classError"
import connectionDB from "./DB/connectionDb"
import authRouter from "./moudles/auth/auth.controller"
import userRouter from "./moudles/users/users.controller"
import cookieParser from "cookie-parser";
import slotsRouter from "./moudles/Slots/Slots.controller"



// ... نفس imports فوق

const app: express.Application = express();

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  ipv6Subnet: 56,
});

// ✅ شغّل الـ middlewares والroutes مرة واحدة (بدون function)
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

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/slots", slotsRouter);

// ✅ DB connect (هيتعمل لما function تشتغل)
connectionDB();

app.get("/", (req: Request, res: Response) => {
  return res.status(200).json({ message: "welcome on my app" });
});

app.get("{/*demo}",(req:Request,res:Response,next:NextFunction)=>{
        throw new AppError(`invalid url ${req.originalUrl}`,  404 )
    })

app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
  return res
    .status((err.cause as unknown as number) || 500)
    .json({ message: err.message, stack: err.stack });
});

export default app;












    app.get("{/*demo}",(req:Request,res:Response,next:NextFunction)=>{
        throw new AppError(`invalid url ${req.originalUrl}`,  404 )
    })
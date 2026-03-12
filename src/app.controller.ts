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
import appointmentRouter from "./moudles/appointment/appointment.controller"
import CaseTypeRouter from "./moudles/CaseType/Case.controller"
import SettingsRouter from "./moudles/setting/setting.controller"
import { startCronJobs } from "./jobs/scheduler"
import clientRouter from "./moudles/client/client.controller"
import invoiceRouter from "./moudles/invoice/invoice.controller"
import LegalCaseRouter from "./moudles/LegalِِCase/LegalCase.controller"



const app:express.Application = express()
const port = Number(process.env.PORT) || 5000;


const limiter = rateLimit({
	windowMs: 5 * 60 * 1000, 
	limit: 100,
	standardHeaders: 'draft-8', 
	legacyHeaders: false, 
	ipv6Subnet: 56,
})

const bootStrap = ()=>{
    app.use(express.json())
    app.use(cors({
     origin: true,
     credentials: true
    }))
    app.use(helmet())
    app.set("trust proxy" , 1)
    app.use(limiter)
    app.use(cookieParser());

    app.use("/auth",authRouter)
    app.use("/users" , userRouter)
    app.use("/slots", slotsRouter);
    app.use("/appointment", appointmentRouter);
    app.use("/CaseType", CaseTypeRouter);
    app.use("/SettingsService", SettingsRouter);
    app.use("/Client", clientRouter);
    app.use("/invoices", invoiceRouter)
    app.use("/LegalCase", LegalCaseRouter); 
    
    
    connectionDB()

    startCronJobs(); 

    app.get("/",(req:Request,res:Response,next:NextFunction)=>{
        return res.status(200).json({message:`welcome on my app`})
    })


    app.get("{/*demo}",(req:Request,res:Response,next:NextFunction)=>{
        throw new AppError(`invalid url ${req.originalUrl}`,  404 )
    })

    app.use((err:AppError,req:Request,res:Response,next:NextFunction)=>{
        return res.status(err.cause as unknown as number || 500).json({message:err.message , stack:err.stack})
    })

    app.listen(port,"0.0.0.0",()=>{
        console.log(`server is running on port ${port} `);
        
    })

}
 


export default bootStrap
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
import { csrfTokenGenerator, csrfProtection } from "./middleware/csrf";
import slotsRouter from "./moudles/Slots/Slots.controller"
import appointmentRouter from "./moudles/appointment/appointment.controller"
import CaseTypeRouter from "./moudles/CaseType/Case.controller"
import SettingsRouter from "./moudles/setting/setting.controller"
import { startCronJobs } from "./jobs/scheduler"
import clientRouter from "./moudles/client/client.controller"
import invoiceRouter from "./moudles/invoice/invoice.controller"
import LegalCaseRouter from "./moudles/LegalِِCase/LegalCase.controller"
import { initSocket } from "./utils/socket"
import { createServer } from "http"
import taskRouter from "./moudles/task/task.controller"
import DashboardRouter from "./moudles/Dashboard/Dashboard.controller"
import archiveRouter from "./moudles/Archive/Archive.controller"
import sessionRouter from "./moudles/Session/session.controller"
import CalendarRouter from "./moudles/Calendar/Calendar.controller"
import PayrollRouter from "./moudles/Payroll/Payroll.controller"
import lawReminderRouter from "./moudles/LawArticles/lawReminder.controller"
import legalDocumentRouter from "./moudles/LegalDocument/LegalDocument.controller"
import { seedDocumentTemplates } from "./seeds/documentTemplates.seed"
import superAdminRouter from "./moudles/SASS/SuperAdmin/SuperAdmin.controller"
import saasRouter from "./moudles/SASS/subdcripition/subdcripition.controller"
import mySubscriptionRouter from "./moudles/SASS/Mysubscriptio/MySubscription.controller"


const app:express.Application = express()

const httpServer = createServer(app)
export { httpServer }

const port = Number(process.env.PORT) || 5000;


const limiter = rateLimit({
	windowMs: 5 * 60 * 1000, 
	limit: 100,
	standardHeaders: 'draft-8', 
	legacyHeaders: false, 
	ipv6Subnet: 56,
})

const bootStrap = ()=>{
    app.use(express.json({limit:"50mb"}))
    app.use(express.urlencoded({limit:"50mb",extended:true}))
    app.set("trust proxy" , 1)
    app.use(cors({
     origin: true,
     credentials: true
    }))
    app.use(helmet())
    app.use(limiter)
    app.use(cookieParser());
    
    // app.use(csrfTokenGenerator);

    // app.get("/csrf-token", (req: Request, res: Response) => {
    //   res.status(200).json({
    //     message: "success",
    //     csrfToken: (req as any).csrfToken,
    //   });
    // });

    // app.use((req: Request, res: Response, next: NextFunction) => {
    //   const excludedPaths = ["/auth/signin", "/auth/signup", "/csrf-token"];

    //   if (excludedPaths.includes(req.path)) {
    //     return next();
    //   }

    //   return csrfProtection(req, res, next);
    // });

    app.use("/auth",authRouter);
    app.use("/users" , userRouter);
    app.use("/slots", slotsRouter);
    app.use("/appointment", appointmentRouter);
    app.use("/CaseType", CaseTypeRouter);
    app.use("/SettingsService", SettingsRouter);
    app.use("/Client", clientRouter);
    app.use("/invoices", invoiceRouter);
    app.use("/LegalCase", LegalCaseRouter); 
    app.use("/task", taskRouter);
    app.use("/Dashboard", DashboardRouter); 
    app.use("/Archive", archiveRouter); 
    app.use("/session", sessionRouter); 
    app.use("/calendar" , CalendarRouter)
    app.use("/payroll", PayrollRouter)
    app.use("/lawReminder", lawReminderRouter)
    app.use("/legalDocuments", legalDocumentRouter)

    //sass
    app.use("/super-admin",superAdminRouter)
    app.use("/subscription" ,saasRouter)
    app.use("/my-subscription" ,mySubscriptionRouter)

    
    
    connectionDB()

    startCronJobs(); 

    seedDocumentTemplates().catch((e) => console.error("[SEED ERROR]", e))

    initSocket(httpServer)

    app.get("/",(req:Request,res:Response,next:NextFunction)=>{
        return res.status(200).json({message:`welcome on my app`})
    })


    app.get("{/*demo}",(req:Request,res:Response,next:NextFunction)=>{
        throw new AppError(`invalid url ${req.originalUrl}`,  404 )
    })

    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
        res.status(err.statusCode || 500).json({
            status: "error",
            message: err.message,
            ...(err.details && { details: err.details })
        })
    })

    httpServer.listen(port,"0.0.0.0",()=>{
        console.log(`server is running on port ${port} `);
        
    })

}
 


export default bootStrap
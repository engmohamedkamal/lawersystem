import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";
import { validation } from "../../middleware/validation";
import * as AV from "./appointment.validation";
import AS from "./appointment.service";
import { TokenType } from "../../utils/token";
import { Role } from "../../DB/model/user.model";

const bookingLimiter = rateLimit({
        windowMs : 5 * 60 * 100,
        max : 1,
        message : {
            message : "too many booking attempts please try again later ."
        },
        standardHeaders : true,
        legacyHeaders : true,
    })

    const appointmentRouter = Router()

    appointmentRouter.post(
      "/BOOKED",
      bookingLimiter,
      validation(AV.createAppointmentSchema),
      AS.createAppointment
    );

    appointmentRouter.get(
      "/",
      authentication(TokenType.access),
      authorization(Role.ADMIN, Role.STAFF),
      AS.getAppointments
    );

    appointmentRouter.get(
      "/:id",
      authentication(TokenType.access),
      authorization(Role.ADMIN, Role.STAFF),
      validation(AV.paramsSchema),
      AS.getAppointmentById
    );

    appointmentRouter.patch(
      "/:id/cancel",
      authentication(TokenType.access),
      authorization(Role.ADMIN, Role.STAFF),
      validation(AV.paramsSchema),
      AS.cancelAppointment
   );

   appointmentRouter.patch(
      "/:id/status",
      authentication(TokenType.access),
      authorization(Role.ADMIN, Role.STAFF),
      validation(AV.updateStatusSchema),
      AS.updateAppointmentStatus
  );

    export default appointmentRouter
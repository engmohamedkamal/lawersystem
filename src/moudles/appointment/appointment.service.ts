import { NextFunction, Request, Response } from "express";
import AvailabilitySlotModel from "../../DB/model/AvailabilitySlot.model";
import { AppError } from "../../utils/classError";
import mongoose from "mongoose";
import AppointmentModel from "../../DB/model/Appointment.model";
import { bookSchemaType } from "./appointment.validation";


class AppointmentService {
    constructor(){}

    createAppointment = async (req: Request, res: Response, next: NextFunction) => {
        const {fullName, phone, email, slot: slotId, serviceType, caseType, description} : bookSchemaType = req.body

        const slot = await AvailabilitySlotModel.findById(slotId)
        if(!slot) throw new AppError("slot not found" , 404)
        if(slot.status !== "AVAILABLE") throw new AppError("slot is not available ",409)

        const expireAt = slot.endAt
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const appointment = await AppointmentModel.create(
                [{
                    fullName,
                    phone,
                    email,
                    slot: slotId,
                    serviceType,
                    caseType,
                    description,
                    expireAt,          
                    status: "CONFIRMED",
                }],
                { session }
            );

            await AvailabilitySlotModel.findByIdAndUpdate(
                slotId,
                { status: "BOOKED", appointment: appointment[0]._id },
                { session }
            );

            await session.commitTransaction();
            session.endSession();

            return res.status(201).json({
                message: "Appointment booked successfully",
                appointment: appointment[0],
            });
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
}

export default new AppointmentService
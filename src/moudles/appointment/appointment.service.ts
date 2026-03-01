import { NextFunction, Request, Response } from "express";
import AvailabilitySlotModel from "../../DB/model/AvailabilitySlot.model";
import { AppError } from "../../utils/classError";
import mongoose from "mongoose";
import AppointmentModel from "../../DB/model/Appointment.model";
import { bookSchemaType, updateStatusType } from "./appointment.validation";


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
                    status : "CONFIRMED",
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


    getAppointments = async (req: Request, res: Response, next: NextFunction) => {
        const { status, serviceType, caseType, handledBy, page = "1", limit = "10" } = req.query

        const filter: Record<string, any> = {}
        if (status)      filter.status      = status
        if (serviceType) filter.serviceType = serviceType
        if (caseType)    filter.caseType    = caseType
        if (handledBy)   filter.handledBy   = handledBy

        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
        const skip     = (pageNum - 1) * limitNum

        const [appointments, total] = await Promise.all([
            AppointmentModel.find(filter)
                .populate("slot",      "startAt endAt status")
                .populate("caseType",  "name")
                .populate("handledBy", "UserName email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            AppointmentModel.countDocuments(filter),
        ])

        return res.status(200).json({
            message:    "success",
            total,
            page:       pageNum,
            totalPages: Math.ceil(total / limitNum),
            appointments,
        })
    }

    getAppointmentById  = async (req: Request, res: Response, next: NextFunction) => {

        const { id } = req.params

        const appointment = await AppointmentModel.findById(id)
            .populate("slot",      "startAt endAt status")
            .populate("caseType",  "name")
            .populate("handledBy", "UserName email")

        if(!appointment) throw new AppError ("appointment not found" , 404 )

        return res.status(200).json({message : "success" , appointment })
    }

    cancelAppointment = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        const appointment = await AppointmentModel.findById(id)
        if(!appointment) throw new AppError ("appointment not found" , 404 )
        if (appointment.status === "CANCELLED")  throw new AppError("appointment is already cancelled", 400)
        if (appointment.status === "COMPLETED")  throw new AppError("cannot cancel a completed appointment", 400)

        const session = await mongoose.startSession()
        session.startTransaction()

        try {
            await AvailabilitySlotModel.findByIdAndUpdate(
                appointment.slot,
                { status: "AVAILABLE", $unset: { appointment: 1 } },
                { session }
            )

            await AppointmentModel.findByIdAndUpdate(
                id,
                { status: "CANCELLED", $unset: { expireAt: 1 } },
                { session }
            )

            await AppointmentModel.findByIdAndDelete(id, { session })

            await session.commitTransaction()
            session.endSession()

            return res.status(200).json({ message: "Appointment cancelled successfully" })
        } catch (error) {
            await session.abortTransaction()
            session.endSession()
            throw error
        }
    }

    updateAppointmentStatus = async (req: Request, res: Response, next: NextFunction) => {
        const { id }               = req.params
        const { status }: updateStatusType = req.body

        const appointment = await AppointmentModel.findById(id)
        if (!appointment) throw new AppError("appointment not found", 404)
        if (appointment.status === "COMPLETED") throw new AppError("appointment is already completed", 400)

        const updated = await AppointmentModel.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        ).populate("slot",      "startAt endAt status")
         .populate("caseType",  "name")
         .populate("handledBy", "UserName email")

        return res.status(200).json({ message: "Status updated successfully", appointment: updated })
    }
}

export default new AppointmentService
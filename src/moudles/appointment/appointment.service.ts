import { NextFunction, Request, Response } from "express";
import AvailabilitySlotModel from "../../DB/model/AvailabilitySlot.model";
import { AppError } from "../../utils/classError";
import mongoose from "mongoose";
import AppointmentModel from "../../DB/model/Appointment.model";
import { bookSchemaType, updateStatusType } from "./appointment.validation";
import { getFingerprint } from "../../utils/getFingerprint";
import { assertFeatureEnabled } from "../../helpers/planFeature.helper";
import { PLAN_FEATURES } from "../SASS/constants/planFeatures";
import OfficeModel from "../../DB/model/SaaSModels/Office.model";


class AppointmentService {
    constructor(){}

    createAppointment = async (req: Request, res: Response, next: NextFunction) => {
        const {fullName, phone, email, slot: slotId , caseType : caseTypeId , description} : bookSchemaType = req.body

        const session = await mongoose.startSession();
        session.startTransaction();

        try {


            const slot = await AvailabilitySlotModel.findOneAndUpdate(
            { _id: slotId, status: "AVAILABLE" },
            { $set: { status: "BOOKED" } },
            { session, returnDocument: "after" }
            );

            if (!slot) throw new AppError("slot is not available", 409);

            if (new Date(slot.endAt).getTime() <= Date.now()) {
              throw new AppError("slot already ended", 400);
            }

            const expireAt = slot.endAt;


            const fingerprint = getFingerprint(req , phone);

            const DAY = 24 * 60 * 60 * 1000;

            const existing = await AppointmentModel.findOne({
            fingerprint,
            createdAt: { $gte: new Date(Date.now() - DAY) }
            });

            if (existing) {
            throw new AppError("يمكنك الحجز مرة واحدة فقط كل 24 ساعة",429);
            }


            const appointment = await AppointmentModel.create(
                [{
                    fullName,
                    phone,
                    email,
                    slot: slotId,
                    caseType: caseTypeId,
                    description,
                    expireAt,          
                    status : "CONFIRMED",
                    fingerprint
                }],
                { session }
            );

            await AvailabilitySlotModel.updateOne(
                { _id: slotId },
                { $set: { appointment: appointment[0]._id } },
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

        const officeId = req.user?.officeId;
        const office = await OfficeModel.findById(officeId);
        if (!office) throw new AppError("office not found", 404);

        assertFeatureEnabled(office, PLAN_FEATURES.APPOINTMENTS_ENABLED)

        const filter: Record<string, any> = { officeId: req.user?.officeId }
        if (status)      filter.status      = status
        if (serviceType) filter.serviceType = serviceType
        if (caseType)    filter.caseType    = caseType
        if (handledBy)   filter.handledBy   = handledBy

        const now = new Date()
        const startOfYear = new Date(now.getFullYear(), 0, 1)
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
        const skip     = (pageNum - 1) * limitNum

        const [appointments, total , thisYear, thisMonth, confirmed, cancelled] = await Promise.all([
            AppointmentModel.find(filter)
                .populate("slot",      "startAt endAt status")
                .populate("caseType",  "name")
                .populate("handledBy", "UserName email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            AppointmentModel.countDocuments(filter),
            AppointmentModel.countDocuments({ officeId: req.user?.officeId, createdAt: { $gte: startOfYear } }),
            AppointmentModel.countDocuments({ officeId: req.user?.officeId, createdAt: { $gte: startOfMonth } }),
            AppointmentModel.countDocuments({ officeId: req.user?.officeId, status: "CONFIRMED" }),
            AppointmentModel.countDocuments({ officeId: req.user?.officeId, status: "CANCELLED" }),
        ])

        return res.status(200).json({
            message: "success",
            stats: {
            thisYear,
            thisMonth,
            confirmed,
            cancelled,
            },
            total,
            page:       pageNum,
            totalPages: Math.ceil(total / limitNum),
            appointments,
        })
    }

    getAppointmentById  = async (req: Request, res: Response, next: NextFunction) => {

        const { id } = req.params

        const appointment = await AppointmentModel.findOne({ _id: id, officeId: req.user?.officeId })
            .populate("slot",      "startAt endAt status")
            .populate("caseType",  "name")
            .populate("handledBy", "UserName email")

        if(!appointment) throw new AppError ("appointment not found" , 404 )

        return res.status(200).json({message : "success" , appointment })
    }

    cancelAppointment = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        const appointment = await AppointmentModel.findOne({ _id: id, officeId: req.user?.officeId })
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

        const appointment = await AppointmentModel.findOne({ _id: id, officeId: req.user?.officeId })
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
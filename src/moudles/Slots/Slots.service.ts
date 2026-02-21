import { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/classError";
import AvailabilitySlotModel from "../../DB/model/AvailabilitySlot.model";
import { createSlotSchemaType } from "./Slots.validation";

class slotsService {
  create = async (req: Request, res: Response, next: NextFunction) => {
    const { assignedTo, startAt, endAt } : createSlotSchemaType= req.body;

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (!(start < end)) throw new AppError("endAt must be after startAt", 400);
    if (start.getTime() < Date.now()) throw new AppError("Cannot create slot in the past", 400);

    const slot = await AvailabilitySlotModel.create({
      assignedTo,
      startAt: start,
      endAt: end,
      status: "AVAILABLE",
      createdBy: req.user?._id
    });

    return res.status(201).json({ message: "done, slot created", slot });
  };

  available = async (req: Request, res: Response, next: NextFunction) => {
    const { date } = req.query as any;

    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const slots = await AvailabilitySlotModel.find({
      status: "AVAILABLE",
      startAt: { $gte: start, $lte: end },
    })
      .sort({ startAt: 1 })
      .select("_id startAt endAt assignedTo");

    return res.status(200).json({ message: "done", slots });
  };
}

export default new slotsService();
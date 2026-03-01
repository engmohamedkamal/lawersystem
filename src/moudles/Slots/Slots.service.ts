import { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/classError";
import AvailabilitySlotModel from "../../DB/model/AvailabilitySlot.model";
import UserModel from "../../DB/model/user.model";

class SlotService {
  constructor() {}

  
  createSlot = async (req: Request, res: Response, next: NextFunction) => {
    const {  startAt, endAt } = req.body;

    const start = new Date(startAt)
    const end = new Date(endAt)

    if(start.getTime() < Date.now()){
      throw new AppError ("cannot create slot in the past" , 400)
    }

    if (end.getTime() <= start.getTime()) {
      throw new AppError("endAt must be after startAt", 400);
    }
    
  
    const existing = await AvailabilitySlotModel.findOne({
      startAt,
      endAt,
    });

    if (existing) {
      throw new AppError("Slot already exists for this time range", 409);
    }

    const slot = new AvailabilitySlotModel({
      startAt,
      endAt,
      createdBy: req.user?.id,
    });

    await slot.save();
    return res.status(201).json({ message: "Slot created successfully", slot });
  };

  
  getSlots = async (req: Request, res: Response, next: NextFunction) => {
    const { status, page = 1, limit = 10 } = req.query;

    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [slots, total] = await Promise.all([
      AvailabilitySlotModel.find(filter)
        .populate("appointment")
        .populate("createdBy", "UserName email")
        .sort({ startAt: 1 })
        .skip(skip)
        .limit(Number(limit)),
      AvailabilitySlotModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: "success",
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      slots,
    });
  };


  getSlotById = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const slot = await AvailabilitySlotModel.findById(id)
      .populate("appointment")
      .populate("createdBy", "UserName email")

    if (!slot) throw new AppError("Slot not found", 404);

    return res.status(200).json({ message: "success", slot });
  };

  updateSlot = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, startAt, endAt } = req.body;

    const slot = await AvailabilitySlotModel.findById(id);
    if (!slot) throw new AppError("Slot not found", 404);

    if (slot.status === "BOOKED") {
      throw new AppError("Cannot update a booked slot", 400);
    }

    const newStart = startAt ? new Date(startAt) : new Date(slot.startAt);
    const newEnd = endAt ? new Date(endAt) : new Date(slot.endAt);

    if (startAt && newStart.getTime() < Date.now()) {
      throw new AppError("cannot update slot to the past", 400);
    }

    if (newEnd.getTime() <= newStart.getTime()) {
      throw new AppError("endAt must be after startAt", 400);
    }

    if (status) slot.status = status;
    if (startAt) slot.startAt = startAt;
    if (endAt) slot.endAt = endAt;

    await slot.save();
    return res.status(200).json({ message: "Slot updated successfully", slot });
  };

  deleteSlot = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const slot = await AvailabilitySlotModel.findById(id);
    if (!slot) throw new AppError("Slot not found", 404);

    if (slot.status === "BOOKED") {
      throw new AppError("Cannot delete a booked slot", 400);
    }

    await slot.deleteOne();
    return res.status(200).json({ message: "Slot deleted successfully" });
  };
}

export default new SlotService();
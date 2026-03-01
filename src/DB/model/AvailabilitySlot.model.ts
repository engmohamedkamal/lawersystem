import mongoose, { Types } from "mongoose";

export interface IAvailabilitySlot extends mongoose.Document {
  _id: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  status: "AVAILABLE" | "BOOKED" | "CANCELLED";
  appointment?: Types.ObjectId;
  createdBy?: Types.ObjectId;
}
const AvailabilitySlotSchema = new mongoose.Schema<IAvailabilitySlot>(
  {
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["AVAILABLE", "BOOKED", "CANCELLED"],
      default: "AVAILABLE",
      required: true,
    },
    appointment: { type: Types.ObjectId, ref: "Appointment" },
    createdBy: { type: Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

AvailabilitySlotSchema.index({ startAt: 1, endAt: 1 },);
const AvailabilitySlotModel = mongoose.models.AvailabilitySlot || mongoose.model<IAvailabilitySlot>("AvailabilitySlot", AvailabilitySlotSchema);

export default AvailabilitySlotModel;
import mongoose, { Types } from "mongoose";

export interface IAvailabilitySlot extends mongoose.Document {
  _id: Types.ObjectId;
  assignedTo: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  status: "AVAILABLE" | "BOOKED" | "CANCELLED";
  bookedBy?: Types.ObjectId;
  appointment?: Types.ObjectId;
  createdBy?: Types.ObjectId;
}
const AvailabilitySlotSchema = new mongoose.Schema<IAvailabilitySlot>(
  {
    assignedTo: { type: Types.ObjectId, ref: "User", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["AVAILABLE", "BOOKED", "CANCELLED"],
      default: "AVAILABLE",
      required: true,
    },
    bookedBy: { type: Types.ObjectId, ref: "Client" },
    appointment: { type: Types.ObjectId, ref: "Appointment" },
    createdBy: { type: Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

AvailabilitySlotSchema.index(
  { assignedTo: 1, startAt: 1, endAt: 1 },
  { unique: true }
);
AvailabilitySlotSchema.index({ status: 1, startAt: 1 });
AvailabilitySlotSchema.index({ assignedTo: 1, status: 1, startAt: 1 });
const AvailabilitySlotModel = mongoose.models.AvailabilitySlot || mongoose.model<IAvailabilitySlot>("AvailabilitySlot", AvailabilitySlotSchema);

export default AvailabilitySlotModel;
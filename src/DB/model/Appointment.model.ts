import mongoose, { Types } from "mongoose";

export interface IAppointment extends mongoose.Document {
  _id: Types.ObjectId;
  client: Types.ObjectId;
  slot: Types.ObjectId;
  serviceType: string;
  caseType: Types.ObjectId;
  description?: string;
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED";
  handledBy?: Types.ObjectId;
}

const AppointmentSchema = new mongoose.Schema<IAppointment>(
  {
    client: { type: Types.ObjectId, ref: "Client", required: true },
    slot: { type: Types.ObjectId, ref: "AvailabilitySlot", required: true, unique: true },
    serviceType: { type: String, required: true, trim: true, minLength: 2, maxLength: 100 },
    caseType: { type: Types.ObjectId, ref: "CaseType", required: true },
    description: { type: String, trim: true, maxLength: 2000 },
    handledBy: { type: Types.ObjectId, ref: "User" },
  },
  {timestamps: true, toObject: { virtuals: true }, toJSON: { virtuals: true } }
);

const AppointmentModel = mongoose.models.Appointment || mongoose.model<IAppointment>("Appointment", AppointmentSchema);

export default AppointmentModel;

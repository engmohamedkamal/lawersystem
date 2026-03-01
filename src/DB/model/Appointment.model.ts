import mongoose, { Types } from "mongoose";


export const APPOINTMENT_STATUSES = ["CONFIRMED", "CANCELLED", "COMPLETED"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface IAppointment extends mongoose.Document {
  _id: Types.ObjectId;
  fullName : string,
  phone : string,
  email : string,
  slot: Types.ObjectId;
  serviceType: string;
  caseType?: string;
  description?: string;
  expireAt?: Date,
  status: AppointmentStatus,
  handledBy?: Types.ObjectId;
}

const AppointmentSchema = new mongoose.Schema<IAppointment>(
  {
    fullName : {type : String , required : true , minLength : 2 , maxLength : 50 ,trim : true},
    phone : {type : String , required : true},
    email : {type : String , trim : true},
    slot: { type: Types.ObjectId, ref: "AvailabilitySlot", required: true, unique: true },
    serviceType: { type: String, required: true, trim: true, minLength: 2, maxLength: 100 , options : true },
    caseType: { type: String, required: true },
    expireAt: { type : Date},
    status : { type : String , enum : APPOINTMENT_STATUSES , default : "CONFIRMED", required : true  },
    description: { type: String, trim: true, maxLength: 2000 },
    handledBy: { type: Types.ObjectId, ref: "User" },

  },
  {timestamps: true, toObject: { virtuals: true }, toJSON: { virtuals: true } }
);


const AppointmentModel = mongoose.models.Appointment || mongoose.model<IAppointment>("Appointment", AppointmentSchema);

export default AppointmentModel;

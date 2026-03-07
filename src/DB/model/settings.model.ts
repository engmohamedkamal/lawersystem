import mongoose, { Types } from "mongoose";



export const DAYS = ["الجمعة","الخميس","الأربعاء","الثلاثاء","الاثنين","الأحد", "السبت"] as const;
export type DayType = (typeof DAYS)[number];

export interface IWorkHour {
  days: DayType[];
  from: string; 
  to:   string; 
}

export interface ISettings extends mongoose.Document {
  _id: Types.ObjectId;
  officeName: string;
  crNumber?: string;
  officialEmail?: string;
  phone?: string;
  addressDetail?: string;
  governorate?: string;
  country?: string;
  logo?: string;
  logoPublicId?: string; 
  workHours: IWorkHour[];
  mapEmbedUrl?: string
}


const WorkHourSchema = new mongoose.Schema<IWorkHour>(
  {
    days: { type: [String], enum: DAYS, required: true },
    from: { type: String, required: true },
    to:   { type: String, required: true },
  },
  { _id: false }
);

const SettingsSchema = new mongoose.Schema<ISettings>(
  {
    officeName: { type: String, required: true, trim: true, minLength: 2, maxLength: 100 },
    crNumber: { type: String, trim: true },
    officialEmail: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    addressDetail: { type: String, trim: true, maxLength: 300 },
    governorate: { type: String, trim: true },
    country: { type: String, trim: true, default: "مصر" },
    logo: { type: String },
    logoPublicId: { type: String },
    workHours: { type: [WorkHourSchema], default: [] },
    mapEmbedUrl: { type: String , trim: true}
  },
  { timestamps: true }
);

const SettingsModel = mongoose.models.Settings || mongoose.model<ISettings>("Settings", SettingsSchema);


export default SettingsModel;
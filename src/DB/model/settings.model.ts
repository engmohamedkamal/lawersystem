import mongoose, { Types } from "mongoose";

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
}

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
  },
  { timestamps: true }
);

const SettingsModel = mongoose.models.Settings || mongoose.model<ISettings>("Settings", SettingsSchema);

export default SettingsModel;
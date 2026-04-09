import mongoose, { Types } from "mongoose"

export enum PayrollMonthStatus {
  DRAFT = "DRAFT",
  APPROVED = "APPROVED",
}

export interface IPayrollMonth extends mongoose.Document {
  _id: Types.ObjectId
  officeId: Types.ObjectId
  month: number
  year: number
  status: PayrollMonthStatus
  approvedBy?: Types.ObjectId
  approvedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const PayrollMonthSchema = new mongoose.Schema<IPayrollMonth>(
  {
    officeId: { type: Types.ObjectId, ref: "Office", required: false },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
    },
    status: {
      type: String,
      enum: Object.values(PayrollMonthStatus),
      default: PayrollMonthStatus.DRAFT,
    },
    approvedBy: {
      type: Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

PayrollMonthSchema.index({ month: 1, year: 1, officeId: 1 }, { unique: true })

const PayrollMonthModel = mongoose.models.PayrollMonth || mongoose.model<IPayrollMonth>("PayrollMonth", PayrollMonthSchema)

export default PayrollMonthModel
import mongoose, { Types } from "mongoose"

export enum PayrollTransactionType {
  BONUS = "BONUS",
  DEDUCTION = "DEDUCTION",
  ADVANCE = "ADVANCE",
}

export enum AdvanceMode {
  ONE_TIME = "ONE_TIME",
  INSTALLMENT = "INSTALLMENT",
}

export interface IPayrollTransaction extends mongoose.Document {
  _id: Types.ObjectId
  employee: Types.ObjectId
  type: PayrollTransactionType
  amount: number
  note?: string
  date: Date
  month: number
  year: number
  advanceMode?: AdvanceMode
  installmentMonths?: number
  createdBy: Types.ObjectId
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

const PayrollTransactionSchema = new mongoose.Schema<IPayrollTransaction>(
  {
    employee: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(PayrollTransactionType),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    note: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
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
    advanceMode: {
      type: String,
      enum: Object.values(AdvanceMode),
    },
    installmentMonths: {
      type: Number,
      min: 2,
    },
    createdBy: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

PayrollTransactionSchema.index({ employee: 1, month: 1, year: 1 })
PayrollTransactionSchema.index({ type: 1, month: 1, year: 1 })

const PayrollTransactionModel =
  mongoose.models.PayrollTransaction ||
  mongoose.model<IPayrollTransaction>("PayrollTransaction", PayrollTransactionSchema)

export default PayrollTransactionModel
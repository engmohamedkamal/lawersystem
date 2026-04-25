import { NextFunction, Request, Response } from "express"
import UserModel, { Role } from "../../DB/model/user.model"
import PayrollTransactionModel, {AdvanceMode,PayrollTransactionType,} from "../../DB/model/PayrollTransaction.model"
import PayrollMonthModel, { PayrollMonthStatus } from "../../DB/model/PayrollMonth.model"
import { AppError } from "../../utils/classError"
import {approvePayrollSchemaType,createPayrollTransactionSchemaType,deletePayrollTransactionParamsType,getPayrollEmployeeHistoryParamsType,getPayrollEmployeeParamsType,getPayrollEmployeeSchemaType,getPayrollMonthlySchemaType,updatePayrollTransactionParamsType,updatePayrollTransactionSchemaType,} from "./payroll.validation"
import { sendNotification } from "../task/notification.service"
import { assertFeatureEnabled } from "../../helpers/planFeature.helper"
import { PLAN_FEATURES } from "../SASS/constants/planFeatures"
import OfficeModel from "../../DB/model/SaaSModels/Office.model"

class PayrollService {
    
  private async ensureMonthEditable(officeId: any, month: number, year: number) {
    const payrollMonth = await PayrollMonthModel.findOne({ officeId, month, year })
    if (payrollMonth?.status === PayrollMonthStatus.APPROVED) {
      throw new AppError("payroll month already approved and cannot be edited", 400)
    }
  }

  private monthRange(month: number, year: number) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
    const end = new Date(year, month, 0, 23, 59, 59, 999)
    return { start, end }
  }

  private monthDiff(startMonth: number, startYear: number, targetMonth: number, targetYear: number) {
    return (targetYear - startYear) * 12 + (targetMonth - startMonth)
  }

  private calculateAdvanceDueForMonth(transactions: any[], month: number, year: number) {
    let total = 0

    for (const trx of transactions) {
      if (trx.type !== PayrollTransactionType.ADVANCE) continue

      if (trx.advanceMode === AdvanceMode.ONE_TIME) {
        if (trx.month === month && trx.year === year) {
          total += trx.amount
        }
        continue
      }

      if (trx.advanceMode === AdvanceMode.INSTALLMENT) {
        const diff = this.monthDiff(trx.month, trx.year, month, year)
        if (diff >= 0 && diff < trx.installmentMonths) {
          total += trx.amount / trx.installmentMonths
        }
      }
    }

    return total
  }

  private async buildEmployeePayroll(user: any, month: number, year: number , monthTransactions? : any[]) {
    const transactions = await PayrollTransactionModel.find({
      employee: user._id,
      isDeleted: false,
      $or: [
        { type: { $in: [PayrollTransactionType.BONUS, PayrollTransactionType.DEDUCTION] }, month, year },
        { type: PayrollTransactionType.ADVANCE },
      ],
    }).lean()

    const bonuses = transactions
      .filter(t => t.type === PayrollTransactionType.BONUS && t.month === month && t.year === year)
      .reduce((sum, t) => sum + t.amount, 0)

    const deductions = transactions
      .filter(t => t.type === PayrollTransactionType.DEDUCTION && t.month === month && t.year === year)
      .reduce((sum, t) => sum + t.amount, 0)

    const advances = this.calculateAdvanceDueForMonth(transactions, month, year)

    const netSalary = user.salary + bonuses - deductions - advances

    return {
      employee: {
        _id: user._id,
        UserName: user.UserName,
        email: user.email,
        phone: user.phone,
        jobTitle: user.jobTitle,
        department: user.department,
        role: user.role,
        employmentDate: user.employmentDate,
        leavingDate: user.leavingDate,
        isActiveEmployee: user.isActiveEmployee,
      },
      basicSalary: user.salary,
      bonuses,
      deductions,
      advances,
      netSalary,
      transactions,
    }
  }

  private employeeBelongsToMonth(user: any, month: number, year: number) {
    if (user.role === Role.ADMIN) return false

    const { start, end } = this.monthRange(month, year)
    const employmentDate = new Date(user.employmentDate)
    const leavingDate = user.leavingDate ? new Date(user.leavingDate) : null

    return employmentDate <= end && (!leavingDate || leavingDate >= start)
  }

  createTransaction = async (req: Request, res: Response, next: NextFunction) => {
    const body: createPayrollTransactionSchemaType = req.body

    const officeId = req.user?.officeId;
    const office = await OfficeModel.findById(officeId);
    if (!office) throw new AppError("office not found", 404);

    assertFeatureEnabled(office, PLAN_FEATURES.PAROLE_ENABLED)

    const date = body.date ? new Date(body.date) : new Date()
    let month = date.getMonth() + 1
    let year = date.getFullYear()

    let isApproved = true;
    while (isApproved) {
      const payrollMonth = await PayrollMonthModel.findOne({ officeId, month, year })
      if (payrollMonth?.status === PayrollMonthStatus.APPROVED) {
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      } else {
        isApproved = false;
      }
    }

    const employee = await UserModel.findOne({ _id: body.employee, officeId: req.user?.officeId })
    if (!employee) throw new AppError("employee not found", 404)
    if (employee.role === Role.ADMIN) throw new AppError("admin is excluded from payroll", 400)

    const transaction = await PayrollTransactionModel.create({
      employee: body.employee,
      type: body.type,
      amount: body.amount,
      note: body.note,
      date,
      month,
      year,
      advanceMode: body.advanceMode,
      installmentMonths: body.installmentMonths,
      createdBy: req.user?._id,
      officeId: req.user?.officeId,
    })

    const typeTranslations: Record<string, string> = {
      [PayrollTransactionType.BONUS]: "مكافأة",
      [PayrollTransactionType.DEDUCTION]: "خصم",
      [PayrollTransactionType.ADVANCE]: "سلفة"
    }
    const typeAr = typeTranslations[body.type] || "معاملة";

    await sendNotification({
        userId: body.employee,
        type: "payroll_transaction",
        title: "إضافة مالية جديدة",
        body: `تم تسجيل ${typeAr} بقيمة ${body.amount} ضمن معاملاتك في شهر ${month}/${year}.`,
        amount: body.amount,
        month,
        year
    })

    return res.status(201).json({
      message: "transaction created successfully",
      transaction,
    })
  }

  getMonthlyPayroll = async (req: Request, res: Response, next: NextFunction) => {
        const { page = 1, limit = 20, search } = req.query as unknown as getPayrollMonthlySchemaType
        const month = Number(req.query.month)
        const year  = Number(req.query.year)
 
        const users = await UserModel.find({ role: { $ne: Role.ADMIN }, officeId: req.user?.officeId })
            .select("UserName email phone role jobTitle department salary employmentDate leavingDate isActiveEmployee")
            .lean()
 
        let filtered = users.filter(user => this.employeeBelongsToMonth(user, month, year))
 
        if (search) {
            const s = search.toLowerCase()
            filtered = filtered.filter(u =>
                u.UserName?.toLowerCase().includes(s) ||
                u.email?.toLowerCase().includes(s) ||
                u.jobTitle?.toLowerCase().includes(s)
            )
        }
 
        const total = filtered.length
        const skip = (page - 1) * limit
        const pageUsers = filtered.slice(skip, skip + limit)
 
        const items = await Promise.all(pageUsers.map(user => this.buildEmployeePayroll(user, month, year)))
 
        const summary = items.reduce(
            (acc, item) => {
                acc.totalBasic += item.basicSalary
                acc.totalBonuses  += item.bonuses
                acc.totalDeductions += item.deductions
                acc.totalAdvances += item.advances
                acc.totalNet += item.netSalary
                return acc
            },
            { totalBasic: 0, totalBonuses: 0, totalDeductions: 0, totalAdvances: 0, totalNet: 0 }
        )
 
        const approval = await PayrollMonthModel.findOne({ officeId: req.user?.officeId, month, year }).lean()
 
        return res.status(200).json({
            message: "success",
            month,
            year,
            approvalStatus: approval?.status ?? PayrollMonthStatus.DRAFT,
            summary,
            page,
            total,
            totalPages: Math.ceil(total / limit),
            items,
        })
    }

  getEmployeePayroll = async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params as unknown as getPayrollEmployeeParamsType
    const month = Number(req.query.month)
    const year  = Number(req.query.year)

    const user = await UserModel.findOne({ _id: userId, officeId: req.user?.officeId })
      .select("UserName email phone role jobTitle department salary employmentDate leavingDate isActiveEmployee").lean()

    if (!user) throw new AppError("employee not found", 404)
    if (user.role === Role.ADMIN) throw new AppError("admin is excluded from payroll", 400)

    const payroll = await this.buildEmployeePayroll(user, month, year )

    return res.status(200).json({
      message: "success",
      month,
      year,
      payroll,
    })
  }

  getEmployeePayrollHistory = async (req: Request, res: Response, next: NextFunction) => {
        const { userId } = req.params as unknown as getPayrollEmployeeHistoryParamsType
 
        const user = await UserModel.findOne({ _id: userId, officeId: req.user?.officeId })
            .select("UserName email phone role jobTitle department salary employmentDate leavingDate isActiveEmployee")
            .lean()
 
        if (!user) throw new AppError("employee not found", 404)
        if (user.role === Role.ADMIN) throw new AppError("admin is excluded from payroll", 400)
 
        const allTransactions = await PayrollTransactionModel.find({
            employee:  userId,
            isDeleted: false,
        }).lean()
 
        const startDate = new Date(user.employmentDate)
        const endDate   = user.leavingDate ? new Date(user.leavingDate) : new Date()
 
        const result: any[] = []
        let currentYear  = startDate.getFullYear()
        let currentMonth = startDate.getMonth() + 1
 
        while (
            currentYear < endDate.getFullYear() ||
            (currentYear === endDate.getFullYear() && currentMonth <= endDate.getMonth() + 1)
        ) {
            const monthTransactions = allTransactions.filter(t => {
                if (t.type === PayrollTransactionType.ADVANCE) return true
                return t.month === currentMonth && t.year === currentYear
            })
 
            const payroll = await this.buildEmployeePayroll(user, currentMonth, currentYear, monthTransactions)
 
            result.push({
                month:       currentMonth,
                year:        currentYear,
                basicSalary: payroll.basicSalary,
                bonuses:     payroll.bonuses,
                deductions:  payroll.deductions,
                advances:    payroll.advances,
                netSalary:   payroll.netSalary,
            })
 
            currentMonth++
            if (currentMonth > 12) { currentMonth = 1; currentYear++ }
        }
 
        return res.status(200).json({ message: "success", employee: user, history: result })
    }

  approveMonth = async (req: Request, res: Response, next: NextFunction) => {
    const { month, year } = req.body as approvePayrollSchemaType

    const exists = await PayrollMonthModel.findOne({ officeId: req.user?.officeId, month, year })
    if (exists?.status === PayrollMonthStatus.APPROVED) {
      throw new AppError("payroll month already approved", 400)
    }

    const approved = await PayrollMonthModel.findOneAndUpdate(
      { officeId: req.user?.officeId, month, year },
      {
        $set: {
          status: PayrollMonthStatus.APPROVED,
          approvedBy: req.user?._id,
          approvedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    )

    const users = await UserModel.find({ role: { $ne: Role.ADMIN }, officeId: req.user?.officeId })
      .select("UserName email phone role jobTitle department salary employmentDate leavingDate isActiveEmployee")
      .lean()
      
    const filtered = users.filter(user => this.employeeBelongsToMonth(user, month, year))
    
    for (const user of filtered) {
        await sendNotification({
            userId: user._id.toString(),
            type: "payroll_approved",
            title: "اعتماد الرواتب",
            body: `تم اعتماد رواتب شهر ${month} لعام ${year}، يمكنك مراجعة كشف راتبك الآن.`,
            month,
            year
        })
    }

    return res.status(200).json({
      message: "payroll month approved successfully",
      approved,
    })
  }

  updateTransaction = async (req: Request, res: Response, next: NextFunction) => {
    const { transactionId } = req.params as unknown as updatePayrollTransactionParamsType
    const body = req.body as updatePayrollTransactionSchemaType

    const transaction = await PayrollTransactionModel.findById(transactionId)
    if (!transaction || transaction.isDeleted) throw new AppError("transaction not found", 404)

    await this.ensureMonthEditable(req.user?.officeId, transaction.month, transaction.year)

    if (body.amount !== undefined) transaction.amount = body.amount
    if (body.note !== undefined) transaction.note = body.note

    await transaction.save()

    return res.status(200).json({
      message: "transaction updated successfully",
      transaction,
    })
  }

  deleteTransaction = async (req: Request, res: Response, next: NextFunction) => {
    const { transactionId } = req.params as unknown as deletePayrollTransactionParamsType

    const transaction = await PayrollTransactionModel.findById(transactionId)
    if (!transaction || transaction.isDeleted) throw new AppError("transaction not found", 404)

    await this.ensureMonthEditable(req.user?.officeId, transaction.month, transaction.year)

    transaction.isDeleted = true
    await transaction.save()

    return res.status(200).json({
      message: "transaction deleted successfully",
    })
  }

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    const month = Number(req.query.month)
    const year = Number(req.query.year)

    if (!month || !year) {
      throw new AppError("month and year are required", 400)
    }

    const users = await UserModel.find({
      role: { $ne: Role.ADMIN },
      officeId: req.user?.officeId,
    })
      .select("UserName email phone role jobTitle department salary employmentDate leavingDate isActiveEmployee")
      .lean()

    const filtered = users.filter(user => this.employeeBelongsToMonth(user, month, year))
    const payrollItems = await Promise.all(filtered.map(user => this.buildEmployeePayroll(user, month, year)))

    const stats = payrollItems.reduce(
      (acc, item) => {
        acc.employeeCount += 1
        acc.totalPayroll += item.netSalary
        acc.totalBasic += item.basicSalary || 0
        acc.totalDeductions += item.deductions || 0
        acc.totalBonuses += item.bonuses || 0
        acc.totalAdvances += item.advances || 0
        acc.totalNet += item.netSalary || 0
        return acc
      },
      {
        employeeCount: 0,
        totalPayroll: 0,
        totalBasic: 0,
        totalDeductions: 0,
        totalBonuses: 0,
        totalAdvances: 0,
        totalNet: 0,
      }
    )

    return res.status(200).json({
      message: "success",
      month,
      year,
      stats,
    })
  }
}

export default new PayrollService()
import { NextFunction, Request, Response } from "express"
import AvailabilitySlotModel from "../../DB/model/AvailabilitySlot.model"
import SessionModel from "../../DB/model/session.model"
import { Role } from "../../DB/model/user.model"
import InvoiceModel from "../../DB/model/invoice.model"
import TaskModel from "../../DB/model/tasks.model"
import { assertFeatureEnabled } from "../../helpers/planFeature.helper"
import { PLAN_FEATURES } from "../SASS/constants/planFeatures"

const TZ_OFFSET_MS = 2 * 60 * 60 * 1000

const getKey = (date: Date): string => {
  const local = new Date(date.getTime() + TZ_OFFSET_MS)
  const y = local.getUTCFullYear()
  const m = String(local.getUTCMonth() + 1).padStart(2, "0")
  const d = String(local.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const VALID_TYPES = ["sessions", "tasks", "invoices", "appointments"] as const
type CalendarType = (typeof VALID_TYPES)[number]

interface IPreviewItem {
  type: CalendarType
  id: string
  title: string
  time?: string
  status: string
}

interface IDayEntry {
  counts: {
    sessions: number
    tasks: number
    invoices: number
    appointments: number
  }
  preview: IPreviewItem[]
  hasMore: boolean
  previewLimitApplied: number
}

const resolveTypes = (raw: string | string[] | undefined): CalendarType[] | null => {
  if (!raw) return [...VALID_TYPES]

  const arr = Array.isArray(raw) ? raw : [raw]
  const parsed = arr.flatMap(t => t.split(",").map(s => s.trim())).filter(Boolean)
  const valid = parsed.filter(t => VALID_TYPES.includes(t as CalendarType)) as CalendarType[]

  if (parsed.length && valid.length === 0) return null
  return valid.length ? valid : [...VALID_TYPES]
}

const validateDate = (str: string): Date | null => {
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

const lawyerFilter = (userId: string) => ({
  $or: [{ assignedTo: userId }, { team: userId }],
})

class CalendarService {
  constructor() {}

getStats = async (req: Request, res: Response, next: NextFunction) => {
    assertFeatureEnabled((req as any).office, PLAN_FEATURES.CALENDER_ENABLED)

    const now = new Date()
    const role = req.user?.role
    const userId = req.user?.id
    const isLawyer = role === Role.LAWYER

    const weekStart = new Date(now)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    weekEnd.setHours(23, 59, 59, 999)

    const [overdueInvoices, upcomingAppointments, sessionsThisWeek] = await Promise.all([
      InvoiceModel.countDocuments({
        isDeleted: false,
        officeId: req.user?.officeId,
        status: { $nin: ["مدفوعة", "ملغية"] },
        dueDate: { $lt: now },
        remaining: { $gt: 0 },
      }),

      AvailabilitySlotModel.countDocuments({
        status: "BOOKED",
        officeId: req.user?.officeId,
        startAt: { $gte: now },
        appointment: { $exists: true, $ne: null },
      }),

      SessionModel.countDocuments({
        isDeleted: false,
        officeId: req.user?.officeId,
        status: "مجدولة",
        startAt: { $gte: weekStart, $lte: weekEnd },
        ...(isLawyer && lawyerFilter(userId!)),
      }),
    ])

    return res.status(200).json({
      message: "success",
      stats: { overdueInvoices, upcomingAppointments, sessionsThisWeek },
    })
  }

getRange = async (req: Request, res: Response, next: NextFunction) => {
    const { startDate, endDate, search, previewLimit = "3" } = req.query
    const role = req.user?.role
    const userId = req.user?.id
    const isLawyer = role === Role.LAWYER

    const types = resolveTypes(req.query.type as string | string[] | undefined)
    if (!types) {
      return res.status(400).json({ message: "invalid type value" })
    }

    if (typeof startDate !== "string" || typeof endDate !== "string") {
      return res.status(400).json({ message: "startDate and endDate are required" })
    }

    const start = validateDate(startDate)
    const end = validateDate(endDate)

    if (!start || !end) {
      return res.status(400).json({ message: "invalid startDate or endDate format" })
    }

    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    const limit = Math.min(Math.max(Number(previewLimit) || 3, 1), 10)
    const s = typeof search === "string" ? search : undefined

    const [sessions, tasks, invoices, appointments] = await Promise.all([
      types.includes("sessions")
        ? SessionModel.find({
            isDeleted: false,
            officeId: req.user?.officeId,
            startAt: { $gte: start, $lte: end },
            ...(isLawyer && lawyerFilter(userId!)),
            ...(s && {
              $or: [
                { courtName: { $regex: s, $options: "i" } },
                { city: { $regex: s, $options: "i" } },
              ],
            }),
          })
            .select("startAt status courtName city legalCase assignedTo team")
            .populate({
              path: "legalCase",
              select: "caseNumber",
              populate: { path: "client", select: "fullName" },
            })
            .populate("assignedTo", "UserName")
            .lean()
        : [],

      types.includes("tasks")
        ? TaskModel.find({
            isDeleted: false,
            officeId: req.user?.officeId,
            dueDate: { $gte: start, $lte: end },
            ...(isLawyer && { assignedTo: userId }),
            ...(s && { title: { $regex: s, $options: "i" } }),
          })
            .select("title dueDate status priority client")
            .populate("client", "fullName")
            .lean()
        : [],

      types.includes("invoices")
        ? InvoiceModel.find({
            isDeleted: false,
            officeId: req.user?.officeId,
            status: { $nin: ["مدفوعة", "ملغية"] },
            dueDate: { $gte: start, $lte: end },
            remaining: { $gt: 0 },
            ...(s && {
              $or: [
                { invoiceNumber: { $regex: s, $options: "i" } },
                { notes: { $regex: s, $options: "i" } },
              ],
            }),
          })
            .select("invoiceNumber dueDate remaining status client")
            .populate("client", "fullName")
            .lean()
        : [],

      types.includes("appointments")
        ? AvailabilitySlotModel.find({
            status: "BOOKED",
            officeId: req.user?.officeId,
            startAt: { $gte: start, $lte: end },
            appointment: { $exists: true, $ne: null },
          })
            .select("startAt endAt status appointment createdBy")
            .populate({
              path: "appointment",
              select: "fullName phone email status caseType handledBy description slot",
              populate: [
                { path: "caseType", select: "name" },
                { path: "handledBy", select: "UserName email" },
              ],
            })
            .populate("createdBy", "UserName email")
            .lean()
        : [],
    ])

    const dayMap: Record<string, IDayEntry> = {}

    const initDay = (key: string) => {
      if (!dayMap[key]) {
        dayMap[key] = {
          counts: { sessions: 0, tasks: 0, invoices: 0, appointments: 0 },
          preview: [],
          hasMore: false,
          previewLimitApplied: limit,
        }
      }
    }

    const addPreview = (key: string, item: IPreviewItem) => {
      const day = dayMap[key]!
      if (day.preview.length < limit) {
        day.preview.push(item)
      } else {
        day.hasMore = true
      }
    }

    sessions.forEach((session: any) => {
      if (!session.startAt) return

      const key = getKey(new Date(session.startAt))
      initDay(key)
      dayMap[key]!.counts.sessions++

      addPreview(key, {
        type: "sessions",
        id: session._id.toString(),
        title: `جلسة — ${(session.legalCase as any)?.caseNumber ?? ""}`,
        time: new Date(session.startAt).toLocaleTimeString("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: session.status,
      })
    })

    tasks.forEach((task: any) => {
      if (!task.dueDate) return

      const key = getKey(new Date(task.dueDate))
      initDay(key)
      dayMap[key]!.counts.tasks++

      addPreview(key, {
        type: "tasks",
        id: task._id.toString(),
        title: task.title,
        status: task.status,
      })
    })

    invoices.forEach((invoice: any) => {
      if (!invoice.dueDate) return

      const key = getKey(new Date(invoice.dueDate))
      initDay(key)
      dayMap[key]!.counts.invoices++

      addPreview(key, {
        type: "invoices",
        id: invoice._id.toString(),
        title: `فاتورة ${invoice.invoiceNumber} — ${(invoice.client as any)?.fullName ?? ""}`,
        status: invoice.status,
      })
    })

    appointments.forEach((slot: any) => {
      if (!slot.startAt) return

      const key = getKey(new Date(slot.startAt))
      initDay(key)
      dayMap[key]!.counts.appointments++

      addPreview(key, {
        type: "appointments",
        id: slot._id.toString(),
        title: `موعد — ${(slot.appointment as any)?.fullName ?? ""}`,
        time: new Date(slot.startAt).toLocaleTimeString("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: (slot.appointment as any)?.status ?? slot.status,
      })
    })

    Object.values(dayMap).forEach(day => {
      day.preview.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
    })

    const totalCounts = Object.values(dayMap).reduce(
      (acc, day) => ({
        sessions: acc.sessions + day.counts.sessions,
        tasks: acc.tasks + day.counts.tasks,
        invoices: acc.invoices + day.counts.invoices,
        appointments: acc.appointments + day.counts.appointments,
      }),
      { sessions: 0, tasks: 0, invoices: 0, appointments: 0 }
    )

    return res.status(200).json({
      message: "success",
      range: { startDate, endDate },
      types,
      summary: totalCounts,
      days: dayMap,
    })
  }

getDay = async (req: Request, res: Response, next: NextFunction) => {
    const { date } = req.params as { date: string }
    const { search } = req.query
    const role = req.user?.role
    const userId = req.user?.id
    const isLawyer = role === Role.LAWYER

    const types = resolveTypes(req.query.type as string | string[] | undefined)
    if (!types) {
      return res.status(400).json({ message: "invalid type value" })
    }

    const parsedDate = validateDate(date)
    if (!parsedDate) {
      return res.status(400).json({ message: "invalid date format" })
    }

    const dayStart = new Date(parsedDate)
    dayStart.setHours(0, 0, 0, 0)

    const dayEnd = new Date(parsedDate)
    dayEnd.setHours(23, 59, 59, 999)

    const s = typeof search === "string" ? search : undefined

    const [sessions, tasks, invoices, appointments] = await Promise.all([
      types.includes("sessions")
        ? SessionModel.find({
            isDeleted: false,
            officeId: req.user?.officeId,
            startAt: { $gte: dayStart, $lte: dayEnd },
            ...(isLawyer && lawyerFilter(userId!)),
            ...(s && {
              $or: [
                { courtName: { $regex: s, $options: "i" } },
                { city: { $regex: s, $options: "i" } },
              ],
            }),
          })
            .populate("legalCase", "caseNumber status client")
            .populate("assignedTo", "UserName email")
            .populate("team", "UserName email")
            .sort({ startAt: 1 })
            .lean()
        : [],

      types.includes("tasks")
        ? TaskModel.find({
            isDeleted: false,
            officeId: req.user?.officeId,
            dueDate: { $gte: dayStart, $lte: dayEnd },
            ...(isLawyer && { assignedTo: userId }),
            ...(s && { title: { $regex: s, $options: "i" } }),
          })
            .populate("assignedTo", "UserName email")
            .populate("client", "fullName phone")
            .sort({ priority: 1 })
            .lean()
        : [],

      types.includes("invoices")
        ? InvoiceModel.find({
            isDeleted: false,
            officeId: req.user?.officeId,
            status: { $nin: ["مدفوعة", "ملغية"] },
            dueDate: { $gte: dayStart, $lte: dayEnd },
            remaining: { $gt: 0 },
            ...(s && {
              $or: [
                { invoiceNumber: { $regex: s, $options: "i" } },
                { notes: { $regex: s, $options: "i" } },
              ],
            }),
          })
            .populate("client", "fullName phone")
            .populate("legalCase", "caseNumber")
            .sort({ dueDate: 1 })
            .lean()
        : [],

      types.includes("appointments")
        ? AvailabilitySlotModel.find({
            status: "BOOKED",
            officeId: req.user?.officeId,
            startAt: { $gte: dayStart, $lte: dayEnd },
            appointment: { $exists: true, $ne: null },
          })
            .populate({
              path: "appointment",
              select: "fullName phone email status caseType handledBy description slot",
              populate: [
                { path: "caseType", select: "name" },
                { path: "handledBy", select: "UserName email" },
              ],
            })
            .populate("createdBy", "UserName email")
            .sort({ startAt: 1 })
            .lean()
        : [],
    ])

    return res.status(200).json({
      message: "success",
      date,
      types,
      summary: {
        sessions: sessions.length,
        tasks: tasks.length,
        invoices: invoices.length,
        appointments: appointments.length,
      },
      sessions,
      tasks,
      invoices,
      appointments,
    })
  }
}

export default new CalendarService()
import { NextFunction, Request, Response } from "express";
import LegalCaseModel from "../../DB/model/LegalCase.model";
import { AppError } from "../../utils/classError";
import ClientModel from "../../DB/model/client.model";
import { CreateClientType } from "./client.validation";
import * as ExcelJS from "exceljs"

class ClientService {
    constructor() {}

    // ─── Stats ─────────────────────────────────────────────────────────────────
    getStats = async (req: Request, res: Response, next: NextFunction) => {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const [totalClients, newThisMonth, activeClientIds, pendingFeesResult] = await Promise.all([
            ClientModel.countDocuments({ isDeleted: false }),
            ClientModel.countDocuments({ isDeleted: false, createdAt: { $gte: startOfMonth } }),
            LegalCaseModel.distinct("client", {
                isDeleted: false,
                status: { $nin: ["منتهية", "مؤرشفة"] },
            }),
            LegalCaseModel.aggregate([
                { $match: { isDeleted: false, "fees.paymentStatus": { $ne: "سُدد بالكامل" } } },
                {
                  $project: {
                    remaining: {
                      $max: [{ $subtract: ["$fees.totalAmount", "$fees.paidAmount"] }, 0],
                    },
                  },
                },
                { $group: { _id: null, total: { $sum: "$remaining" } } },
              ])
        ])

        const activeClients = await ClientModel.countDocuments({
            _id:       { $in: activeClientIds },
            isDeleted: false,
        })

        return res.status(200).json({
            message: "success",
            stats: {
                totalClients,
                newThisMonth,
                activeClients,
                pendingFees: pendingFeesResult[0]?.total ?? 0,
            },
        })
    }

    // ─── Create ────────────────────────────────────────────────────────────────
    createClient = async (req: Request, res: Response, next: NextFunction) => {
        const data: CreateClientType = req.body

        const check = await ClientModel.findOne({ crNumber : data.crNumber } )

        if (check) {
            throw new AppError("client already exist" , 404)
        }

        const client = await ClientModel.create({
            ...data,
            createdBy: req.user?.id,
        })

        return res.status(201).json({ message: "Client created successfully", client })
    }

    // // ─── Get All ───────────────────────────────────────────────────────────────
    // getClients = async (req: Request, res: Response, next: NextFunction) => {
    //     const { search, type, page = "1", limit = "10" } = req.query

    //     const filter: Record<string, any> = { isDeleted: false }
    //     if (type) filter.type = type
    //     if (search) {
    //         filter.$or = [
    //             { fullName: { $regex: search, $options: "i" } },
    //             { phone:    { $regex: search, $options: "i" } },
    //         ]
    //     }

    //     const pageNum  = Math.max(Number(page), 1)
    //     const limitNum = Math.min(Math.max(Number(limit), 1), 100)
    //     const skip     = (pageNum - 1) * limitNum

    //     const [clients, total] = await Promise.all([
    //         ClientModel.find(filter)
    //             .populate("createdBy", "UserName email")
    //             .sort({ createdAt: -1 })
    //             .skip(skip)
    //             .limit(limitNum),
    //         ClientModel.countDocuments(filter),
    //     ])

    //     // إجمالي القضايا لكل عميل
    //     const clientIds   = clients.map(c => c._id)
    //     const caseCounts  = await LegalCaseModel.aggregate([
    //         { $match: { client: { $in: clientIds }, isDeleted: false } },
    //         { $group: { _id: "$client", count: { $sum: 1 } } },
    //     ])
    //     const caseCountMap = Object.fromEntries(caseCounts.map(c => [c._id.toString(), c.count]))

    //     const result = clients.map(c => ({
    //         ...c.toJSON(),
    //         casesCount: caseCountMap[c._id.toString()] ?? 0,
    //     }))

    //     return res.status(200).json({
    //         message:    "success",
    //         total,
    //         page:       pageNum,
    //         totalPages: Math.ceil(total / limitNum),
    //         clients:    result,
    //     })
    // }

    // // ─── Get By ID ─────────────────────────────────────────────────────────────
    // getClientById = async (req: Request, res: Response, next: NextFunction) => {
    //     const { id } = req.params

    //     const client = await ClientModel.findOne({ _id: id, isDeleted: false })
    //         .populate("createdBy", "UserName email")
    //     if (!client) throw new AppError("client not found", 404)

    //     // القضايا المرتبطة بالعميل
    //     const cases = await LegalCaseModel.find({ client: id, isDeleted: false })
    //         .populate("caseType",   "name")
    //         .populate("assignedTo", "UserName email")
    //         .select("caseNumber status caseType openedAt assignedTo fees")

    //     // إجمالي الأتعاب
    //     const totalFees = cases.reduce((sum, c) => sum + (c.fees?.totalAmount ?? 0), 0)
    //     const paidFees  = cases.reduce((sum, c) => sum + (c.fees?.paidAmount  ?? 0), 0)

    //     return res.status(200).json({
    //         message: "success",
    //         client,
    //         cases,
    //         summary: {
    //             casesCount:    cases.length,
    //             totalFees,
    //             paidFees,
    //             remainingFees: totalFees - paidFees,
    //         },
    //     })
    // }

    // // ─── Update ────────────────────────────────────────────────────────────────
    // updateClient = async (req: Request, res: Response, next: NextFunction) => {
    //     const { id }               = req.params
    //     const data: UpdateClientType = req.body

    //     const client = await ClientModel.findOne({ _id: id, isDeleted: false })
    //     if (!client) throw new AppError("client not found", 404)

    //     const updated = await ClientModel.findByIdAndUpdate(
    //         id,
    //         { $set: data },
    //         { new: true }
    //     )

    //     return res.status(200).json({ message: "Client updated successfully", client: updated })
    // }

    // // ─── Upload Document ───────────────────────────────────────────────────────
    // uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
    //     const { id } = req.params
    //     if (!req.file) throw new AppError("No file uploaded", 400)

    //     const client = await ClientModel.findOne({ _id: id, isDeleted: false })
    //     if (!client) throw new AppError("client not found", 404)

    //     const { secure_url, public_id } = await uploadBuffer(
    //         req.file.buffer,
    //         `clients/${id}/documents`
    //     )

    //     const updated = await ClientModel.findByIdAndUpdate(
    //         id,
    //         {
    //             $push: {
    //                 documents: {
    //                     url:        secure_url,
    //                     publicId:   public_id,
    //                     name:       req.file.originalname,
    //                     uploadedAt: new Date(),
    //                 },
    //             },
    //         },
    //         { new: true }
    //     )

    //     return res.status(200).json({ message: "Document uploaded successfully", client: updated })
    // }

    // // ─── Delete Document ───────────────────────────────────────────────────────
    // deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
    //     const { id, publicId } = req.params

    //     const client = await ClientModel.findOne({ _id: id, isDeleted: false })
    //     if (!client) throw new AppError("client not found", 404)

    //     const doc = client.documents.find(d => d.publicId === decodeURIComponent(publicId))
    //     if (!doc) throw new AppError("document not found", 404)

    //     await cloudinary.uploader.destroy(doc.publicId)

    //     const updated = await ClientModel.findByIdAndUpdate(
    //         id,
    //         { $pull: { documents: { publicId: doc.publicId } } },
    //         { new: true }
    //     )

    //     return res.status(200).json({ message: "Document deleted successfully", client: updated })
    // }

    // // ─── Soft Delete ───────────────────────────────────────────────────────────
    // deleteClient = async (req: Request, res: Response, next: NextFunction) => {
    //     const { id } = req.params

    //     const client = await ClientModel.findOne({ _id: id, isDeleted: false })
    //     if (!client) throw new AppError("client not found", 404)

    //     await ClientModel.findByIdAndUpdate(id, {
    //         isDeleted: true,
    //         deletedAt: new Date(),
    //         deletedBy: req.user?.id,
    //     })

    //     return res.status(200).json({ message: "Client deleted successfully" })
    // }

    // // ─── Export Excel ──────────────────────────────────────────────────────────
    exportExcel = async (req: Request, res: Response, next: NextFunction) => {
        const clients = await ClientModel.find({ isDeleted: false }).sort({ createdAt: -1 })

        const workbook  = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet("العملاء")

        worksheet.columns = [
            { header: "الاسم",             key: "fullName", width: 25 },
            { header: "النوع",             key: "type",     width: 12 },
            { header: "رقم الهاتف",        key: "phone",    width: 18 },
            { header: "البريد الإلكتروني", key: "email",    width: 25 },
            { header: "العنوان",           key: "address",  width: 30 },
            { header: "رقم السجل التجاري", key: "crNumber", width: 20 },
            { header: "تاريخ الإضافة",     key: "createdAt",width: 20 },
        ]


        clients.forEach(c => {
            worksheet.addRow({
                fullName:  c.fullName,
                type:      c.type,
                phone:     c.phone,
                email:     c.email ?? "",
                address:   c.address ?? "",
                crNumber:  c.crNumber ?? "",
                createdAt: c.createdAt?.toLocaleDateString("ar-EG"),
            })
        })

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", "attachment; filename=clients.xlsx")

        await workbook.xlsx.write(res)
        res.end()
    }
}

export default new ClientService()
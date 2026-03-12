import { NextFunction, Request, Response } from "express";
import LegalCaseModel from "../../DB/model/LegalCase.model";
import { AppError } from "../../utils/classError";
import ClientModel from "../../DB/model/client.model";
import { CreateClientType, UpdateClientType } from "./client.validation";
import * as ExcelJS from "exceljs"
import { uploadBuffer } from "../../utils/cloudinaryHelpers";
import cloudinary from "../../utils/cloudInary";
import InvoiceModel from "../../DB/model/invoice.model";

class ClientService {
    constructor() {}

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

    getClients = async (req: Request, res: Response, next: NextFunction) => {
        const { search, type, page = "1", limit = "10" } = req.query
 
        const filter: Record<string, any> = { isDeleted: false }
        if (type) filter.type = type
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { phone:    { $regex: search, $options: "i" } },
            ]
        }
 
        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
        const skip     = (pageNum - 1) * limitNum
 
        const [clients, total] = await Promise.all([
            ClientModel.find(filter)
                .populate("createdBy", "UserName email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            ClientModel.countDocuments(filter),
        ])
 
        const clientIds  = clients.map(c => c._id)
        const caseCounts = await LegalCaseModel.aggregate([
            { $match: { client: { $in: clientIds }, isDeleted: false } },
            { $group: { _id: "$client", count: { $sum: 1 } } },
        ])
        const caseCountMap = Object.fromEntries(
            caseCounts.map(c => [c._id.toString(), c.count])
        )
 
        const result = clients.map(c => ({
            ...c.toJSON(),
            casesCount: caseCountMap[c._id.toString()] ?? 0,
        }))
 
        return res.status(200).json({
            message:    "success",
            total,
            page:       pageNum,
            totalPages: Math.ceil(total / limitNum),
            clients:    result,
        })
    }

    getClientById = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
 
        const client = await ClientModel.findOne({ _id: id, isDeleted: false })
            .populate("createdBy", "UserName email")
        if (!client) throw new AppError("client not found", 404)
 
        const cases = await LegalCaseModel.find({ client: id, isDeleted: false })
            .populate("caseType",   "name")
            .populate("assignedTo", "UserName email")
            .select("caseNumber status caseType openedAt assignedTo fees extraPayments")
 
        const totalFees = cases.reduce((sum, c) => sum + (c.fees?.totalAmount ?? 0), 0)
        const paidFees  = cases.reduce((sum, c) => sum + (c.fees?.paidAmount  ?? 0), 0)
 
        const activeCasesCount = cases.filter(
            c => !["منتهية", "مؤرشفة"].includes(c.status)
        ).length
 
        const invoices = await InvoiceModel.find({
            client:    id,
            isDeleted: false,
            status:    { $ne: "ملغية" },
        }).select("invoiceNumber total paidAmount remaining status isFromFees legalCase issueDate")
 
        const totalInvoicesAmount = invoices.reduce((sum : number, inv) => sum + (inv.total ?? 0), 0)
        const totalInvoicesPaid   = invoices.reduce((sum : number, inv) => sum + (inv.paidAmount ?? 0), 0)
 
        const extraPaymentsTotal = client.extraPayments?.reduce(
            (sum : number, p : { amount?: number }) => sum + (p.amount ?? 0), 0
        ) ?? 0
 
        const remainingFees = totalFees - paidFees
 
        return res.status(200).json({
            message: "success",
            client,
            cases,
            invoices,
            summary: {
                casesCount:          cases.length,
                activeCasesCount,
 
                totalFees,
                paidFees,
                remainingFees,
 
                invoicesCount:       invoices.length,
                totalInvoicesAmount,
                totalInvoicesPaid,
 
                extraPaymentsTotal,
 
                grandTotalPaid:      paidFees + extraPaymentsTotal,
            },
        })
    }

    updateClient = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        const data: UpdateClientType = req.body

        const client = await ClientModel.findOne({ _id: id, isDeleted: false })
        if (!client) throw new AppError("client not found", 404)

        const updated = await ClientModel.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true }
        )

        return res.status(200).json({ message: "Client updated successfully", client: updated })
    }


    uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        if (!req.file) throw new AppError("No file uploaded", 400)

        const client = await ClientModel.findOne({ _id: id, isDeleted: false })
        if (!client) throw new AppError("client not found", 404)

        const { secure_url, public_id } = await uploadBuffer(
            req.file.buffer,
            `clients/${id}/documents`
        )

        const updated = await ClientModel.findByIdAndUpdate(
            id,
            {
                $push: {
                    documents: {
                        url:        secure_url,
                        publicId:   public_id,
                        name:       req.file.originalname,
                        uploadedAt: new Date(),
                    },
                },
            },
            { new: true }
        )

        return res.status(200).json({ message: "Document uploaded successfully", client: updated })
    }

    deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params as { id : string }
        const { publicId } = req.body

        const client = await ClientModel.findOne({ _id: id, isDeleted: false })
        if (!client) throw new AppError("client not found", 404)

        const doc = client.documents.find((d: { publicId: string }) => d.publicId === decodeURIComponent(publicId))
        if (!doc) throw new AppError("document not found", 404)

        await cloudinary.uploader.destroy(doc.publicId)

        const updated = await ClientModel.findByIdAndUpdate(
            id,
            { $pull: { documents: { publicId: doc.publicId } } },
            { new: true }
        )

        return res.status(200).json({ message: "Document deleted successfully", client: updated })
    }

    deleteClient = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params

        const client = await ClientModel.findOne({ _id: id, isDeleted: false })
        if (!client) throw new AppError("client not found", 404)

        await ClientModel.findByIdAndUpdate(id, {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: req.user?.id,
        })

        return res.status(200).json({ message: "Client deleted successfully" })
    }

    unDeleteClient = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        const client = await ClientModel.findById(id)
        if (!client) throw new AppError("client not found", 404) 
        if (!client.isDeleted) throw new AppError("client is not deleted", 400)
        await ClientModel.findByIdAndUpdate(id, {
        isDeleted: false,
        $unset: { deletedAt: 1, deletedBy: 1 },
        })

        return res.status(200).json({ message: "Client restored successfully", client })
    }

     exportExcel = async (req: Request, res: Response, next: NextFunction) => {
        const clients = await ClientModel.find({ isDeleted: false }).sort({ createdAt: -1 })

        const clientIds = clients.map(c => c._id)
        const allCases  = await LegalCaseModel.find({
            client:    { $in: clientIds },
            isDeleted: false,
        }).select("client caseNumber fees status")

        const casesByClient: Record<string, typeof allCases> = {}
        allCases.forEach(c => {
            const key = c.client.toString()
            if (!casesByClient[key]) casesByClient[key] = []
            casesByClient[key].push(c)
        })

        const C = {
            headerBg:      "FF0E1A2B",
            headerText:    "FFFFFFFF",
            headerBorder:  "FFC9A14A",  

            clientBg:      "FF1C3150",
            clientText:    "FFFFFFFF",

            rowEven:       "FFFFFFFF",
            rowOdd:        "FFF7F3EC",

            subtotalBg:    "FFEEE8D8",
            subtotalText:  "FF5C4A1E",
            subtotalBorder:"FFC9A14A",

            grandBg:       "FFC9A14A",
            grandText:     "FF0E1A2B",
            grandBorder:   "FF0E1A2B",

            border:        "FFE0DAD0",
        }

        const workbook = new ExcelJS.Workbook()

   
        const worksheet = workbook.addWorksheet("بيانات العملاء")
        worksheet.views = [{ rightToLeft: true }]

        worksheet.columns = [
            { header: "الاسم",             key: "fullName",    width: 25 },
            { header: "النوع",             key: "type",        width: 12 },
            { header: "رقم الهاتف",        key: "phone",       width: 18 },
            { header: "البريد الإلكتروني", key: "email",       width: 25 },
            { header: "العنوان",           key: "address",     width: 30 },
            { header: "رقم السجل التجاري", key: "crNumber",    width: 20 },
            { header: "تاريخ الإضافة",     key: "createdAt",   width: 20 },
            { header: "رقم القضية",        key: "caseNumber",  width: 20 },
            { header: "حالة القضية",       key: "caseStatus",  width: 18 },
            { header: "إجمالي الأتعاب",    key: "totalAmount", width: 18 },
            { header: "المدفوع",           key: "paidAmount",  width: 15 },
            { header: "الباقي",            key: "remaining",   width: 15 },
        ]

        const headerRow = worksheet.getRow(1)
        headerRow.height = 22
        headerRow.eachCell(cell => {
            cell.font      = { bold: true, size: 12, color: { argb: C.headerText } }
            cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } }
            cell.alignment = { vertical: "middle", horizontal: "center" }
            cell.border    = {
                bottom: { style: "medium", color: { argb: C.grandBg } },
                left:   { style: "thin",   color: { argb: C.border } },
                right:  { style: "thin",   color: { argb: C.border } },
            }
        })

        let grandTotalAmount = 0
        let grandPaidAmount  = 0
        let currentRow       = 2
        let clientRowIndex   = 0

        const chartData: { name: string; total: number; paid: number; remaining: number }[] = []

        clients.forEach(c => {
            const cases      = casesByClient[c._id.toString()] ?? []
            const startRow   = currentRow
            const rowsCount  = Math.max(cases.length, 1)
            const rowBg      = clientRowIndex % 2 === 0 ? C.rowEven : C.rowOdd
            clientRowIndex++

            if (cases.length === 0) {
                const row = worksheet.addRow({
                    fullName:    c.fullName,
                    type:        c.type,
                    phone:       c.phone,
                    email:       c.email    ?? "",
                    address:     c.address  ?? "",
                    crNumber:    c.crNumber ?? "",
                    createdAt:   c.createdAt?.toLocaleDateString("ar-EG"),
                    caseNumber:  "-",
                    caseStatus:  "-",
                    totalAmount: 0,
                    paidAmount:  0,
                    remaining:   0,
                })
                row.height = 18
                row.eachCell(cell => {
                    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } }
                    cell.alignment = { vertical: "middle", horizontal: "center" }
                    cell.border    = { bottom: { style: "hair", color: { argb: C.border } } }
                })
                currentRow++
            } else {
                let clientTotal = 0
                let clientPaid  = 0

                cases.forEach((lc, index) => {
                    const total     = lc.fees?.totalAmount ?? 0
                    const paid      = lc.fees?.paidAmount  ?? 0
                    const remaining = total - paid

                    clientTotal      += total
                    clientPaid       += paid
                    grandTotalAmount += total
                    grandPaidAmount  += paid

                    const row = worksheet.addRow({
                        fullName:    index === 0 ? c.fullName                               : "",
                        type:        index === 0 ? c.type                                   : "",
                        phone:       index === 0 ? c.phone                                  : "",
                        email:       index === 0 ? (c.email ?? "")                          : "",
                        address:     index === 0 ? (c.address ?? "")                        : "",
                        crNumber:    index === 0 ? (c.crNumber ?? "")                       : "",
                        createdAt:   index === 0 ? c.createdAt?.toLocaleDateString("ar-EG") : "",
                        caseNumber:  lc.caseNumber,
                        caseStatus:  lc.status,
                        totalAmount: total,
                        paidAmount:  paid,
                        remaining,
                    })
                    row.height = 18
                    row.eachCell(cell => {
                        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } }
                        cell.alignment = { vertical: "middle", horizontal: "center" }
                        cell.border    = { bottom: { style: "hair", color: { argb: C.border } } }
                    })
                    currentRow++
                })

                if (cases.length > 1) {
                    const subtotalRow = worksheet.addRow({
                        caseNumber:  `إجمالي ${c.fullName}`,
                        totalAmount: clientTotal,
                        paidAmount:  clientPaid,
                        remaining:   clientTotal - clientPaid,
                    })
                    subtotalRow.height = 20
                    subtotalRow.eachCell(cell => {
                        cell.font      = { bold: true, size: 11, color: { argb: C.subtotalText } }
                        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.subtotalBg } }
                        cell.alignment = { vertical: "middle", horizontal: "center" }
                        cell.border    = {
                            top:    { style: "thin",   color: { argb: C.subtotalBorder } },
                            bottom: { style: "thin",   color: { argb: C.subtotalBorder } },
                            left:   { style: "hair" },
                            right:  { style: "hair" },
                        }
                    })
                    currentRow++
                }

                if (rowsCount > 1) {
                    const endRow     = startRow + rowsCount - 1
                    const clientCols = ["A", "B", "C", "D", "E", "F", "G"]
                    clientCols.forEach(col => {
                        worksheet.mergeCells(`${col}${startRow}:${col}${endRow}`)
                        const cell     = worksheet.getCell(`${col}${startRow}`)
                        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.clientBg } }
                        cell.font      = { bold: true, color: { argb: C.clientText } }
                        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
                    })
                }

                chartData.push({
                    name:      c.fullName,
                    total:     clientTotal,
                    paid:      clientPaid,
                    remaining: clientTotal - clientPaid,
                })
            }

            worksheet.addRow({})
            currentRow++
        })

        worksheet.addRow({})
        const totalRow = worksheet.addRow({
            fullName:    "إجمالي جميع العملاء",
            totalAmount: grandTotalAmount,
            paidAmount:  grandPaidAmount,
            remaining:   grandTotalAmount - grandPaidAmount,
        })
        totalRow.height = 30
        totalRow.eachCell(cell => {
            cell.font      = { bold: true, size: 14, color: { argb: C.grandText } }
            cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.grandBg } }
            cell.alignment = { vertical: "middle", horizontal: "center" }
            cell.border    = {
                top:    { style: "medium", color: { argb: C.grandBorder } },
                bottom: { style: "medium", color: { argb: C.grandBorder } },
                left:   { style: "medium", color: { argb: C.grandBorder } },
                right:  { style: "medium", color: { argb: C.grandBorder } },
            }
        })


        if (chartData.length > 0) {
            const chartSheet = workbook.addWorksheet("ملخص الأتعاب")
            chartSheet.views = [{ rightToLeft: true }]

            chartSheet.columns = [
                { header: "العميل",          key: "name",      width: 25 },
                { header: "إجمالي الأتعاب",  key: "total",     width: 18 },
                { header: "المدفوع",         key: "paid",      width: 15 },
                { header: "الباقي",          key: "remaining", width: 15 },
            ]

            const chartHeader = chartSheet.getRow(1)
            chartHeader.height = 22
            chartHeader.eachCell(cell => {
                cell.font      = { bold: true, size: 12, color: { argb: C.headerText } }
                cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } }
                cell.alignment = { vertical: "middle", horizontal: "center" }
                cell.border    = { bottom: { style: "medium", color: { argb: C.grandBg } } }
            })

            chartData.forEach((d, i) => {
                const row = chartSheet.addRow(d)
                row.height = 18
                const bg = i % 2 === 0 ? C.rowEven : C.rowOdd
                row.eachCell(cell => {
                    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
                    cell.alignment = { vertical: "middle", horizontal: "center" }
                    cell.border    = { bottom: { style: "hair", color: { argb: C.border } } }
                })
            })

            chartSheet.addRow({})
            const chartTotal = chartSheet.addRow({
                name:      "الإجمالي",
                total:     grandTotalAmount,
                paid:      grandPaidAmount,
                remaining: grandTotalAmount - grandPaidAmount,
            })
            chartTotal.height = 25
            chartTotal.eachCell(cell => {
                cell.font      = { bold: true, size: 13, color: { argb: C.grandText } }
                cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.grandBg } }
                cell.alignment = { vertical: "middle", horizontal: "center" }
                cell.border    = {
                    top:    { style: "medium", color: { argb: C.grandBorder } },
                    bottom: { style: "medium", color: { argb: C.grandBorder } },
                }
            })
        }

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", "attachment; filename=clients.xlsx")

        await workbook.xlsx.write(res)
        res.end()
    }
}

export default new ClientService()
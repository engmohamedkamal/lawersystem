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

        const [totalClients, newThisMonth, activeClientIds, pendingFromCases , pendingFromInvoices] = await Promise.all([
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
              ]),
              InvoiceModel.aggregate([
                { $match: { isDeleted: false, status: { $ne: "ملغية" }, isFromFees: false } },
                { $group: { _id: null, total: { $sum: "$remaining" } } },
            ]),
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
                pendingFees: (pendingFromCases[0]?.total ?? 0) + (pendingFromInvoices[0]?.total ?? 0),
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
 
        const clientIds = clients.map(c => c._id)

        const [caseCounts, invoiceSums] = await Promise.all([
            LegalCaseModel.aggregate([
            { $match: { isDeleted: false } },  
            {
                $group: {
                    _id:           "$client",
                    count:         { $sum: 1 },
                    remainingFees: {
                        $sum: { $max: [{ $subtract: ["$fees.totalAmount", "$fees.paidAmount"] }, 0] }
                    },
                }
            },
        ]),
            InvoiceModel.aggregate([
                { $match: { client: { $in: clientIds }, isDeleted: false, status: { $ne: "ملغية" } , isFromFees : false } },
                { $group: { _id: "$client", totalDue: { $sum: "$remaining" } }},
            ]),
        ])

        const caseCountMap = Object.fromEntries(
             caseCounts.map(c => [c._id.toString(), { count: c.count, remainingFees: c.remainingFees }])
        )
        const invoiceDueMap = Object.fromEntries(
            invoiceSums.map(i => [i._id.toString(), i.totalDue])
        )

        const result = clients.map(c => {
        const caseData              = caseCountMap[c._id.toString()]
        const remainingFromCases    = caseData?.remainingFees         ?? 0
        const remainingFromInvoices = invoiceDueMap[c._id.toString()] ?? 0
        return {
            ...c.toJSON(),
            casesCount: caseData?.count ?? 0,
            totalDue:   remainingFromCases + remainingFromInvoices,
        }
    })

        console.log("caseCounts:", JSON.stringify(caseCounts))
 
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

        const remainingFromStandaloneInvoices = invoices
            .filter(inv => !inv.isFromFees)
            .reduce((sum: number, inv) => sum + (inv.remaining ?? 0), 0)
 
        const totalDue = remainingFees + remainingFromStandaloneInvoices
 
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
                totalDue
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

    exportToExcel = async (req: Request, res: Response, next: NextFunction) => {
 
        // ── جلب كل البيانات ───────────────────────────────────────────────
        const clients = await ClientModel.find({ isDeleted: false })
            .populate("createdBy", "UserName")
 
        const clientIds = clients.map(c => c._id)
 
        const [cases, invoices] = await Promise.all([
            LegalCaseModel.find({ client: { $in: clientIds }, isDeleted: false })
                .populate("caseType",   "name")
                .populate("assignedTo", "UserName")
                .select("caseNumber status caseType openedAt assignedTo fees extraPayments client"),
            InvoiceModel.find({ client: { $in: clientIds }, isDeleted: false, status: { $ne: "ملغية" } })
                .select("invoiceNumber total paidAmount remaining status isFromFees legalCase issueDate client items paymentMethod"),
        ])
 
        // ── helper: اسم العميل ────────────────────────────────────────────
        const clientName = (id: any): string => {
            const c = clients.find(cl => cl._id.toString() === id?.toString())
            return c?.fullName ?? "—"
        }
 
        // ── ألوان الـ theme ────────────────────────────────────────────────
        const NAVY  = "FF0E1A2B"
        const GOLD  = "FFC9A14A"
        const BEIGE = "FFF5F0E8"
        const WHITE = "FFFFFFFF"
        const GREEN = "FFD6F5D6"
        const RED   = "FFFFD6D6"
 
        const applyHeader = (row: ExcelJS.Row) => {
            row.height = 35
            row.eachCell(cell => {
                cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
                cell.font      = { color: { argb: WHITE }, bold: true, size: 11, name: "Arial" }
                cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
                cell.border    = { bottom: { style: "medium", color: { argb: GOLD } } }
            })
        }
 
        const applyRow = (row: ExcelJS.Row, idx: number, bg?: string) => {
            const color = bg ?? (idx % 2 === 0 ? WHITE : BEIGE)
            row.height = 24
            row.eachCell(cell => {
                cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: color } }
                cell.font      = { size: 10, name: "Arial" }
                cell.alignment = { horizontal: "center", vertical: "middle" }
            })
        }
 
        const moneyFmt = '#,##0 "ر.س"'
 
        const workbook = new ExcelJS.Workbook()
 
        // ══════════════════════════════════════════════════════════════════
        // شيت 1 — بيانات العملاء
        // ══════════════════════════════════════════════════════════════════
        const ws1 = workbook.addWorksheet("بيانات العملاء")
        ws1.views = [{ rightToLeft: true }]
        ws1.columns = [
            { header: "الاسم الكامل",        key: "fullName",  width: 30 },
            { header: "النوع",                key: "type",      width: 12 },
            { header: "رقم الهوية / السجل",   key: "crNumber",  width: 22 },
            { header: "الهاتف",               key: "phone",     width: 18 },
            { header: "البريد الإلكتروني",    key: "email",     width: 28 },
            { header: "العنوان",              key: "address",   width: 30 },
            { header: "تاريخ التسجيل",        key: "createdAt", width: 20 },
        ]
        applyHeader(ws1.getRow(1))
 
        clients.forEach((client, i) => {
            const row = ws1.addRow({
                fullName:  client.fullName,
                type:      client.type,
                crNumber:  client.crNumber,
                phone:     client.phone,
                email:     client.email  ?? "",
                address:   client.address ?? "",
                createdAt: new Date((client as any).createdAt).toLocaleDateString("ar-EG"),
            })
            applyRow(row, i)
        })
 
        // ══════════════════════════════════════════════════════════════════
        // شيت 2 — القضايا
        // ══════════════════════════════════════════════════════════════════
        const ws2 = workbook.addWorksheet("القضايا")
        ws2.views = [{ rightToLeft: true }]
        ws2.columns = [
            { header: "العميل",              key: "client",      width: 25 },
            { header: "رقم القضية",          key: "caseNumber",  width: 18 },
            { header: "نوع القضية",          key: "caseType",    width: 20 },
            { header: "الحالة",              key: "status",      width: 16 },
            { header: "المحامي المسؤول",     key: "assignedTo",  width: 22 },
            { header: "تاريخ الفتح",         key: "openedAt",    width: 16 },
            { header: "إجمالي الأتعاب",      key: "totalFees",   width: 20 },
            { header: "المدفوع",             key: "paidFees",    width: 18 },
            { header: "المتبقي",             key: "remaining",   width: 18 },
        ]
        applyHeader(ws2.getRow(1))
 
        cases.forEach((c, i) => {
            const total   = c.fees?.totalAmount ?? 0
            const paid    = c.fees?.paidAmount  ?? 0
            const row = ws2.addRow({
                client:     clientName(c.client),
                caseNumber: c.caseNumber,
                caseType:   (c.caseType as any)?.name ?? "—",
                status:     c.status,
                assignedTo: (c.assignedTo as any)?.UserName ?? "—",
                openedAt:   c.openedAt ? new Date(c.openedAt).toLocaleDateString("ar-EG") : "—",
                totalFees:  total,
                paidFees:   paid,
                remaining:  total - paid,
            })
            const bg = c.status === "منتهية" ? GREEN : c.status === "مؤرشفة" ? BEIGE : undefined
            applyRow(row, i, bg)
            ;["G","H","I"].forEach(col => {
                ws2.getCell(`${col}${row.number}`).numFmt = moneyFmt
            })
        })
 
        // ══════════════════════════════════════════════════════════════════
        // شيت 3 — الفواتير
        // ══════════════════════════════════════════════════════════════════
        const ws3 = workbook.addWorksheet("الفواتير")
        ws3.views = [{ rightToLeft: true }]
        ws3.columns = [
            { header: "العميل",            key: "client",        width: 25 },
            { header: "رقم الفاتورة",      key: "invoiceNumber", width: 18 },
            { header: "القضية المرتبطة",   key: "legalCase",     width: 20 },
            { header: "النوع",             key: "type",          width: 16 },
            { header: "المبلغ الإجمالي",   key: "total",         width: 18 },
            { header: "المدفوع",           key: "paidAmount",    width: 18 },
            { header: "المتبقي",           key: "remaining",     width: 18 },
            { header: "الحالة",            key: "status",        width: 14 },
            { header: "تاريخ الإصدار",     key: "issueDate",     width: 18 },
        ]
        applyHeader(ws3.getRow(1))
 
        invoices.forEach((inv, i) => {
            const row = ws3.addRow({
                client:        clientName(inv.client),
                invoiceNumber: inv.invoiceNumber,
                legalCase:     inv.legalCase ? `#${inv.legalCase.toString().slice(-6)}` : "—",
                type:          inv.isFromFees ? "أتعاب" : inv.legalCase ? "إضافية" : "مستقلة",
                total:         inv.total      ?? 0,
                paidAmount:    inv.paidAmount ?? 0,
                remaining:     inv.remaining  ?? 0,
                status:        inv.status,
                issueDate:     inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("ar-EG") : "—",
            })
            const bg = inv.status === "مدفوعة" ? GREEN : inv.status === "متأخرة" ? RED : undefined
            applyRow(row, i, bg)
            ;["E","F","G"].forEach(col => {
                ws3.getCell(`${col}${row.number}`).numFmt = moneyFmt
            })
        })
 
        // ══════════════════════════════════════════════════════════════════
        // شيت 4 — الدفعات الإضافية
        // ══════════════════════════════════════════════════════════════════
        const ws4 = workbook.addWorksheet("الدفعات الإضافية")
        ws4.views = [{ rightToLeft: true }]
        ws4.columns = [
            { header: "العميل",            key: "client",        width: 25 },
            { header: "الوصف",             key: "description",   width: 30 },
            { header: "البنود التفصيلية",  key: "items",         width: 40 },
            { header: "القضية المرتبطة",   key: "legalCase",     width: 20 },
            { header: "رقم الفاتورة",      key: "invoiceId",     width: 18 },
            { header: "المبلغ المدفوع",    key: "amount",        width: 18 },
            { header: "طريقة الدفع",       key: "paymentMethod", width: 16 },
            { header: "تاريخ الدفع",       key: "paidAt",        width: 18 },
        ]
        applyHeader(ws4.getRow(1))
 
        let extraIdx = 0
        clients.forEach(client => {
            (client.extraPayments ?? []).forEach((ep: any) => {
                const itemsText = (ep.items ?? [])
                    .map((it: any) => `${it.description}: ${it.amount} ر.س`)
                    .join("\n")
 
                const caseLabel = ep.legalCaseId
                    ? cases.find(c => c._id.toString() === ep.legalCaseId?.toString())?.caseNumber ?? ep.legalCaseId.toString().slice(-6)
                    : "—"
 
                const invLabel = ep.invoiceId
                    ? invoices.find(inv => inv._id.toString() === ep.invoiceId?.toString())?.invoiceNumber ?? ep.invoiceId.toString().slice(-6)
                    : "—"
 
                const row = ws4.addRow({
                    client:        client.fullName,
                    description:   ep.description,
                    items:         itemsText,
                    legalCase:     caseLabel,
                    invoiceId:     invLabel,
                    amount:        ep.amount,
                    paymentMethod: ep.paymentMethod ?? "—",
                    paidAt:        ep.paidAt ? new Date(ep.paidAt).toLocaleDateString("ar-EG") : "—",
                })
                row.height = Math.max(24, (ep.items?.length ?? 1) * 18)
                row.eachCell(cell => {
                    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: extraIdx % 2 === 0 ? WHITE : BEIGE } }
                    cell.font      = { size: 10, name: "Arial" }
                    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
                })
                ws4.getCell(`F${row.number}`).numFmt = moneyFmt
                extraIdx++
            })
        })
 
        // ══════════════════════════════════════════════════════════════════
        // شيت 5 — الملخص المالي
        // ══════════════════════════════════════════════════════════════════
        const ws5 = workbook.addWorksheet("الملخص المالي")
        ws5.views = [{ rightToLeft: true }]
        ws5.columns = [
            { header: "العميل",                  key: "client",          width: 25 },
            { header: "عدد القضايا",             key: "casesCount",      width: 14 },
            { header: "القضايا النشطة",          key: "activeCases",     width: 16 },
            { header: "إجمالي الأتعاب",          key: "totalFees",       width: 20 },
            { header: "المدفوع من الأتعاب",      key: "paidFees",        width: 22 },
            { header: "الدفعات الإضافية",        key: "extraPayments",   width: 20 },
            { header: "إجمالي المدفوع",          key: "grandTotal",      width: 20 },
            { header: "المتبقي",                 key: "remaining",       width: 18 },
            { header: "عدد الفواتير",            key: "invoicesCount",   width: 14 },
        ]
        applyHeader(ws5.getRow(1))
 
        clients.forEach((client, i) => {
            const cClientCases    = cases.filter(c => c.client?.toString() === client._id.toString())
            const cClientInvoices = invoices.filter(inv => inv.client?.toString() === client._id.toString())
            const totalFees   = cClientCases.reduce((s, c) => s + (c.fees?.totalAmount ?? 0), 0)
            const paidFees    = cClientCases.reduce((s, c) => s + (c.fees?.paidAmount  ?? 0), 0)
            const extraTotal  = (client.extraPayments ?? []).reduce((s: number, ep: any) => s + (ep.amount ?? 0), 0)
            const activeCases = cClientCases.filter(c => !["منتهية","مؤرشفة"].includes(c.status)).length
 
            const row = ws5.addRow({
                client:        client.fullName,
                casesCount:    cClientCases.length,
                activeCases,
                totalFees,
                paidFees,
                extraPayments: extraTotal,
                grandTotal:    paidFees + extraTotal,
                remaining:     totalFees - paidFees,
                invoicesCount: cClientInvoices.length,
            })
            applyRow(row, i)
            ;["D","E","F","G","H"].forEach(col => {
                ws5.getCell(`${col}${row.number}`).numFmt = moneyFmt
            })
        })
 
        // ── صف الإجمالي ───────────────────────────────────────────────────
        const lastRow = ws5.lastRow!.number + 1
        const totalRowData = ["الإجمالي", "", ""]
        const totalRow = ws5.addRow(totalRowData)
        totalRow.height = 28
        ;["D","E","F","G","H"].forEach(col => {
            const cell = ws5.getCell(`${col}${lastRow}`)
            cell.value  = { formula: `SUM(${col}2:${col}${lastRow - 1})` }
            cell.numFmt = moneyFmt
            cell.font   = { bold: true, size: 11, name: "Arial" }
            cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } }
            cell.alignment = { horizontal: "center", vertical: "middle" }
        })
        ws5.getCell(`A${lastRow}`).value = "الإجمالي"
        ws5.getCell(`A${lastRow}`).font  = { bold: true, size: 11, name: "Arial" }
        ws5.getCell(`A${lastRow}`).fill  = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } }
        ws5.getCell(`A${lastRow}`).alignment = { horizontal: "center", vertical: "middle" }
 
        // ── إرسال الملف ───────────────────────────────────────────────────
        res.setHeader("Content-Type",        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", `attachment; filename="clients-${Date.now()}.xlsx"`)
 
        await workbook.xlsx.write(res)
        return res.end()
    }
}

export default new ClientService()
import { NextFunction, Request, Response } from "express";
import LegalCaseModel from "../../DB/model/LegalCase.model";
import ClientModel from "../../DB/model/client.model";
import TaskModel from "../../DB/model/tasks.model";
import { Role } from "../../DB/model/user.model";
import { assertFeatureEnabled } from "../../helpers/planFeature.helper";
import { PLAN_FEATURES } from "../SASS/constants/planFeatures";
import OfficeModel from "../../DB/model/SaaSModels/Office.model";
import { AppError } from "../../utils/classError";


class ArchiveService {
    constructor() {}

    private getFileExtension(fileName = "") {
    const parts = fileName.split(".")
    return parts.length > 1 ? parts.pop()?.toLowerCase() ?? "" : ""
  }

  getDocuments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user?.role
      const userId = req.user?._id  

      const office = await OfficeModel.findById(req.user?.officeId);
          if (!office) {
          throw new AppError("office not found", 404);
      }

      assertFeatureEnabled(office, PLAN_FEATURES.ARCHIVE_ENABLED)

      const {
        source,
        search,
        sort = "latest",
        page = "1",
        limit = "20",
      } = req.query

      const allowedSources = ["case", "client", "task"]
      if (source && !allowedSources.includes(String(source))) {
        return res.status(400).json({ message: "invalid source" })
      }

      const pageNum = Math.max(Number(page), 1)
      const limitNum = Math.min(Math.max(Number(limit), 1), 100)

      const docs: any[] = []
      const isAdmin  = role === Role.ADMIN
      const isLawyer = role === Role.LAWYER
      const isStaff  = role === Role.STAFF

      if (!source || source === "case") {
        const caseFilter: any = {
          isDeleted: false,
          officeId: req.user?.officeId,
          "attachments.0": { $exists: true },
        }

        if (isLawyer) {
          caseFilter.$or = [{ assignedTo: userId }, { team: userId }]
        }

        const cases = await LegalCaseModel.find(caseFilter)
          .select("caseNumber attachments client")
          .populate("client", "fullName")
          .lean()

        cases.forEach((c: any) => {
          c.attachments?.forEach((att: any) => {
            docs.push({
              id: att.publicId || `${c._id}-${att.name}-${att.uploadedAt}`,
              url: att.url,
              publicId: att.publicId,
              name: att.name,
              extension: this.getFileExtension(att.name),
              uploadedAt: att.uploadedAt,
              relatedType: "case",
              relatedId: c._id,
              relatedDisplay: c.caseNumber,
              clientName: c.client?.fullName ?? "—",
            })
          })
        })
      }

      if (!isLawyer && (!source || source === "client")) {
        const clients = await ClientModel.find({
          isDeleted: false,
          officeId: req.user?.officeId,
          "documents.0": { $exists: true },
        })
          .select("fullName documents")
          .lean()

        clients.forEach((cl: any) => {
          cl.documents?.forEach((doc: any) => {
            docs.push({
              id: doc.publicId || `${cl._id}-${doc.name}-${doc.uploadedAt}`,
              url: doc.url,
              publicId: doc.publicId,
              name: doc.name,
              extension: this.getFileExtension(doc.name),
              uploadedAt: doc.uploadedAt,
              relatedType: "client",
              relatedId: cl._id,
              relatedDisplay: cl.fullName,
              clientName: cl.fullName,
            })
          })
        })
      }

      if (!source || source === "task") {
        const taskFilter: any = {
          isDeleted: false,
          officeId: req.user?.officeId,
          "attachments.0": { $exists: true },
        }

        if (isLawyer || isStaff) taskFilter.assignedTo = userId

        const tasks = await TaskModel.find(taskFilter)
          .select("title attachments client")
          .populate("client", "fullName")
          .lean()

        tasks.forEach((t: any) => {
          t.attachments?.forEach((att: any) => {
            docs.push({
              id: att.publicId || `${t._id}-${att.name}-${att.uploadedAt}`,
              url: att.url,
              publicId: att.publicId,
              name: att.name,
              extension: this.getFileExtension(att.name),
              uploadedAt: att.uploadedAt,
              relatedType: "task",
              relatedId: t._id,
              relatedDisplay: t.title,
              clientName: t.client?.fullName ?? "—",
            })
          })
        })
      }

      let result = docs

      if (search) {
        const s = String(search).toLowerCase()
        result = result.filter((d) =>
          d.name?.toLowerCase().includes(s) ||
          d.relatedDisplay?.toLowerCase().includes(s) ||
          d.clientName?.toLowerCase().includes(s) ||
          d.extension?.toLowerCase().includes(s)
        )
      }

      if (sort === "oldest") {
        result.sort(
          (a, b) =>
            new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
        )
      } else if (sort === "name") {
        result.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"))
      } else {
        result.sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )
      }

      const total = result.length
      const paginated = result.slice((pageNum - 1) * limitNum, pageNum * limitNum)

      return res.status(200).json({
        message: "success",
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        documents: paginated,
      })
    } catch (error) {
      next(error)
    }
  }
   
   
}

export default new ArchiveService()
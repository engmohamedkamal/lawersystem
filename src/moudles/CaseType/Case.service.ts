import { NextFunction, Request, Response } from "express";
import CaseTypeModel from "../../DB/model/CaseType.model";
import { AppError } from "../../utils/classError";
import { CreateCaseTypeType } from "./Case.validation";



class usersService {
    constructor(){}

    createCaseType = async (req: Request, res: Response, next: NextFunction) =>{

      const { name } : CreateCaseTypeType = req.body

      const officeId = req.user?.officeId

      const create = await CaseTypeModel.findOne({ name, officeId })

      if(create) throw new AppError("CaseType already exist" , 409)

      const CaseType = await CaseTypeModel.create({name , createdBy : req.user?._id, officeId})
      
      return res.status(201).json({ message: "Case type created successfully", CaseType })
    }

    getCaseTypes = async (req: Request, res: Response, next: NextFunction) => {
        const caseTypes = await CaseTypeModel.find({ isActive: true, officeId: req.user?.officeId }).sort({ createdAt: -1 })
        return res.status(200).json({ message: "success", caseTypes })
    }

    getAllCaseTypes = async (req: Request, res: Response, next: NextFunction) => {
        const caseTypes = await CaseTypeModel.find({ officeId: req.user?.officeId })
            .populate("createdBy", "UserName email")
            .sort({ createdAt: -1 })
        return res.status(200).json({ message: "success", caseTypes })
    }

    enableCaseType = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params

        const caseType = await CaseTypeModel.findOne({ _id: id, officeId: req.user?.officeId })
        if (!caseType) throw new AppError("case type not found", 404)
        if (caseType.isActive) throw new AppError("case type is already enabled", 400)

        caseType.isActive = true
        await caseType.save()

        return res.status(200).json({ message: "Case type enabled successfully", caseType })
    }

    disableCaseType = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params

        const caseType = await CaseTypeModel.findOne({ _id: id, officeId: req.user?.officeId })
        if (!caseType) throw new AppError("case type not found", 404)
        if (!caseType.isActive) throw new AppError("case type is already disabled", 400)

        caseType.isActive = false
        await caseType.save()

        return res.status(200).json({ message: "Case type disabled successfully", caseType })
    }

    deleteCaseType = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
    
        const caseType = await CaseTypeModel.findOne({ _id: id, officeId: req.user?.officeId });
        if (!caseType) throw new AppError("caseType not found", 404);
    
        await caseType.deleteOne();
        return res.status(200).json({ message: "caseType deleted successfully" });
      };




}



export default new usersService()


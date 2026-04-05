import { NextFunction, Request, Response } from "express";
import PlanModel from "../../../DB/model/SaaSModels/Plan.model";
import { AppError } from "../../../utils/classError";


const buildFeaturesFromPlan = (plan: any): Record<string, any> => {
    const features: Record<string, any> = {}
    plan.features.forEach((f: any) => { features[f.key] = f.defaultValue })
    return features
}

class SuperAdminService {

    //CRUD FOR PLANS

    createPlan = async (req: Request, res: Response, next: NextFunction) => {
        const { name, slug, description, monthlyPrice, yearlyPrice, features, isPopular, sortOrder } = req.body

        const existing = await PlanModel.findOne({ slug })
        if (existing) throw new AppError("plan slug already exists", 409)

        const plan = await PlanModel.create({
            name, slug, description, monthlyPrice, yearlyPrice,
            features: features ?? [], isPopular, sortOrder,
        })

        return res.status(201).json({ message: "Plan created", plan })
    }

    getPlans = async (req: Request, res: Response, next: NextFunction) => {
        const plans = await PlanModel.find().sort({ sortOrder: 1 })
        return res.status(200).json({ message: "success", plans })
    }

    updatePlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
        Object.assign(plan, req.body)
        await plan.save()
        return res.status(200).json({ message: "Plan updated", plan })
    }

    freezePlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
        plan.isActive = false
        await plan.save()
        return res.status(200).json({ message: "Plan deactivated" })
    }

    unfreezePlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
        plan.isActive = true
        await plan.save()
        return res.status(200).json({ message: "Plan activated" })
    }

    deletePlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
        await plan.deleteOne()
        return res.status(200).json({ message: "Plan deleted" })
    }

    addFeature = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
        plan.features.push(req.body)
        await plan.save()
        return res.status(200).json({ message: "Feature added", plan })
    }

    removeFeature = async (req: Request, res: Response, next: NextFunction) => {
        const { planId, featureId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
        plan.features = plan.features.filter((f: any) => f._id.toString() !== featureId)
        await plan.save()
        return res.status(200).json({ message: "Feature removed", plan })
    }
}

export default new SuperAdminService()
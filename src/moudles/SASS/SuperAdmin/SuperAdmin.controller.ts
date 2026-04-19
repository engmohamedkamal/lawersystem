import { Router } from "express";
import { TokenType } from "../../../utils/token";
import { authentication } from "../../../middleware/authentication";
import SS from "./Superadmin.service";
import { isSuperAdmin } from "../../../middleware/superAdmin";
import { validation } from "../../../middleware/validation";
import * as SV from "./SuperAdmin.validation";


const superAdminRouter = Router();

//CRUD FOR PLANS
superAdminRouter.post("/createPlan",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.createPlanSchema),
    SS.createPlan
)

superAdminRouter.get("/getPlans",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.getPlans
)

superAdminRouter.put("/updatePlan/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.updatePlanSchema),
    SS.updatePlan
)

superAdminRouter.put("/freezePlan/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.planIdParamSchema),
    SS.freezePlan
)

superAdminRouter.put("/unfreezePlan/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.planIdParamSchema),
    SS.unfreezePlan
)

superAdminRouter.delete("/deletePlan/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.planIdParamSchema),
    SS.deletePlan
)

//CRUD FOR ONE PLAN FEATURES
superAdminRouter.post("/addFeature/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.addFeatureSchema),
    SS.addFeatureForOnePlan
)

superAdminRouter.delete("/removeFeature/:planId/:key",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.featureParamSchema),
    SS.removeFeatureFromOnePlan
)

superAdminRouter.put("/updateFeature/:planId/:key",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.updateFeatureSchema),
    SS.updateFeatureForOnePlan
)

//CRUD FOR ALL PLANS FEATURES
superAdminRouter.post("/addFeatureToAllPlans",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.addFeatureSchema),
    SS.addFeatureToAllPlans
)

superAdminRouter.delete("/removeFeatureFromAllPlans/:key",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.featureParamSchema),
    SS.removeFeatureFromAllPlans
)

superAdminRouter.put("/updateFeatureInAllPlans/:key",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.updateFeatureSchema),
    SS.updateFeatureInAllPlans
)

//CRUD FOR PLAN OFFER
superAdminRouter.post("/setPlanOffer/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.setPlanOfferSchema),
    SS.setPlanOffer
)

superAdminRouter.delete("/removePlanOffer/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.planIdParamSchema),
    SS.removePlanOffer
)

//CRUD FOR COUPONS
superAdminRouter.post("/createCoupon",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.createCouponSchema),
    SS.createCoupon
)

superAdminRouter.get("/getCoupons",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.getAllCoupons
)

superAdminRouter.get("/getCoupon/:couponId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.couponIdParamSchema),
    SS.getCoupon
)

superAdminRouter.delete("/deleteCoupon/:couponId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.couponIdParamSchema),
    SS.deleteCoupon
)

//OFFICES

superAdminRouter.get("/getAllOffices",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.getAllOffices
)

superAdminRouter.get("/getOffice/:officeId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.officeIdParamSchema),
    SS.getOfficeById
)

superAdminRouter.put("/updateOfficeSubscription/:officeId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.updateOfficeSubscriptionSchema),
    SS.updateOfficeSubscription
)

superAdminRouter.put("/updateOfficeFeatures/:officeId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.updateOfficeFeaturesSchema),
    SS.updateOfficeFeatures
)


superAdminRouter.put("/toggleOfficeStatus/:officeId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.officeIdParamSchema),
    SS.toggleOfficeStatus
)

superAdminRouter.get("/getRevenueChart",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.getRevenueChart
)

superAdminRouter.get("/getRevenueByPlan/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.planIdParamSchema),
    SS.getRevenueByPlan
)

//BROADCAST SYSTEM MESSAGES
superAdminRouter.post("/broadcastMessage",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.broadcastMessageSchema),
    SS.broadcastMessage
)

//DASHBOARD

superAdminRouter.get("/dashboard",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.dashboard
)

superAdminRouter.get("/getTopPlans",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.getTopPlans
)

superAdminRouter.get("/getPayments",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.getPayments
)

//STORAGE MANAGEMENT

superAdminRouter.post("/triggerStorageSync",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.triggerStorageSync
)

superAdminRouter.get("/auditStorage/:officeId",
    authentication(TokenType.access),
    isSuperAdmin,
    validation(SV.officeIdParamSchema),
    SS.auditOfficeStorage
)


export default superAdminRouter;
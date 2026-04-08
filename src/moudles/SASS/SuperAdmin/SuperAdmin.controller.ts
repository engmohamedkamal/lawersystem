import { Router } from "express";
import { TokenType } from "../../../utils/token";
import { authentication } from "../../../middleware/authentication";
import SS from "./Superadmin.service";
import { isSuperAdmin } from "../../../middleware/superAdmin";


const superAdminRouter = Router();

//CRUD FOR PLANS
superAdminRouter.post("/createPlan",
    authentication(TokenType.access),
    isSuperAdmin,
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
    SS.updatePlan
)

superAdminRouter.put("/freezePlan/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.freezePlan
)

superAdminRouter.put("/unfreezePlan/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.unfreezePlan
)

superAdminRouter.delete("/deletePlan/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.deletePlan
)

//CRUD FOR FEATURES
superAdminRouter.post("/addFeature/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.addFeatureForOnePlan
)

superAdminRouter.delete("/removeFeature/:planId/:key",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.removeFeatureFromOnePlan
)

superAdminRouter.put("/updateFeature/:planId/:key",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.updateFeatureForOnePlan
)

//CRUD FOR PLAN OFFER
superAdminRouter.post("/setPlanOffer/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.setPlanOffer
)

superAdminRouter.delete("/removePlanOffer/:planId",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.removePlanOffer
)

//CRUD FOR COUPONS
superAdminRouter.post("/createCoupon",
    authentication(TokenType.access),
    isSuperAdmin,
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
    SS.getCoupon
)

superAdminRouter.delete("/deleteCoupon/:couponId",
    authentication(TokenType.access),
    isSuperAdmin,
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
    SS.getOfficeById
)


superAdminRouter.put("/updateOfficeSubscription/:officeId",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.updateOfficeSubscription
)

superAdminRouter.put("/updateOfficeFeatures/:officeId",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.updateOfficeFeatures
)


superAdminRouter.put("/toggleOfficeStatus/:officeId",
    authentication(TokenType.access),
    isSuperAdmin,
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
    SS.getRevenueByPlan
)

//DASHBOARD

superAdminRouter.get("/dashboard",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.dashboard
)

superAdminRouter.get("/getPayments",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.getPayments
)

export default superAdminRouter;
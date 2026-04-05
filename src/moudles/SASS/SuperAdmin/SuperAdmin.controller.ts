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
    SS.addFeature
)

superAdminRouter.delete("/removeFeature/:planId/:featureId",
    authentication(TokenType.access),
    isSuperAdmin,
    SS.removeFeature
)



export default superAdminRouter;
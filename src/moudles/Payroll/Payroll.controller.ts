import { Router } from "express"
import PayrollService from "./Payroll.service"
import { authentication } from "../../middleware/authentication"
import { authorization } from "../../middleware/authorization"
import { TokenType } from "../../utils/token"
import { Role } from "../../DB/model/user.model"

const PayrollRouter = Router()

PayrollRouter.post(
  "/transactions",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  PayrollService.createTransaction
)

PayrollRouter.get(
  "/stats",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  PayrollService.getStats
)

PayrollRouter.get(
  "/monthly",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  PayrollService.getMonthlyPayroll
)

PayrollRouter.get(
  "/employee/:userId",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  PayrollService.getEmployeePayroll
)

PayrollRouter.get(
  "/employee/:userId/history",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  PayrollService.getEmployeePayrollHistory
)

PayrollRouter.post(
  "/approve",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  PayrollService.approveMonth
)

PayrollRouter.patch(
  "/transactions/:transactionId",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  PayrollService.updateTransaction
)

PayrollRouter.delete(
  "/transactions/:transactionId",
  authentication(TokenType.access),
  authorization(Role.ADMIN),
  PayrollService.deleteTransaction
)

export default PayrollRouter
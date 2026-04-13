<div align="center">

  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white" />
  <img src="https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white" />

</div>

<h1 align="center">⚖️ Lawyer Management System — SaaS Backend</h1>

<p align="center">
  A comprehensive, multi-tenant SaaS backend platform tailored for law firms and independent lawyers.<br/>
  Covers the full spectrum from case & session management, client invoicing, HR payroll,<br/>
  automated legal document generation, appointment booking, and real-time notifications.
</p>

---

## 📑 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Modules & Features](#-modules--features)
  - [1. Authentication & Token Management](#1-authentication--token-management-)
  - [2. User Management (HR)](#2-user-management-hr-)
  - [3. Legal Case Management](#3-legal-case-management-️)
  - [4. Court Sessions](#4-court-sessions-)
  - [5. Client Management](#5-client-management-)
  - [6. Invoicing & Financials](#6-invoicing--financials-)
  - [7. Task Management](#7-task-management-)
  - [8. HR Payroll System](#8-hr-payroll-system-)
  - [9. Appointment Booking](#9-appointment-booking-)
  - [10. Availability Slots](#10-availability-slots-)
  - [11. Unified Calendar](#11-unified-calendar-)
  - [12. Dashboard & Analytics](#12-dashboard--analytics-)
  - [13. Document Archive](#13-document-archive-)
  - [14. Case Types](#14-case-types-)
  - [15. Law Articles & Reminders](#15-law-articles--reminders-)
  - [16. Legal Document Builder](#16-legal-document-builder-)
  - [17. Office Settings](#17-office-settings-️)
  - [18. Real-Time Notifications](#18-real-time-notifications-)
  - [19. Cron Jobs & Schedulers](#19-cron-jobs--schedulers-)
  - [20. SaaS / Super Admin](#20-saas--super-admin-)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [API Routes Summary](#-api-routes-summary)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)

---

## 🏗️ Architecture Overview

The system follows a **Multi-Tenant SaaS** architecture with:

- **Tenant Isolation Middleware** — Each request is scoped to the authenticated user's `officeId`. The tenant middleware verifies subscription status, checks expiry dates, and auto-suspends expired offices.
- **Feature Flags per Plan** — Subscription plans define granular feature limits (max users, max cases, storage, etc.) enforced at runtime via `assertFeatureLimitNotReached()`.
- **Layered Architecture** — `Controller → Service → Model` pattern with centralized validation (Zod), authentication (JWT), and authorization (RBAC) middleware.

---

## ✨ Modules & Features

### 1. Authentication & Token Management 🔐

| Endpoint | Method | Description |
|---|---|---|
| `/auth/authRegister` | POST | Register a new user with email, password, phone, username |
| `/auth/authSignin` | POST | Sign in with email & password, returns access token + httpOnly refresh cookie |
| `/auth/logout` | POST | Revoke current JWT and clear refresh cookie |
| `/auth/refreshToken` | POST | Rotate tokens — issues new access + refresh tokens, revokes old refresh |

**Implementation Details:**
- **Access Token**: JWT with 3-day expiry, contains `id`, `role`, `userName`
- **Refresh Token**: JWT with 1-year expiry, stored as httpOnly cookie
- **Token Revocation**: Revoked tokens tracked in `RevokeToken` collection with TTL index
- **Credential Change Detection**: Checks `changCredentials` timestamp to invalidate old tokens
- **Frozen Account Guard**: Blocks login for soft-deleted users (`isDeleted: true`)

---

### 2. User Management (HR) 👥

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/users/addUsers` | POST | Admin, Staff | Create user with optional profile photo upload |
| `/users/` | GET | Admin, Staff | List all users (filterable by role) |
| `/users/profile/me` | GET | All | Get authenticated user's profile + stats |
| `/users/:userId` | GET | Admin, Staff | Get user by ID + case/session stats |
| `/users/updateUser/:userId` | PATCH | Admin | Update user fields (email uniqueness enforced) |
| `/users/deleteUser/:userId` | PATCH | Admin | Soft delete user |
| `/users/hardDeleteUser/:userId` | DELETE | Admin | Permanent deletion |
| `/users/:userId/freeze` | PATCH | Admin | Freeze (soft delete) user account |
| `/users/:userId/unfreeze` | PATCH | Admin | Restore frozen account |
| `/users/updateProfilePhoto` | PATCH | All | Upload/replace profile photo (Cloudinary) |

**Implementation Details:**
- **SaaS Limit Enforcement**: New users checked against `users.max` plan feature
- **Profile Stats**: Returns `totalCases`, `activeCases`, `completedCases`, `thisWeekSessions`
- **Leaving Date Logic**: Setting `leavingDate` auto-sets `isActiveEmployee = false`; clearing it restores to `true`
- **Photo Upload**: Cloudinary integration with automatic old photo cleanup

---

### 3. Legal Case Management ⚖️

**Full CRUD with deep financial tracking.**

**Case Model Fields:**
- `caseNumber` (unique), `caseType`, `client`, `status`, `priority`
- `court`, `city`, `description`, `openedAt`, `closedAt`
- `assignedTo` (lawyer), `team[]` (multiple lawyers)
- `fees` — `{ totalAmount, paidAmount, paymentMethod, paymentStatus, notes }`
- `extraPayments[]` — line-item payments with invoice linking
- `attachments[]` — file uploads via Cloudinary

**Statuses:** `قيد التحضير` → `قيد التنفيذ` → `منتهية` / `موقوفة` / `مؤرشفة`

**Priorities:** `منخفضة` | `متوسطة` | `عالية` | `عاجلة`

**Payment Statuses:** `لم يُسدد` | `سُدد جزئياً` | `سُدد بالكامل`

**Virtual Fields:**
- `fees.remainingAmount` — auto-calculated (`totalAmount - paidAmount`)
- `totalPaidAll` — sum of fees paid + all extra payments

**Database Indexes:** Optimized on `client+status`, `caseType+status`, `assignedTo+status`, `isDeleted+status`

---

### 4. Court Sessions 📋

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/session/` | POST | Admin, Staff | Create session linked to a case |
| `/session/` | GET | All | List all sessions (lawyer scoped for `LAWYER` role) |
| `/session/case/:legalCaseId` | GET | All | Get sessions for a specific case |
| `/session/:sessionId` | GET | All | Get session details |
| `/session/:sessionId` | PATCH | Admin, Staff | Update session |
| `/session/:sessionId/status` | PATCH | Admin, Staff | Update status + result + next session date |
| `/session/:sessionId/attachments` | POST | Admin, Staff | Upload attachment (image/file, max 10MB) |
| `/session/:sessionId/attachments` | DELETE | Admin, Staff | Delete attachment from Cloudinary |
| `/session/:sessionId` | DELETE | Admin | Soft delete session |
| `/session/lawyer/:userId` | GET | Admin, Staff | Get sessions assigned to a specific lawyer |

**Implementation Details:**
- **Real-time Notifications**: All session participants (assignedTo + team) receive notification on creation
- **Session Statuses**: `مجدولة` | `منتهية` | `مؤجلة` | `ملغية`
- **Attachment Handling**: Safe unicode filename conversion, Cloudinary with auto resource type detection
- **Cancelled Session Guard**: Cannot update a cancelled session

---

### 5. Client Management 👤

| Endpoint | Method | Description |
|---|---|---|
| `/Client/` | GET | Client dashboard stats (total, new this month, active, pending fees) |
| `/Client/create` | POST | Create client (unique `crNumber`) |
| `/Client/all` | GET | List clients with search, pagination, case counts, total due calculations |
| `/Client/:id` | GET | Full client profile with cases, invoices, financial summary breakdown |
| `/Client/:id` | PUT | Update client |
| `/Client/:id/documents` | POST | Upload document (any file type, max 10MB) |
| `/Client/:id/deleteDocuments` | DELETE | Delete document from Cloudinary |
| `/Client/:id` | DELETE | Soft delete |
| `/Client/:id` | PATCH | Restore deleted client |
| `/Client/export` | GET | **Export to Excel** (5-sheet workbook) |

**Excel Export Sheets:**
1. **بيانات العملاء** — Client directory
2. **القضايا** — Cases with fees breakdown
3. **الفواتير** — All invoices with status
4. **الدفعات الإضافية** — Extra payments log
5. **الملخص المالي** — Financial summary with totals row

**Financial Summary (GET /:id):**
- `totalDue` = remaining from cases + standalone invoices + case extra invoices
- `totalDueBreakdown` — per-case and per-invoice remaining amounts

---

### 6. Invoicing & Financials 💳

| Endpoint | Method | Description |
|---|---|---|
| `/invoices/` | POST | Create case-linked invoice (fees or extra) |
| `/invoices/standalone` | POST | Create standalone invoice (no case) |
| `/invoices/all` | GET | List all invoices with stats (revenue, unpaid, overdue) |
| `/invoices/:invoiceId` | GET | Get invoice details |
| `/invoices/:invoiceId` | PUT | Update invoice (recalculates totals) |
| `/invoices/:invoiceId` | DELETE | Soft delete + sync fees |
| `/invoices/:invoiceId/print` | GET | Generate & download PDF |
| `/invoices/client/:clientId/print-all` | GET | Print all client invoices as single PDF |

**Implementation Details:**
- **Auto Invoice Number**: `INV-{YEAR}-{SEQUENCE}` format (e.g., `INV-2026-0001`)
- **Smart Status Resolution**: `مسودة` → `مُصدرة` → `مدفوعة` / `متأخرة` (auto based on amounts and due date)
- **Fee Overflow Protection**: Cannot pay more than `totalAmount` on case fees
- **Bidirectional Sync**: On invoice CRUD, `syncCaseFees()` recalculates case `paidAmount` + `paymentStatus`
- **Extra Payment Ledger**: Non-fee invoices create entries in both `LegalCase.extraPayments` and `Client.extraPayments`
- **PDF Generation**: Arabic RTL support, branded with office settings
- **Calculations**: `subtotal` → `discount%` → `afterDiscount` → `tax%` → `total` → `remaining`

---

### 7. Task Management ✅

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/task/` | POST | Admin, Staff | Create task with optional attachment |
| `/task/` | GET | All | List tasks (lawyer sees only own tasks) |
| `/task/lawyer/:userId` | GET | Admin, Staff | Get tasks for specific lawyer |
| `/task/:taskId` | GET | All | Get task details (lawyer ownership check) |
| `/task/:taskId` | PATCH | Admin, Staff | Update task fields |
| `/task/:taskId/status` | PATCH | All | Update task status (lawyer can update own) |
| `/task/:taskId` | DELETE | Admin, Staff | Soft delete |
| `/task/notifications` | GET | All | Get user's notifications (last 50) |
| `/task/notifications/read` | PATCH | All | Mark all notifications as read |

**Task Statuses**: `قيد التنفيذ` | `مكتملة` | `متأخرة` | `ملغية`

**Task Priorities**: `عاجلة` | `عالية` | `متوسطة` | `منخفضة`

**Notifications Triggered:**
- `task_assigned` — When a task is created
- `task_updated` — When a task is modified
- `task_completed` — When a lawyer marks task as complete (notifies the assigner)

---

### 8. HR Payroll System 💰

| Endpoint | Method | Description |
|---|---|---|
| `/payroll/transactions` | POST | Create transaction (bonus / deduction / advance) |
| `/payroll/monthly` | GET | Generate monthly payroll report for all employees |
| `/payroll/employee/:userId` | GET | Get employee payroll for a specific month |
| `/payroll/employee/:userId/history` | GET | Full employment history (month by month) |
| `/payroll/approve` | POST | Approve/lock a payroll month |
| `/payroll/transactions/:transactionId` | PATCH | Update transaction (amount/note) |
| `/payroll/transactions/:transactionId` | DELETE | Soft delete transaction |
| `/payroll/stats` | GET | Payroll statistics for a month |

**Transaction Types:**
- **BONUS** — One-time bonus for a specific month
- **DEDUCTION** — One-time deduction for a specific month
- **ADVANCE** — Salary advance with two modes:
  - `ONE_TIME` — Full amount deducted in the given month
  - `INSTALLMENT` — Spread evenly over `installmentMonths` months

**Net Salary Calculation:**
```
Net = Base Salary + Bonuses − Deductions − Advances Due This Month
```

**Approval Workflow:**
- `DRAFT` → `APPROVED` (locks the month, no more edits)
- All employees receive `payroll_approved` notification on approval

**Employee Filtering:**
- Only includes employees whose `employmentDate ≤ monthEnd` AND (`leavingDate ≥ monthStart` or still active)
- Admins excluded from payroll

---

### 9. Appointment Booking 📅

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/appointment/` | POST | Public | Book an appointment (transactional) |
| `/appointment/` | GET | Admin, Staff | List appointments with stats |
| `/appointment/:id` | GET | Admin, Staff | Get appointment details |
| `/appointment/:id/cancel` | DELETE | Admin, Staff | Cancel + free the slot (transactional) |
| `/appointment/:id/status` | PATCH | Admin, Staff | Update status (CONFIRMED → COMPLETED) |

**Anti-Spam Protection:**
- **Fingerprint**: Hashed combination of IP + User-Agent + phone number
- **Rate Limit**: One booking per fingerprint per 24 hours
- **Slot Expiry Check**: Cannot book a slot that has already ended

**Transaction Safety:**
- Uses MongoDB session/transaction for atomic booking (slot status + appointment creation)
- Automatic rollback on failure

---

### 10. Availability Slots 🕐

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/slots/` | POST | Admin, Staff | Create availability slot |
| `/slots/available` | GET | Public | List future available slots |
| `/slots/all` | GET | Admin, Staff | List all slots (with appointment details) |
| `/slots/:id` | GET | Admin, Staff | Get slot details |
| `/slots/:id` | PATCH | Admin, Staff | Update slot (blocked if BOOKED) |
| `/slots/:id` | DELETE | Admin, Staff | Delete slot (blocked if BOOKED) |

**Validations:**
- Cannot create slot in the past
- `endAt` must be after `startAt`
- Duplicate time range detection
- Booked slots are protected from update/delete

---

### 11. Unified Calendar 📆

| Endpoint | Method | Description |
|---|---|---|
| `/calendar/stats` | GET | Quick stats (overdue invoices, upcoming appointments, this week's sessions) |
| `/calendar/range` | GET | Date range calendar with day-by-day breakdown |
| `/calendar/day/:date` | GET | Full details for a specific day |

**Aggregates 4 data sources per day:**
- 🔵 **Sessions** — Court sessions with case info
- 🟢 **Tasks** — Tasks with due dates
- 🟡 **Invoices** — Unpaid invoices with due dates
- 🟣 **Appointments** — Booked appointment slots

**Features:**
- Lawyer role sees only their own sessions/tasks
- Configurable `previewLimit` per day (1–10 items)
- `hasMore` flag when day has more items than limit
- Search across all types
- Filter by specific type(s): `?type=sessions,tasks`
- EG timezone offset handling (UTC+2)

---

### 12. Dashboard & Analytics 📊

| Endpoint | Method | Description |
|---|---|---|
| `/Dashboard/` | GET | Role-aware dashboard stats |

**Admin Dashboard Returns:**
- `activeCases`, `activeClients`, `pendingTasks`, `totalRevenue`
- `upcomingSessions` (next 7 days, limit 10)
- `tasksByPriority` breakdown: `{ عاجلة, عالية, متوسطة, منخفضة }`
- `recentCases` (latest 5)

**Lawyer Dashboard Returns:**
- `myCases`, `myPendingTasks`
- Own upcoming sessions only
- Own tasks by priority

---

### 13. Document Archive 🗂️

| Endpoint | Method | Description |
|---|---|---|
| `/Archive/` | GET | Unified document search across cases, clients, and tasks |

**Features:**
- Aggregates attachments from **cases**, **clients**, and **tasks** into one feed
- **Role-based visibility**:
  - Admin: sees everything
  - Lawyer: sees case attachments (own cases) + task attachments (own tasks)
  - Staff: sees everything except restricted by task assignment
  - Lawyers cannot see client documents
- Filter by `source` (case / client / task)
- Search by filename, related entity, client name, or file extension
- Sort by `latest`, `oldest`, or `name`
- Paginated response

---

### 14. Case Types 🏷️

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/CaseType/` | POST | Admin | Create case type |
| `/CaseType/` | GET | All | List active case types |
| `/CaseType/all` | GET | Admin | List all (including disabled) |
| `/CaseType/:id/enable` | PATCH | Admin | Enable case type |
| `/CaseType/:id/disable` | PATCH | Admin | Disable case type |
| `/CaseType/:id` | DELETE | Admin | Hard delete |

---

### 15. Law Articles & Reminders 📚

| Endpoint | Method | Description |
|---|---|---|
| `/lawReminder/upload` | POST | Upload law PDF → auto-extract articles |
| `/lawReminder/` | GET | List all laws (filterable by category) |
| `/lawReminder/:lawId/articles` | GET | Get all articles for a law |
| `/lawReminder/:lawId/reminder` | GET | Get next article reminder (sequential cycling) |
| `/lawReminder/:lawId` | DELETE | Delete law + articles + reminders + Cloudinary file |

**PDF Article Extraction:**
- Parses Arabic PDF text using `pdf-parse`
- Regex extraction: `المادة (N)` pattern
- Duplicate article number detection
- Atomic: if article insertion fails, law + uploaded file are rolled back

**Reminder System:**
- Per-user, per-law progress tracking (`UserLawReminder` model)
- Each call returns the next article in sequence
- Automatically cycles back to article 1 after reaching the end

---

### 16. Legal Document Builder 📄

| Endpoint | Method | Description |
|---|---|---|
| `/legalDocuments/templates` | GET | List all active templates |
| `/legalDocuments/templates/:id` | GET | Get template by ID |
| `/legalDocuments/templates` | POST | Create template |
| `/legalDocuments/templates/:id` | PATCH | Update template |
| `/legalDocuments/templates/:id` | DELETE | Soft deactivate template |
| `/legalDocuments/` | POST | Create document from template |
| `/legalDocuments/mine` | GET | List user's documents (filter by status/type) |
| `/legalDocuments/:id` | GET | Get document by ID |
| `/legalDocuments/:id` | PATCH | Update document (fields, sections, style) |
| `/legalDocuments/:id` | DELETE | Soft delete |
| `/legalDocuments/:id/pdf` | GET | Export as PDF |

**Template System:**
- Templates define `defaultFields[]` (key-value) and `defaultSections[]` (key, label, content, order)
- Document creation merges user input with template defaults
- Missing fields default to empty string

**Document Statuses:** `draft` | `final` | `archived`

**PDF Export:**
- RTL Arabic layout support
- Office branding (logo, name from Settings)
- UTF-8 filename encoding for Arabic titles
- Court-compliant formatting

---

### 17. Office Settings ⚙️

| Endpoint | Method | Description |
|---|---|---|
| `/SettingsService/` | GET | Get current settings |
| `/SettingsService/public/:subdomain` | GET | (Public) Get office settings for landing pages using subdomain |
| `/SettingsService/` | POST | Upsert settings (create or update) |
| `/SettingsService/workHours` | PATCH | Add work hour blocks |
| `/SettingsService/workHours` | DELETE | Remove specific days |
| `/SettingsService/logo` | PATCH | Upload/replace office logo |
| `/SettingsService/logo` | DELETE | Remove logo |

**Settings Fields:**
- `officeName`, `crNumber`, `officialEmail`, `phone`
- `addressDetail`, `governorate`, `country`
- `logo` / `logoPublicId` (Cloudinary)
- `workHours[]` — `{ days: ["الأحد","الاثنين"], from: "09:00", to: "17:00" }`
- `mapEmbedUrl` — Google Maps embed

**Work Hours Validation:**
- No duplicate days allowed across all work hour blocks

---

### 18. Real-Time Notifications 🔔

**Socket.IO Integration** with JWT-authenticated connections.

**Notification Types:**
| Type | Trigger |
|---|---|
| `task_assigned` | New task created |
| `task_updated` | Task modified |
| `task_completed` | Lawyer marks task complete |
| `case_assigned` | Case assigned to lawyer |
| `payroll_transaction` | Bonus/deduction/advance recorded |
| `payroll_approved` | Monthly payroll approved |
| `session_created` | New court session scheduled |

**Notification Data Fields:**
`title`, `body`, `taskId`, `taskTitle`, `clientName`, `clientPhone`, `clientEmail`, `dueDate`, `caseId`, `caseNumber`, `amount`, `month`, `year`

**Delivery:**
- Persisted to `Notification` model for offline users
- Real-time push via `emitToUser()` for online users (Socket.IO room per userId)
- Online user tracking via `Map<userId, socketId>`

---

### 19. Cron Jobs & Schedulers ⏰

| Schedule | Job | Description |
|---|---|---|
| Every 5 minutes | `completeExpiredAppointments` | Auto-complete appointments whose slot has ended |
| Every hour | `sessionReminderJob` | Send notifications for upcoming court sessions |
| Daily at midnight | `overdueInvoiceUpdate` | Mark invoices past due date as `متأخرة` |

**Cron Safety:**
- Mutex flags prevent overlapping runs
- MongoDB connection check before each run
- Graceful handling of connection errors (skip, don't crash)

---

### 20. SaaS / Super Admin 🏢

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/super-admin/plans` | POST | Super Admin | Create subscription plan |
| `/super-admin/plans` | GET | Super Admin | List all plans |
| `/super-admin/plans/:planId` | PATCH | Super Admin | Update plan |
| `/super-admin/plans/:planId` | DELETE | Super Admin | Delete plan |
| `/super-admin/plans/:planId/freeze` | PATCH | Super Admin | Deactivate plan |
| `/super-admin/plans/:planId/unfreeze` | PATCH | Super Admin | Reactivate plan |
| `/super-admin/plans/:planId/features` | POST | Super Admin | Add feature to plan |
| `/super-admin/plans/:planId/features/:featureId` | DELETE | Super Admin | Remove feature |

**Plan Model:**
- `name`, `slug` (unique), `description`
- `monthlyPrice`, `yearlyPrice`, `currency` (default: EGP)
- `features[]` — `{ key, label, valueType: "number"|"boolean", defaultValue, visible }`
- `offer` — `{ label, discountPercent, validUntil, isActive }`
- `isActive`, `isPopular`, `sortOrder`

**Defined Plan Feature Keys:**
| Key | Type | Description |
|---|---|---|
| `users.max` | number | Max users per office |
| `legalCases.max` | number | Max legal cases |
| `sessions.max` | number | Max court sessions |
| `client.max` | number | Max clients |
| `legalDocuments.max` | number | Max legal documents |
| `storage.max` | number | Max storage |
| `appointments.enabled` | boolean | Appointment booking |
| `archive.enabled` | boolean | Document archive |
| `calender.enabled` | boolean | Calendar access |
| `invoice.enabled` | boolean | Invoicing |
| `lawArticles.enabled` | boolean | Law articles library |
| `parole.enabled` | boolean | Payroll system |
| `tasks.enabled` | boolean | Task management |

**Tenant Middleware Flow:**
1. Extract `officeId` from JWT
2. Load office with subscription data
3. Check `isActive` flag
4. Check subscription `endDate` — auto-expire if past due
5. Check subscription `status === "active"`
6. Attach `office` to request

**Coupon System:** (in subscription service)
- Percentage or fixed-amount discounts
- Usage count limits (`maxUses`)
- Date validity range (`validFrom` → `validUntil`)
- Plan-specific restrictions

**Office Model:**
- `name`, `email`, `phone`, `address`, `subdomain` (unique)
- `subscription` — `{ planId, status, startDate, endDate, billingInterval, autoRenew }`
- `features` — Runtime feature flags (copied from plan on subscription)
- Paymob payment gateway integration fields

---

### 21. My Subscription 💳

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/my-subscription` | GET | Admin | Get current subscription status, plan details, and remaining days |
| `/my-subscription/methods` | GET | Admin | List available payment methods (Cards, Wallets) |
| `/my-subscription/plans` | GET | Admin | List active plans to upgrade/renew |
| `/my-subscription/renew` | POST | Admin | Initiate renewal/upgrade (Integrated with Paymob Wallets & Cards) |
| `/my-subscription/payments` | GET | Admin | Get historical payments and invoices |
| `/my-subscription/card` | DELETE | Admin | Remove saved credit card & auto-renewal |

**Implementation Details:**
- **Paymob Integration**: Full support for credit cards (iframe) and E-Wallets (redirect) using `walletPhone` identifiers.
- **Dynamic Pricing**: Applies active plan offers and coupon discounts mathematically.
- **History Tracking**: Fetches all previous subscription transactions with status and saved amounts.

---

## 🔐 Role-Based Access Control (RBAC)

| Role | Scope | Access Level |
|---|---|---|
| **SUPER_ADMIN** | Platform-wide | Manage plans, tenants, billing |
| **ADMIN** | Office-wide | Full control over firm data, users, payroll, settings |
| **STAFF** | Office-wide | Case ops, client mgmt, sessions, invoices (no payroll, no user delete) |
| **LAWYER** | Own data | View assigned cases/tasks/sessions, update own task status |

---

## 🗂️ API Routes Summary

| Base Path | Module | Methods |
|---|---|---|
| `/auth` | Authentication | POST |
| `/users` | User Management | GET, POST, PATCH, DELETE |
| `/LegalCase` | Cases | GET, POST, PATCH, DELETE |
| `/session` | Court Sessions | GET, POST, PATCH, DELETE |
| `/Client` | Clients | GET, POST, PUT, PATCH, DELETE |
| `/invoices` | Invoicing | GET, POST, PUT, DELETE |
| `/task` | Tasks & Notifications | GET, POST, PATCH, DELETE |
| `/payroll` | HR Payroll | GET, POST, PATCH, DELETE |
| `/appointment` | Appointments | GET, POST, PATCH, DELETE |
| `/slots` | Availability Slots | GET, POST, PATCH, DELETE |
| `/calendar` | Unified Calendar | GET |
| `/Dashboard` | Analytics | GET |
| `/Archive` | Document Archive | GET |
| `/CaseType` | Case Types | GET, POST, PATCH, DELETE |
| `/lawReminder` | Law Articles | GET, POST, DELETE |
| `/legalDocuments` | Document Builder | GET, POST, PATCH, DELETE |
| `/SettingsService` | Office Settings | GET, POST, PATCH, DELETE |
| `/super-admin` | SaaS Management | GET, POST, PATCH, DELETE |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Language** | TypeScript (strict) |
| **Database** | MongoDB (Mongoose ODM) |
| **Validation** | Zod (declarative schema validation) |
| **Auth** | JWT (access + refresh tokens) + bcryptjs |
| **Real-time** | Socket.IO |
| **File Storage** | Cloudinary (images + raw files) |
| **PDF Generation** | Custom HTML→PDF engine (RTL Arabic support) |
| **Excel Export** | ExcelJS (styled multi-sheet workbooks) |
| **Scheduling** | node-cron (3 scheduled jobs) |
| **Rate Limiting** | express-rate-limit (100 req / 5 min) |
| **Security** | Helmet, CORS, cookie-parser |

---

## 📁 Project Structure

```
src/
├── app.controller.ts          # Express app bootstrap + route registration
├── index.ts                   # Entry point
│
├── DB/
│   ├── connectionDb.ts        # MongoDB connection
│   └── model/                 # Mongoose schemas
│       ├── user.model.ts
│       ├── LegalCase.model.ts
│       ├── session.model.ts
│       ├── client.model.ts
│       ├── invoice.model.ts
│       ├── tasks.model.ts
│       ├── Appointment.model.ts
│       ├── AvailabilitySlot.model.ts
│       ├── CaseType.model.ts
│       ├── Notification.model.ts
│       ├── PayrollMonth.model.ts
│       ├── PayrollTransaction.model.ts
│       ├── documentTemplate.model.ts
│       ├── legalDocument.model.ts
│       ├── law.model.ts
│       ├── lawArticle.model.ts
│       ├── userLawReminder.model.ts
│       ├── settings.model.ts
│       ├── revokeToken.model.ts
│       └── SaaSModels/
│           ├── Office.model.ts
│           ├── Plan.model.ts
│           ├── Payment.model.ts
│           └── Coupon.model.ts
│
├── middleware/
│   ├── authentication.ts      # JWT verification
│   ├── authorization.ts       # Role-based guards
│   ├── validation.ts          # Zod schema validation
│   ├── tenant.ts              # Multi-tenant isolation
│   ├── superAdmin.ts          # Super admin guard
│   └── multer.ts              # File upload (memory storage)
│
├── moudles/                   # Feature modules (controller + service + validation)
│   ├── auth/
│   ├── users/
│   ├── LegalِِCase/
│   ├── Session/
│   ├── client/
│   ├── invoice/
│   ├── task/                  # + notification.service.ts
│   ├── Payroll/
│   ├── appointment/
│   ├── Slots/
│   ├── Calendar/
│   ├── Dashboard/
│   ├── Archive/
│   ├── CaseType/
│   ├── LawArticles/
│   ├── LegalDocument/
│   ├── setting/
│   ├── SASS/                  # SaaS management
│   │   ├── SuperAdmin/
│   │   └── subscription.service.ts
│   └── constants/
│       └── planFeatures.ts
│
├── helpers/
│   └── planFeature.helper.ts  # Feature limit enforcement
│
├── jobs/
│   ├── scheduler.ts           # Cron job orchestrator
│   ├── Session.cron.ts        # Session reminders
│   ├── Subscription.cron.ts   # Subscription expiry
│   └── completeAppointments.job.ts
│
├── seeds/
│   └── documentTemplates.seed.ts
│
└── utils/
    ├── token.ts               # JWT sign/verify
    ├── hash.ts                # bcrypt wrapper
    ├── classError.ts          # AppError class
    ├── soket.ts               # Socket.IO setup
    ├── cloudInary.ts          # Cloudinary config
    ├── cloudinaryHelpers.ts   # Upload buffer helper
    ├── invoicepdf.ts          # Invoice PDF generator
    ├── legalDocumentPdf.ts    # Legal doc PDF generator
    ├── getFingerprint.ts      # Anti-spam fingerprinting
    └── request.type.ts        # Express request augmentation
```

---

## 🚀 Getting Started

1. **Install Dependencies**
    ```bash
    npm install
    ```

2. **Environment Variables**
    Create `config/.env` with the following:
    ```env
    PORT=3000
    DB_URI=mongodb+srv://...
    ACCESS_TOKEN=your_access_secret
    REFRESH_TOKEN=your_refresh_secret
    CLOUD_NAME=your_cloudinary_name
    CLOUD_API_KEY=your_cloudinary_key
    CLOUD_API_SECRET=your_cloudinary_secret
    NODE_ENV=development
    ```

3. **Run Development Server**
    ```bash
    npm run start:dev 
    ```

4. **Server starts on** `http://localhost:3000`


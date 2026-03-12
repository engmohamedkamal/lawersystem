import puppeteer from "puppeteer"
import axios     from "axios"

// ─── تحميل صورة وتحويلها لـ base64 ───────────────────────────────────────
const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
        const res      = await axios.get(url, { responseType: "arraybuffer" })
        const base64   = Buffer.from(res.data).toString("base64")
        const mimeType = res.headers["content-type"] ?? "image/jpeg"
        return `data:${mimeType};base64,${base64}`
    } catch {
        return null
    }
}

export const generateInvoicePDF = async (invoice: any, settings: any, warning?: string): Promise<Buffer> => {

    // لوجو المكتب
    let logoSrc = ""
    if (settings?.logo) {
        const b64 = await fetchImageAsBase64(settings.logo)
        if (b64) logoSrc = b64
    }

    const fmt = (val: number) =>
        val?.toLocaleString("en-EG", { minimumFractionDigits: 2 }) ?? "0.00"

    const caseTotal     = invoice.legalCase?.fees?.totalAmount ?? invoice.total ?? 0
    const casePaid      = invoice.legalCase?.fees?.paidAmount  ?? invoice.paidAmount ?? 0
    const caseRemaining = Math.max(caseTotal - casePaid, 0)
    const isOverpaid    = invoice.legalCase && casePaid > caseTotal && caseTotal > 0

    const discountAmt = (invoice.subtotal * invoice.discount) / 100
    const taxAmt      = (invoice.subtotal * (1 - invoice.discount / 100) * invoice.tax) / 100

    // ─── HTML الفاتورة ────────────────────────────────────────────────────
    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo', sans-serif; background: #fff; color: #0E1A2B; font-size: 13px; }

  /* HEADER */
  .header { background: #0E1A2B; color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #C9A14A; }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .header-left img { height: 64px; width: 64px; object-fit: cover; border-radius: 8px; }
  .office-name { font-size: 22px; font-weight: 700; }
  .office-info { color: #C9A14A; font-size: 11px; margin-top: 4px; }
  .header-right { text-align: left; }
  .invoice-num { font-size: 24px; font-weight: 700; color: #fff; }
  .invoice-dates { color: #C9A14A; font-size: 11px; margin-top: 6px; }

  /* INFO CARDS */
  .cards { display: flex; gap: 16px; padding: 20px 32px; }
  .card { flex: 1; background: #F3F4F6; border-radius: 8px; padding: 14px 16px; border: 1px solid #E5E7EB; }
  .card-title { color: #C9A14A; font-weight: 700; font-size: 12px; margin-bottom: 8px; letter-spacing: 1px; }
  .card-name { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .card-info { color: #6B7280; font-size: 11px; line-height: 1.7; }

  /* TABLE */
  .table-wrap { padding: 0 32px 16px; }
  table { width: 100%; border-collapse: collapse; }
  .table-header { background: #0E1A2B; color: #fff; }
  .table-header th { padding: 10px 14px; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
  .table-header th:last-child { text-align: left; }
  tr:nth-child(even) td { background: #F9FAFB; }
  td { padding: 10px 14px; border-bottom: 1px solid #E5E7EB; font-size: 13px; }
  td:last-child { text-align: left; font-weight: 700; }
  .table-divider { height: 3px; background: #C9A14A; }

  /* BOXES */
  .boxes { display: flex; gap: 16px; padding: 16px 32px; }
  .box { flex: 1; border-radius: 8px; overflow: hidden; border: 1px solid #E5E7EB; }
  .box-header { padding: 10px 14px; font-weight: 700; font-size: 12px; letter-spacing: 1px; }
  .box1 .box-header { background: #0E1A2B; color: #fff; }
  .box2 .box-header { background: #C9A14A; color: #0E1A2B; }
  .box-body { padding: 12px 14px; background: #F9FAFB; }
  .box2-body { background: #FEF9EE; }
  .box-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
  .box-row .label { color: #6B7280; }
  .box-row .val { font-weight: 600; }
  .box-divider { height: 1px; background: #E5E7EB; margin: 8px 0; }
  .box2 .box-divider { background: #C9A14A; }
  .total-row { background: #C9A14A; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; margin: 8px 0; }
  .total-row span { font-weight: 700; font-size: 14px; color: #0E1A2B; }
  .remaining-box { border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; margin-top: 8px; }
  .remaining-box.has-remaining { background: #FEE2E2; }
  .remaining-box.paid-full     { background: #DCFCE7; }
  .red   { color: #DC2626; }
  .green { color: #16A34A; }
  .zero  { color: #DC2626; }

  /* NOTES */
  .notes { margin: 0 32px 16px; background: #F3F4F6; border-radius: 8px; padding: 12px 16px; }
  .notes-title { color: #C9A14A; font-weight: 700; font-size: 11px; letter-spacing: 1px; margin-bottom: 6px; }
  .notes-text  { color: #6B7280; font-size: 12px; }

  /* WARNING BANNER */
  .warning-banner { background: #FEE2E2; border-right: 4px solid #DC2626; padding: 10px 20px; margin: 0 32px 16px; border-radius: 6px; display: flex; align-items: center; gap: 10px; }
  .warning-banner .warn-icon { font-size: 18px; }
  .warning-banner .warn-text { color: #991B1B; font-size: 12px; font-weight: 700; }

  /* FOOTER */
  .footer { background: #0E1A2B; border-top: 3px solid #C9A14A; padding: 14px 32px; text-align: center; }
  .footer p { color: #6B7280; font-size: 10px; }
  .footer span { color: #C9A14A; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-left">
    ${logoSrc ? `<img src="${logoSrc}" alt="logo"/>` : ""}
    <div>
      <div class="office-name">${settings?.officeName ?? "مكتب المحاماة"}</div>
      <div class="office-info">${settings?.officialEmail ?? ""}<br/>${settings?.phone ?? ""}</div>
    </div>
  </div>
  <div class="header-right">
    <div class="invoice-num"># ${invoice.invoiceNumber}</div>
    <div class="invoice-dates">
      تاريخ الإصدار: ${new Date(invoice.issueDate).toLocaleDateString("ar-EG")}<br/>
      ${invoice.dueDate ? `تاريخ الاستحقاق: ${new Date(invoice.dueDate).toLocaleDateString("ar-EG")}` : ""}
    </div>
  </div>
</div>

<!-- WARNING BANNER -->
${isOverpaid ? `
<div class="warning-banner">
  <span class="warn-icon">⚠️</span>
  <span class="warn-text">تحذير: إجمالي المدفوع (${fmt(casePaid)} ج.م) تجاوز إجمالي الأتعاب (${fmt(caseTotal)} ج.م)</span>
</div>` : ""}

<!-- CLIENT + CASE CARDS -->
<div class="cards">
  <div class="card">
    <div class="card-title">العميل</div>
    <div class="card-name">${invoice.client?.fullName ?? "-"}</div>
    <div class="card-info">
      ${invoice.client?.phone   ?? ""}<br/>
      ${invoice.client?.email   ?? ""}<br/>
      ${invoice.client?.address ?? ""}
    </div>
  </div>
  ${invoice.legalCase ? `
  <div class="card">
    <div class="card-title">القضية</div>
    <div class="card-name">${invoice.legalCase?.caseNumber ?? "-"}</div>
    <div class="card-info">
      الحالة: ${invoice.legalCase?.status ?? "-"}<br/>
      المحكمة: ${invoice.legalCase?.court ?? "-"}<br/>
      المدينة: ${invoice.legalCase?.city  ?? "-"}
    </div>
  </div>` : ""}
</div>

<!-- ITEMS TABLE -->
<div class="table-wrap">
  <table>
    <thead>
      <tr class="table-header">
        <th>البيان</th>
        <th>المبلغ (ج.م)</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.items?.map((item: any) => `
        <tr>
          <td>${item.description}</td>
          <td>${fmt(item.amount)}</td>
        </tr>
      `).join("") ?? ""}
    </tbody>
  </table>
  <div class="table-divider"></div>
</div>

<!-- BOXES -->
<div class="boxes">

  <!-- مربع 1 — الفاتورة الحالية -->
  <div class="box box1" style="${!invoice.legalCase ? 'max-width:100%;flex:1' : ''}">
    <div class="box-header">هذه الفاتورة</div>
    <div class="box-body">
      <div class="box-row">
        <span class="label">المجموع الفرعي:</span>
        <span class="val">${fmt(invoice.subtotal)} ج.م</span>
      </div>
      ${invoice.discount > 0 ? `
      <div class="box-row">
        <span class="label">الخصم (${invoice.discount}%):</span>
        <span class="val red">- ${fmt(discountAmt)} ج.م</span>
      </div>` : ""}
      ${invoice.tax > 0 ? `
      <div class="box-row">
        <span class="label">الضريبة (${invoice.tax}%):</span>
        <span class="val">+ ${fmt(taxAmt)} ج.م</span>
      </div>` : ""}
      <div class="box-divider"></div>
      <div class="total-row">
        <span>الإجمالي:</span>
        <span>${fmt(invoice.total)} ج.م</span>
      </div>
      <div class="box-row">
        <span class="label">المدفوع:</span>
        <span class="val ${invoice.paidAmount > 0 ? "green" : "zero"}">${fmt(invoice.paidAmount ?? 0)} ج.م</span>
      </div>
      <div class="box-row">
        <span class="label">المتبقي:</span>
        <span class="val ${(invoice.remaining ?? 0) > 0 ? "red" : "green"}">${fmt(invoice.remaining ?? 0)} ج.م</span>
      </div>
      ${invoice.paymentMethod ? `
      <div class="box-row">
        <span class="label">طريقة الدفع:</span>
        <span class="val">${invoice.paymentMethod}</span>
      </div>` : ""}
    </div>
  </div>

  <!-- مربع 2 — ملخص الأتعاب (فقط لو في قضية) -->
  ${invoice.legalCase ? `
  <div class="box box2">
    <div class="box-header">ملخص الأتعاب</div>
    <div class="box-body box2-body">
      <div class="box-row">
        <span class="label">إجمالي الأتعاب:</span>
        <span class="val ${caseTotal === 0 ? "zero" : ""}">${fmt(caseTotal)} ج.م</span>
      </div>
      <div class="box-row">
        <span class="label">إجمالي المدفوع:</span>
        <span class="val ${casePaid > 0 ? "green" : "zero"}">${fmt(casePaid)} ج.م</span>
      </div>
      <div class="box-divider"></div>
      <div class="remaining-box ${caseRemaining > 0 ? "has-remaining" : "paid-full"}">
        <span class="label">المتبقي:</span>
        <span class="val ${caseRemaining > 0 ? "red" : "green"}" style="font-size:15px;font-weight:700;">
          ${caseRemaining === 0 ? "تم السداد بالكامل ✓" : fmt(caseRemaining) + " ج.م"}
        </span>
      </div>
    </div>
  </div>` : ""}
</div>

<!-- NOTES -->
${invoice.notes ? `
<div class="notes">
  <div class="notes-title">ملاحظات</div>
  <div class="notes-text">${invoice.notes}</div>
</div>` : ""}

<!-- FOOTER -->
<div class="footer">
  <p>${settings?.officeName ?? ""} ${settings?.addressDetail ? "| " + settings.addressDetail : ""} ${settings?.phone ? "| " + settings.phone : ""}</p>
  <p style="margin-top:4px;"><span>فاتورة ${invoice.invoiceNumber}</span> | تم الإنشاء بتاريخ ${new Date().toLocaleDateString("ar-EG")}</p>
</div>

</body>
</html>
`

    // ─── تحويل HTML لـ PDF ────────────────────────────────────────────────
    const browser = await puppeteer.launch({
        headless: true,
        args:     ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format:            "A4",
        printBackground:   true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
    })

    await browser.close()
    return Buffer.from(pdfBuffer)
}

// ─── طباعة كل فواتير العميل في PDF واحد ──────────────────────────────────
export const generateAllInvoicesPDF = async (invoices: any[], settings: any): Promise<Buffer> => {
    return new Promise(async (resolve, reject) => {
        if (!invoices.length) reject(new Error("No invoices found"))

        const fmt = (val: number) =>
            val?.toLocaleString("en-EG", { minimumFractionDigits: 2 }) ?? "0.00"

        // لوجو المكتب
        let logoSrc = ""
        if (settings?.logo) {
            const b64 = await fetchImageAsBase64(settings.logo)
            if (b64) logoSrc = b64
        }

        // ─── توليد HTML لكل فاتورة ────────────────────────────────────────
        const invoicesHTML = invoices.map((invoice: any, index: number) => {
            const caseTotal     = invoice.legalCase?.fees?.totalAmount ?? invoice.total ?? 0
            const casePaid      = invoice.legalCase?.fees?.paidAmount  ?? invoice.paidAmount ?? 0
            const caseRemaining = Math.max(caseTotal - casePaid, 0)
            const isOverpaid    = invoice.legalCase && casePaid > caseTotal && caseTotal > 0
            const discountAmt   = (invoice.subtotal * invoice.discount) / 100
            const taxAmt        = (invoice.subtotal * (1 - invoice.discount / 100) * invoice.tax) / 100

            return `
<div class="invoice-page ${index > 0 ? "page-break" : ""}">

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      ${logoSrc ? `<img src="${logoSrc}" alt="logo"/>` : ""}
      <div>
        <div class="office-name">${settings?.officeName ?? "مكتب المحاماة"}</div>
        <div class="office-info">${settings?.officialEmail ?? ""}<br/>${settings?.phone ?? ""}</div>
      </div>
    </div>
    <div class="header-right">
      <div class="invoice-num"># ${invoice.invoiceNumber}</div>
      <div class="invoice-dates">
        تاريخ الإصدار: ${new Date(invoice.issueDate).toLocaleDateString("ar-EG")}<br/>
        ${invoice.dueDate ? `تاريخ الاستحقاق: ${new Date(invoice.dueDate).toLocaleDateString("ar-EG")}` : ""}
      </div>
    </div>
  </div>

  ${isOverpaid ? `
  <div class="warning-banner">
    <span class="warn-icon">⚠️</span>
    <span class="warn-text">تحذير: إجمالي المدفوع (${fmt(casePaid)} ج.م) تجاوز إجمالي الأتعاب (${fmt(caseTotal)} ج.م)</span>
  </div>` : ""}

  <!-- CLIENT + CASE -->
  <div class="cards">
    <div class="card">
      <div class="card-title">العميل</div>
      <div class="card-name">${invoice.client?.fullName ?? "-"}</div>
      <div class="card-info">
        ${invoice.client?.phone ?? ""}<br/>
        ${invoice.client?.email ?? ""}<br/>
        ${invoice.client?.address ?? ""}
      </div>
    </div>
    ${invoice.legalCase ? `
    <div class="card">
      <div class="card-title">القضية</div>
      <div class="card-name">${invoice.legalCase?.caseNumber ?? "-"}</div>
      <div class="card-info">
        الحالة: ${invoice.legalCase?.status ?? "-"}<br/>
        المحكمة: ${invoice.legalCase?.court ?? "-"}<br/>
        المدينة: ${invoice.legalCase?.city  ?? "-"}
      </div>
    </div>` : ""}
  </div>

  <!-- ITEMS TABLE -->
  <div class="table-wrap">
    <table>
      <thead><tr class="table-header"><th>البيان</th><th>المبلغ (ج.م)</th></tr></thead>
      <tbody>
        ${invoice.items?.map((item: any) => `
          <tr><td>${item.description}</td><td>${fmt(item.amount)}</td></tr>
        `).join("") ?? ""}
      </tbody>
    </table>
    <div class="table-divider"></div>
  </div>

  <!-- BOXES -->
  <div class="boxes">
    <div class="box box1" style="${!invoice.legalCase ? "flex:1" : ""}">
      <div class="box-header">هذه الفاتورة</div>
      <div class="box-body">
        <div class="box-row"><span class="label">المجموع الفرعي:</span><span class="val">${fmt(invoice.subtotal)} ج.م</span></div>
        ${invoice.discount > 0 ? `<div class="box-row"><span class="label">الخصم (${invoice.discount}%):</span><span class="val red">- ${fmt(discountAmt)} ج.م</span></div>` : ""}
        ${invoice.tax > 0 ? `<div class="box-row"><span class="label">الضريبة (${invoice.tax}%):</span><span class="val">+ ${fmt(taxAmt)} ج.م</span></div>` : ""}
        <div class="box-divider"></div>
        <div class="total-row"><span>الإجمالي:</span><span>${fmt(invoice.total)} ج.م</span></div>
        <div class="box-row"><span class="label">المدفوع:</span><span class="val ${invoice.paidAmount > 0 ? "green" : "zero"}">${fmt(invoice.paidAmount ?? 0)} ج.م</span></div>
        <div class="box-row"><span class="label">المتبقي:</span><span class="val ${(invoice.remaining ?? 0) > 0 ? "red" : "green"}">${fmt(invoice.remaining ?? 0)} ج.م</span></div>
        ${invoice.paymentMethod ? `<div class="box-row"><span class="label">طريقة الدفع:</span><span class="val">${invoice.paymentMethod}</span></div>` : ""}
      </div>
    </div>
    ${invoice.legalCase ? `
    <div class="box box2">
      <div class="box-header">ملخص الأتعاب</div>
      <div class="box-body box2-body">
        <div class="box-row"><span class="label">إجمالي الأتعاب:</span><span class="val ${caseTotal === 0 ? "zero" : ""}">${fmt(caseTotal)} ج.م</span></div>
        <div class="box-row"><span class="label">إجمالي المدفوع:</span><span class="val ${casePaid > 0 ? "green" : "zero"}">${fmt(casePaid)} ج.م</span></div>
        <div class="box-divider"></div>
        <div class="remaining-box ${caseRemaining > 0 ? "has-remaining" : "paid-full"}">
          <span class="label">المتبقي:</span>
          <span class="val ${caseRemaining > 0 ? "red" : "green"}" style="font-size:15px;font-weight:700;">
            ${caseRemaining === 0 ? "تم السداد بالكامل ✓" : fmt(caseRemaining) + " ج.م"}
          </span>
        </div>
      </div>
    </div>` : ""}
  </div>

  ${invoice.notes ? `
  <div class="notes">
    <div class="notes-title">ملاحظات</div>
    <div class="notes-text">${invoice.notes}</div>
  </div>` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <p>${settings?.officeName ?? ""} ${settings?.addressDetail ? "| " + settings.addressDetail : ""}</p>
    <p><span>فاتورة ${invoice.invoiceNumber}</span> | ${new Date().toLocaleDateString("ar-EG")}</p>
  </div>

</div>`
        }).join("")

        const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo', sans-serif; background: #fff; color: #0E1A2B; font-size: 13px; }
  .page-break { page-break-before: always; }
  .invoice-page { min-height: 100vh; }
  .header { background: #0E1A2B; color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #C9A14A; }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .header-left img { height: 64px; width: 64px; object-fit: cover; border-radius: 8px; }
  .office-name { font-size: 22px; font-weight: 700; }
  .office-info { color: #C9A14A; font-size: 11px; margin-top: 4px; }
  .header-right { text-align: left; }
  .invoice-num { font-size: 24px; font-weight: 700; }
  .invoice-dates { color: #C9A14A; font-size: 11px; margin-top: 6px; }
  .warning-banner { background: #FEE2E2; border-right: 4px solid #DC2626; padding: 10px 20px; margin: 0 32px 16px; border-radius: 6px; display: flex; align-items: center; gap: 10px; margin-top: 12px; }
  .warn-text { color: #991B1B; font-size: 12px; font-weight: 700; }
  .cards { display: flex; gap: 16px; padding: 20px 32px; }
  .card { flex: 1; background: #F3F4F6; border-radius: 8px; padding: 14px 16px; border: 1px solid #E5E7EB; }
  .card-title { color: #C9A14A; font-weight: 700; font-size: 12px; margin-bottom: 8px; }
  .card-name { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .card-info { color: #6B7280; font-size: 11px; line-height: 1.7; }
  .table-wrap { padding: 0 32px 16px; }
  table { width: 100%; border-collapse: collapse; }
  .table-header { background: #0E1A2B; color: #fff; }
  .table-header th { padding: 10px 14px; font-size: 12px; font-weight: 700; }
  .table-header th:last-child { text-align: left; }
  tr:nth-child(even) td { background: #F9FAFB; }
  td { padding: 10px 14px; border-bottom: 1px solid #E5E7EB; font-size: 13px; }
  td:last-child { text-align: left; font-weight: 700; }
  .table-divider { height: 3px; background: #C9A14A; }
  .boxes { display: flex; gap: 16px; padding: 16px 32px; }
  .box { flex: 1; border-radius: 8px; overflow: hidden; border: 1px solid #E5E7EB; }
  .box-header { padding: 10px 14px; font-weight: 700; font-size: 12px; }
  .box1 .box-header { background: #0E1A2B; color: #fff; }
  .box2 .box-header { background: #C9A14A; color: #0E1A2B; }
  .box-body { padding: 12px 14px; background: #F9FAFB; }
  .box2-body { background: #FEF9EE; }
  .box-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
  .box-row .label { color: #6B7280; }
  .box-row .val { font-weight: 600; }
  .box-divider { height: 1px; background: #E5E7EB; margin: 8px 0; }
  .box2 .box-divider { background: #C9A14A; }
  .total-row { background: #C9A14A; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; margin: 8px 0; }
  .total-row span { font-weight: 700; font-size: 14px; color: #0E1A2B; }
  .remaining-box { border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; margin-top: 8px; }
  .remaining-box.has-remaining { background: #FEE2E2; }
  .remaining-box.paid-full { background: #DCFCE7; }
  .red { color: #DC2626; } .green { color: #16A34A; } .zero { color: #DC2626; }
  .notes { margin: 0 32px 16px; background: #F3F4F6; border-radius: 8px; padding: 12px 16px; }
  .notes-title { color: #C9A14A; font-weight: 700; font-size: 11px; margin-bottom: 6px; }
  .notes-text { color: #6B7280; font-size: 12px; }
  .footer { background: #0E1A2B; border-top: 3px solid #C9A14A; padding: 14px 32px; text-align: center; }
  .footer p { color: #6B7280; font-size: 10px; }
  .footer span { color: #C9A14A; }
</style>
</head>
<body>
${invoicesHTML}
</body>
</html>`

        const browser = await puppeteer.launch({
            headless: true,
            args:     ["--no-sandbox", "--disable-setuid-sandbox"],
        })
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: "domcontentloaded" , timeout: 60000, })
        const pdfBuffer = await page.pdf({
            format:          "A4",
            printBackground: true,
            margin: { top: "0", right: "0", bottom: "0", left: "0" },
        })
        await browser.close()
        resolve(Buffer.from(pdfBuffer))
    })
}
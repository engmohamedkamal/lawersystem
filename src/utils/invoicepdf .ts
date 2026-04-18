import PDFDocument from "pdfkit";
import axios from "axios";
import path from "path";

// ─── Fonts ────────────────────────────────────────────────────────────────
const FONT_REG  = path.join(process.cwd(), "src/utils/fonts/Cairo-Regular.ttf");
const FONT_BOLD = path.join(process.cwd(), "src/utils/fonts/Cairo-Bold.ttf");

// ─── Colors (RGB 0-255) ──────────────────────────────────────────────────
const DARK      = [14, 26, 43]   as const;
const GOLD      = [201, 161, 74] as const;
const WHITE     = [255, 255, 255] as const;
const GRAY_BG   = [243, 244, 246] as const;
const GRAY_BG2  = [249, 250, 251] as const;
const BORDER    = [229, 231, 235] as const;
const TEXT_GRAY = [107, 114, 128] as const;
const RED       = [220, 38, 38]  as const;
const RED_BG    = [254, 226, 226] as const;
const RED_DARK  = [153, 27, 27]  as const;
const GREEN     = [22, 163, 74]  as const;
const GREEN_BG  = [220, 252, 231] as const;
const GOLD_BG   = [254, 249, 238] as const;

// ─── Page Constants ──────────────────────────────────────────────────────
const PAGE_W     = 595.28; // A4 width
const MARGIN     = 32;
const CONTENT_W  = PAGE_W - MARGIN * 2;

// ─── Helpers ─────────────────────────────────────────────────────────────
const fmtAr = (val: number) => {
    const num = val?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "0.00";
    // Reverse characters so PDFKit rtla feature flips them back to correct visual order when mixed with Arabic
    return num.split("").reverse().join("");
};

const fmtNum = (val: number) => val?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "0.00";

const revStr = (str: string) => str.split("").reverse().join("");

const fetchLogo = async (url: string): Promise<Buffer | null> => {
    try {
        const res = await axios.get(url, { responseType: "arraybuffer", timeout: 5000 });
        return Buffer.from(res.data);
    } catch { return null; }
};

// ─── Drawing helpers ─────────────────────────────────────────────────────
type RGB = readonly [number, number, number];

const rect = (doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, color: RGB) => {
    doc.save().rect(x, y, w, h).fill(color as unknown as string).restore();
};

const roundedRect = (doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number, color: RGB) => {
    doc.save().roundedRect(x, y, w, h, r).fill(color as unknown as string).restore();
};

const roundedRectStroke = (doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number, strokeColor: RGB) => {
    doc.save().roundedRect(x, y, w, h, r).lineWidth(1).strokeColor(strokeColor as unknown as string).stroke().restore();
};

const textR = (doc: PDFKit.PDFDocument, text: string, x: number, y: number, opts: PDFKit.Mixins.TextOptions = {}) => {
    doc.text(text, x, y, { align: "right", features: ["rtla", "liga", "calt"], ...opts });
};

const textL = (doc: PDFKit.PDFDocument, text: string, x: number, y: number, opts: PDFKit.Mixins.TextOptions = {}) => {
    doc.text(text, x, y, { align: "left", features: ["rtla", "liga", "calt"], ...opts });
};

// ─── Draw Invoice Header ─────────────────────────────────────────────────
const drawHeader = (
    doc: PDFKit.PDFDocument,
    invoice: any,
    settings: any,
    logo: Buffer | null,
    startY: number
): number => {
    const headerH = 80;
    rect(doc, 0, startY, PAGE_W, headerH, DARK);
    // Gold bottom border
    rect(doc, 0, startY + headerH, PAGE_W, 4, GOLD);

    // Logo
    let logoEndX = MARGIN;
    if (logo) {
        try {
            doc.image(logo, PAGE_W - MARGIN - 50, startY + 10, { width: 50, height: 50, fit: [50, 50] });
        } catch { /* skip bad logo */ }
    }

    // Office name (right side)
    doc.font(FONT_BOLD).fontSize(18).fillColor(WHITE as unknown as string);
    textR(doc, settings?.officeName ?? "مكتب المحاماة", MARGIN, startY + 14, { width: CONTENT_W - 70 });

    // Office info
    doc.font(FONT_REG).fontSize(9).fillColor(GOLD as unknown as string);
    const infoText = [settings?.officialEmail, settings?.phone].filter(Boolean).join("  |  ");
    if (infoText) textR(doc, infoText, MARGIN, startY + 38, { width: CONTENT_W - 70 });

    // Invoice number (left side)
    doc.font(FONT_BOLD).fontSize(20).fillColor(WHITE as unknown as string);
    textL(doc, `# ${invoice.invoiceNumber}`, MARGIN, startY + 12, { width: 200 });

    // Dates
    doc.font(FONT_REG).fontSize(9).fillColor(GOLD as unknown as string);
    const issueDate = new Date(invoice.issueDate).toLocaleDateString("en-GB");
    textL(doc, `تاريخ الإصدار: ${revStr(issueDate)}`, MARGIN, startY + 40, { width: 200 });
    if (invoice.dueDate) {
        const dueDate = new Date(invoice.dueDate).toLocaleDateString("en-GB");
        textL(doc, `تاريخ الاستحقاق: ${revStr(dueDate)}`, MARGIN, startY + 54, { width: 200 });
    }

    return startY + headerH + 4;
};

// ─── Warning Banner ──────────────────────────────────────────────────────
const drawWarning = (doc: PDFKit.PDFDocument, text: string, startY: number): number => {
    const bannerY = startY + 10;
    roundedRect(doc, MARGIN, bannerY, CONTENT_W, 32, 4, RED_BG);
    // Right border
    rect(doc, PAGE_W - MARGIN - 4, bannerY, 4, 32, RED);

    doc.font(FONT_BOLD).fontSize(10).fillColor(RED_DARK as unknown as string);
    textR(doc, `⚠️ ${text}`, MARGIN + 10, bannerY + 8, { width: CONTENT_W - 30 });

    return bannerY + 42;
};

// ─── Info Cards ──────────────────────────────────────────────────────────
const drawCards = (doc: PDFKit.PDFDocument, invoice: any, startY: number): number => {
    const cardY = startY + 10;
    const hasCase = !!invoice.legalCase;
    const cardW = hasCase ? (CONTENT_W - 12) / 2 : CONTENT_W;
    const cardH = 90;

    // Client card (right)
    const clientX = hasCase ? MARGIN + cardW + 12 : MARGIN;
    roundedRect(doc, clientX, cardY, cardW, cardH, 6, GRAY_BG);
    roundedRectStroke(doc, clientX, cardY, cardW, cardH, 6, BORDER);

    doc.font(FONT_BOLD).fontSize(10).fillColor(GOLD as unknown as string);
    textR(doc, "العميل", clientX + 10, cardY + 10, { width: cardW - 20 });

    doc.font(FONT_BOLD).fontSize(12).fillColor(DARK as unknown as string);
    textR(doc, invoice.client?.fullName ?? "-", clientX + 10, cardY + 28, { width: cardW - 20 });

    doc.font(FONT_REG).fontSize(9).fillColor(TEXT_GRAY as unknown as string);
    const clientInfo = [invoice.client?.phone, invoice.client?.email, invoice.client?.address].filter(Boolean).join("\n");
    textR(doc, clientInfo, clientX + 10, cardY + 46, { width: cardW - 20, lineGap: 2 });

    // Case card (left) - only if has case
    if (hasCase) {
        const caseX = MARGIN;
        roundedRect(doc, caseX, cardY, cardW, cardH, 6, GRAY_BG);
        roundedRectStroke(doc, caseX, cardY, cardW, cardH, 6, BORDER);

        doc.font(FONT_BOLD).fontSize(10).fillColor(GOLD as unknown as string);
        textR(doc, "القضية", caseX + 10, cardY + 10, { width: cardW - 20 });

        doc.font(FONT_BOLD).fontSize(12).fillColor(DARK as unknown as string);
        textR(doc, invoice.legalCase?.caseNumber ?? "-", caseX + 10, cardY + 28, { width: cardW - 20 });

        doc.font(FONT_REG).fontSize(9).fillColor(TEXT_GRAY as unknown as string);
        const caseInfo = [
            `الحالة: ${invoice.legalCase?.status ?? "-"}`,
            `المحكمة: ${invoice.legalCase?.court ?? "-"}`,
            `المدينة: ${invoice.legalCase?.city ?? "-"}`,
        ].join("\n");
        textR(doc, caseInfo, caseX + 10, cardY + 46, { width: cardW - 20, lineGap: 2 });
    }

    return cardY + cardH;
};

// ─── Items Table ─────────────────────────────────────────────────────────
const drawTable = (doc: PDFKit.PDFDocument, invoice: any, startY: number): number => {
    const tableY = startY + 14;
    const colDescW = CONTENT_W * 0.65;
    const colAmtW  = CONTENT_W * 0.35;
    const rowH     = 28;
    const headerH  = 30;

    // Table header
    rect(doc, MARGIN, tableY, CONTENT_W, headerH, DARK);
    doc.font(FONT_BOLD).fontSize(10).fillColor(WHITE as unknown as string);
    textR(doc, "البيان", MARGIN + CONTENT_W - colDescW + 8, tableY + 8, { width: colDescW - 16 });
    textL(doc, "المبلغ )ج.م(", MARGIN + 8, tableY + 8, { width: colAmtW - 16 });

    let y = tableY + headerH;
    const items = invoice.items ?? [];

    for (let i = 0; i < items.length; i++) {
        // Check page break
        if (y + rowH > 760) {
            doc.addPage();
            y = MARGIN;
        }

        // Alternating background
        if (i % 2 === 1) rect(doc, MARGIN, y, CONTENT_W, rowH, GRAY_BG2);

        // Bottom border
        doc.save().moveTo(MARGIN, y + rowH).lineTo(PAGE_W - MARGIN, y + rowH)
            .lineWidth(0.5).strokeColor(BORDER as unknown as string).stroke().restore();

        // Description
        doc.font(FONT_REG).fontSize(11).fillColor(DARK as unknown as string);
        textR(doc, items[i].description ?? "", MARGIN + colAmtW + 8, y + 7, { width: colDescW - 16 });

        // Amount
        doc.font(FONT_BOLD).fontSize(11).fillColor(DARK as unknown as string);
        textL(doc, fmtNum(items[i].amount), MARGIN + 8, y + 7, { width: colAmtW - 16 });

        y += rowH;
    }

    // Gold divider
    rect(doc, MARGIN, y, CONTENT_W, 3, GOLD);

    return y + 3;
};

// ─── Summary Boxes ───────────────────────────────────────────────────────
const drawBoxes = (doc: PDFKit.PDFDocument, invoice: any, startY: number): number => {
    const boxY = startY + 12;
    const hasCase = !!invoice.legalCase;
    const boxW = hasCase ? (CONTENT_W - 12) / 2 : CONTENT_W;

    const discountAmt = (invoice.subtotal * invoice.discount) / 100;
    const taxAmt = (invoice.subtotal * (1 - invoice.discount / 100) * invoice.tax) / 100;

    const caseTotal     = invoice.legalCase?.fees?.totalAmount ?? invoice.total ?? 0;
    const casePaid      = invoice.legalCase?.fees?.paidAmount  ?? invoice.paidAmount ?? 0;
    const caseRemaining = Math.max(caseTotal - casePaid, 0);

    // ── Box 1: هذه الفاتورة (right) ──
    const box1X = hasCase ? MARGIN + boxW + 12 : MARGIN;
    let box1H = 140;
    if (invoice.discount > 0) box1H += 18;
    if (invoice.tax > 0) box1H += 18;
    if (invoice.paymentMethod) box1H += 18;

    // Check page break
    if (boxY + box1H > 760) {
        doc.addPage();
        return drawBoxes(doc, invoice, MARGIN - 12);
    }

    // Box container
    roundedRectStroke(doc, box1X, boxY, boxW, box1H, 6, BORDER);

    // Header
    roundedRect(doc, box1X, boxY, boxW, 28, 6, DARK);
    // Fix: fill bottom corners
    rect(doc, box1X, boxY + 14, boxW, 14, DARK);
    doc.font(FONT_BOLD).fontSize(10).fillColor(WHITE as unknown as string);
    textR(doc, "هذه الفاتورة", box1X + 10, boxY + 7, { width: boxW - 20 });

    let row1Y = boxY + 36;

    // Subtotal
    const drawBoxRow = (label: string, value: string, color: RGB = DARK) => {
        doc.font(FONT_REG).fontSize(10).fillColor(TEXT_GRAY as unknown as string);
        textR(doc, label, box1X + 10, row1Y, { width: boxW - 20 });
        doc.font(FONT_BOLD).fontSize(10).fillColor(color as unknown as string);
        textL(doc, value, box1X + 10, row1Y, { width: boxW - 20 });
        row1Y += 18;
    };

    drawBoxRow("المجموع الفرعي:", `${fmtAr(invoice.subtotal)} ج.م`);
    if (invoice.discount > 0) drawBoxRow(`الخصم (${invoice.discount}%):`, `- ${fmtAr(discountAmt)} ج.م`, RED);
    if (invoice.tax > 0) drawBoxRow(`الضريبة (${invoice.tax}%):`, `+ ${fmtAr(taxAmt)} ج.م`);

    // Divider
    doc.save().moveTo(box1X + 10, row1Y).lineTo(box1X + boxW - 10, row1Y)
        .lineWidth(0.5).strokeColor(BORDER as unknown as string).stroke().restore();
    row1Y += 6;

    // Total (gold bar)
    roundedRect(doc, box1X + 8, row1Y, boxW - 16, 26, 4, GOLD);
    doc.font(FONT_BOLD).fontSize(12).fillColor(DARK as unknown as string);
    textR(doc, "الإجمالي:", box1X + 16, row1Y + 5, { width: (boxW - 32) / 2 });
    textL(doc, `${fmtAr(invoice.total)} ج.م`, box1X + 16, row1Y + 5, { width: (boxW - 32) / 2 });
    row1Y += 34;

    // Paid
    doc.font(FONT_REG).fontSize(10).fillColor(TEXT_GRAY as unknown as string);
    textR(doc, "المدفوع:", box1X + 10, row1Y, { width: boxW - 20 });
    doc.font(FONT_BOLD).fontSize(10).fillColor((invoice.paidAmount > 0 ? GREEN : RED) as unknown as string);
    textL(doc, `${fmtAr(invoice.paidAmount ?? 0)} ج.م`, box1X + 10, row1Y, { width: boxW - 20 });
    row1Y += 18;

    // Remaining
    doc.font(FONT_REG).fontSize(10).fillColor(TEXT_GRAY as unknown as string);
    textR(doc, "المتبقي:", box1X + 10, row1Y, { width: boxW - 20 });
    doc.font(FONT_BOLD).fontSize(10).fillColor(((invoice.remaining ?? 0) > 0 ? RED : GREEN) as unknown as string);
    textL(doc, `${fmtAr(invoice.remaining ?? 0)} ج.م`, box1X + 10, row1Y, { width: boxW - 20 });
    row1Y += 18;

    // Payment method
    if (invoice.paymentMethod) {
        doc.font(FONT_REG).fontSize(10).fillColor(TEXT_GRAY as unknown as string);
        textR(doc, "طريقة الدفع:", box1X + 10, row1Y, { width: boxW - 20 });
        doc.font(FONT_BOLD).fontSize(10).fillColor(DARK as unknown as string);
        textL(doc, invoice.paymentMethod, box1X + 10, row1Y, { width: boxW - 20 });
        row1Y += 18;
    }

    let bottomY = row1Y;

    // ── Box 2: ملخص الأتعاب (left) ── only if has case
    if (hasCase) {
        const box2X = MARGIN;
        const box2H = 130;

        roundedRectStroke(doc, box2X, boxY, boxW, box2H, 6, BORDER);

        // Gold Header
        roundedRect(doc, box2X, boxY, boxW, 28, 6, GOLD);
        rect(doc, box2X, boxY + 14, boxW, 14, GOLD);
        doc.font(FONT_BOLD).fontSize(10).fillColor(DARK as unknown as string);
        textR(doc, "ملخص الأتعاب", box2X + 10, boxY + 7, { width: boxW - 20 });

        let row2Y = boxY + 36;

        // Total fees
        doc.font(FONT_REG).fontSize(10).fillColor(TEXT_GRAY as unknown as string);
        textR(doc, "إجمالي الأتعاب:", box2X + 10, row2Y, { width: boxW - 20 });
        doc.font(FONT_BOLD).fontSize(10).fillColor((caseTotal === 0 ? RED : DARK) as unknown as string);
        textL(doc, `${fmtAr(caseTotal)} ج.م`, box2X + 10, row2Y, { width: boxW - 20 });
        row2Y += 18;

        // Paid
        doc.font(FONT_REG).fontSize(10).fillColor(TEXT_GRAY as unknown as string);
        textR(doc, "إجمالي المدفوع:", box2X + 10, row2Y, { width: boxW - 20 });
        doc.font(FONT_BOLD).fontSize(10).fillColor((casePaid > 0 ? GREEN : RED) as unknown as string);
        textL(doc, `${fmtAr(casePaid)} ج.م`, box2X + 10, row2Y, { width: boxW - 20 });
        row2Y += 18;

        // Divider
        doc.save().moveTo(box2X + 10, row2Y).lineTo(box2X + boxW - 10, row2Y)
            .lineWidth(0.5).strokeColor(GOLD as unknown as string).stroke().restore();
        row2Y += 8;

        // Remaining box
        const remColor = caseRemaining > 0 ? RED_BG : GREEN_BG;
        roundedRect(doc, box2X + 8, row2Y, boxW - 16, 30, 4, remColor);

        doc.font(FONT_REG).fontSize(10).fillColor(TEXT_GRAY as unknown as string);
        textR(doc, "المتبقي:", box2X + 16, row2Y + 7, { width: (boxW - 32) / 2 });

        doc.font(FONT_BOLD).fontSize(12).fillColor((caseRemaining > 0 ? RED : GREEN) as unknown as string);
        const remText = caseRemaining === 0 ? "تم السداد بالكامل ✓" : `${fmtAr(caseRemaining)} ج.م`;
        textL(doc, remText, box2X + 16, row2Y + 7, { width: (boxW - 32) / 2 });

        row2Y += 38;
        if (row2Y > bottomY) bottomY = row2Y;
    }

    return bottomY;
};

// ─── Notes ───────────────────────────────────────────────────────────────
const drawNotes = (doc: PDFKit.PDFDocument, notes: string, startY: number): number => {
    if (!notes) return startY;

    const noteY = startY + 10;
    const noteH = 50;

    if (noteY + noteH > 760) {
        doc.addPage();
        return drawNotes(doc, notes, MARGIN);
    }

    roundedRect(doc, MARGIN, noteY, CONTENT_W, noteH, 6, GRAY_BG);

    doc.font(FONT_BOLD).fontSize(9).fillColor(GOLD as unknown as string);
    textR(doc, "ملاحظات", MARGIN + 12, noteY + 8, { width: CONTENT_W - 24 });

    doc.font(FONT_REG).fontSize(10).fillColor(TEXT_GRAY as unknown as string);
    textR(doc, notes, MARGIN + 12, noteY + 24, { width: CONTENT_W - 24 });

    return noteY + noteH;
};

// ─── Footer ──────────────────────────────────────────────────────────────
const drawFooter = (doc: PDFKit.PDFDocument, invoice: any, settings: any) => {
    const footerH = 40;
    const footerY = 841.89 - footerH; // Bottom of A4

    rect(doc, 0, footerY, PAGE_W, footerH, DARK);
    rect(doc, 0, footerY, PAGE_W, 3, GOLD);

    doc.font(FONT_REG).fontSize(8).fillColor(TEXT_GRAY as unknown as string);
    const line1 = [settings?.officeName, settings?.addressDetail, settings?.phone].filter(Boolean).join("  |  ");
    doc.text(line1, MARGIN, footerY + 10, { width: CONTENT_W, align: "center", features: ["rtla"] });

    doc.font(FONT_REG).fontSize(8).fillColor(GOLD as unknown as string);
    const dateStr = new Date().toLocaleDateString("en-GB");
    const line2 = `فاتورة ${invoice.invoiceNumber}  |  ${revStr(dateStr)}`;
    doc.text(line2, MARGIN, footerY + 24, { width: CONTENT_W, align: "center", features: ["rtla"] });
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export const generateInvoicePDF = async (invoice: any, settings: any, warning?: string): Promise<Buffer> => {
    const logo = settings?.logo ? await fetchLogo(settings.logo) : null;

    const caseTotal  = invoice.legalCase?.fees?.totalAmount ?? invoice.total ?? 0;
    const casePaid   = invoice.legalCase?.fees?.paidAmount  ?? invoice.paidAmount ?? 0;
    const isOverpaid = invoice.legalCase && casePaid > caseTotal && caseTotal > 0;

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: "A4",
                margin: 0,
                info: {
                    Title: `فاتورة ${invoice.invoiceNumber}`,
                    Author: settings?.officeName ?? "مكتب المحاماة",
                },
            });

            doc.registerFont("Cairo", FONT_REG);
            doc.registerFont("CairoBold", FONT_BOLD);

            const chunks: Buffer[] = [];
            doc.on("data", (c: Buffer) => chunks.push(c));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            // ─── Draw ───
            let y = drawHeader(doc, invoice, settings, logo, 0);

            if (isOverpaid) {
                y = drawWarning(doc, `تحذير: إجمالي المدفوع (${fmtAr(casePaid)} ج.م) تجاوز إجمالي الأتعاب (${fmtAr(caseTotal)} ج.م)`, y);
            }

            y = drawCards(doc, invoice, y);
            y = drawTable(doc, invoice, y);
            y = drawBoxes(doc, invoice, y);
            y = drawNotes(doc, invoice.notes, y);
            drawFooter(doc, invoice, settings);

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

// ─── طباعة كل فواتير العميل في PDF واحد ──────────────────────────────────
export const generateAllInvoicesPDF = async (invoices: any[], settings: any): Promise<Buffer> => {
    if (!invoices.length) throw new Error("No invoices found");

    const logo = settings?.logo ? await fetchLogo(settings.logo) : null;

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: "A4",
                margin: 0,
                info: {
                    Title: `فواتير العملاء`,
                    Author: settings?.officeName ?? "مكتب المحاماة",
                },
            });

            doc.registerFont("Cairo", FONT_REG);
            doc.registerFont("CairoBold", FONT_BOLD);

            const chunks: Buffer[] = [];
            doc.on("data", (c: Buffer) => chunks.push(c));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            invoices.forEach((invoice, idx) => {
                if (idx > 0) doc.addPage();

                const caseTotal  = invoice.legalCase?.fees?.totalAmount ?? invoice.total ?? 0;
                const casePaid   = invoice.legalCase?.fees?.paidAmount  ?? invoice.paidAmount ?? 0;
                const isOverpaid = invoice.legalCase && casePaid > caseTotal && caseTotal > 0;

                let y = drawHeader(doc, invoice, settings, logo, 0);

                if (isOverpaid) {
                    y = drawWarning(doc, `تحذير: إجمالي المدفوع (${fmtAr(casePaid)} ج.م) تجاوز إجمالي الأتعاب (${fmtAr(caseTotal)} ج.م)`, y);
                }

                y = drawCards(doc, invoice, y);
                y = drawTable(doc, invoice, y);
                y = drawBoxes(doc, invoice, y);
                y = drawNotes(doc, invoice.notes, y);
                drawFooter(doc, invoice, settings);
            });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

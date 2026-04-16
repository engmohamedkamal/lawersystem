import puppeteer from "puppeteer";
import { ILegalDocument } from "../DB/model/legalDocument.model";

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildLegalDocumentHTML = (doc: any, settings: any): string => {
  const fields =
    doc.fields instanceof Map
      ? Object.fromEntries(doc.fields)
      : doc.fields ?? {};

  const templateFields = Array.isArray(doc?.templateId?.defaultFields)
    ? doc.templateId.defaultFields
    : [];

  const fieldLabels = Object.fromEntries(
    templateFields.map((f: any) => [f.key, f.label])
  );

  const officeName = settings?.officeName || "المكتب القانوني";
  const officePhone = settings?.phone || "";
  const officeEmail = settings?.email || settings?.officialEmail || "";

  const visibleSections = [...(doc.sections ?? [])]
    .filter((section: any) => section.visible !== false)
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

  const nonSignatureSections = visibleSections.filter(
    (sec: any) => sec.key !== "signature"
  );
  const signatureSection = visibleSections.find(
    (sec: any) => sec.key === "signature"
  );

  const introLines = Object.entries(fields)
    .map(([key, val]) => {
      const label = fieldLabels[key] ?? key;
      const safeVal =
        val && String(val).trim() !== ""
          ? escapeHtml(val)
          : "................................";
      return `<div class="meta-line"><span class="meta-label">${escapeHtml(
        label
      )}</span> : <span class="meta-value">${safeVal}</span></div>`;
    })
    .join("");

  const sectionsHTML = nonSignatureSections
    .map((sec: any) => {
      const label = sec.label ? escapeHtml(sec.label) : "";
      const content = escapeHtml(sec.content ?? "").replace(/\n/g, "<br/>");

      return `
        <section class="section-block">
          ${label ? `<div class="section-title">${label}</div>` : ""}
          <div class="section-content">${content}</div>
        </section>
      `;
    })
    .join("");

  const signatureHtml = signatureSection
    ? `
      <section class="signature-wrap">
        <div class="signature-prelude">وتفضلوا بقبول وافر الاحترام ،،،</div>
        <div class="signature-box">
          <div class="signature-title">${escapeHtml(
            signatureSection.label || "التوقيع"
          )}</div>
          <div class="signature-name">
            ${escapeHtml(signatureSection.content ?? "........................")}
          </div>
        </div>
      </section>
    `
    : "";

  const today = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');

  @page {
    size: A4;
    margin: 22mm 18mm 22mm 28mm;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: 'Amiri', 'Times New Roman', serif;
    background: #fff;
    color: #111;
    direction: rtl;
    font-size: 20px;
    line-height: 2.15;
  }

  .page {
    width: 100%;
  }

  .top-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .office-name {
    font-size: 26px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .office-sub {
    font-size: 16px;
    margin-bottom: 2px;
  }

  .office-contact {
    font-size: 15px;
    color: #333;
  }

  .doc-date {
    margin-top: 10px;
    font-size: 15px;
  }

  .doc-title-wrap {
    text-align: center;
    margin: 28px 0 24px;
  }

  .doc-title {
    display: inline-block;
    font-size: 30px;
    font-weight: 700;
    padding-bottom: 6px;
    border-bottom: 1px solid #000;
    margin: 0;
  }

  .meta-block {
    margin-bottom: 26px;
  }

  .meta-line {
    margin-bottom: 6px;
    font-size: 20px;
  }

  .meta-label {
    font-weight: 700;
  }

  .meta-value {
    font-weight: 400;
  }

  .section-block {
    margin-bottom: 22px;
  }

  .section-title {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 8px;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .section-content {
    text-align: justify;
    word-break: break-word;
  }

  .signature-wrap {
    margin-top: 38px;
    page-break-inside: avoid;
  }

  .signature-prelude {
    margin-bottom: 36px;
  }

  .signature-box {
    width: 42%;
    margin-right: auto;
    text-align: center;
  }

  .signature-title {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  .signature-name {
    font-size: 22px;
    line-height: 2;
  }

  .divider {
    border-top: 1px solid #000;
    margin: 18px 0 0;
  }
</style>
</head>
<body>
  <div class="page">

    <header class="top-header">
      <div class="office-name">${escapeHtml(officeName)}</div>
      <div class="office-sub">المحاماة والاستشارات القانونية</div>
      ${
        officePhone || officeEmail
          ? `
        <div class="office-contact">
          ${officePhone ? escapeHtml(officePhone) : ""}
          ${officePhone && officeEmail ? " | " : ""}
          ${officeEmail ? escapeHtml(officeEmail) : ""}
        </div>
      `
          : ""
      }
      <div class="doc-date">التاريخ: ${escapeHtml(today)}</div>
    </header>

    <section class="doc-title-wrap">
      <h1 class="doc-title">${escapeHtml(doc.title ?? "مستند قانوني")}</h1>
    </section>

    ${
      introLines
        ? `
      <section class="meta-block">
        ${introLines}
      </section>
    `
        : ""
    }

    ${sectionsHTML}

    ${signatureHtml}

  </div>
</body>
</html>
`;
};

export const generateLegalDocumentPDF = async (
  doc: ILegalDocument,
  settings: any
): Promise<Buffer> => {
  const html = buildLegalDocumentHTML(doc, settings);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await page.evaluate(async () => {
      // @ts-ignore
      if (document.fonts?.ready) {
        // @ts-ignore
        await document.fonts.ready;
      }
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    await page.close();
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
};
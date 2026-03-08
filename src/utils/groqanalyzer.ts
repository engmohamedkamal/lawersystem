import Groq from "groq-sdk"
import Tesseract from "tesseract.js"
import axios from "axios"

const groq     = new Groq({ apiKey: process.env.AI_API })
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>

// ─── استخراج النص من PDF ───────────────────────────────────────────────────
const extractTextFromPDF = async (url: string): Promise<string> => {
    try {
        const response = await axios.get(url, { responseType: "arraybuffer" })
        const buffer   = Buffer.from(response.data)
        const data     = await pdfParse(buffer)
        return data.text?.trim() ?? ""
    } catch {
        return ""
    }
}

// ─── استخراج النص من صورة (OCR) ───────────────────────────────────────────
const extractTextFromImage = async (url: string): Promise<string> => {
    try {
        const { data: { text } } = await Tesseract.recognize(url, "ara+eng", {
            logger: () => {},
        })
        return text?.trim() ?? ""
    } catch {
        return ""
    }
}

// ─── استخراج النص من ملف حسب نوعه ────────────────────────────────────────
const extractTextFromFile = async (url: string, name: string): Promise<string> => {
    const lower = name.toLowerCase()
    if (lower.endsWith(".pdf")) {
        return await extractTextFromPDF(url)
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(lower)) {
        return await extractTextFromImage(url)
    }
    return ""
}

// ─── Interfaces ────────────────────────────────────────────────────────────
export interface ClientInfo {
    fullName: string
    phone:    string
    email?:   string
    address?: string
    type:     string
}

export interface CaseAnalysisInput {
    caseNumber:   string
    caseType:     string
    status:       string
    priority:     string
    description?: string
    court?:       string
    city?:        string
    openedAt:     Date
    closedAt?:    Date
    client:       ClientInfo
    assignedTo?:  string
    team?:        string[]
    attachments:  { url: string; name: string }[]
}

export interface CaseAnalysisResult {
    summary:             string
    clientProfile:       string
    caseAssessment:      string
    weaknesses:          string[]
    recommendations:     string[]
    nextSteps:           string[]
    urgencyLevel:        string
    attachmentsSummary?: string
}

// ─── التحليل الرئيسي ───────────────────────────────────────────────────────
export const analyzeCase = async (caseData: CaseAnalysisInput): Promise<CaseAnalysisResult> => {

    // استخراج النصوص من الملفات
    let attachmentsText = ""
    if (caseData.attachments.length > 0) {
        const texts = await Promise.all(
            caseData.attachments.map(a => extractTextFromFile(a.url, a.name))
        )
        attachmentsText = texts.filter(t => t.length > 0).join("\n\n---\n\n")
    }

    const hasAttachments = attachmentsText.length > 0

    const prompt = `
مهم جداً: أجب باللغة العربية الفصحى فقط. لا تستخدم أي لغة أخرى إطلاقاً.

أنت محامٍ ومستشار قانوني خبير متخصص في القانون المصري منذ 20 عاماً. مهمتك تقديم تحليل قانوني عميق ومفصل يساعد المحامي على كسب القضية.

═══════════════════════════════════════
## بيانات العميل
═══════════════════════════════════════
- الاسم: ${caseData.client.fullName}
- النوع: ${caseData.client.type}
- رقم الهاتف: ${caseData.client.phone}
- البريد الإلكتروني: ${caseData.client.email ?? "غير متوفر"}
- العنوان: ${caseData.client.address ?? "غير متوفر"}

═══════════════════════════════════════
## بيانات القضية
═══════════════════════════════════════
- رقم القضية: ${caseData.caseNumber}
- نوع القضية: ${caseData.caseType}
- الحالة الحالية: ${caseData.status}
- الأولوية: ${caseData.priority}
- المحكمة: ${caseData.court ?? "غير محدد"}
- المدينة: ${caseData.city ?? "غير محدد"}
- تاريخ الافتتاح: ${caseData.openedAt.toLocaleDateString("ar-EG")}
${caseData.closedAt ? `- تاريخ الإغلاق: ${caseData.closedAt.toLocaleDateString("ar-EG")}` : ""}
- وصف القضية: ${caseData.description ?? "لا يوجد وصف"}

═══════════════════════════════════════
## فريق العمل
═══════════════════════════════════════
- المحامي المسؤول: ${caseData.assignedTo ?? "غير محدد"}
- فريق القضية: ${caseData.team?.join(", ") || "لا يوجد فريق"}

${hasAttachments
    ? `═══════════════════════════════════════\n## محتوى المستندات المرفقة\n═══════════════════════════════════════\n${attachmentsText}`
    : "## لا توجد مستندات مرفقة حتى الآن"}

═══════════════════════════════════════
## تعليمات التحليل
═══════════════════════════════════════
1. **الملخص**: اكتب ملخصاً شاملاً يتضمن هوية العميل وطبيعة القضية والوضع القانوني الحالي (5-7 جمل).
2. **ملف العميل**: حلل نوع العميل وما يترتب عليه قانونياً وأي مخاطر أو فرص (3-4 جمل).
3. **تقييم القضية**: قيّم قوة القضية مع نسبة فرص النجاح التقريبية والأسباب (4-5 جمل).
4. **الثغرات**: حدد الثغرات القانونية الحقيقية بناءً على نوع القضية والقانون المصري.
5. **التوصيات**: قدم توصيات عملية ومحددة بناءً على نوع القضية تحديداً.
6. **الخطوات القادمة**: اكتب خطوات عملية مرتبة بالأولوية يجب على المحامي تنفيذها فوراً.
7. **مستوى الاستعجال**: حدده بناءً على الأولوية والحالة وتاريخ الافتتاح.
${hasAttachments ? "8. **ملخص المستندات**: حلل كل مستند على حدة واذكر أهميته القانونية وما يثبته أو ينفيه." : ""}

أجب بـ JSON فقط بدون أي نص خارجه وبالعربية فقط:
{
  "summary": "ملخص شامل ومفصل للقضية (5-7 جمل)",
  "clientProfile": "تحليل مفصل لملف العميل (3-4 جمل)",
  "caseAssessment": "تقييم قوة القضية مع نسبة فرص النجاح التقريبية (4-5 جمل)",
  "weaknesses": ["ثغرة قانونية محددة 1", "ثغرة قانونية محددة 2", "ثغرة قانونية محددة 3"],
  "recommendations": ["توصية عملية محددة 1", "توصية عملية محددة 2", "توصية عملية محددة 3"],
  "nextSteps": ["خطوة فورية 1", "خطوة فورية 2", "خطوة فورية 3"],
  "urgencyLevel": "منخفض أو متوسط أو عالي أو عاجل"${hasAttachments ? `,\n  "attachmentsSummary": "تحليل مفصل لكل مستند وأهميته القانونية"` : ""}
}
`

    const completion = await groq.chat.completions.create({
        model:    "llama-3.3-70b-versatile",
        messages: [
            {
                role:    "system",
                content: "أنت مستشار قانوني خبير متخصص في القانون المصري. تجيب دائماً باللغة العربية الفصحى فقط. لا تستخدم أي لغة أخرى إطلاقاً.",
            },
            { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens:  4000,
    })

    const raw       = completion.choices[0]?.message?.content ?? ""
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("Failed to parse AI response")

    return JSON.parse(jsonMatch[0]) as CaseAnalysisResult
}
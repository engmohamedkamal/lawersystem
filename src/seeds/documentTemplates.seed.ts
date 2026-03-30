import DocumentTemplateModel from "../DB/model/documentTemplate.model";

type FieldType = "text" | "date" | "number";

const f = (
  key: string,
  label: string,
  type: FieldType = "text",
  required = false
) => ({ key, label, type, required });

const s = (key: string, label: string, order: number) => ({
  key,
  label,
  order,
});

const F = {
  courtName: f("courtName", "اسم المحكمة", "text", true),
  caseNumber: f("caseNumber", "رقم القضية", "text", true),
  filingDate: f("filingDate", "تاريخ التقديم", "date", true),
  sessionDate: f("sessionDate", "تاريخ الجلسة", "date", false),
  judgmentDate: f("judgmentDate", "تاريخ الحكم", "date", false),

  plaintiffName: f("plaintiffName", "اسم المدعي", "text", true),
  plaintiffAddr: f("plaintiffAddr", "عنوان المدعي"),
  defendantName: f("defendantName", "اسم المدعى عليه", "text", true),
  defendantAddr: f("defendantAddr", "عنوان المدعى عليه"),

  accusedName: f("accusedName", "اسم المتهم", "text", true),
  prosecutionName: f("prosecutionName", "النيابة العامة"),

  appellantName: f("appellantName", "اسم المستأنف", "text", true),
  respondentName: f("respondentName", "اسم المستأنف ضده", "text", true),

  applicantName: f("applicantName", "اسم الطالب", "text", true),
  claimantName: f("claimantName", "اسم الدائن/الطالب", "text", true),
  opponentName: f("opponentName", "اسم الخصم", "text", true),
  authorityName: f("authorityName", "الجهة المختصة", "text", true),

  senderName: f("senderName", "اسم المنذر", "text", true),
  senderAddr: f("senderAddr", "عنوان المنذر"),
  receiverName: f("receiverName", "اسم المنذر إليه", "text", true),
  receiverAddr: f("receiverAddr", "عنوان المنذر إليه", "text", true),

  employeeName: f("employeeName", "اسم العامل", "text", true),
  employerName: f("employerName", "اسم صاحب العمل", "text", true),

  lawyerName: f("lawyerName", "اسم المحامي", "text", true),
  lawyerLicense: f("lawyerLicense", "رقم قيد المحامي"),

  claimAmount: f("claimAmount", "قيمة المطالبة", "number", false),
  compensationAmount: f("compensationAmount", "قيمة التعويض", "number", false),
  executionNumber: f("executionNumber", "رقم ملف التنفيذ"),
  dueDate: f("dueDate", "تاريخ الاستحقاق", "date", false),

  noticeDate: f("noticeDate", "تاريخ الإنذار", "date", true),
  grievanceDate: f("grievanceDate", "تاريخ الشكوى/التظلم", "date", true),
  deadlineDays: f("deadlineDays", "المهلة بالأيام", "number", false),

  propertyAddress: f("propertyAddress", "وصف/عنوان العين", "text", false),
  contractDate: f("contractDate", "تاريخ العقد", "date", true),
  contractValue: f("contractValue", "قيمة العقد", "number", false),
  rentAmount: f("rentAmount", "قيمة الأجرة", "number", false),

  startDate: f("startDate", "تاريخ البداية", "date", false),
  endDate: f("endDate", "تاريخ النهاية", "date", false),
  workStartDate: f("workStartDate", "تاريخ بدء العمل", "date", false),
  salary: f("salary", "الأجر", "number", false),
  workPlace: f("workPlace", "مكان العمل"),
  duration: f("duration", "المدة"),

  companyName: f("companyName", "اسم الشركة", "text", true),
  capitalAmount: f("capitalAmount", "رأس المال", "number", false),

  firstPartyName: f("firstPartyName", "اسم الطرف الأول", "text", true),
  firstPartyId: f("firstPartyId", "رقم هوية الطرف الأول"),
  secondPartyName: f("secondPartyName", "اسم الطرف الثاني", "text", true),
  secondPartyId: f("secondPartyId", "رقم هوية الطرف الثاني"),

  clientName: f("clientName", "اسم الموكل", "text", true),
  clientId: f("clientId", "رقم هوية الموكل", "text", true),
  issueDate: f("issueDate", "تاريخ الإصدار", "date", true),

  declarantName: f("declarantName", "اسم المقر/المتعهد", "text", true),
  declarantId: f("declarantId", "رقم الهوية", "text", false),
  subject: f("subject", "الموضوع", "text", false),

  childName: f("childName", "اسم الصغير/المحضون", "text", false),
  marriageDate: f("marriageDate", "تاريخ الزواج", "date", false),

  settlementDate: f("settlementDate", "تاريخ التسوية", "date", true),
};

const DEFENSE_SECTIONS = [
  s("header", "الديباجة", 1),
  s("introduction", "المقدمة", 2),
  s("facts", "الوقائع", 3),
  s("legalBasis", "الأساس القانوني", 4),
  s("defenses", "أوجه الدفاع", 5),
  s("requests", "الطلبات", 6),
  s("signature", "التوقيع", 7),
];

const LAWSUIT_SECTIONS = [
  s("parties", "أطراف الدعوى", 1),
  s("facts", "وقائع الدعوى", 2),
  s("legalBasis", "الأساس القانوني", 3),
  s("requests", "الطلبات الختامية", 4),
  s("attachments", "المستندات", 5),
  s("signature", "التوقيع", 6),
];

const APPEAL_SECTIONS = [
  s("judgment", "الحكم المطعون عليه", 1),
  s("facts", "الوقائع", 2),
  s("grounds", "أسباب الطعن/الاستئناف", 3),
  s("requests", "الطلبات", 4),
  s("signature", "التوقيع", 5),
];

const EXECUTION_SECTIONS = [
  s("executiveTitle", "السند التنفيذي", 1),
  s("facts", "الوقائع", 2),
  s("grounds", "الأسباب", 3),
  s("requests", "الطلبات", 4),
  s("signature", "التوقيع", 5),
];

const NOTICE_SECTIONS = [
  s("opening", "التمهيد", 1),
  s("subject", "موضوع الإنذار", 2),
  s("facts", "الوقائع", 3),
  s("demands", "المطالب القانونية", 4),
  s("deadline", "المهلة", 5),
  s("signature", "التوقيع", 6),
];

const CONTRACT_SECTIONS = [
  s("preamble", "التمهيد", 1),
  s("subject", "موضوع العقد", 2),
  s("obligations", "الالتزامات", 3),
  s("financialTerms", "البنود المالية", 4),
  s("termination", "الفسخ/الإنهاء", 5),
  s("jurisdiction", "الاختصاص القضائي", 6),
  s("signature", "التوقيعات", 7),
];

const COMPLAINT_SECTIONS = [
  s("applicant", "بيانات مقدم الطلب", 1),
  s("subject", "موضوع الطلب", 2),
  s("facts", "الوقائع", 3),
  s("legalBasis", "الأساس القانوني", 4),
  s("requests", "الطلبات", 5),
  s("attachments", "المرفقات", 6),
  s("signature", "التوقيع", 7),
];

const TEMPLATES = [
  {
    name: "مذكرة دفاع مدنية",
    type: "مذكرة دفاع",
    description: "مذكرة دفاع في دعوى مدنية",
    defaultFields: [
      F.courtName,
      F.caseNumber,
      F.sessionDate,
      F.plaintiffName,
      F.defendantName,
      F.lawyerName,
      F.lawyerLicense,
    ],
    defaultSections: DEFENSE_SECTIONS,
  },
  {
    name: "مذكرة دفاع جنائية",
    type: "مذكرة دفاع",
    description: "مذكرة دفاع في جنحة/جناية",
    defaultFields: [
      F.courtName,
      F.caseNumber,
      F.sessionDate,
      F.accusedName,
      F.prosecutionName,
      F.lawyerName,
      F.lawyerLicense,
    ],
    defaultSections: DEFENSE_SECTIONS,
  },
  {
    name: "مذكرة استئناف",
    type: "استئناف",
    description: "مذكرة بأسباب الاستئناف",
    defaultFields: [
      F.courtName,
      F.caseNumber,
      F.judgmentDate,
      F.appellantName,
      F.respondentName,
      F.lawyerName,
      F.lawyerLicense,
    ],
    defaultSections: APPEAL_SECTIONS,
  },
  {
    name: "صحيفة دعوى مدنية",
    type: "صحيفة دعوى",
    description: "صحيفة دعوى مدنية عامة",
    defaultFields: [
      F.courtName,
      F.filingDate,
      F.plaintiffName,
      F.plaintiffAddr,
      F.defendantName,
      F.defendantAddr,
      F.claimAmount,
      F.lawyerName,
    ],
    defaultSections: LAWSUIT_SECTIONS,
  },
  {
    name: "صحيفة دعوى مطالبة مالية",
    type: "صحيفة دعوى",
    description: "دعوى مطالبة بمبلغ مالي",
    defaultFields: [
      F.courtName,
      F.filingDate,
      F.plaintiffName,
      F.defendantName,
      F.claimAmount,
      F.dueDate,
      F.lawyerName,
    ],
    defaultSections: LAWSUIT_SECTIONS,
  },
  {
    name: "صحيفة دعوى تعويض",
    type: "صحيفة دعوى",
    description: "دعوى تعويض عن ضرر",
    defaultFields: [
      F.courtName,
      F.filingDate,
      F.plaintiffName,
      F.defendantName,
      F.compensationAmount,
      F.lawyerName,
    ],
    defaultSections: LAWSUIT_SECTIONS,
  },
  {
    name: "صحيفة دعوى طرد للغصب",
    type: "صحيفة دعوى",
    description: "دعوى طرد للغصب أو الإخلاء",
    defaultFields: [
      F.courtName,
      F.filingDate,
      F.plaintiffName,
      F.defendantName,
      F.propertyAddress,
      F.lawyerName,
    ],
    defaultSections: LAWSUIT_SECTIONS,
  },
  {
    name: "صحيفة دعوى صحة توقيع",
    type: "صحيفة دعوى",
    description: "دعوى صحة توقيع على محرر عرفي",
    defaultFields: [
      F.courtName,
      F.filingDate,
      F.plaintiffName,
      F.defendantName,
      F.contractDate,
      F.lawyerName,
    ],
    defaultSections: LAWSUIT_SECTIONS,
  },
  {
    name: "صحيفة دعوى صحة ونفاذ",
    type: "صحيفة دعوى",
    description: "دعوى صحة ونفاذ عقد",
    defaultFields: [
      F.courtName,
      F.filingDate,
      F.plaintiffName,
      F.defendantName,
      F.contractDate,
      F.contractValue,
      F.propertyAddress,
      F.lawyerName,
    ],
    defaultSections: LAWSUIT_SECTIONS,
  },
  {
    name: "صحيفة استئناف",
    type: "استئناف",
    description: "صحيفة استئناف حكم",
    defaultFields: [
      F.courtName,
      F.caseNumber,
      F.judgmentDate,
      F.appellantName,
      F.respondentName,
      F.lawyerName,
    ],
    defaultSections: APPEAL_SECTIONS,
  },
  {
    name: "إشكال في التنفيذ",
    type: "تنفيذ",
    description: "إشكال وقتي/موضوعي في التنفيذ",
    defaultFields: [
      F.courtName,
      F.caseNumber,
      F.executionNumber,
      F.judgmentDate,
      F.plaintiffName,
      F.defendantName,
      F.lawyerName,
    ],
    defaultSections: EXECUTION_SECTIONS,
  },
  {
    name: "عريضة أمر أداء",
    type: "أوامر",
    description: "طلب استصدار أمر أداء",
    defaultFields: [
      F.courtName,
      F.claimantName,
      F.defendantName,
      F.claimAmount,
      F.dueDate,
      F.lawyerName,
    ],
    defaultSections: COMPLAINT_SECTIONS,
  },
  {
    name: "طلب أمر على عريضة",
    type: "أوامر",
    description: "طلب أمر على عريضة",
    defaultFields: [
      F.courtName,
      F.applicantName,
      F.subject,
      F.filingDate,
      F.lawyerName,
    ],
    defaultSections: COMPLAINT_SECTIONS,
  },
  {
    name: "التماس إعادة نظر",
    type: "طعون",
    description: "التماس إعادة النظر في حكم نهائي",
    defaultFields: [
      F.courtName,
      F.caseNumber,
      F.judgmentDate,
      F.applicantName,
      F.opponentName,
      F.lawyerName,
    ],
    defaultSections: APPEAL_SECTIONS,
  },
  {
    name: "إنذار رسمي على يد محضر",
    type: "إنذار",
    description: "إنذار رسمي قبل أو أثناء النزاع",
    defaultFields: [
      F.senderName,
      F.senderAddr,
      F.receiverName,
      F.receiverAddr,
      F.noticeDate,
      F.deadlineDays,
      F.lawyerName,
    ],
    defaultSections: NOTICE_SECTIONS,
  },
  {
    name: "شكوى / تظلم / التماس",
    type: "طلبات",
    description: "شكوى أو تظلم أو التماس موجّه لجهة رسمية",
    defaultFields: [
      F.authorityName,
      F.applicantName,
      F.grievanceDate,
      F.subject,
      F.lawyerName,
    ],
    defaultSections: COMPLAINT_SECTIONS,
  },
  {
    name: "صحيفة دعوى أحوال شخصية",
    type: "صحيفة دعوى",
    description: "دعوى أحوال شخصية",
    defaultFields: [
      F.courtName,
      F.filingDate,
      F.plaintiffName,
      F.defendantName,
      F.childName,
      F.marriageDate,
      F.lawyerName,
    ],
    defaultSections: LAWSUIT_SECTIONS,
  },
  {
    name: "صحيفة دعوى عمالية",
    type: "صحيفة دعوى",
    description: "دعوى عمالية ضد صاحب العمل",
    defaultFields: [
      F.courtName,
      F.filingDate,
      F.employeeName,
      F.employerName,
      F.workStartDate,
      F.salary,
      F.claimAmount,
      F.lawyerName,
    ],
    defaultSections: LAWSUIT_SECTIONS,
  },
  {
    name: "عقد بيع ابتدائي",
    type: "عقد",
    description: "عقد بيع ابتدائي",
    defaultFields: [
      F.contractDate,
      F.firstPartyName,
      F.firstPartyId,
      F.secondPartyName,
      F.secondPartyId,
      F.propertyAddress,
      F.contractValue,
      F.lawyerName,
    ],
    defaultSections: CONTRACT_SECTIONS,
  },
  {
    name: "عقد إيجار",
    type: "عقد",
    description: "عقد إيجار سكني/تجاري",
    defaultFields: [
      F.contractDate,
      F.firstPartyName,
      F.secondPartyName,
      F.propertyAddress,
      F.rentAmount,
      F.startDate,
      F.endDate,
      F.lawyerName,
    ],
    defaultSections: CONTRACT_SECTIONS,
  },
  {
    name: "عقد عمل",
    type: "عقد",
    description: "عقد عمل فردي",
    defaultFields: [
      F.contractDate,
      F.employerName,
      F.employeeName,
      F.salary,
      F.workPlace,
      F.duration,
      F.workStartDate,
      F.lawyerName,
    ],
    defaultSections: CONTRACT_SECTIONS,
  },
  {
    name: "اتفاقية تسوية ومخالصة",
    type: "اتفاقية",
    description: "اتفاقية تسوية ومخالصة نهائية",
    defaultFields: [
      F.settlementDate,
      F.firstPartyName,
      F.secondPartyName,
      F.claimAmount,
      F.lawyerName,
    ],
    defaultSections: CONTRACT_SECTIONS,
  },
  {
    name: "عقد شراكة",
    type: "عقد",
    description: "عقد شراكة بين طرفين/شركاء",
    defaultFields: [
      F.contractDate,
      F.companyName,
      F.firstPartyName,
      F.secondPartyName,
      F.capitalAmount,
      F.duration,
      F.lawyerName,
    ],
    defaultSections: CONTRACT_SECTIONS,
  },
  {
    name: "إقرار وتعهد",
    type: "إقرار",
    description: "إقرار أو تعهد قانوني",
    defaultFields: [
      F.declarantName,
      F.declarantId,
      F.issueDate,
      F.subject,
      F.lawyerName,
    ],
    defaultSections: [
      s("introduction", "التمهيد", 1),
      s("statement", "نص الإقرار/التعهد", 2),
      s("effects", "الآثار القانونية", 3),
      s("signature", "التوقيع", 4),
    ],
  },
  {
    name: "توكيل قانوني",
    type: "توكيل",
    description: "توكيل قانوني لمحام",
    defaultFields: [
      F.clientName,
      F.clientId,
      F.lawyerName,
      F.lawyerLicense,
      F.issueDate,
    ],
    defaultSections: [
      s("authorization", "نص التفويض", 1),
      s("scope", "نطاق الصلاحيات", 2),
      s("duration", "مدة السريان", 3),
      s("signature", "التوقيعات", 4),
    ],
  },
];

export const seedDocumentTemplates = async (): Promise<void> => {
  const ops = TEMPLATES.map((template) => ({
    updateOne: {
      filter: { name: template.name, type: template.type },
      update: {
        $set: {
          ...template,
          isActive: true,
        },
      },
      upsert: true,
    },
  }));

  const result = await DocumentTemplateModel.bulkWrite(ops);

  console.log(
    `[SEED] templates => upserted: ${result.upsertedCount}, modified: ${result.modifiedCount}, matched: ${result.matchedCount}`
  );
};
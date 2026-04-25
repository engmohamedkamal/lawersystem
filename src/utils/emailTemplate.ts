export interface EmailTemplateOptions {
  title: string;
  subtitle?: string;
  badge?: string;
  bodyHtml: string;
  actionBtn?: {
    text: string;
    url: string;
  };
}

export const buildEmailTemplate = (titleOrOptions: string | EmailTemplateOptions, bodyHtml?: string) => {
  let title = "";
  let subtitle = "";
  let badge = "";
  let body = "";
  let actionBtn: EmailTemplateOptions["actionBtn"] | null = null;

  if (typeof titleOrOptions === "string") {
    title = titleOrOptions;
    body = bodyHtml || "";
  } else {
    title = titleOrOptions.title;
    subtitle = titleOrOptions.subtitle || "";
    badge = titleOrOptions.badge || "";
    body = titleOrOptions.bodyHtml;
    actionBtn = titleOrOptions.actionBtn || null;
  }

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

    body {
      margin: 0;
      padding: 0;
      direction: rtl;
      font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
      background: #071b35;
      color: #ffffff;
      -webkit-font-smoothing: antialiased;
    }

    .email-wrapper {
      width: 100%;
      padding: 40px 14px;
      box-sizing: border-box;
      background:
        radial-gradient(circle at top right, rgba(212, 169, 74, 0.16), transparent 32%),
        linear-gradient(180deg, #081f3d 0%, #06182f 100%);
    }

    .container {
      max-width: 640px;
      margin: 0 auto;
      overflow: hidden;
      border-radius: 28px;
      background: #0a2343;
      border: 1px solid rgba(212, 169, 74, 0.34);
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
    }

    .topbar {
      padding: 22px 30px;
      background: #061b35;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      text-align: left;
    }

    .brand {
      display: inline-block;
      color: #ffffff;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }

    .brand span {
      color: #d4a94a;
      margin-right: 8px;
      font-size: 18px;
    }

    .header {
      padding: 46px 34px 34px;
      text-align: right;
      background:
        linear-gradient(135deg, rgba(10, 35, 67, 0.92), rgba(6, 24, 47, 0.98));
    }

    .badge {
      display: inline-block;
      margin-bottom: 22px;
      padding: 7px 17px;
      color: #d4a94a;
      border: 1px solid rgba(212, 169, 74, 0.72);
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      background: rgba(212, 169, 74, 0.08);
    }

    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 34px;
      line-height: 1.45;
      font-weight: 900;
      letter-spacing: -0.8px;
    }

    .header h1 strong,
    .gold {
      color: #d4a94a;
    }

    .subtitle {
      margin: 18px 0 0;
      color: #dbe7f7;
      font-size: 15px;
      line-height: 1.9;
      font-weight: 500;
    }

    .content {
      padding: 34px;
      color: #eef5ff;
      font-size: 15px;
      line-height: 1.95;
      background: #08203d;
    }

    .content p {
      margin: 0 0 18px;
    }

    .content h3 {
      margin: 26px 0 14px;
      color: #ffffff;
      font-size: 20px;
      font-weight: 900;
    }

    .highlight-box,
    .info-card {
      margin: 28px 0;
      padding: 22px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.055);
      border: 1px solid rgba(212, 169, 74, 0.3);
      color: #f5f8ff;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .highlight-box {
      border-right: 4px solid #d4a94a;
    }

    .content ul {
      padding: 0;
      margin: 22px 0;
      list-style: none;
    }

    .content li {
      position: relative;
      margin: 12px 0;
      padding-right: 28px;
    }

    .content li::before {
      content: "✓";
      position: absolute;
      right: 0;
      top: 0;
      width: 18px;
      height: 18px;
      border: 1px solid #d4a94a;
      border-radius: 50%;
      color: #d4a94a;
      font-size: 11px;
      line-height: 18px;
      text-align: center;
      font-weight: 900;
    }

    .action-container {
      text-align: center;
      margin: 36px 0 8px;
    }

    .btn-main {
      display: inline-block;
      min-width: 160px;
      padding: 15px 28px;
      border-radius: 13px;
      background: #d4a94a;
      color: #061b35 !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 900;
      box-shadow: 0 12px 26px rgba(212, 169, 74, 0.26);
    }

    .certification {
      padding: 28px 24px;
      text-align: center;
      background: #071b35;
      border-top: 1px solid rgba(255, 255, 255, 0.07);
    }

    .scale-icon {
      margin-bottom: 8px;
      color: #d4a94a;
      font-size: 26px;
    }

    .cert-text {
      color: #aebdd0;
      font-size: 11px;
      letter-spacing: 1.4px;
      font-weight: 800;
    }

    .footer {
      padding: 30px 28px 36px;
      text-align: center;
      background: #06182f;
      border-top: 1px solid rgba(212, 169, 74, 0.18);
    }

    .footer-brand {
      margin-bottom: 12px;
      color: #ffffff;
      font-size: 18px;
      font-weight: 900;
    }

    .footer-brand span {
      color: #d4a94a;
    }

    .footer-copy {
      margin: 0 0 18px;
      color: #9fb0c7;
      font-size: 12px;
      line-height: 1.8;
    }

    .footer-links a {
      color: #d4a94a;
      text-decoration: none;
      font-size: 11px;
      margin: 0 8px;
      font-weight: 800;
    }

    @media only screen and (max-width: 520px) {
      .email-wrapper { padding: 20px 10px; }
      .topbar, .header, .content { padding-right: 22px; padding-left: 22px; }
      .header h1 { font-size: 28px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="topbar">
        <div class="brand">lexora <span>⚖</span></div>
      </div>

      <div class="header">
        ${badge ? `<div class="badge">${badge}</div>` : ""}
        <h1>${title}</h1>
        ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
      </div>

      <div class="content">
        ${body}

        ${actionBtn ? `
        <div class="action-container">
          <a href="${actionBtn.url}" class="btn-main">${actionBtn.text}</a>
        </div>
        ` : ""}
      </div>

      <div class="certification">
        <div class="scale-icon">⚖</div>
        <div class="cert-text">DIGITALLY CERTIFIED BY LEXORA OS</div>
      </div>

      <div class="footer">
        <div class="footer-brand">lexora <span>⚖</span></div>
        <p class="footer-copy">&copy; ${new Date().getFullYear()} Lexora Legal Group. All rights reserved.<br />هذه رسالة تلقائية من النظام، يرجى عدم الرد عليها.</p>
        <div class="footer-links">
          <a href="#">سياسة الخصوصية</a>
          <a href="#">الشروط القانونية</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

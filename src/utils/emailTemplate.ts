export interface EmailTemplateOptions {
  title: string;
  subtitle?: string;
  badge?: string;
  headerId?: string;
  bodyHtml: string;
}

export const buildEmailTemplate = (titleOrOptions: string | EmailTemplateOptions, bodyHtml?: string) => {
  let title = "";
  let subtitle = "";
  let badge = "";
  let headerId = "";
  let body = "";

  if (typeof titleOrOptions === 'string') {
    title = titleOrOptions;
    body = bodyHtml || "";
  } else {
    title = titleOrOptions.title;
    subtitle = titleOrOptions.subtitle || "";
    badge = titleOrOptions.badge || "";
    headerId = titleOrOptions.headerId || "";
    body = titleOrOptions.bodyHtml;
  }

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f4f5;
      color: #1f2937;
      margin: 0;
      padding: 0;
    }
    .email-wrapper {
      width: 100%;
      background-color: #f4f4f5;
      padding: 40px 0;
    }
    .container {
      max-width: 640px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
    }
    .header {
      background-color: #171923;
      color: #ffffff;
      padding: 40px 32px;
      text-align: right;
    }
    .header-top {
      display: table;
      width: 100%;
      margin-bottom: 24px;
    }
    .badge-wrap {
      display: table-cell;
      text-align: right;
    }
    .id-wrap {
      display: table-cell;
      text-align: left;
    }
    .badge {
      background-color: #fde047;
      color: #854d0e;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .header-id {
      color: #4b5563;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
    }
    .header h1 {
      margin: 0 0 12px 0;
      font-size: 26px;
      font-weight: 700;
      line-height: 1.4;
    }
    .subtitle {
      color: #9ca3af;
      font-size: 15px;
      font-style: italic;
      margin: 0;
      line-height: 1.6;
    }
    .content {
      padding: 40px 32px;
      font-size: 15px;
      line-height: 1.8;
      color: #374151;
    }
    .quote-box {
      border-right: 4px solid #fde047;
      padding: 4px 16px;
      margin: 24px 0;
      color: #4b5563;
      font-style: italic;
      background-color: #fdfdfd;
    }
    .info-card {
      background-color: #f3f4f6;
      border-radius: 8px;
      padding: 24px;
      margin: 24px 0;
      display: table;
      width: 100%;
      box-sizing: border-box;
    }
    .info-col {
      display: table-cell;
      vertical-align: middle;
    }
    .info-col-left {
      text-align: left;
    }
    .btn-black {
      display: inline-block;
      background-color: #000000;
      color: #fde047 !important;
      padding: 12px 24px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .grid-2 {
      display: table;
      width: 100%;
      margin-bottom: 24px;
    }
    .grid-3 {
      display: table;
      width: 100%;
      margin: 32px 0;
    }
    .grid-col {
      display: table-cell;
    }
    .label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      display: block;
    }
    .value {
      font-size: 14px;
      color: #111827;
      font-weight: 600;
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      background-color: #f59e0b;
      border-radius: 50%;
      margin-left: 6px;
    }
    .certification {
      text-align: center;
      padding: 32px;
      border-top: 1px solid #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
      background-color: #ffffff;
    }
    .scale-icon {
      color: #d97706;
      font-size: 24px;
      margin-bottom: 12px;
    }
    .cert-text {
      font-size: 11px;
      color: #9ca3af;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .footer {
      background-color: #f9fafb;
      padding: 32px;
      text-align: center;
    }
    .footer-brand {
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
      letter-spacing: 2px;
      margin-bottom: 16px;
    }
    .footer-copy {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 16px;
    }
    .footer-links a {
      color: #9ca3af;
      text-decoration: none;
      font-size: 11px;
      margin: 0 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      
      <div class="header">
        ${badge || headerId ? `
        <div class="header-top">
          <div class="badge-wrap">${badge ? `<span class="badge">${badge}</span>` : ''}</div>
          <div class="id-wrap">${headerId ? `<span class="header-id">${headerId}</span>` : ''}</div>
        </div>
        ` : ''}
        <h1>${title}</h1>
        ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
      </div>

      <div class="content">
        ${body}
      </div>

      <div class="certification">
        <div class="scale-icon">⚖️</div>
        <div class="cert-text">DIGITALLY CERTIFIED BY LEXORE OS</div>
      </div>

      <div class="footer">
        <div class="footer-brand">LEXORE</div>
        <div class="footer-copy">&copy; ${new Date().getFullYear()} Lexore Legal Group. All rights reserved.</div>
        <div class="footer-links">
          <a href="#">PRIVACY POLICY</a>
          <a href="#">LEGAL TERMS</a>
          <a href="#">UNSUBSCRIBE</a>
        </div>
      </div>

    </div>
  </div>
</body>
</html>
  `;
};

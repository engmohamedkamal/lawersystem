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
  let actionBtn = null;

  if (typeof titleOrOptions === 'string') {
    title = titleOrOptions;
    body = bodyHtml || "";
  } else {
    title = titleOrOptions.title;
    subtitle = titleOrOptions.subtitle || "";
    badge = titleOrOptions.badge || "";
    body = titleOrOptions.bodyHtml;
    actionBtn = titleOrOptions.actionBtn;
  }

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f4f5;
      color: #1f2937;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      width: 100%;
      background-color: #f4f4f5;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01);
    }
    .header {
      background-color: #1a202c;
      color: #ffffff;
      padding: 48px 32px;
      text-align: right;
      position: relative;
    }
    .badge-wrap {
      margin-bottom: 24px;
    }
    .badge {
      background-color: #fef08a;
      color: #854d0e;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      display: inline-block;
    }
    .header h1 {
      margin: 0 0 12px 0;
      font-size: 28px;
      font-weight: 800;
      line-height: 1.4;
      color: #f9fafb;
    }
    .subtitle {
      color: #9ca3af;
      font-size: 16px;
      font-weight: 400;
      margin: 0;
      line-height: 1.6;
    }
    .content {
      padding: 40px 32px;
      font-size: 16px;
      line-height: 1.8;
      color: #374151;
      background-color: #ffffff;
    }
    .content p {
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content h3 {
      font-size: 18px;
      color: #111827;
      margin-bottom: 16px;
      font-weight: 700;
    }
    .highlight-box {
      border-right: 4px solid #facc15;
      padding: 16px 20px;
      margin: 32px 0;
      background-color: #fefce8;
      border-radius: 8px 0 0 8px;
      color: #854d0e;
      font-size: 15px;
      line-height: 1.7;
    }
    .info-card {
      background-color: #f3f4f6;
      border-radius: 12px;
      padding: 24px;
      margin: 32px 0;
      text-align: center;
    }
    .action-container {
      text-align: center;
      margin: 40px 0 10px 0;
    }
    .btn-main {
      display: inline-block;
      background-color: #1a202c;
      color: #fde047 !important;
      padding: 14px 32px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 800;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      transition: all 0.2s ease;
    }
    .certification {
      text-align: center;
      padding: 32px 24px;
      border-top: 1px solid #f3f4f6;
      background-color: #ffffff;
    }
    .scale-icon {
      color: #d97706;
      font-size: 28px;
      margin-bottom: 12px;
      opacity: 0.9;
    }
    .cert-text {
      font-size: 10px;
      color: #9ca3af;
      letter-spacing: 2px;
      text-transform: uppercase;
      font-weight: 700;
    }
    .footer {
      background-color: #f8fafc;
      padding: 40px 32px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer-brand {
      font-size: 16px;
      font-weight: 800;
      color: #1e293b;
      letter-spacing: 3px;
      margin-bottom: 16px;
    }
    .footer-copy {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .footer-links a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 12px;
      margin: 0 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      
      <div class="header">
        ${badge ? `
        <div class="badge-wrap">
          <span class="badge">${badge}</span>
        </div>
        ` : ''}
        <h1>${title}</h1>
        ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
      </div>

      <div class="content">
        ${body}
        
        ${actionBtn ? `
        <div class="action-container">
          <a href="${actionBtn.url}" class="btn-main">${actionBtn.text}</a>
        </div>
        ` : ''}
      </div>

      <div class="certification">
        <div class="scale-icon">⚖️</div>
        <div class="cert-text">DIGITALLY CERTIFIED BY LEXORE OS</div>
      </div>

      <div class="footer">
        <div class="footer-brand">LEXORE</div>
        <div class="footer-copy">&copy; ${new Date().getFullYear()} Lexore Legal Group. All rights reserved.<br>هذه رسالة تلقائية من النظام، يرجى عدم الرد عليها.</div>
        <div class="footer-links">
          <a href="#">PRIVACY POLICY</a>
          <a href="#">LEGAL TERMS</a>
        </div>
      </div>

    </div>
  </div>
</body>
</html>
  `;
};

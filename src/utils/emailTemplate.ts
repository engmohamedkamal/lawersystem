export const buildEmailTemplate = (title: string, bodyHtml: string) => {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #F9FAFB;
      color: #1F2937;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
      border: 1px solid #E5E7EB;
    }
    .header {
      background-color: #2563EB;
      color: #ffffff;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      letter-spacing: 1px;
    }
    .content {
      padding: 32px 24px;
      line-height: 1.8;
      font-size: 16px;
      color: #4B5563;
    }
    .content h2 {
      color: #1F2937;
      margin-top: 0;
    }
    .footer {
      background-color: #F9FAFB;
      padding: 20px 24px;
      text-align: center;
      font-size: 14px;
      color: #6B7280;
      border-top: 1px solid #E5E7EB;
    }
    .btn {
      display: inline-block;
      background-color: #2563EB;
      color: #ffffff;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin-top: 20px;
      font-weight: bold;
    }
    .highlight {
      color: #10B981;
      font-weight: bold;
    }
    .danger {
      color: #EF4444;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Lexore</h1>
    </div>
    <div class="content">
      <h2>${title}</h2>
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>هذه رسالة تلقائية من نظام Lexore. يرجى عدم الرد على هذا البريد.</p>
      <p>&copy; ${new Date().getFullYear()} Lexore. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
  `;
};

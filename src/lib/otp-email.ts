export function otpEmailHtml(code: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="420" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                CardPulse
              </div>
              <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">
                Your credit card command centre
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 20px;">
              <p style="font-size:16px;color:#374151;margin:0 0 8px;">Hi there,</p>
              <p style="font-size:15px;color:#6b7280;margin:0 0 28px;line-height:1.5;">
                Use the code below to sign in to CardPulse. It expires in 10 minutes.
              </p>
              <!-- OTP Code -->
              <div style="background:#f8f7ff;border:2px dashed #6366f1;border-radius:12px;padding:24px;text-align:center;margin:0 0 28px;">
                <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#6366f1;font-family:'Courier New',monospace;">
                  ${code}
                </div>
              </div>
              <p style="font-size:13px;color:#9ca3af;margin:0 0 4px;line-height:1.5;">
                If you didn't request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;">
              <p style="font-size:12px;color:#d1d5db;margin:0;text-align:center;">
                CardPulse &mdash; Track, manage, and pay off your credit cards smarter.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

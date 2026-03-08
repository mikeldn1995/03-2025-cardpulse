export function otpEmailHtml(code: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="420" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e5e5e5;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;">
              <div style="font-size:15px;font-weight:700;color:#0a0a0a;letter-spacing:-0.3px;">
                CardPulse
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px 32px 20px;">
              <p style="font-size:14px;color:#0a0a0a;margin:0 0 4px;font-weight:600;">Sign in to your account</p>
              <p style="font-size:13px;color:#737373;margin:0 0 24px;line-height:1.5;">
                Copy the code below to verify your identity. It expires in 10 minutes.
              </p>
              <!-- OTP Code -->
              <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:6px;padding:20px;text-align:center;margin:0 0 24px;cursor:pointer;" onclick="navigator.clipboard&&navigator.clipboard.writeText('${code}')">
                <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0a0a0a;font-family:'SF Mono','Cascadia Code','Courier New',monospace;">
                  ${code}
                </div>
                <div style="font-size:11px;color:#a3a3a3;margin-top:8px;text-transform:uppercase;letter-spacing:0.5px;">
                  Click to copy
                </div>
              </div>
              <p style="font-size:12px;color:#a3a3a3;margin:0;line-height:1.5;">
                If you didn't request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #f5f5f5;">
              <p style="font-size:11px;color:#d4d4d4;margin:0;">
                CardPulse
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

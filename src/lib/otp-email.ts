export function otpEmailHtml(code: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0A1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A1628;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="420" cellpadding="0" cellspacing="0" style="background:#1B2A4A;border-radius:8px;border:1px solid #2A3F6A;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;">
              <div style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                CardPulse
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px 32px 20px;">
              <p style="font-size:14px;color:#ffffff;margin:0 0 4px;font-weight:600;">Sign in to your account</p>
              <p style="font-size:13px;color:#94A3B8;margin:0 0 24px;line-height:1.5;">
                Copy the code below to verify your identity. It expires in 10 minutes.
              </p>
              <!-- OTP Code -->
              <div style="background:#0A1628;border:1px solid #2A3F6A;border-radius:6px;padding:20px;text-align:center;margin:0 0 24px;cursor:pointer;" onclick="navigator.clipboard&&navigator.clipboard.writeText('${code}')">
                <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#ffffff;font-family:'SF Mono','Cascadia Code','Courier New',monospace;">
                  ${code}
                </div>
                <div style="font-size:11px;color:#64748B;margin-top:8px;text-transform:uppercase;letter-spacing:0.5px;">
                  Click to copy
                </div>
              </div>
              <p style="font-size:12px;color:#64748B;margin:0;line-height:1.5;">
                If you didn't request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #2A3F6A;">
              <p style="font-size:11px;color:#475569;margin:0;">
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

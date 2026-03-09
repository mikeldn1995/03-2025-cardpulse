export function reminderEmailHtml(
  userName: string,
  staleAccounts: { institution: string; accountName: string; lastUpdate: string }[],
  appUrl: string,
): string {
  const accountRows = staleAccounts
    .map(
      (a) => `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #1B2A4A; color: #CBD5E1; font-size: 14px;">
            ${a.institution}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #1B2A4A; color: #CBD5E1; font-size: 14px;">
            ${a.accountName}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #1B2A4A; color: #94A3B8; font-size: 14px; text-align: right;">
            ${a.lastUpdate}
          </td>
        </tr>`,
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CardPulse Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A1628; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A1628;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">
                Card<span style="color: #38BDF8;">Pulse</span>
              </h1>
            </td>
          </tr>

          <!-- Body Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #1B2A4A; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 32px;">
                    <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #FFFFFF;">
                      Hi ${userName}, time to update your statements
                    </h2>
                    <p style="margin: 0 0 24px; font-size: 14px; color: #94A3B8; line-height: 1.5;">
                      The following accounts haven't been updated recently. Upload your latest statements to keep your balances and spending insights accurate.
                    </p>

                    <!-- Accounts Table -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F1D32; border-radius: 8px; overflow: hidden;">
                      <thead>
                        <tr>
                          <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1B2A4A;">
                            Institution
                          </th>
                          <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1B2A4A;">
                            Account
                          </th>
                          <th style="padding: 10px 16px; text-align: right; font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1B2A4A;">
                            Last Update
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        ${accountRows}
                      </tbody>
                    </table>

                    <!-- CTA Button -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                      <tr>
                        <td align="center">
                          <a href="${appUrl}/upload" target="_blank" style="display: inline-block; padding: 12px 32px; background-color: #38BDF8; color: #0A1628; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                            Upload Statements
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
                You're receiving this because you have an account on CardPulse.<br />
                <a href="${appUrl}" style="color: #64748B; text-decoration: underline;">Open CardPulse</a>
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

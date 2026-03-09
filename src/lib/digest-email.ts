export function digestEmailHtml(data: {
  userName: string
  netWorth: number
  debtTotal: number
  accounts: { institution: string; balance: number; change: number }[]
  topCategories: { name: string; amount: number }[]
  appUrl: string
}): string {
  const { userName, netWorth, debtTotal, accounts, topCategories, appUrl } = data

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n)

  const arrow = (change: number) => {
    if (change > 0) return `<span style="color: #4ADE80;">&#9650; ${fmt(change)}</span>`
    if (change < 0) return `<span style="color: #F87171;">&#9660; ${fmt(Math.abs(change))}</span>`
    return `<span style="color: #94A3B8;">&mdash;</span>`
  }

  const accountRows = accounts
    .map(
      (a) => `
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1B2A4A; color: #CBD5E1; font-size: 14px;">
            ${a.institution}
          </td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1B2A4A; color: #FFFFFF; font-size: 14px; text-align: right; font-weight: 500;">
            ${fmt(a.balance)}
          </td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1B2A4A; font-size: 13px; text-align: right;">
            ${arrow(a.change)}
          </td>
        </tr>`,
    )
    .join("")

  const categoryRows = topCategories
    .map(
      (c) => `
        <tr>
          <td style="padding: 8px 16px; border-bottom: 1px solid #1B2A4A; color: #CBD5E1; font-size: 14px; text-transform: capitalize;">
            ${c.name}
          </td>
          <td style="padding: 8px 16px; border-bottom: 1px solid #1B2A4A; color: #F87171; font-size: 14px; text-align: right; font-weight: 500;">
            ${fmt(c.amount)}
          </td>
        </tr>`,
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CardPulse Weekly Digest</title>
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
              <p style="margin: 8px 0 0; font-size: 13px; color: #64748B; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em;">
                Weekly Digest
              </p>
            </td>
          </tr>

          <!-- Body Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #1B2A4A; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 32px;">

                    <p style="margin: 0 0 24px; font-size: 15px; color: #CBD5E1; line-height: 1.5;">
                      Hi ${userName}, here's your week at a glance.
                    </p>

                    <!-- Summary Cards -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                      <tr>
                        <td width="50%" style="padding-right: 8px;" valign="top">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F1D32; border-radius: 8px;">
                            <tr>
                              <td style="padding: 16px 20px;">
                                <p style="margin: 0; font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em;">Net Worth</p>
                                <p style="margin: 6px 0 0; font-size: 22px; font-weight: 700; color: ${netWorth >= 0 ? "#4ADE80" : "#F87171"};">
                                  ${fmt(netWorth)}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td width="50%" style="padding-left: 8px;" valign="top">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F1D32; border-radius: 8px;">
                            <tr>
                              <td style="padding: 16px 20px;">
                                <p style="margin: 0; font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em;">Total Debt</p>
                                <p style="margin: 6px 0 0; font-size: 22px; font-weight: 700; color: #F87171;">
                                  ${fmt(debtTotal)}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Accounts Table -->
                    <h3 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em;">
                      Account Balances
                    </h3>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F1D32; border-radius: 8px; overflow: hidden; margin-bottom: 28px;">
                      <thead>
                        <tr>
                          <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1B2A4A;">
                            Account
                          </th>
                          <th style="padding: 10px 16px; text-align: right; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1B2A4A;">
                            Balance
                          </th>
                          <th style="padding: 10px 16px; text-align: right; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1B2A4A;">
                            Change
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        ${accountRows}
                      </tbody>
                    </table>

                    <!-- Top Categories -->
                    ${topCategories.length > 0 ? `
                    <h3 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em;">
                      Top Spending Categories
                    </h3>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F1D32; border-radius: 8px; overflow: hidden; margin-bottom: 28px;">
                      <tbody>
                        ${categoryRows}
                      </tbody>
                    </table>
                    ` : ""}

                    <!-- CTA Button -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${appUrl}" target="_blank" style="display: inline-block; padding: 12px 32px; background-color: #38BDF8; color: #0A1628; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                            View Dashboard
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

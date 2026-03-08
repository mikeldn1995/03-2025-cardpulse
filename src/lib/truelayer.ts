// TrueLayer configuration — sandbox for now, swap URLs for production later
const IS_SANDBOX = (process.env.TRUELAYER_CLIENT_ID || "").startsWith("sandbox-")

export const TL = {
  clientId: process.env.TRUELAYER_CLIENT_ID!,
  clientSecret: process.env.TRUELAYER_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/truelayer/callback`,
  authBase: IS_SANDBOX ? "https://auth.truelayer-sandbox.com" : "https://auth.truelayer.com",
  apiBase: IS_SANDBOX ? "https://api.truelayer-sandbox.com" : "https://api.truelayer.com",
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: TL.clientId,
    scope: "cards balance offline_access",
    redirect_uri: TL.redirectUri,
    state,
    providers: "uk-ob-all uk-oauth-all",
  })
  return `${TL.authBase}/?${params.toString()}`
}

export async function exchangeCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const res = await fetch(`${TL.authBase}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: TL.clientId,
      client_secret: TL.clientSecret,
      redirect_uri: TL.redirectUri,
      code,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${err}`)
  }
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const res = await fetch(`${TL.authBase}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: TL.clientId,
      client_secret: TL.clientSecret,
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token refresh failed: ${err}`)
  }
  return res.json()
}

export interface TLCard {
  account_id: string
  card_network: string
  card_type: string
  display_name: string
  partial_card_number: string
  currency: string
}

export interface TLBalance {
  current: number
  available: number
  credit_limit: number
  currency: string
  last_statement_balance: number
  last_statement_date: string
  payment_due: number
  payment_due_date: string
}

export async function fetchCards(accessToken: string): Promise<TLCard[]> {
  const res = await fetch(`${TL.apiBase}/data/v1/cards`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch cards: ${res.status}`)
  const data = await res.json()
  return data.results || []
}

export async function fetchCardBalance(accessToken: string, accountId: string): Promise<TLBalance | null> {
  const res = await fetch(`${TL.apiBase}/data/v1/cards/${accountId}/balance`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.results?.[0] || null
}

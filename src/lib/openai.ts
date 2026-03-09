import OpenAI from "openai"
import type { ParsedStatement, ParsedTransaction, AccountCategory } from "@/types"

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `You are a financial statement parser. Given a bank or credit card statement (as text extracted from PDF or CSV), extract the following structured data.

Return valid JSON with this exact schema:
{
  "institution": "string — bank/institution name",
  "institutionDomain": "string|null — website domain for logo lookup (e.g. barclays.co.uk)",
  "accountName": "string — specific account/product name",
  "category": "credit_card|current_account|savings|isa|investment|crypto|loan|mortgage",
  "last4": "string — last 4 digits of account/card number",
  "currency": "string — ISO 4217 code (GBP, USD, EUR, etc.)",
  "balance": "number — closing/current balance. For credit cards, positive means amount owed.",
  "creditLimit": "number|null — credit limit if applicable",
  "interestCharged": "number|null — interest charged this period",
  "minimumPayment": "number|null — minimum payment amount",
  "paymentDueDate": "string|null — YYYY-MM-DD format",
  "statementPeriodStart": "string|null — YYYY-MM-DD",
  "statementPeriodEnd": "string|null — YYYY-MM-DD",
  "statementDate": "string — YYYY-MM-DD the statement was generated",
  "aprDetected": "number|null — APR if mentioned (as percentage, e.g. 24.9)",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": "number — negative for debits/spending, positive for credits/payments",
      "category": "string — one of: Groceries, Dining, Transport, Entertainment, Shopping, Bills & Utilities, Health, Travel, Education, Subscriptions, Cash, Transfer, Income, Interest, Fees, Insurance, Investments, Charity, Personal Care, Home, Uncategorised",
      "categoryConfidence": "number 0-1"
    }
  ],
  "confidence": {
    "fieldName": "number 0-1 — how confident you are about each extracted field"
  }
}

Rules:
- For credit cards: balance is the amount OWED (positive number).
- For bank accounts: positive balance means money in account.
- Always include confidence scores for: institution, balance, creditLimit, interestCharged, minimumPayment, transactions.
- If a field cannot be determined, set it to null and confidence to 0.
- Categorise every transaction. Use context clues from the description.
- Dates must be YYYY-MM-DD format.
- Currency amounts should be plain numbers (no symbols).
- If the statement is for Wise or similar multi-currency account, identify the currency from the statement.`

export async function parseStatementWithAI(
  content: string,
  fileType: "pdf" | "csv",
  existingCorrectionRules?: { descriptionPattern: string; toCategory: string }[]
): Promise<ParsedStatement> {
  let userPrompt = `Parse this ${fileType.toUpperCase()} statement and extract all data:\n\n${content}`

  if (existingCorrectionRules && existingCorrectionRules.length > 0) {
    userPrompt += `\n\nThe user has previously corrected these categorisations. Apply these rules:\n`
    for (const rule of existingCorrectionRules) {
      userPrompt += `- "${rule.descriptionPattern}" should be categorised as "${rule.toCategory}"\n`
    }
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 16000,
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error("No response from AI")

  const parsed = JSON.parse(raw)

  return {
    institution: parsed.institution || "Unknown",
    institutionDomain: parsed.institutionDomain || null,
    accountName: parsed.accountName || "",
    category: validateCategory(parsed.category),
    last4: parsed.last4 || "",
    currency: parsed.currency || "GBP",
    balance: Number(parsed.balance) || 0,
    creditLimit: parsed.creditLimit != null ? Number(parsed.creditLimit) : null,
    interestCharged: parsed.interestCharged != null ? Number(parsed.interestCharged) : null,
    minimumPayment: parsed.minimumPayment != null ? Number(parsed.minimumPayment) : null,
    paymentDueDate: parsed.paymentDueDate || null,
    statementPeriodStart: parsed.statementPeriodStart || null,
    statementPeriodEnd: parsed.statementPeriodEnd || null,
    statementDate: parsed.statementDate || new Date().toISOString().substring(0, 10),
    aprDetected: parsed.aprDetected != null ? Number(parsed.aprDetected) : null,
    transactions: (parsed.transactions || []).map((t: any): ParsedTransaction => ({
      date: t.date || parsed.statementDate || new Date().toISOString().substring(0, 10),
      description: t.description || "Unknown",
      amount: Number(t.amount) || 0,
      category: t.category || "Uncategorised",
      categoryConfidence: Number(t.categoryConfidence) || 0.5,
    })),
    confidence: parsed.confidence || {},
  }
}

function validateCategory(cat: string): AccountCategory {
  const valid: AccountCategory[] = [
    "credit_card", "current_account", "savings", "isa",
    "investment", "crypto", "loan", "mortgage",
  ]
  return valid.includes(cat as AccountCategory) ? (cat as AccountCategory) : "current_account"
}

export async function suggestCategory(
  description: string,
  correctionRules?: { descriptionPattern: string; toCategory: string }[]
): Promise<{ category: string; confidence: number }> {
  // Check correction rules first
  if (correctionRules) {
    for (const rule of correctionRules) {
      if (description.toLowerCase().includes(rule.descriptionPattern.toLowerCase())) {
        return { category: rule.toCategory, confidence: 1.0 }
      }
    }
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Categorise this transaction description into one of: Groceries, Dining, Transport, Entertainment, Shopping, Bills & Utilities, Health, Travel, Education, Subscriptions, Cash, Transfer, Income, Interest, Fees, Insurance, Investments, Charity, Personal Care, Home, Uncategorised. Return JSON: {"category": "string", "confidence": 0-1}`,
      },
      { role: "user", content: description },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 50,
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) return { category: "Uncategorised", confidence: 0 }
  const parsed = JSON.parse(raw)
  return { category: parsed.category || "Uncategorised", confidence: parsed.confidence || 0.5 }
}

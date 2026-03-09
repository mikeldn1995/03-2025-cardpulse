export type AccountCategory =
  | "credit_card"
  | "current_account"
  | "savings"
  | "isa"
  | "investment"
  | "crypto"
  | "loan"
  | "mortgage"

export const ACCOUNT_CATEGORIES: { value: AccountCategory; label: string }[] = [
  { value: "credit_card", label: "Credit Card" },
  { value: "current_account", label: "Current Account" },
  { value: "savings", label: "Savings" },
  { value: "isa", label: "ISA" },
  { value: "investment", label: "Investment" },
  { value: "crypto", label: "Crypto" },
  { value: "loan", label: "Loan" },
  { value: "mortgage", label: "Mortgage" },
]

export const DEBT_CATEGORIES: AccountCategory[] = ["credit_card", "loan", "mortgage"]

export type TransactionSource = "statement" | "manual"

export interface Account {
  id: number
  userId: number
  institution: string
  institutionDomain: string | null
  accountName: string
  category: AccountCategory
  last4: string
  currency: string
  balance: number
  creditLimit: number | null
  overdraftLimit: number | null
  aprRegular: number | null
  aprPromo: number | null
  promoUntil: string | null
  minPaymentOverride: number | null
  dd: string
  ddAmount: number
  paymentDay: number | null
  statementDay: number | null
  interestCharged: number | null
  minimumPayment: number | null
  paymentDueDate: string | null
  lastStatementDate: string | null
  balanceUpdatedAt: string | null
  createdAt: string
}

export interface Transaction {
  id: number
  accountId: number
  userId: number
  date: string
  description: string
  amount: number
  category: string
  categoryConfidence: number | null
  source: TransactionSource
  statementId: string | null
  isTransfer: boolean
  linkedTransactionId: number | null
  needsReview: boolean
  createdAt: string
}

export interface BalanceSnapshot {
  id: number
  accountId: number
  date: string
  balance: number
  creditLimit: number | null
  interestCharged: number | null
  minimumPayment: number | null
  paymentDueDate: string | null
  statementPeriodStart: string | null
  statementPeriodEnd: string | null
  source: string
}

export interface ParsedStatement {
  institution: string
  institutionDomain: string | null
  accountName: string
  category: AccountCategory
  last4: string
  currency: string
  balance: number
  creditLimit: number | null
  interestCharged: number | null
  minimumPayment: number | null
  paymentDueDate: string | null
  statementPeriodStart: string | null
  statementPeriodEnd: string | null
  statementDate: string
  aprDetected: number | null
  transactions: ParsedTransaction[]
  confidence: Record<string, number> // field name → 0-1 confidence
}

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
  category: string
  categoryConfidence: number
}

export const TRANSACTION_CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Entertainment",
  "Shopping",
  "Bills & Utilities",
  "Health",
  "Travel",
  "Education",
  "Subscriptions",
  "Cash",
  "Transfer",
  "Income",
  "Interest",
  "Fees",
  "Insurance",
  "Investments",
  "Charity",
  "Personal Care",
  "Home",
  "Uncategorised",
] as const

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number]

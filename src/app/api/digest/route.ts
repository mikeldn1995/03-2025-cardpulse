import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { accounts, transactions, balanceSnapshots } from "@/db/schema"
import { getSession } from "@/lib/auth"
import { eq, and, gte, lte, desc } from "drizzle-orm"
import { isDebtAccount, getEffectiveApr } from "@/lib/utils"
import { generateForecast } from "@/lib/forecast"
import type { Account } from "@/types"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const year = Number(searchParams.get("year") || new Date().getFullYear())
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1)

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`

  // Fetch all accounts
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, session.user.id))

  // Fetch transactions for this month
  const monthTxs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
      ),
    )
    .orderBy(desc(transactions.date))

  // Fetch previous month transactions for comparison
  const prevTxs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        gte(transactions.date, prevStartDate),
        lte(transactions.date, startDate),
      ),
    )

  // Net worth & debt totals
  let netWorth = 0
  let totalDebt = 0
  const accountSummaries: {
    id: number
    institution: string
    accountName: string
    category: string
    balance: number
    currency: string
    prevBalance: number | null
    change: number | null
  }[] = []

  for (const acct of userAccounts) {
    netWorth += acct.balance
    if (isDebtAccount(acct as unknown as Account)) {
      totalDebt += Math.abs(acct.balance)
    }

    // Try to find prev month snapshot
    const snapshots = await db
      .select()
      .from(balanceSnapshots)
      .where(
        and(
          eq(balanceSnapshots.accountId, acct.id),
          gte(balanceSnapshots.date, prevStartDate),
          lte(balanceSnapshots.date, startDate),
        ),
      )
      .orderBy(desc(balanceSnapshots.date))
      .limit(1)

    const prevBalance = snapshots.length > 0 ? snapshots[0].balance : null

    accountSummaries.push({
      id: acct.id,
      institution: acct.institution,
      accountName: acct.accountName,
      category: acct.category,
      balance: acct.balance,
      currency: acct.currency,
      prevBalance,
      change: prevBalance != null ? acct.balance - prevBalance : null,
    })
  }

  // Spending by category (only debits)
  const categorySpending: Record<string, number> = {}
  const prevCategorySpending: Record<string, number> = {}

  for (const tx of monthTxs) {
    if (tx.amount < 0) {
      const cat = tx.category || "Uncategorised"
      categorySpending[cat] = (categorySpending[cat] || 0) + Math.abs(tx.amount)
    }
  }
  for (const tx of prevTxs) {
    if (tx.amount < 0) {
      const cat = tx.category || "Uncategorised"
      prevCategorySpending[cat] = (prevCategorySpending[cat] || 0) + Math.abs(tx.amount)
    }
  }

  // Sort categories by spend
  const sortedCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      prevAmount: Math.round((prevCategorySpending[category] || 0) * 100) / 100,
      change:
        prevCategorySpending[category]
          ? Math.round(
              ((amount - prevCategorySpending[category]) /
                prevCategorySpending[category]) *
                100,
            )
          : null,
    }))

  // Top merchants (by frequency & spend)
  const merchantMap: Record<string, { count: number; total: number }> = {}
  for (const tx of monthTxs) {
    if (tx.amount < 0) {
      const key = tx.description
      if (!merchantMap[key]) merchantMap[key] = { count: 0, total: 0 }
      merchantMap[key].count++
      merchantMap[key].total += Math.abs(tx.amount)
    }
  }
  const topMerchants = Object.entries(merchantMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, data]) => ({
      name,
      count: data.count,
      total: Math.round(data.total * 100) / 100,
    }))

  // Transfers between accounts
  const transfers = monthTxs.filter((tx) => tx.isTransfer)

  // Debt forecast
  const debtAccounts = userAccounts.filter((a) => isDebtAccount(a as unknown as Account)) as unknown as Account[]
  const forecast = generateForecast(debtAccounts, 0, 24)

  // Total income vs spending
  const totalIncome = monthTxs
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0)
  const totalSpending = monthTxs
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  // Financial health score (simple heuristic 0-100)
  let healthScore = 50
  if (totalIncome > totalSpending) healthScore += 15
  if (totalDebt === 0) healthScore += 20
  else if (totalDebt < netWorth * 0.3) healthScore += 10
  if (sortedCategories.some((c) => c.category === "Savings" || c.category === "Investments"))
    healthScore += 5
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpending) / totalIncome) * 100 : 0
  if (savingsRate > 20) healthScore += 10
  else if (savingsRate > 10) healthScore += 5
  healthScore = Math.min(100, Math.max(0, healthScore))

  const monthName = new Date(year, month - 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })

  return NextResponse.json({
    monthName,
    year,
    month,
    netWorth: Math.round(netWorth * 100) / 100,
    totalDebt: Math.round(totalDebt * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalSpending: Math.round(totalSpending * 100) / 100,
    savingsRate: Math.round(savingsRate),
    healthScore,
    accountSummaries,
    categorySpending: sortedCategories,
    topMerchants,
    transferCount: transfers.length,
    forecastPayoffMonth: forecast.payoffMonthMinimum,
    forecastTotalInterest: forecast.totalInterestMinimum,
    transactionCount: monthTxs.length,
    userName: session.user.name || "User",
  })
}

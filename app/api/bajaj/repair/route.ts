/**
 * POST /api/bajaj/repair
 * One-time fix: updates bajaj_work_orders rows that have NULL country
 * where we can infer the module from other clues.
 *
 * Call this from Admin panel or directly to fix Bangladesh / other missing data.
 *
 * Body: { moduleSlug: "bangladesh" | "srilanka" | ... , country?: "Bangladesh" }
 * This sets country = defaultCountry for all rows WHERE country IS NULL (or mismatched spelling).
 */

import { NextRequest, NextResponse } from "next/server"
import { getLinksPool, sql } from "@/lib/db"

const MODULE_DEFAULT_COUNTRY: Record<string, string[]> = {
  srilanka:   ["Sri Lanka"],
  nigeria:    ["Nigeria"],
  bangladesh: ["Bangladesh", "BANGALDESH", "Bangaldesh"],
  triumph:    ["United Kingdom"],
  vipar:      ["VIPAR"],
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { moduleSlug: string; dryRun?: boolean }
    const { moduleSlug, dryRun = false } = body

    if (!moduleSlug || !MODULE_DEFAULT_COUNTRY[moduleSlug]) {
      return NextResponse.json({ error: "Invalid moduleSlug" }, { status: 400 })
    }

    const canonicalCountry = MODULE_DEFAULT_COUNTRY[moduleSlug][0]
    const allVariants = MODULE_DEFAULT_COUNTRY[moduleSlug]
    const pool = await getLinksPool()

    // Count affected rows (NULL country)
    const countRes = await pool.request().query(
      `SELECT COUNT(*) AS n FROM bajaj_work_orders WHERE country IS NULL OR country = ''`
    )
    const nullCount = countRes.recordset[0]?.n ?? 0

    // Also count rows with spelling variants
    const variantList = allVariants.slice(1).map((v) => `'${v.replace(/'/g, "''")}'`).join(",")
    let variantCount = 0
    if (variantList) {
      const vRes = await pool.request().query(
        `SELECT COUNT(*) AS n FROM bajaj_work_orders WHERE country IN (${variantList})`
      )
      variantCount = vRes.recordset[0]?.n ?? 0
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        moduleSlug,
        canonicalCountry,
        wouldUpdateNullRows: nullCount,
        wouldFixSpellingVariants: variantCount,
      })
    }

    // Fix NULL country rows — stamp them with canonical country
    // NOTE: This stamps ALL null-country rows with this module's country.
    // Only run this if you know all your null-country data belongs to this module.
    const updateRes = await pool.request()
      .input("country", sql.VarChar, canonicalCountry)
      .query(`UPDATE bajaj_work_orders SET country = @country WHERE country IS NULL OR country = ''`)

    // Fix spelling variants
    let variantFixed = 0
    if (variantList) {
      const vUpdate = await pool.request()
        .input("country", sql.VarChar, canonicalCountry)
        .query(`UPDATE bajaj_work_orders SET country = @country WHERE country IN (${variantList})`)
      variantFixed = vUpdate.rowsAffected[0] ?? 0
    }

    return NextResponse.json({
      success: true,
      moduleSlug,
      canonicalCountry,
      nullRowsFixed: updateRes.rowsAffected[0] ?? 0,
      spellingVariantsFixed: variantFixed,
    })
  } catch (err) {
    console.error("[POST /api/bajaj/repair]", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

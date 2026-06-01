/**
 * GET    /api/settings           — public, retourne logo et autres settings
 * (PUT/DELETE :key dans /[key]/route.ts)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@tt/db';

const ENSURE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "SiteSetting" (
    "key" TEXT PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

let tableEnsured = false;

export async function ensureSiteSettingTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(ENSURE_TABLE_SQL);
    tableEnsured = true;
  } catch (e) {
    console.warn('[settings] Failed to ensure table:', e);
  }
}

export async function GET() {
  await ensureSiteSettingTable();
  try {
    const settings = await prisma.siteSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    return NextResponse.json({ data: map });
  } catch (e) {
    // Si la table n'existe vraiment pas, retourner un objet vide (pas d'erreur 500)
    console.warn('[settings] GET failed:', e);
    return NextResponse.json({ data: {} });
  }
}

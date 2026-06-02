/**
 * POST /api/upload — convertit l'image en data URL base64 (stockable en BD).
 * Pas d'écriture fichier (filesystem standalone Next.js read-only).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, requireRole, HttpError } from '@/lib/auth/server';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
const MAX_SIZE = 1 * 1024 * 1024; // 1 Mo

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) throw new HttpError(400, 'Fichier manquant');

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new HttpError(415, `Type non supporté : ${file.type}`);
    }
    if (file.size > MAX_SIZE) {
      throw new HttpError(
        413,
        `Fichier trop grand (${Math.round(file.size / 1024)} Ko, max 1 Mo)`,
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    return NextResponse.json({ ok: true, url: dataUrl, size: bytes.length });
  } catch (e) {
    return errorResponse(e);
  }
}

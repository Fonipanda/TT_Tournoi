/**
 * POST /api/upload — upload d'un fichier image vers public/uploads/.
 * Retourne l'URL relative pour utilisation dans les composants.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { errorResponse, requireRole, HttpError } from '@/lib/auth/server';

const UPLOAD_DIR = path.join(process.cwd(), 'apps/web/public/uploads');
const PUBLIC_DIR = path.join(process.cwd(), 'public/uploads');
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

function getUploadDir(): string {
  // En standalone Next.js, le cwd est /app et public est à /app/apps/web/public
  if (existsSync(UPLOAD_DIR)) return UPLOAD_DIR;
  if (existsSync(PUBLIC_DIR)) return PUBLIC_DIR;
  return UPLOAD_DIR;
}

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
      throw new HttpError(413, `Fichier trop grand (${Math.round(file.size / 1024)} Ko, max 5 Mo)`);
    }

    const dir = getUploadDir();
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });

    // Nom de fichier sécurisé
    const ext = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext || '.bin'}`;
    const target = path.join(dir, slug);

    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(target, bytes);

    const publicUrl = `/uploads/${slug}`;
    return NextResponse.json({ ok: true, url: publicUrl, size: bytes.length });
  } catch (e) {
    return errorResponse(e);
  }
}

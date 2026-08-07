/**
 * Migration sélective SQLite → PostgreSQL
 *
 * Lit l'ancienne base SQLite Django (`backend/db.sqlite3`) et importe
 * uniquement les données pertinentes : joueurs, salles, tables, menu, comptes,
 * templates SMS et config adapter (mais désactivée).
 *
 * Ne migre PAS l'historique (matches, brackets, notifications, logs SMS).
 *
 * Usage :
 *   npx tsx infra/scripts/migrate-from-sqlite.ts <path/to/db.sqlite3>
 *
 * Idempotent : utilise `upsert` sur les clefs naturelles (licenseNumber,
 * username, table number, room id, etc.).
 */

import path from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';
import { Prisma, prisma } from '@tt/db';

const TOURNAMENT_DEFAULT_ID = '00000000-0000-0000-0000-000000000001';

interface DjangoPlayer {
  id: string;
  first_name: string;
  last_name: string;
  license_number: string | null;
  ranking: string | null;
  points: number | null;
  club: string | null;
  email: string;
  phone: string | null;
  is_active: number;
  created_at: string;
}

interface DjangoRoom {
  id: string;
  name: string;
  description: string | null;
  rows: number;
  tables_per_row: number;
  entrance_markers: string;
  buvette_markers: string;
  wc_markers: string;
  arrow_markers: string;
  rotation: number;
  is_active: number;
}

interface DjangoTable {
  id: string;
  table_number: number;
  room_id: string;
  status: string;
  position_row: number;
  position_col: number;
  orientation: string;
}

interface DjangoMenuSection {
  id: string;
  name: string;
  order: number;
}

interface DjangoMenuItem {
  id: string;
  section_id: string;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  is_available: number;
  order: number;
}

interface DjangoUser {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  player_id: string | null;
}

interface DjangoSmsTemplate {
  id: string;
  name: string;
  content: string;
  is_active: number;
}

interface DjangoSmsAdapter {
  id: string;
  name: string;
  adapter_type: string;
  config: string;
  default_sender: string;
  is_active: number;
}

function safeJson(raw: unknown, fallback: unknown = []): unknown {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function main() {
  const sqlitePath = process.argv[2] ?? path.resolve('backend/db.sqlite3');
  console.info(`[migrate] Lecture SQLite: ${sqlitePath}`);

  const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });

  // ---------------------------------------------------------------------------
  // Vérifier qu'un Tournament existe (créé par le seed)
  // ---------------------------------------------------------------------------
  const t = await prisma.tournament.findUnique({ where: { id: TOURNAMENT_DEFAULT_ID } });
  if (!t) {
    console.warn(
      '[migrate] ⚠ Aucun tournoi par défaut. Lancez `pnpm db:seed` avant de migrer (les MenuSection seront rattachées au tournoi seedé).',
    );
  }

  // ---------------------------------------------------------------------------
  // Joueurs
  // ---------------------------------------------------------------------------
  const players = sqlite
    .prepare('SELECT * FROM tournament_player WHERE is_active = 1')
    .all() as DjangoPlayer[];
  let playersMigrated = 0;
  for (const p of players) {
    if (!p.license_number) continue; // skip sans licence (clé d'unicité)
    await prisma.player.upsert({
      where: { licenseNumber: p.license_number },
      update: {},
      create: {
        firstName: p.first_name,
        lastName: p.last_name,
        licenseNumber: p.license_number,
        ranking: p.ranking,
        points: p.points ? Number(p.points) : 500,
        club: p.club ?? '',
        email: p.email ?? '',
        phone: p.phone ?? null,
        isActive: p.is_active === 1,
      },
    });
    playersMigrated++;
  }
  console.info(`[migrate] Joueurs migrés : ${playersMigrated}/${players.length}`);

  // ---------------------------------------------------------------------------
  // Salles + Tables (conversion grille (row,col) → canvas (x,y))
  // ---------------------------------------------------------------------------
  const rooms = sqlite
    .prepare('SELECT * FROM tournament_room WHERE is_active = 1')
    .all() as DjangoRoom[];
  const roomIdMap = new Map<string, string>();

  for (const r of rooms) {
    const created = await prisma.room.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        tournamentId: TOURNAMENT_DEFAULT_ID,
        name: r.name,
        description: r.description,
        width: Math.max(800, r.tables_per_row * 200),
        height: Math.max(500, r.rows * 200),
        entranceMarkers: safeJson(r.entrance_markers, []) as Prisma.InputJsonValue,
        buvetteMarkers: safeJson(r.buvette_markers, []) as Prisma.InputJsonValue,
        wcMarkers: safeJson(r.wc_markers, []) as Prisma.InputJsonValue,
        arrowMarkers: safeJson(r.arrow_markers, []) as Prisma.InputJsonValue,
        rotation: r.rotation,
      },
    });
    roomIdMap.set(r.id, created.id);
  }
  console.info(`[migrate] Salles migrées : ${rooms.length}`);

  // Tables : conversion (row,col) → (x,y) avec espacement 200x180
  const tables = sqlite.prepare('SELECT * FROM tournament_table').all() as DjangoTable[];
  let tablesMigrated = 0;
  for (const t of tables) {
    const newRoomId = roomIdMap.get(t.room_id);
    if (!newRoomId) continue;
    await prisma.tableModel.upsert({
      where: { number: t.table_number },
      update: {},
      create: {
        roomId: newRoomId,
        number: t.table_number,
        x: 100 + t.position_col * 200,
        y: 100 + t.position_row * 180,
        rotation: t.orientation === 'vertical' ? 90 : 0,
        status: t.status === 'occupied' ? 'occupied' : 'free',
      },
    });
    tablesMigrated++;
  }
  console.info(`[migrate] Tables migrées : ${tablesMigrated}/${tables.length}`);

  // ---------------------------------------------------------------------------
  // Menu (rattaché au tournoi par défaut)
  // ---------------------------------------------------------------------------
  const sections = sqlite
    .prepare('SELECT * FROM tournament_menusection ORDER BY "order"')
    .all() as DjangoMenuSection[];
  const sectionIdMap = new Map<string, string>();
  for (const s of sections) {
    const created = await prisma.menuSection.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        tournamentId: TOURNAMENT_DEFAULT_ID,
        name: s.name,
        order: s.order,
      },
    });
    sectionIdMap.set(s.id, created.id);
  }

  const items = sqlite.prepare('SELECT * FROM tournament_menuitem').all() as DjangoMenuItem[];
  let itemsMigrated = 0;
  for (const i of items) {
    const newSectionId = sectionIdMap.get(i.section_id);
    if (!newSectionId) continue;
    const existing = await prisma.menuItem.findFirst({
      where: { sectionId: newSectionId, name: i.name },
    });
    if (existing) continue;
    await prisma.menuItem.create({
      data: {
        sectionId: newSectionId,
        name: i.name,
        description: i.description ?? null,
        price: new Prisma.Decimal(i.price),
        imageUrl: i.image_url ?? null,
        isAvailable: i.is_available === 1,
        order: i.order,
      },
    });
    itemsMigrated++;
  }
  console.info(
    `[migrate] Menu migré : ${sections.length} sections, ${itemsMigrated}/${items.length} items`,
  );

  // ---------------------------------------------------------------------------
  // Comptes utilisateurs (avec passwordNeedsReset=true)
  // ---------------------------------------------------------------------------
  let users: DjangoUser[] = [];
  try {
    users = sqlite.prepare('SELECT * FROM tournament_useraccount').all() as DjangoUser[];
  } catch {
    console.info('[migrate] Pas de table tournament_useraccount, skip.');
  }
  let usersMigrated = 0;
  for (const u of users) {
    const role = ['admin', 'juge_arbitre', 'player'].includes(u.role) ? u.role : 'player';
    await prisma.userAccount.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        passwordHash: '', // SHA-256 incompatible
        passwordNeedsReset: true,
        // Compte migré sans adresse email : aucun lien d'activation ne peut
        // lui être envoyé. On le marque vérifié pour ne pas le rendre
        // définitivement inaccessible après réinitialisation du mot de passe.
        emailVerifiedAt: new Date(),
        role: role as 'admin' | 'juge_arbitre' | 'player',
      },
    });
    usersMigrated++;
  }
  console.info(`[migrate] Comptes migrés : ${usersMigrated} (passwordNeedsReset=true)`);

  // ---------------------------------------------------------------------------
  // Templates SMS
  // ---------------------------------------------------------------------------
  let templates: DjangoSmsTemplate[] = [];
  try {
    templates = sqlite.prepare('SELECT * FROM tournament_smstemplate').all() as DjangoSmsTemplate[];
  } catch {
    console.info('[migrate] Pas de table tournament_smstemplate, skip.');
  }
  let templatesMigrated = 0;
  for (const t of templates) {
    await prisma.smsTemplate.upsert({
      where: { name: t.name },
      update: {},
      create: {
        name: t.name,
        content: t.content,
        isActive: t.is_active === 1,
      },
    });
    templatesMigrated++;
  }
  console.info(`[migrate] Templates SMS migrés : ${templatesMigrated}`);

  // ---------------------------------------------------------------------------
  // SmsAdapterConfig — désactivés (re-saisir secrets via UI)
  // ---------------------------------------------------------------------------
  let adapters: DjangoSmsAdapter[] = [];
  try {
    adapters = sqlite
      .prepare('SELECT * FROM tournament_smsadapterconfig')
      .all() as DjangoSmsAdapter[];
  } catch {
    console.info('[migrate] Pas de table tournament_smsadapterconfig, skip.');
  }
  let adaptersMigrated = 0;
  for (const a of adapters) {
    if (!['test', 'ovh', 'twilio', 'free_mobile', 'smpp'].includes(a.adapter_type)) continue;
    await prisma.smsAdapterConfig.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        name: a.name,
        adapterType: a.adapter_type as 'test' | 'ovh' | 'twilio' | 'free_mobile' | 'smpp',
        config: safeJson(a.config, {}) as Prisma.InputJsonValue,
        defaultSender: a.default_sender,
        isActive: false, // toujours désactivé après migration (re-saisir secrets)
      },
    });
    adaptersMigrated++;
  }
  console.info(`[migrate] Adapters SMS migrés (désactivés) : ${adaptersMigrated}`);

  sqlite.close();
  await prisma.$disconnect();

  console.info('\n[migrate] ✅ Migration terminée.');
  console.info('         Étapes suivantes :');
  console.info('         1. Ouvrir l\'admin → SMS → Réactiver l\'adaptateur OVH + saisir secrets');
  console.info('         2. Ouvrir l\'admin → Comptes → Demander aux utilisateurs un reset password');
  console.info('         3. Recréer les tournois & brackets pour la prochaine compétition');
}

main().catch((e) => {
  console.error('[migrate] ❌ Erreur :', e);
  process.exit(1);
});

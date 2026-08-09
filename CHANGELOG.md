# Changelog

## [2.0.0-rc.1] — Refonte complète mono-repo

Cette version fusionne les deux dépôts historiques (`TT_Tournoi` Django + `TT_Tournoi_Emergent` FastAPI) en une seule application moderne déployable sur VPS OVH via Coolify.

### ✨ Ajouts majeurs

#### Architecture
- **Mono-repo Turborepo + pnpm workspaces** (apps/web, apps/ws, packages/db|auth|sms|types|ui|config)
- **Next.js 15 + React 19** (App Router, Server Components, Route Handlers REST)
- **Service Fastify dédié** pour WebSocket sur port interne (`apps/ws`)
- **PostgreSQL 16** via Prisma ORM (16 tables, types partagés)
- **Redis 7** pour Pub/Sub temps réel + BullMQ + cache FFTT 24h
- **Bus temps réel Redis Pub/Sub** : web publie sur `live:*` → ws diffuse aux clients

#### Authentification
- **JWT HS256 via `jose`** (Edge-compatible pour middleware Next.js)
- **argon2id** pour les mots de passe (OWASP 2024)
- 4 rôles : `visitor`, `player`, `admin`, `juge_arbitre`
- Refresh token rotation avec `RefreshToken` table + révocation par `jti`
- Cookies httpOnly + sameSite=lax

#### FFTT
- **Moteur poules + élimination** porté en TypeScript depuis Python (articles I.301-305)
  - `ffttPoolMatchOrder` : ordre des parties (poules de 3 à 6 joueurs)
  - `ffttPoolRanking` : V=2/D=1, départage par confrontation directe puis quotient sets
  - `ffttSeedingPositions` : positions standard de seeding
  - `ffttPlaceQualifiers` : 1ers comme têtes de série, 2èmes en demi-tableau opposé
- **Tests Vitest** : 25+ tests unitaires conformes spec FFTT
- **Lookup FFTT avec cache Redis 24h** + autocréation joueur sur login licence
- **Points-swap automatique** après chaque match terminé

#### SMS
- **Architecture multi-adaptateur** : OVH SMS Pro (actif v1), Twilio, Free Mobile, SMPP, Test
- **OVH SMS Pro** complet : signature SHA1 `$1$`, gestion sender, timeout, retry
- **BullMQ** sur Redis avec rate limiter 40 SMS/min (sous quota OVH 50/min)
- **Templates** avec variables : `{joueur}`, `{table}`, `{tableau}`, `{adversaire}`, `{heure}`, `{salle}`, `{message}`
- **Trigger SQL** garantit qu'un seul adapter peut être actif à la fois
- **Notifications tiers** (parent/accompagnant) via `PlayerNotificationSubscription`

#### Live & WebSocket
- Événements diffusés : `match_created`, `match_started`, `match_completed`, `match_score_updated`, `match_blocked`, `match_unblocked`, `table_updated`, `tables_repositioned`, `pools_generated`, `elimination_generated`
- **Hook React `useLiveWebSocket`** avec back-off exponentiel 1s→15s
- **Mode TV** plein écran sur `/tv` — réservé à l'admin, lancé depuis `/admin/parametres` ; rend les salles de `/admin/salles` avec l'aspect de l'éditeur visuel, rotation automatique réglable (3 s → 30 s)
- **Fallback polling REST** sur `/api/live/tables` et `/api/live/matches` pour clients sans WS

#### PWA Juge-Arbitre
- **Service Worker** avec stratégies par type de ressource (Cache-First / Network-First)
- **Outbox IndexedDB** pour mutations offline avec drain automatique au retour `online`
- **Optimistic concurrency** via `Match.version` + idempotency via `MatchEvent.clientId UNIQUE`
- **Page `/admin/sync-status`** pour visualiser l'outbox locale
- Manifest standalone `start_url=/juge-arbitre`

#### Pages publiques
- Accueil (bento-grid responsive avec hero + compteurs + programme)
- Live (RoomCanvas tables avec codage couleur libre/occupée)
- Progression (liste brackets + détail poules + arbre élimination)
- Buvette (sections + items)
- Règlement (page MDX statique conforme FFTT)

#### Pages joueur
- Mon espace (profil + points actuels + inscriptions)
- Notifications (liste + filtre non lues + marquage)
- Inscription (sélection brackets, max 2/jour FFTT)

#### Pages staff
- Dashboard admin (compteurs + alertes adapter SMS)
- Tournois / Tableaux / Joueurs / Salles (CRUD lectures, raffinements en v2.1)
- SMS (4 onglets : Adaptateurs / Templates / Envoi / Historique)
- **Juge-Arbitre** (saisie de score tactile, +1/+1, vainqueur, **fonctionne offline**)
- Sync Status (visualisation outbox PWA)

#### Design system
- **Palette froide claire** : sky-600 / cyan-500 / slate / vert success / rouge danger
- **Mode TV** : fond slate-900 + cyan-400
- Typographies **Oswald** (headings) + **Manrope** (body)
- **Coins sharp** (radius 0-4px max), scoreboard XL avec `tabular-nums`
- `data-testid` systématique sur tous les éléments interactifs

#### Déploiement
- **Dockerfiles multi-stage** pour web + ws (~250 / ~150 Mo)
- **`docker-compose.yml`** local pour dev (Postgres + Redis)
- **`DEPLOIEMENT.md` complet** : guide pas-à-pas Coolify (DNS, SSL, env, healthchecks, backups, sécurité)
- **Script `migrate-from-sqlite.ts`** : migration sélective depuis ancienne base Django
- **Script `backup-postgres.sh`** : cron quotidien vers Object Storage OVH

### 🔄 Migration depuis v1

| Donnée | Stratégie |
|---|---|
| Joueurs | Migrés (clé naturelle = licenseNumber) |
| Salles + tables | Migrées avec conversion grille `(row,col)` → canvas `(x,y)` |
| Menu buvette | Migré, rattaché au tournoi par défaut |
| Templates SMS | Migrés |
| SmsAdapterConfig | Migré mais désactivé (re-saisir secrets via UI) |
| Comptes | Migrés avec `passwordNeedsReset=true` (SHA-256 → argon2id) |
| Tournois / Brackets / Matches | **Non migrés** (modèles trop différents, à recréer) |
| Notifications / SmsLog historiques | **Non migrés** (peu de valeur archivable) |

### 💔 Breaking changes vs v1

- Stack entièrement renouvelée (Django→Next.js, SQLite→PostgreSQL, JS→TS strict)
- Auth incompatible : tous les utilisateurs doivent reset leur mot de passe au premier login
- Modèle `Room/Table` : abandon de la grille `(row,col)` pour le canvas libre `(x, y, rotation)`
- `Player.points` : passe de `Int` à `Float` (pour FFTT points-swap)
- `MenuSection` : devient lié à un tournoi (ne plus être global)
- Endpoints REST réécrits avec préfixe `/api/...` cohérent et codes HTTP standards (200/201/400/401/403/404/409)

### 🛠 Tech debt connu (à traiter en v2.1)

- L10 : RoomCanvas drag & drop avec @dnd-kit (placeholder actuel : pages de gestion manuelles)
- L11 : BracketTree visuel avec connecteurs CSS géométriques (placeholder : liste textuelle)
- L14 : tests E2E Playwright (à compléter — fondations en place)
- Stripe paiement (reporté V2 par décision utilisateur)
- Check-in QR / dossards (reporté V2)
- Multi-tournoi simultanés (reporté V2)

### 📦 Stack finale

| Catégorie | Versions |
|---|---|
| Runtime | Node.js 20 LTS |
| Frontend | Next.js 15 + React 19 + TypeScript 5.6 + Tailwind 3.4 |
| Backend API | Next.js Route Handlers + Prisma 5.22 + Zod 3.23 |
| WebSocket | Fastify 5 + @fastify/websocket |
| Auth | jose (JWT) + argon2id |
| BD | PostgreSQL 16 |
| Cache/Queue | Redis 7 + BullMQ 5 |
| SMS actif | OVH SMS Pro (architecture multi-adapter conservée) |
| Déploiement | Docker + Coolify + Traefik (Let's Encrypt auto) |
| Tests | Vitest (unit) + Playwright (E2E à venir) |

---

## Versions précédentes

### [1.x] — Django + Next.js 14 (TT_Tournoi original)

Voir l'historique git avant `v2.0.0-rc.1`.

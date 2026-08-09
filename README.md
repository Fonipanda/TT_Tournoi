<div align="center">

# TT Tournoi v2 — Chelles Tennis de Table

### Plateforme de gestion de tournois de tennis de table — refonte mono-repo

<br>

<img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js 15">
<img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19">
<img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/Fastify-5-000000?style=for-the-badge&logo=fastify&logoColor=white" alt="Fastify">
<img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 16">
<img src="https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis 7">
<img src="https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma">
<img src="https://img.shields.io/badge/Coolify-deploy-6B47CC?style=for-the-badge" alt="Coolify">

<br><br>

[Architecture](#architecture) &bull; [Demarrage](#demarrage-rapide) &bull; [Structure](#structure-monorepo) &bull; [Commandes](#commandes-utiles) &bull; [Deploiement](DEPLOIEMENT.md)

</div>

---

## A propos

`tournoi-chellestt.fr` — application web temps reel pour gerer un tournoi de tennis de table conforme aux regles FFTT (articles I.301 a I.305).

Refonte unifiee des deux dependances historiques (`TT_Tournoi` Django + `TT_Tournoi_Emergent` FastAPI) en **une seule application** Next.js 15 deployable sur VPS OVH via Coolify.

Branche de travail : `v2-ovh-coolify`.

## Architecture

```
        Internet (joueurs / spectateurs / staff)
                       |
                       v
            tournoi-chellestt.fr (HTTPS, SSL Let's Encrypt)
                       |
       +---------------+---------------+
       |                               |
       v                               v
  Next.js 15 (apps/web)        Fastify WS (apps/ws)
  Frontend SSR + REST          WebSocket :3001
  :3000                              |
       |                             |
       +-----+--------+--------------+
             |        |
             v        v
       PostgreSQL 16  Redis 7
       (Prisma)       (Pub/Sub + BullMQ)
```

- **Frontend + REST** : Next.js 15 App Router, React 19, TypeScript, PWA (Serwist).
- **WebSocket temps reel** : service Fastify dedie, Pub/Sub Redis pour la diffusion d'evenements depuis Next.js.
- **Base de donnees** : PostgreSQL 16 via Prisma ORM (types partages entre web/ws/sms).
- **Cache et files** : Redis (cache FFTT, queue BullMQ pour les SMS, bus Pub/Sub).
- **SMS** : architecture multi-adaptateur (OVH SMS Pro actif en v1, Twilio/Free Mobile/SMPP/Test inactifs mais portes).
- **Deploiement** : Docker + Coolify sur VPS OVH (auto SSL Let's Encrypt, healthchecks).

## Structure monorepo

```
TT_Tournoi/
|-- apps/
|   |-- web/               Next.js 15 (frontend + REST API)
|   +-- ws/                Fastify WebSocket service
|-- packages/
|   |-- db/                Prisma schema + client + seed
|   |-- types/             Types partages (events WS, DTOs)
|   |-- auth/              JWT + argon2id + RBAC
|   |-- sms/               Multi-adaptateur SMS + BullMQ
|   |-- ui/                Design tokens + Tailwind preset
|   +-- config/            ESLint / TSConfig partages
|-- infra/
|   |-- docker/            Dockerfiles + docker-compose
|   |-- coolify/           Guide deploiement Coolify
|   |-- nginx/             Conf nginx de reference
|   +-- scripts/           Migration SQLite, backup PG
|-- tests/
|   |-- e2e/               Playwright
|   +-- fixtures/
|-- legacy/                Anciens dossiers Django + CRA (a supprimer en L15)
+-- ...                    package.json, turbo.json, etc.
```

## Demarrage rapide

### Prerequis
- Node.js >= 20.10 (utiliser `nvm use` avec `.nvmrc`)
- pnpm >= 9.0 (`npm install -g pnpm`)
- Docker + Docker Compose (pour PostgreSQL + Redis local)

### Installation

```powershell
# 1. Installer les dependances
pnpm install

# 2. Demarrer PostgreSQL + Redis (local Docker)
pnpm docker:up

# 3. Copier les variables d'environnement
Copy-Item .env.example .env

# 4. Generer le client Prisma + creer la BD + seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Lancer toutes les apps en mode dev
pnpm dev
```

Acces :

| Service                   | URL                              |
|---------------------------|----------------------------------|
| Frontend + API REST       | http://localhost:3000            |
| WebSocket service         | ws://localhost:3001/api/ws/live  |
| Healthcheck               | http://localhost:3000/api/health |
| Prisma Studio (BD)        | `pnpm db:studio`                 |

## Commandes utiles

```bash
pnpm dev                # tout lancer (web + ws)
pnpm build              # build production
pnpm lint               # lint mono-repo
pnpm typecheck          # type-check mono-repo
pnpm test               # tests unitaires (Vitest)
pnpm test:e2e           # tests Playwright
pnpm format             # formater avec Prettier
pnpm db:migrate         # creer une migration Prisma
pnpm db:studio          # ouvrir Prisma Studio
pnpm docker:up          # lancer Postgres + Redis local
pnpm docker:down        # arreter Postgres + Redis local
```

## Deploiement

Voir [DEPLOIEMENT.md](DEPLOIEMENT.md) pour le guide pas-a-pas Coolify (DNS, SSL, variables d'environnement, healthchecks, backups, mRemoteNG).

Voir [PC-vs-VPS.md](PC-vs-VPS.md) pour comprendre **ce qui se fait sur PC Windows en local vs sur le VPS** (aide-memoire des outils et commandes).

Voir [docs/runbook.md](docs/runbook.md) pour les procedures d'urgence et de maintenance.

Voir [SMS-OVH-A-FAIRE.md](SMS-OVH-A-FAIRE.md) pour les actions manuelles OVH/Coolify restantes du module SMS (code termine, en attente de validation de l'expediteur).

## Roles utilisateurs

| Role               | Acces                                                  |
|--------------------|--------------------------------------------------------|
| **Visiteur**       | Accueil / Live / Progression / Buvette / Reglement     |
| **Joueur**         | + Inscription / Mon espace / Notifications             |
| **Juge-Arbitre**   | + Saisie de scores (PWA hors-ligne)                    |
| **Administrateur** | Tout : tournois, tableaux, joueurs, salles, SMS, FFTT  |

## Specifications metier

- Implementation des articles **FFTT I.301 a I.305** (ordre des parties en poule, classement, departage).
- WebSocket diffuse les evenements `match_started`, `match_completed`, `table_updated`, `tables_repositioned`, `elimination_generated`.
- Mode TV plein ecran sur `/live/tv` (scoreboard XL, lisible a 5m).
- PWA hors-ligne pour juges-arbitres (saisie de scores + sync au retour reseau).

## Licence

Developpe pour le **Club de Chelles Tennis de Table**.

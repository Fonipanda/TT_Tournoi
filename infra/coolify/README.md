# Déploiement Coolify — TT Tournoi v2

→ Voir le guide pas-à-pas complet : [`/DEPLOIEMENT.md`](../../DEPLOIEMENT.md)

## Ressources Coolify à créer (résumé)

1. **PostgreSQL 16** (interne, volume 20 Go)
2. **Redis 7** (interne, sans persistance)
3. **App `tt-web`** : Dockerfile `infra/docker/web.Dockerfile` → port 3000 → domaine `tournoi-chellestt.fr`
4. **App `tt-ws`** : Dockerfile `infra/docker/ws.Dockerfile` → port 3001 → label Traefik `/ws`

## Variables d'environnement requises

Voir `.env.example` à la racine + section §4.3 du guide DEPLOIEMENT.md.

⚠️ Critique : utiliser **les hosts internes** Coolify (`tt-postgres`, `tt-redis`) et non `localhost` ou IP publique.

## Healthchecks

- `https://tournoi-chellestt.fr/api/health` → web
- `https://tournoi-chellestt.fr/ws/health` → ws

## Commandes utiles

```bash
# Logs
docker logs -f tt-web
docker logs -f tt-ws

# Seed
docker exec -it tt-web sh -c 'node packages/db/node_modules/.bin/prisma db seed'

# Backup ponctuel
docker exec tt-postgres pg_dump -U tt tt_tournoi | gzip > backup-$(date +%F).sql.gz

# Restore
gunzip < backup-2026-03-15.sql.gz | docker exec -i tt-postgres psql -U tt tt_tournoi
```

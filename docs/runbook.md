# Runbook opérationnel — TT Tournoi v2

Procédures d'urgence et de maintenance pour la production.

---

## 🚨 Incidents

### App `tt-web` ne répond plus

```bash
# 1. Vérifier le statut Coolify
# Dashboard → tt-web → onglet Logs

# 2. Healthcheck rapide
curl -fs https://tournoi-chellestt.fr/api/health

# 3. Restart soft
docker restart tt-web

# 4. Si toujours KO : revenir à la dernière version OK
# Coolify → tt-web → Deployments → Rollback to previous
```

### WebSocket ne se reconnecte plus

**Symptôme** : badge "Reconnexion…" persistant en haut des pages live.

```bash
# Vérifier que le service ws tourne
docker logs --tail 100 tt-ws

# Vérifier que Redis est joignable depuis ws
docker exec -it tt-ws sh -c 'redis-cli -h tt-redis ping'

# Vérifier les labels Traefik (le routing /ws → ws est crucial)
docker inspect tt-ws | grep -i traefik

# Restart
docker restart tt-ws
```

### SMS ne partent plus

```bash
# 1. Vérifier l'adaptateur actif (admin → SMS)
# Si aucun actif → activer OVH

# 2. Tester l'adaptateur (admin → SMS → Test)
# Si erreur "OVH non configuré" → re-saisir les secrets

# 3. Vérifier la queue BullMQ
docker exec -it tt-redis redis-cli LLEN bull:sms:wait

# 4. Vérifier les rate limits (40/min)
docker logs tt-web | grep -i 'sms worker'

# 5. Si OVH down : basculer Twilio temporairement
# Admin → SMS → Adaptateurs → Twilio → Activer (le trigger SQL désactive OVH)
```

### Base PostgreSQL down

```bash
# 1. Statut
docker ps --filter name=tt-postgres

# 2. Logs
docker logs --tail 200 tt-postgres

# 3. Si crash : restart
docker restart tt-postgres
sleep 10
docker exec tt-postgres pg_isready -U tt

# 4. Si BD corrompue : restore depuis backup
# Voir DEPLOIEMENT.md §6.3
```

### RAM saturée

```bash
# Diagnostic
docker stats --no-stream

# Cible un jour de tournoi : RAM totale < 8 Go (sur 12 dispo)
# Si tt-web > 3 Go : probable fuite mémoire BullMQ ou Prisma
docker restart tt-web
```

### Disque saturé

```bash
df -h /
docker system df

# Nettoyer les vieilles images Docker
docker system prune -a --volumes --filter 'until=720h'

# Nettoyer les vieux logs
journalctl --vacuum-time=30d

# Vieux dumps locaux
find /tmp/tt_tournoi_*.sql.gz -mtime +30 -delete
```

---

## 🛠 Maintenance régulière

### Avant chaque tournoi

- [ ] Vérifier le solde OVH SMS (manager.ovh.com → SMS → Crédits)
- [ ] Tester un envoi SMS de bout en bout (admin → SMS → Test)
- [ ] Vérifier le healthcheck : `https://tournoi-chellestt.fr/api/health`
- [ ] Vérifier la connexion WebSocket : ouvrir 2 onglets sur `/live`, déclencher un PATCH côté admin → l'événement doit apparaître <1s
- [ ] Snapshot OVH manuel (point de retour clean)
- [ ] Backup pg_dump manuel : `docker exec tt-postgres pg_dump -U tt tt_tournoi | gzip > /tmp/avant_tournoi_$(date +%F).sql.gz`
- [ ] Vérifier que les juges-arbitres ont chargé `https://tournoi-chellestt.fr/juge-arbitre` au moins une fois (pour activer le service worker offline)

### Après chaque tournoi

- [ ] Snapshot OVH manuel
- [ ] Export SPID des résultats (admin → tournoi → Export CSV)
- [ ] Vérifier que tous les `MatchEvent.clientId` ont été drainés (admin → Sync Status devrait être vide pour tous les clients)
- [ ] Archiver le tournoi (`isActive=false`) pour qu'il n'apparaisse plus dans les listes publiques

### Mensuel

- [ ] `apt update && apt upgrade` sur le VPS (le faire en heures creuses)
- [ ] Vérifier que les backups vers Object Storage OVH s'exécutent bien (cf logs `/var/log/tt-backup.log`)
- [ ] Tester un restore sur un environnement de staging (idéalement)
- [ ] Vérifier le certificat SSL (Coolify auto-renew, mais audit annuel : `https://www.ssllabs.com/ssltest/`)
- [ ] Auditer les RefreshToken non révoqués > 7 jours dans la DB et nettoyer

---

## 🔐 Sécurité

### Rotation des secrets JWT

⚠️ **Attention** : invalide tous les sessions actifs.

```bash
# 1. Générer 2 nouveaux secrets
openssl rand -base64 48
openssl rand -base64 48

# 2. Coolify → tt-web et tt-ws → Variables d'env → mettre à jour
#   JWT_ACCESS_SECRET et JWT_REFRESH_SECRET (mêmes valeurs sur les 2 services)

# 3. Redéployer tt-web ET tt-ws (le secret doit matcher)

# 4. Tous les utilisateurs doivent re-login
```

### Compromission de compte admin

```bash
# 1. Révoquer tous les refresh tokens de l'admin
docker exec -it tt-postgres psql -U tt tt_tournoi -c \
  "UPDATE \"RefreshToken\" SET \"revokedAt\"=NOW() WHERE \"userId\"=(SELECT id FROM \"UserAccount\" WHERE username='admin');"

# 2. Forcer reset password
docker exec -it tt-postgres psql -U tt tt_tournoi -c \
  "UPDATE \"UserAccount\" SET \"passwordNeedsReset\"=true, \"passwordHash\"='' WHERE username='admin';"

# 3. Audit logs
docker logs tt-web | grep -i 'login\|admin' | tail -200
```

### Ajout d'un utilisateur staff

```bash
# Dans le container web (ou via Prisma Studio)
docker exec -it tt-web node -e "
const { prisma } = require('./packages/db/src');
const argon2 = require('argon2');
(async () => {
  const hash = await argon2.hash('NouveauMotDePasseFort!', { type: argon2.argon2id });
  await prisma.userAccount.create({ data: {
    username: 'arbitre1',
    email: 'arbitre1@chellestt.fr',
    passwordHash: hash,
    role: 'juge_arbitre',
    passwordNeedsReset: true,
    // Obligatoire : sans cette date le compte est considéré comme non activé
    // et la connexion est refusée (403 email_not_verified).
    emailVerifiedAt: new Date()
  }});
  console.log('OK');
})();
"
```

---

## 📊 Métriques à surveiller un jour de tournoi

| Métrique | Cible | Alert si |
|---|---|---|
| RAM totale conteneurs | < 7 Go / 12 | > 9 Go |
| CPU pic | < 4 vCPU / 6 | > 5 vCPU sur 5 min |
| Latence event WS | < 500ms | > 2s |
| Connexions WS simultanées | < 500 | > 1000 |
| SMS sent / failed (1h) | failed < 5 % | failed > 10 % |
| Postgres connections | < 50 / 100 | > 80 |
| Disque utilisé | < 50 Go / 100 | > 80 Go |

---

## 📝 Diagnostic rapide (1 commande)

```bash
ssh tt@tournoi-chellestt.fr 'echo "=== HEALTH ===" && curl -fs https://tournoi-chellestt.fr/api/health | jq && echo "=== STATS ===" && docker stats --no-stream && echo "=== LOGS ===" && docker logs --tail 30 tt-web'
```

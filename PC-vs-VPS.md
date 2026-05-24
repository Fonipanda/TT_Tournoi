# 🖥️ PC Windows local ↔ ☁️ VPS OVH — Qui fait quoi ?

Ce document récapitule **où chaque tâche se fait**. Référence rapide quand tu te demandes "ça se passe où, ça ?".

> **Domaine de production** : `tournoi-chellestt.fr`
> **Branche Git** : `v2-ovh-coolify`
> **Pour le détail des étapes** : voir [`DEPLOIEMENT.md`](DEPLOIEMENT.md)

---

## 🎯 Vue d'ensemble

```
┌──────────────────────┐                          ┌──────────────────────┐
│  🖥️ PC Windows local │                          │  ☁️ VPS OVHcloud      │
│  (ton ordinateur)    │                          │  (serveur Ubuntu 24)  │
├──────────────────────┤                          ├──────────────────────┤
│ • Coder / Tester     │                          │ • Docker             │
│ • Git push           │                          │ • Coolify (panel)    │
│ • Navigateur web     │  ← HTTPS / SSH / DNS →   │ • PostgreSQL 16      │
│ • mRemoteNG (SSH)    │                          │ • Redis 7            │
│ • VS Code            │                          │ • App Next.js (web)  │
│ • Node.js + pnpm     │                          │ • App Fastify (ws)   │
│ • Manager OVH        │                          │ • Backups cron       │
└──────────────────────┘                          └──────────────────────┘
```

---

## 🖥️ Ce qui se fait UNIQUEMENT sur PC Windows local

### A. Développement & code

| Action | Outil | Commande |
|---|---|---|
| Cloner le repo | Git Bash / PowerShell | `git clone https://github.com/Fonipanda/TT_Tournoi.git` |
| Installer les dépendances | PowerShell | `pnpm install` |
| Lancer Postgres + Redis local | PowerShell + Docker Desktop | `pnpm docker:up` |
| Démarrer l'app en dev | PowerShell | `pnpm dev` (web sur :3000, ws sur :3001) |
| Tests unitaires Vitest | PowerShell | `pnpm test` |
| Tests E2E Playwright | PowerShell | `pnpm test:e2e` |
| Modifier le code | VS Code | (édition fichiers) |
| Commit et push | Git | `git add . && git commit -m "..." && git push` |

### B. Configuration / administration via interfaces web

| Action | URL | Notes |
|---|---|---|
| Manager OVH (VPS, domaine, SMS, Object Storage) | https://www.ovh.com/manager/ | Achat, snapshots, DNS |
| GitHub | https://github.com/Fonipanda/TT_Tournoi | Suivi commits, branches, issues |
| Coolify panel | https://coolify.tournoi-chellestt.fr | Déploiements, logs, env vars, restart |
| App admin | https://tournoi-chellestt.fr/admin | Tournois, joueurs, SMS, salles |
| App publique | https://tournoi-chellestt.fr | Live, progression, buvette |

### C. SSH vers le VPS via mRemoteNG

| Action | Comment | Notes |
|---|---|---|
| Ouvrir SSH | Double-clic sur la connexion `tt-tournoi-prod` | Auth par clé .ppk |
| Plusieurs sessions en parallèle | Onglets mRemoteNG | Utile pour ne pas se lock-out |
| Transfert de fichiers (rare) | `pscp` (PuTTY) | `pscp fichier.txt tt@IP_VPS:/home/tt/` |

### D. Tests & vérifications

| Action | Commande PowerShell | Quand l'utiliser |
|---|---|---|
| Vérifier propagation DNS | `nslookup tournoi-chellestt.fr` | Après config DNS OVH |
| Vérifier HTTPS / certificat | navigateur sur l'URL | Après premier déploiement |
| Vérifier healthcheck | `curl https://tournoi-chellestt.fr/api/health` | Avant chaque tournoi |
| Console WebSocket | F12 dans le navigateur sur `/live` | Debug live |

---

## ☁️ Ce qui se fait UNIQUEMENT sur le VPS

> **Comment ?** Toujours via mRemoteNG → onglet SSH ouvert sur le VPS.

### A. Configuration système (à faire 1 fois)

| Action | Commande | Quand |
|---|---|---|
| Mise à jour système | `sudo apt update && sudo apt upgrade -y` | 1ère install + mensuel |
| Créer user `tt` | `sudo adduser tt && sudo usermod -aG sudo tt` | 1ère install |
| Activer pare-feu UFW | `sudo ufw enable` | 1ère install |
| Activer fail2ban | `sudo systemctl enable --now fail2ban` | 1ère install |
| Ajouter swap | `sudo fallocate -l 4G /swapfile && ...` | 1ère install |

### B. Installation de Coolify (1 seule fois)

```bash
sudo bash -c "$(curl -fsSL https://cdn.coollabs.io/coolify/install.sh)"
```

→ Cela installe Docker + Coolify + Traefik en une commande.

### C. Backups Postgres (configuration cron)

| Action | Commande | Quand |
|---|---|---|
| Test manuel d'un backup | `sudo /opt/tt-tournoi/backup-postgres.sh` | Avant tournoi |
| Voir les logs cron | `tail -f /var/log/tt-backup.log` | Debug |
| Test de restoration | (cf DEPLOIEMENT.md §10.7) | **Avant le 1er tournoi** |

### D. Diagnostic d'incidents

| Action | Commande |
|---|---|
| Voir tous les containers | `docker ps` |
| Voir les logs d'une app | `docker logs --tail 100 -f $(docker ps --filter name=tt-web -q)` |
| Stats RAM/CPU temps réel | `docker stats` |
| Espace disque | `df -h` |
| Espace disque Docker | `docker system df` |
| Nettoyer les images orphelines | `docker system prune -a --volumes --filter 'until=720h'` |
| Redémarrer un container | `docker restart $(docker ps --filter name=tt-web -q)` |

### E. Mises à jour OS

```bash
sudo apt update && sudo apt upgrade -y
# Si kernel updated → reboot programmé hors heures de tournoi :
sudo shutdown -r now
```

---

## 🎛️ Ce qui se fait dans Coolify (interface web sur https://coolify.tournoi-chellestt.fr)

### A. Configuration initiale (1 fois)

| Action | Où | Quand |
|---|---|---|
| Créer le compte admin Coolify | http://IP_VPS:8000 | Tout début |
| Configurer le domaine `coolify.tournoi-chellestt.fr` | Settings → General | Après config DNS |
| Créer le project `tt-tournoi` | Projects → + Add | Après login |
| Créer la BD Postgres | Project → + New Resource → Postgres 16 | Une fois |
| Créer Redis | Project → + New Resource → Redis | Une fois |
| Créer l'app `tt-web` | Project → + New Resource → Application | Une fois |
| Créer l'app `tt-ws` | Project → + New Resource → Application | Une fois |
| Configurer les labels Traefik pour `/ws` | tt-ws → Settings → Advanced | Une fois |

### B. Opérations courantes

| Action | Où dans Coolify |
|---|---|
| Voir les logs en temps réel | App → onglet **Logs** |
| Redémarrer une app | App → bouton **Restart** (en haut à droite) |
| Modifier les variables d'env | App → onglet **Environment Variables** |
| Forcer un redéploiement | App → bouton **Deploy** (en haut à droite) |
| Ouvrir un terminal dans le container | App → onglet **Terminal** |
| Voir les déploiements précédents | App → onglet **Deployments** (avec rollback possible) |
| Activer l'auto-deploy sur push GitHub | App → Settings → Webhook GitHub |

---

## 🌐 Ce qui se fait dans le manager OVH

| Action | Onglet OVH manager |
|---|---|
| Acheter le VPS-2 | Bare Metal Cloud → VPS |
| Acheter / gérer le domaine `tournoi-chellestt.fr` | Web Cloud → Domaines |
| Configurer la zone DNS | Web Cloud → Domaines → Zone DNS |
| Snapshots du VPS | Bare Metal Cloud → VPS → Snapshots |
| Reverse DNS | Bare Metal Cloud → VPS → Sécurité |
| Acheter pack OVH SMS | Télécom → SMS → Commander |
| Gérer les expéditeurs SMS | Télécom → SMS → Expéditeurs |
| Voir les SMS envoyés / reçus | Télécom → SMS → Historique |
| Object Storage (backups) | Public Cloud → Storage → Object Storage |
| Générer token API SMS | https://api.ovh.com/createToken |

---

## 🔁 Cycle complet — De la modif de code au déploiement

```
1. 🖥️ [LOCAL] Modifier le code dans VS Code
              │
              ▼
2. 🖥️ [LOCAL] Tester en local : pnpm dev
              │
              ▼
3. 🖥️ [LOCAL] Tests unitaires : pnpm test
              │
              ▼
4. 🖥️ [LOCAL] git add . && git commit -m "..." && git push origin v2-ovh-coolify
              │
              ▼ (push)
5. 📝 [GITHUB] Code disponible sur la branche v2-ovh-coolify
              │
              ▼ (webhook ou clic manuel)
6. 🎛️ [COOLIFY] Détecte le push → lance le build Dockerfile
              │
              ▼ (~5 minutes)
7. 🎛️ [COOLIFY] Healthcheck OK → ancien container remplacé
              │
              ▼
8. 🖥️ [LOCAL] Vérifier https://tournoi-chellestt.fr/api/health
              │
              ▼
9. ✅ Production à jour
```

---

## 📊 Aide-mémoire : "où je vais quand…"

| Situation | Où aller en premier |
|---|---|
| Une page ne charge plus | 🎛️ **Coolify** → tt-web → Logs |
| Les SMS ne partent plus | 🖥️ **Local** → `https://tournoi-chellestt.fr/admin/sms` |
| Le live ne se met plus à jour | 🎛️ **Coolify** → tt-ws → Logs |
| Postgres semble lent | ☁️ **VPS SSH** → `docker stats` |
| Le disque est plein | ☁️ **VPS SSH** → `df -h` puis `docker system prune` |
| Je veux ajouter un endpoint | 🖥️ **Local** → VS Code → push GitHub |
| Je veux ajouter un admin | 🎛️ **Coolify** → tt-web → Terminal → script Node |
| Je veux changer un secret | 🎛️ **Coolify** → tt-web → Env Variables → Restart |
| Le SSL expire | (rien à faire, Coolify renouvelle auto) |
| Le VPS est down | 🌐 **OVH manager** → VPS → restart |

---

## 🔐 Sécurité : où sont les secrets

| Secret | Où il est stocké |
|---|---|
| Clé SSH privée (pour mRemoteNG) | 🖥️ `C:\Users\TON_NOM\.ssh\tt-tournoi-prod.ppk` |
| Mot de passe `tt` du VPS | 🖥️ Gestionnaire de mots de passe (Bitwarden / KeePass) |
| Mot de passe Coolify admin | 🖥️ Gestionnaire de mots de passe |
| Mots de passe `admin` / `ja` de l'app | 🖥️ Gestionnaire de mots de passe |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 🎛️ Coolify (env vars marquées Secret) |
| Clés OVH SMS API (3 clés) | 🎛️ Coolify (env vars marquées Secret) |
| Clés Object Storage S3 | ☁️ `/etc/tt-tournoi/backup.env` (chmod 600, root) |
| Mot de passe Postgres | 🎛️ Coolify (env vars + résolu dans `DATABASE_URL`) |

⚠️ **Ne jamais committer un secret dans Git**. Tous les secrets vivent uniquement dans Coolify (env vars) ou sur le VPS (fichiers chmod 600).

---

## 🆘 Numéros à connaître

| Service | URL |
|---|---|
| Support OVH (24h/24) | 1007 (en France) |
| Status OVH | https://status.ovhcloud.com/ |
| Coolify Discord | https://coollabs.io/discord |
| Documentation Coolify | https://coolify.io/docs |

---

## 📌 Règles d'or

1. **Toujours tester en local avant de pousser**. `pnpm dev` puis `pnpm test`.
2. **Faire un snapshot OVH manuel avant tout gros changement** (mise à jour OS, refonte schéma DB).
3. **Tester un restore de backup AVANT le 1er tournoi**, pas le jour J.
4. **Fermer tous les ports inutiles** (port 8000 après installation Coolify).
5. **Utiliser une clé SSH avec passphrase**, jamais un login par mot de passe sur SSH.
6. **Conserver les secrets dans un gestionnaire de mots de passe**, pas dans des fichiers texte.
7. **Activer 2FA** sur OVH manager et GitHub.

---

→ Pour le déploiement complet pas-à-pas, voir [`DEPLOIEMENT.md`](DEPLOIEMENT.md).
→ Pour les procédures opérationnelles d'urgence, voir [`docs/runbook.md`](docs/runbook.md).

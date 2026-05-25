# Déploiement TT Tournoi v2 sur VPS OVHcloud avec Coolify

Guide pas-à-pas **destiné à un utilisateur Windows non sysadmin**, pour mettre en production l'application **TT Tournoi v2** sur un VPS-2 OVHcloud (6 vCPU AMD EPYC, 12 Go RAM, 100 Go NVMe SSD), avec **Coolify** comme panel de déploiement et **mRemoteNG** comme client SSH.

**Domaine cible** : `tournoi-chellestt.fr`
**Branche Git** : `v2-ovh-coolify`
**Repo GitHub** : https://github.com/Fonipanda/TT_Tournoi

---

## 📋 Légende

Chaque action est étiquetée pour que tu saches **où** elle se passe :

| Étiquette | Signification |
|---|---|
| 🖥️ **[LOCAL]** | Sur ton PC Windows (PowerShell, navigateur, mRemoteNG, éditeur texte) |
| ☁️ **[VPS]** | Sur le serveur OVH, via SSH ouvert dans mRemoteNG |
| 🌐 **[OVH WEB]** | Dans le manager OVH (https://www.ovh.com/manager/) |
| 🎛️ **[COOLIFY]** | Dans l'interface Coolify (http://IP_VPS:8000 puis https://coolify.tournoi-chellestt.fr) |
| 📝 **[GITHUB]** | Sur GitHub (https://github.com) |

---

## Sommaire

1. [Pré-requis et achats](#1-pré-requis-et-achats)
2. [Commander le VPS et le domaine](#2-commander-le-vps-et-le-domaine)
3. [Configurer mRemoteNG sur ton PC](#3-configurer-mremoteng-sur-ton-pc)
4. [Première connexion au VPS et durcissement SSH](#4-première-connexion-au-vps-et-durcissement-ssh)
5. [Installation de Coolify](#5-installation-de-coolify)
6. [Configuration DNS chez OVH](#6-configuration-dns-chez-ovh)
7. [Création des ressources Coolify](#7-création-des-ressources-coolify)
8. [Configuration OVH SMS Pro](#8-configuration-ovh-sms-pro)
9. [Premier seed et premier login](#9-premier-seed-et-premier-login)
10. [Configuration des backups automatiques](#10-configuration-des-backups-automatiques)
11. [Vérifications finales](#11-vérifications-finales)
12. [Aide-mémoire urgences](#12-aide-mémoire-urgences)

---

## 1. Pré-requis et achats

### 🖥️ [LOCAL] Logiciels à installer sur ton PC Windows

| Logiciel | Pourquoi | Lien |
|---|---|---|
| **mRemoteNG** | Client SSH (déjà installé chez toi) | https://mremoteng.org/download |
| **PuTTYgen** (inclus avec PuTTY) | Générer une clé SSH | https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html |
| **Git** pour Windows | Cloner le repo GitHub | https://git-scm.com/download/win |
| **Node.js 20 LTS** | Pour tester en local AVANT prod | https://nodejs.org/ (choisir la version 20.x LTS) |
| **VS Code** (ou autre éditeur) | Éditer les fichiers | https://code.visualstudio.com/ |
| **Navigateur web moderne** | Chrome, Firefox ou Edge | (déjà installé) |

### 🌐 [OVH WEB] Comptes / abonnements à créer

| Service | Détail | Coût |
|---|---|---|
| Compte OVHcloud | Si pas déjà créé | gratuit |
| **VPS-2** | 6 vCPU / 12 Go RAM / 100 Go NVMe | ~12 €/mois |
| **Domaine** `tournoi-chellestt.fr` | Achat ou déjà possédé | ~7 €/an |
| **OVH SMS Pro** | Pack SMS (à commander avant le 1er tournoi) | à l'usage, ~0,045 €/SMS HT |
| **Object Storage OVH** (optionnel mais recommandé) | Pour les backups Postgres | ~0,008 €/Go/mois |

### 📝 [GITHUB] Compte GitHub

- Si tu n'as pas déjà cloné `https://github.com/Fonipanda/TT_Tournoi`, il te faudra un compte GitHub
- Branche cible : `v2-ovh-coolify`

---

## 2. Commander le VPS et le domaine

### 🌐 [OVH WEB] 2.1. Commander le VPS-2

1. Aller sur https://www.ovhcloud.com/fr/vps/
2. Choisir le plan **VPS-2** (6 vCore / 12 Go / 100 Go NVMe)
3. **Image système** : sélectionner **`Ubuntu 24.04 LTS`** (à privilégier sur Debian car plus de tutos pour Coolify)
4. **Datacenter** : choisir un datacenter français (Gravelines `GRA` ou Roubaix `RBX` ou Strasbourg `SBG`) → meilleure latence
5. **Options à cocher** :
   - ✅ Snapshot mensuel (inclus, ne pas oublier)
   - ✅ Sauvegarde automatique (option, ~3 €/mois — ou tu peux te contenter du `pg_dump` cron qu'on configurera)
6. Finaliser la commande

### ⏳ Attente provisioning

Tu reçois un email d'OVH dans ~10-30 minutes avec :
- L'**adresse IP publique** du VPS (ex: `51.91.x.x` ou `141.94.x.x`)
- Le **mot de passe root** initial (à changer immédiatement)

**📝 Note immédiatement ces 2 infos quelque part de sécurisé** (gestionnaire de mots de passe type Bitwarden / KeePass).

### 🌐 [OVH WEB] 2.2. Acheter / vérifier le domaine `tournoi-chellestt.fr`

1. Aller sur https://www.ovh.com/fr/domaines/
2. Chercher `tournoi-chellestt.fr` → si disponible, l'acheter (~7 €/an)
3. Si déjà possédé chez un autre registrar, c'est OK (on configurera juste les DNS plus tard, peu importe où le domaine est hébergé)

---

## 3. Configurer mRemoteNG sur ton PC

### 🖥️ [LOCAL] 3.1. Générer une clé SSH (recommandé, plus sûr qu'un mot de passe)

1. Ouvrir **PuTTYgen** (téléchargé en §1)
2. Type de clé : choisir **`Ed25519`** (plus moderne que RSA)
3. Cliquer **`Generate`** → bouger la souris pendant la génération
4. Saisir un **commentaire** : `tt-tournoi-prod`
5. Saisir une **passphrase** (mot de passe pour protéger la clé) — **noter cette passphrase, elle sera redemandée à chaque connexion**
6. Cliquer **`Save private key`** → enregistrer dans `C:\Users\TON_NOM\.ssh\tt-tournoi-prod.ppk`
7. Dans la fenêtre de PuTTYgen, **copier la clé publique** affichée en haut (commence par `ssh-ed25519 AAAA...`) → la coller dans un fichier `C:\Users\TON_NOM\.ssh\tt-tournoi-prod.pub` (extension `.pub`)

> 💡 **Astuce** : si `C:\Users\TON_NOM\.ssh` n'existe pas, créer le dossier dans l'Explorateur Windows.

### 🖥️ [LOCAL] 3.2. Configurer mRemoteNG

1. Ouvrir **mRemoteNG**
2. Clic droit sur le panneau gauche → **`New Connection`**
3. Renseigner les champs :

| Champ | Valeur |
|---|---|
| **Name** | `tt-tournoi-prod` (ou ce que tu veux) |
| **Hostname / IP** | l'IP publique reçue par email d'OVH |
| **Protocol** | **SSH version 2** |
| **Port** | `22` |
| **Username** | `root` (uniquement pour la première connexion ; on créera un user `tt` ensuite) |

4. Onglet **`Config`** (en bas) → Section **`Authentication`** :
   - **User** : `root`
   - **Password** : laisser vide (on va utiliser la clé)
5. Onglet **`Config`** → Section **`SSH`** :
   - **Use private key for authentication** : ✅ cocher
   - **Private key file** : pointer sur `C:\Users\TON_NOM\.ssh\tt-tournoi-prod.ppk`
6. **Sauvegarder** (Ctrl+S)

### 🖥️ [LOCAL] 3.3. Première connexion (avec mot de passe root)

⚠️ **Avant de pouvoir utiliser la clé**, il faut d'abord se connecter une fois avec le mot de passe pour y déposer la clé publique.

**Méthode A — via mRemoteNG en mot de passe temporairement** :

1. Dans mRemoteNG, modifier temporairement la connexion :
   - Décocher **`Use private key for authentication`**
   - Mettre le mot de passe root reçu d'OVH dans **`Password`**
2. Double-clic sur la connexion → un terminal s'ouvre
3. Si demandé "do you trust this host?" → **Yes**
4. Tu es connecté en `root@IP_VPS:~#`

---

## 4. Première connexion au VPS et durcissement SSH

### ☁️ [VPS] 4.1. Changer le mot de passe root

```bash
passwd
# Saisir 2x le nouveau mot de passe (24+ caractères, mélange chiffres/lettres/symboles)
```

### ☁️ [VPS] 4.2. Mettre à jour le système

```bash
apt update && apt upgrade -y
apt install -y curl wget htop ufw fail2ban git unzip ca-certificates
```

⏱️ Cela prend ~3-5 minutes.

### ☁️ [VPS] 4.3. Créer un utilisateur non-root `tt`

```bash
adduser tt
# Saisir un mot de passe fort pour 'tt' + remplir les infos (Full name, etc., laisser vide est OK)
usermod -aG sudo tt
```

### ☁️ [VPS] 4.4. Déposer ta clé publique pour l'utilisateur `tt`

```bash
mkdir -p /home/tt/.ssh
chmod 700 /home/tt/.ssh
nano /home/tt/.ssh/authorized_keys
```

Dans nano, **coller le contenu de `tt-tournoi-prod.pub`** (la clé publique générée à l'étape 3.1) :
- Clic droit dans le terminal mRemoteNG → **Paste** (ou Ctrl+Maj+V)
- Sauvegarder : **Ctrl+O**, **Enter**, **Ctrl+X**

```bash
chmod 600 /home/tt/.ssh/authorized_keys
chown -R tt:tt /home/tt/.ssh
```

### ☁️ [VPS] 4.5. Tester la connexion par clé

⚠️ **Avant de désactiver le login root**, teste que la clé fonctionne pour `tt` :

🖥️ **[LOCAL]** Dans mRemoteNG :
1. Modifier la connexion :
   - **Username** : `tt` (au lieu de `root`)
   - **Password** : (vide)
   - ✅ **Use private key for authentication** + pointer sur ton `.ppk`
2. Sauvegarder, double-clic, tu dois être connecté en `tt@VPS:~$`
3. La passphrase de la clé est demandée (celle de l'étape 3.1)

✅ Si tu vois `tt@VPS:~$` → la clé marche, on peut sécuriser.

❌ Si erreur → ouvre **une 2ème connexion mRemoteNG** en `root` mot de passe (pour ne pas te lock-out), et vérifie que `/home/tt/.ssh/authorized_keys` contient bien la bonne clé publique.

### ☁️ [VPS] 4.6. Durcir SSH (uniquement après confirmation que la clé fonctionne)

Connecté en `tt`, passer en sudo :

```bash
sudo nano /etc/ssh/sshd_config
```

Trouver et modifier (ou ajouter en bas) ces lignes :
```
PermitRootLogin prohibit-password
PasswordAuthentication no
PubkeyAuthentication yes
```

> 🔒 **`prohibit-password`** = root accepté **UNIQUEMENT par clé SSH** (pas par mot de passe). Indispensable pour Coolify qui doit se connecter à lui-même en SSH (cf §5). Tout aussi sécurisé que `PermitRootLogin no` car combiné avec `PasswordAuthentication no`.

**Ctrl+O**, **Enter**, **Ctrl+X** pour sauvegarder.

```bash
sudo systemctl restart ssh
```

⚠️ **Si tu fermes ta connexion par erreur AVANT de tester** → tu peux te lock-out. Garde une 2ème connexion mRemoteNG ouverte en sécurité jusqu'à validation.

### ☁️ [VPS] 4.7. Activer le pare-feu UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 8000/tcp comment 'Coolify panel temporaire'
sudo ufw --force enable
sudo ufw status
```

> ⚠️ Le port `8000` sera **fermé** plus tard (étape 11) une fois Coolify accessible via `https://coolify.tournoi-chellestt.fr`.

### ☁️ [VPS] 4.8. Activer fail2ban (protection brute-force)

```bash
sudo systemctl enable --now fail2ban
sudo systemctl status fail2ban   # doit afficher 'active (running)'
```

### ☁️ [VPS] 4.9. Ajouter du swap (optionnel mais recommandé)

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # vérifier que 4G de swap apparaît
```

---

## 5. Installation de Coolify

### ☁️ [VPS] 5.1. Lancer le script officiel

```bash
sudo bash -c "$(curl -fsSL https://cdn.coollabs.io/coolify/install.sh)"
```

⏱️ Cela prend **5-10 minutes**. Le script :
- Installe Docker + Docker Compose
- Crée la base PostgreSQL interne de Coolify
- Démarre Traefik (proxy auto-SSL)
- Lance l'interface web sur le port `8000`

À la fin, tu vois :
```
Coolify is up and running!
Open http://YOUR_IP:8000
```

### 🖥️ [LOCAL] 5.2. Premier accès à Coolify

1. Ouvrir un navigateur sur ton PC Windows
2. Aller sur `http://IP_VPS:8000` (remplacer `IP_VPS` par l'IP réelle)
3. **Première fois** : créer le compte admin Coolify
   - Email : ton email
   - Password : 16+ caractères forts (à conserver dans ton gestionnaire de mots de passe)
4. Tu arrives sur le dashboard Coolify

> ⚠️ Si la page ne charge pas : vérifier que `sudo ufw status` autorise bien le port 8000, et que `sudo systemctl status docker` est `active`.

### 🎛️ [COOLIFY] 5.3. Configurer le serveur

1. Menu gauche → **`Servers`** → **`localhost`**
2. Renseigner :
   - **Name** : `tt-prod`
   - **Description** : `VPS OVH production TT Tournoi`
3. Save

---

## 6. Configuration DNS chez OVH

### 🌐 [OVH WEB] 6.1. Pointer le domaine vers le VPS

1. Connexion sur https://www.ovh.com/manager/
2. Onglet **`Web Cloud`** → **`Domaines`** → cliquer sur `tournoi-chellestt.fr`
3. Onglet **`Zone DNS`**

#### ⚠️ Étape 6.1.a — Nettoyer la zone DNS d'abord

OVH crée automatiquement des entrées par défaut qui vont **entrer en conflit** avec les nôtres :
- une entrée `A` racine vers `213.186.33.5` (page de parking OVH)
- éventuellement un `AAAA` racine
- des entrées `A`/`AAAA` sur `www`

**Supprime toutes ces entrées par défaut** (clic sur **⋮** → **Supprimer**) :

| À supprimer | Type | Sous-domaine | Cible probable |
|---|---|---|---|
| ✂️ | `A` | (vide / `@`) | `213.186.33.5` (page parking OVH) |
| ✂️ | `AAAA` | (vide / `@`) | IPv6 OVH |
| ✂️ | `A` | `www` | IP OVH parking |
| ✂️ | `AAAA` | `www` | IPv6 OVH |

> ✅ **NE PAS supprimer** : `NS` (serveurs de noms OVH), `SOA`, `MX` (si tu veux garder les emails OVH).

> 💡 Si OVH te bloque malgré tout, utilise **`Réinitialiser la zone DNS`** (bas de page) → mode **"Configuration minimale"** → recommencer à zéro.

#### Étape 6.1.b — Créer les 3 entrées nécessaires

Cliquer **`Ajouter une entrée`** pour chacune :

| Type | Sous-domaine | Cible (valeur) | TTL |
|---|---|---|---|
| `A` | (laisser **VIDE** ou taper `@`) | `IP_DU_VPS` | 60 |
| `A` | `www` | `IP_DU_VPS` | 60 |
| `A` | `coolify` | `IP_DU_VPS` | 60 |
| `CAA` | (laisser **VIDE** ou taper `@`) | `0 issue "letsencrypt.org"` | 3600 |

> ⚠️ **NE PAS METTRE `www` DANS LE CHAMP DE LA 1ÈRE ENTRÉE** ! `www` est un sous-domaine différent de la racine. Pour le **domaine racine** (`tournoi-chellestt.fr` sans rien devant), il faut **laisser le champ "Sous-domaine" vide** ou taper `@` (notation DNS standard pour la racine).

> 💡 **Pourquoi 4 entrées de type `A` au lieu d'un `CNAME` pour `www` ?** Un `CNAME` ne peut pas coexister avec d'autres types d'enregistrement (règle stricte DNS). Les entrées par défaut d'OVH sur `www` provoqueraient l'erreur `CNAME and other data`. Utiliser des `A` directs partout évite le problème et c'est même légèrement plus rapide à résoudre (1 requête DNS au lieu de 2).

> 💡 Le `CAA` autorise explicitement Let's Encrypt à émettre des certificats pour ton domaine — recommandé sécurité.

> ⚠️ **Ne pas créer de sous-domaine `tournoi`** : le domaine est `tournoi-chellestt.fr` directement (avec un tiret). C'est le **domaine racine** qui pointera vers l'app.

4. Cliquer **`Suivant`** puis **`Confirmer`** (à chaque entrée ajoutée)

### 🖥️ [LOCAL] 6.2. Vérifier la propagation DNS

Ouvrir PowerShell sur ton PC :
```powershell
nslookup tournoi-chellestt.fr
nslookup coolify.tournoi-chellestt.fr
nslookup www.tournoi-chellestt.fr
```

→ Doit retourner ton IP_VPS pour les 3 (le `www` peut afficher "alias" ou "CNAME" puis l'IP en dessous, c'est normal).

⏱️ Si ça ne marche pas immédiatement, attendre 5-15 minutes (le DNS se propage progressivement).

> 🔍 Tu peux aussi vérifier sur https://www.whatsmydns.net/ en saisissant `tournoi-chellestt.fr` type `A` — tu verras la propagation par pays/serveur DNS dans le monde.

---

## 7. Création des ressources Coolify

### ☁️ [VPS] 7.0. (PREREQUIS) Autoriser Coolify à se connecter en SSH local

⚠️ **Étape obligatoire à faire AVANT toute action dans l'interface Coolify**, sinon tu auras l'erreur `ssh: connect to host 127.0.0.1 port 22: Connection refused` au moment de valider le serveur.

**Pourquoi ?** Coolify tourne dans un container Docker et doit se connecter à lui-même en SSH (sur 127.0.0.1) pour gérer le serveur "localhost" : déployer les apps, exécuter Docker, etc. Il utilise sa propre paire de clés SSH générée à l'installation.

#### Solution — Ajouter la clé publique Coolify aux `authorized_keys` de root

Connecté en SSH (mRemoteNG) en tant que `tt` :

```bash
# 1. Vérifier que la clé Coolify existe
sudo ls -la /data/coolify/ssh/keys/
# → Tu dois voir id.root@host.docker.internal et id.root@host.docker.internal.pub

# 2. Préparer le dossier .ssh de root
sudo mkdir -p /root/.ssh
sudo chmod 700 /root/.ssh
sudo touch /root/.ssh/authorized_keys
sudo chmod 600 /root/.ssh/authorized_keys

# 3. Ajouter la clé publique Coolify aux authorized_keys de root
sudo cat /data/coolify/ssh/keys/id.root@host.docker.internal.pub | sudo tee -a /root/.ssh/authorized_keys

# 4. Tester que ça marche
sudo ssh -i /data/coolify/ssh/keys/id.root@host.docker.internal \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  root@127.0.0.1 'echo "✅ Coolify peut se connecter en SSH"'
```

→ Si la dernière commande affiche `✅ Coolify peut se connecter en SSH`, c'est bon, tu peux passer à §7.1.

❌ Si encore `Connection refused` :
- Vérifier que sshd écoute bien : `sudo ss -tlnp | grep :22`
- Vérifier que `PermitRootLogin prohibit-password` est bien dans `/etc/ssh/sshd_config` (cf §4.6)
- Restart : `sudo systemctl restart ssh`

### 🎛️ [COOLIFY] 7.1. Sécuriser Coolify avec un sous-domaine + SSL

L'interface Coolify évolue selon les versions. Voici les chemins selon le cas :

#### Plan A — Coolify v4 (le plus courant)

1. Menu gauche → cliquer sur l'icône **`Settings`** (engrenage) tout en **BAS** du menu (pas en haut)
2. Dans la page Settings → onglet **`General`**
3. Trouver le champ **`Instance's Fully Qualified Domain Name (FQDN)`** (ou `Instance Domain`)
4. Saisir : `https://coolify.tournoi-chellestt.fr`
   - ⚠️ Bien mettre `https://` au début → c'est ce qui déclenche la génération du certificat SSL
   - ⚠️ Pas de `/` à la fin
5. Cliquer **`Save`**
6. Attendre ~30 secondes → SSL Let's Encrypt généré automatiquement par Traefik
7. Ouvrir `https://coolify.tournoi-chellestt.fr` dans un nouvel onglet → cadenas vert ✅

#### Plan B — Si le menu Settings n'a pas le champ

Selon la version exacte, le FQDN peut être ailleurs :
- Menu gauche → **`Servers`** → cliquer sur **`localhost`** → onglet **`General`** ou **`Configuration`**
- Ou utiliser la barre de recherche **`Ctrl+K`** / **`Cmd+K`** → taper `FQDN` ou `domain`

#### Plan C — Via SSH (méthode garantie)

Si l'interface ne te propose pas le champ, édite directement le `.env` de Coolify via mRemoteNG :

```bash
sudo nano /data/coolify/source/.env
```

Modifier la ligne (Ctrl+W pour chercher `APP_URL`) :
```
APP_URL=https://coolify.tournoi-chellestt.fr
```

Sauvegarder (Ctrl+O, Enter, Ctrl+X) puis redémarrer Coolify :
```bash
cd /data/coolify/source
sudo docker compose down
sudo docker compose up -d
```

⏱️ ~1 minute. Puis ouvre `https://coolify.tournoi-chellestt.fr` → SSL auto.

> 💡 **Important** : avant cette étape, vérifie que `nslookup coolify.tournoi-chellestt.fr` retourne bien ton IP_VPS (cf §6.2). Sans DNS résolu, Let's Encrypt ne pourra pas valider le challenge HTTP-01.

### 🎛️ [COOLIFY] 7.2. Créer un Project

1. Menu gauche → **`Projects`** → **`+ Add`**
2. Nom : `tt-tournoi`
3. Description : `Plateforme de tournois TT Chelles`
4. Save → entrer dans le projet

### 🎛️ [COOLIFY] 7.3. Créer la base PostgreSQL 16

1. Dans le projet → **`+ New Resource`** → **`Databases`** → **`PostgreSQL 16`**
2. Configurer :
   - **Name** : `tt-postgres`
   - **PostgreSQL User** : `tt`
   - **PostgreSQL Password** : cliquer sur le bouton 🎲 pour générer 32 chars random → **noter dans ton gestionnaire de mots de passe**
   - **PostgreSQL Database** : `tt_tournoi`
   - **Image** : `postgres:16-alpine`
   - **Public Port** : ❌ laisser désactivé (sécurité : interne uniquement)
3. **Save**
4. Cliquer **`Start`** → attendre que le statut passe à `Running`
5. Onglet **`Connection String`** → noter la chaîne :
   ```
   postgres://tt:PASSWORD@<host-interne>:5432/tt_tournoi
   ```
   `<host-interne>` ressemble à `tt-postgres-xxxxx`. C'est l'adresse réseau Docker interne.

### 🎛️ [COOLIFY] 7.4. Créer Redis 7

1. Projet → **`+ New Resource`** → **`Databases`** → **`Redis`**
2. Configurer :
   - **Name** : `tt-redis`
   - **Image** : `redis:7-alpine`
   - **Public Port** : ❌
3. **Save** → **Start**
4. Onglet **`Connection String`** → noter `redis://<host-interne>:6379` (ex `redis://tt-redis-yyyyy:6379`)

### 🎛️ [COOLIFY] 7.5. Créer l'application Web (Next.js)

1. Projet → **`+ New Resource`** → **`Applications`** → **`Public Repository`**
2. Configurer :
   - **Repository URL** : `https://github.com/Fonipanda/TT_Tournoi`
   - **Branch** : `v2-ovh-coolify`
   - **Build Pack** : **`Dockerfile`**
   - **Dockerfile location** : `infra/docker/web.Dockerfile`
3. Cliquer **`Continue`**
4. Configuration de l'app :
   - **Name** : `tt-web`
   - **Domains** : `https://tournoi-chellestt.fr`
   - **Port** (container) : `3000`
   - **Health check path** : `/api/health`
5. **Save**

#### 🎛️ [COOLIFY] Variables d'environnement de `tt-web`

Onglet **`Environment Variables`** → **`+ Add`** pour chaque ligne ci-dessous.

🛡️ Cocher la case **`Secret`** pour les variables marquées 🔒.

```
# --- Database (utiliser le host interne de l'étape 7.3) ---
DATABASE_URL = postgres://tt:PASSWORD@tt-postgres-xxxxx:5432/tt_tournoi?schema=public          🔒
SHADOW_DATABASE_URL = postgres://tt:PASSWORD@tt-postgres-xxxxx:5432/tt_tournoi_shadow?schema=public  🔒

# --- Redis ---
REDIS_URL = redis://tt-redis-yyyyy:6379

# --- Auth (générer 2 secrets uniques de 64+ chars chacun) ---
JWT_ACCESS_SECRET = <openssl rand -base64 48>     🔒
JWT_REFRESH_SECRET = <openssl rand -base64 48>    🔒
JWT_ACCESS_TTL = 15m
JWT_REFRESH_TTL = 7d

# --- URLs publiques ---
NEXT_PUBLIC_APP_URL = https://tournoi-chellestt.fr
NEXT_PUBLIC_WS_URL = wss://tournoi-chellestt.fr/ws/api/ws/live

# --- WebSocket interne ---
WS_INTERNAL_TOKEN = <openssl rand -base64 32>     🔒

# --- FFTT ---
FFTT_API_BASE = http://fftt.dafunker.com/v1
FFTT_CACHE_TTL = 86400

# --- OVH SMS Pro (à remplir avec tes clés OVH après l'étape 8) ---
OVH_SMS_APP_KEY =                                 🔒
OVH_SMS_APP_SECRET =                              🔒
OVH_SMS_CONSUMER_KEY =                            🔒
OVH_SMS_SERVICE_NAME = sms-xxxxx-1
OVH_SMS_DEFAULT_SENDER = ChellesTT

# --- Logs ---
LOG_LEVEL = info
NODE_ENV = production
```

> 🔑 **Pour générer les secrets** : ouvre une connexion SSH (mRemoteNG) sur le VPS et exécute `openssl rand -base64 48`. Copie le résultat dans Coolify.

#### 🎛️ [COOLIFY] Migration Prisma automatique au démarrage

✅ **Aucune action requise** : le Dockerfile inclut un entrypoint qui exécute automatiquement `prisma migrate deploy` à chaque démarrage du container, **avant** de lancer Next.js.

> 💡 **Contrairement aux versions précédentes du guide** où on utilisait un "Custom Start Command", on a intégré la migration directement dans le Dockerfile (`infra/docker/web-entrypoint.sh`). Ça marche dans toutes les versions de Coolify, ne dépend pas de l'UI, et fonctionne aussi en local avec `docker run`.

> ⚠️ Si la migration échoue (BD inaccessible, conflit de schéma...), le container ne démarre pas (fail-fast). Coolify le verra dans les logs et ne mettra pas le container en "Healthy".

#### 🎛️ [COOLIFY] Premier déploiement

1. Cliquer **`Deploy`** (en haut à droite)
2. ⏱️ Le premier build prend **8-15 minutes** (téléchargement Node + dépendances + Prisma generate + Next.js build)
3. Surveiller les logs en temps réel dans l'onglet **`Logs`**
4. ✅ Quand le statut passe à **`Healthy`**, accéder à `https://tournoi-chellestt.fr/api/health` → tu dois voir `{"ok":true,...}`

> ❌ **Si le build échoue** : lire les logs, l'erreur la plus probable est `ECONNREFUSED` sur Postgres → vérifier que `DATABASE_URL` pointe bien vers le host interne (pas `localhost`).

### 🎛️ [COOLIFY] 7.6. Créer l'application WebSocket (Fastify)

1. Projet → **`+ New Resource`** → **`Applications`** → **`Public Repository`**
2. Mêmes paramètres GitHub :
   - Repository URL : `https://github.com/Fonipanda/TT_Tournoi`
   - Branch : `v2-ovh-coolify`
   - Build Pack : **Dockerfile**
   - Dockerfile location : `infra/docker/ws.Dockerfile`
3. **Continue**
4. Configurer :
   - **Name** : `tt-ws`
   - **Domains** : (vide — service interne)
   - **Port** (container) : `3001`
   - **Health check path** : `/health`

#### 🎛️ [COOLIFY] Variables d'env de `tt-ws`

```
REDIS_URL = redis://tt-redis-yyyyy:6379
JWT_ACCESS_SECRET = <même valeur que tt-web>      🔒
WS_PORT = 3001
LOG_LEVEL = info
NODE_ENV = production
```

⚠️ **`JWT_ACCESS_SECRET` doit être identique** entre `tt-web` et `tt-ws` (sinon les tokens ne seront pas valides côté WS).

#### 🎛️ [COOLIFY] Routing `/ws` → service WS via labels Traefik

Onglet **`Settings → Advanced → Custom Docker Labels`** → coller :

```
traefik.http.routers.tt-ws.rule=Host(`tournoi-chellestt.fr`) && PathPrefix(`/ws`)
traefik.http.routers.tt-ws.entrypoints=https
traefik.http.routers.tt-ws.tls=true
traefik.http.routers.tt-ws.tls.certresolver=letsencrypt
traefik.http.services.tt-ws.loadbalancer.server.port=3001
traefik.http.middlewares.tt-ws-strip.stripprefix.prefixes=/ws
traefik.http.routers.tt-ws.middlewares=tt-ws-strip
```

Cela dit à Traefik :
> "Si l'URL commence par `tournoi-chellestt.fr/ws`, retire le préfixe `/ws` et redirige vers le service `tt-ws` sur le port 3001"

5. **Save** → **Deploy**

#### 🖥️ [LOCAL] Vérifier le WebSocket

Dans un navigateur, ouvrir la console JS (F12) sur `https://tournoi-chellestt.fr/live` :
```javascript
const ws = new WebSocket('wss://tournoi-chellestt.fr/ws/api/ws/live');
ws.onopen = () => console.log('✅ WS connecté');
ws.onmessage = (e) => console.log('📨', e.data);
```

Tu dois voir `✅ WS connecté` puis `📨 {"type":"hello","role":"visitor",...}`.

---

## 8. Configuration OVH SMS Pro

### 🌐 [OVH WEB] 8.1. Commander un pack SMS

1. https://www.ovh.com/fr/sms/ → choisir un pack (ex: **100 SMS** pour démarrer, ~5 €)
2. Une fois validé, dans le manager OVH → **Télécom** → **SMS** → noter le **nom du service** (`sms-ab12345-1`)

### 🌐 [OVH WEB] 8.2. Générer un token API OVH

1. Ouvrir https://api.ovh.com/createToken
2. Renseigner :
   - **Account ID** : ton identifiant OVH
   - **Password** : ton mot de passe OVH
   - **Validity** : `Unlimited` (ou 1 an si tu préfères)
   - **Rights** :
     ```
     GET    /sms/*
     POST   /sms/*
     PUT    /sms/*
     DELETE /sms/*
     ```
   - **Application name** : `TT-Tournoi`
   - **Application description** : `App TT Tournoi v2`
3. **Create keys** → tu reçois 3 clés à noter dans ton gestionnaire :
   - `Application Key`
   - `Application Secret`
   - `Consumer Key`

### 🎛️ [COOLIFY] 8.3. Mettre à jour les variables d'env de `tt-web`

Retourner sur `tt-web` → **Environment Variables** → modifier :
```
OVH_SMS_APP_KEY = <Application Key>           🔒
OVH_SMS_APP_SECRET = <Application Secret>     🔒
OVH_SMS_CONSUMER_KEY = <Consumer Key>         🔒
OVH_SMS_SERVICE_NAME = sms-ab12345-1
OVH_SMS_DEFAULT_SENDER = ChellesTT
```

> ⚠️ **`OVH_SMS_DEFAULT_SENDER`** : 11 caractères max, alphanumériques uniquement. Doit être préalablement validé chez OVH (manager → SMS → onglet **Expéditeurs**).

→ Cliquer **Save** → **Restart** (en haut à droite) pour appliquer.

---

## 9. Premier seed et premier login

### 🖥️ [LOCAL] 9.1. Lancer le seed via Coolify Terminal

Coolify expose un terminal web pour chaque container.

1. Coolify → `tt-web` → onglet **`Terminal`**
2. Exécuter :
   ```bash
   node packages/db/node_modules/.bin/prisma db seed --schema=./packages/db/prisma/schema.prisma
   ```
3. ⏱️ Tu dois voir s'afficher :
   ```
   [seed] Tournoi : Tournoi Démo Chelles 2026
   [seed] 4 brackets
   [seed] 16 joueurs FFTT
   [seed] Comptes admin + juge-arbitre
   [seed] 2 salles, 10 tables
   [seed] Menu buvette : 3 sections, 10 items
   [seed] 3 templates SMS
   [seed] ✅ Terminé.
   ```

### 🖥️ [LOCAL] 9.2. Premier login

1. Ouvrir `https://tournoi-chellestt.fr/login`
2. **Mode** : `Staff`
3. **Identifiant** : `admin`
4. **Mot de passe** : `Admin123!`
5. **Submit**
6. Redirigé vers le dashboard. ⚠️ Aller immédiatement dans **`Mon profil`** (à venir) ou via API pour changer le mot de passe.

> 🔐 **À FAIRE OBLIGATOIREMENT** : la fonctionnalité "force reset password" est codée mais l'UI de reset n'est pas dans la v1 → utiliser temporairement un script pour changer le hash :
>
> Dans Coolify → `tt-web` → Terminal :
> ```bash
> node -e "
> const argon2 = require('argon2');
> const { prisma } = require('./packages/db/src');
> (async () => {
>   const hash = await argon2.hash('TonNouveauMotDePasseTresFort!', { type: argon2.argon2id });
>   await prisma.userAccount.update({
>     where: { username: 'admin' },
>     data: { passwordHash: hash, passwordNeedsReset: false }
>   });
>   console.log('Password admin mis à jour ✅');
> })();
> "
> ```

Faire la même chose pour le compte `ja` (juge-arbitre).

### 🎛️ [COOLIFY] 9.3. Activer l'adaptateur OVH SMS

1. Sur `https://tournoi-chellestt.fr` → login admin
2. Menu gauche → **`SMS`**
3. Onglet **`Adaptateurs`** : trouver **`OVH SMS Pro (Chelles TT)`** (créé par le seed)
4. Cliquer **`Modifier`** → **`isActive`** : ✅ → **Save**
5. Le trigger SQL désactive automatiquement les autres adaptateurs

### 🖥️ [LOCAL] 9.4. Tester l'envoi SMS

Toujours dans `/admin/sms` → onglet **`Test`** :
- **To** : `+336XXXXXXXX` (ton numéro)
- **Message** : `Test TT Tournoi`
- **Submit**

✅ Tu reçois le SMS dans les ~30 secondes.

❌ Si erreur "OVH non configuré" → vérifier les 4 variables `OVH_SMS_*` dans Coolify et redémarrer `tt-web`.

---

## 10. Configuration des backups automatiques

### 🌐 [OVH WEB] 10.1. Créer un Object Storage OVH

1. Manager OVH → **`Public Cloud`** → si pas de projet, en créer un (~0,01€ minimum facturé)
2. Section **`Storage`** → **`Object Storage`** → **`Créer un container`**
3. Configurer :
   - **Region** : `GRA` (Gravelines, France)
   - **Type** : `Standard`
   - **Nom** : `tt-tournoi-backups`
   - **Compatibilité** : `S3`
4. Onglet **Utilisateurs S3** → générer une clé S3 :
   - Noter `Access Key` et `Secret Key`

### ☁️ [VPS] 10.2. Installer aws-cli

```bash
sudo apt install -y awscli
```

### ☁️ [VPS] 10.3. Configurer le fichier de credentials

```bash
sudo mkdir -p /etc/tt-tournoi
sudo nano /etc/tt-tournoi/backup.env
```

Contenu :
```bash
S3_BACKUP_BUCKET=tt-tournoi-backups
S3_BACKUP_ENDPOINT=https://s3.gra.io.cloud.ovh.net
S3_BACKUP_ACCESS_KEY=<Access Key>
S3_BACKUP_SECRET_KEY=<Secret Key>
```

```bash
sudo chmod 600 /etc/tt-tournoi/backup.env
```

### ☁️ [VPS] 10.4. Cloner le repo pour avoir le script

```bash
cd /home/tt
git clone https://github.com/Fonipanda/TT_Tournoi.git
cd TT_Tournoi
git checkout v2-ovh-coolify
sudo cp infra/scripts/backup-postgres.sh /opt/tt-tournoi/
sudo chmod +x /opt/tt-tournoi/backup-postgres.sh
```

### ☁️ [VPS] 10.5. Tester le backup manuellement

```bash
sudo /opt/tt-tournoi/backup-postgres.sh
```

✅ Doit afficher `[backup] ✅ done`. Vérifier dans le manager OVH → Object Storage que le fichier `tt_tournoi_YYYYMMDD-HHMMSS.sql.gz` est bien uploadé.

### ☁️ [VPS] 10.6. Cron quotidien à 3h du matin

```bash
sudo nano /etc/cron.d/tt-backup
```

Contenu :
```cron
0 3 * * * tt /opt/tt-tournoi/backup-postgres.sh >> /var/log/tt-backup.log 2>&1
```

```bash
sudo chown root:root /etc/cron.d/tt-backup
sudo chmod 644 /etc/cron.d/tt-backup
sudo touch /var/log/tt-backup.log
sudo chown tt:tt /var/log/tt-backup.log
```

### ☁️ [VPS] 10.7. Tester la restoration (CRUCIAL avant le 1er tournoi)

⚠️ **Ne pas négliger cette étape** : un backup non testé est un backup qui ne marche pas.

```bash
# 1. Télécharger un backup
aws s3 cp s3://tt-tournoi-backups/tt_tournoi_LATEST.sql.gz /tmp/test-restore.sql.gz \
  --endpoint-url=https://s3.gra.io.cloud.ovh.net

# 2. Créer une BD de test
docker exec -it $(docker ps --filter name=tt-postgres -q) psql -U tt -c "CREATE DATABASE tt_test;"

# 3. Restaurer dedans
gunzip < /tmp/test-restore.sql.gz | docker exec -i $(docker ps --filter name=tt-postgres -q) psql -U tt tt_test

# 4. Vérifier
docker exec -it $(docker ps --filter name=tt-postgres -q) psql -U tt tt_test -c "SELECT COUNT(*) FROM \"Player\";"

# 5. Nettoyer
docker exec -it $(docker ps --filter name=tt-postgres -q) psql -U tt -c "DROP DATABASE tt_test;"
```

---

## 11. Vérifications finales

### 🖥️ [LOCAL] 11.1. Checklist sécurité

- [ ] Mot de passe `admin` changé (passwordNeedsReset à false)
- [ ] Mot de passe `ja` changé
- [ ] HTTPS fonctionne sur `https://tournoi-chellestt.fr` (cert valide)
- [ ] HTTPS fonctionne sur `https://coolify.tournoi-chellestt.fr`
- [ ] Aucun warning sur https://www.ssllabs.com/ssltest/ pour `tournoi-chellestt.fr` (note A ou A+ attendue)
- [ ] WebSocket `wss://tournoi-chellestt.fr/ws/api/ws/live` se connecte (vérifier en console F12)
- [ ] Healthcheck OK : `https://tournoi-chellestt.fr/api/health` → `{"ok":true}`
- [ ] SMS de test reçu via OVH

### ☁️ [VPS] 11.2. Fermer le port 8000 (Coolify ne doit plus être en HTTP brut)

Maintenant que `https://coolify.tournoi-chellestt.fr` fonctionne, on peut fermer le port 8000 :

```bash
sudo ufw delete allow 8000/tcp
sudo ufw status
```

→ Coolify reste accessible UNIQUEMENT via `https://coolify.tournoi-chellestt.fr` (avec login obligatoire).

### 🌐 [OVH WEB] 11.3. Snapshot manuel

1. Manager OVH → VPS → onglet **`Snapshots`** → **`Prendre un snapshot`**
2. Nommer : `tt-prod-clean-after-setup`
3. Date à noter — c'est ton **point de retour propre**

### 🖥️ [LOCAL] 11.4. Tester un flow complet en E2E

Sur `https://tournoi-chellestt.fr` :
1. Page d'accueil charge ✅
2. Page `/live` affiche les tables (libres) ✅
3. Page `/buvette` affiche le menu ✅
4. Login `admin` → dashboard accessible ✅
5. Page `/admin/sms` → adaptateur OVH actif (cocher vert) ✅
6. Login joueur avec licence `7711100001` (Martin DUPONT du seed) → autocréation OK, redirection vers `/mon-espace` ✅

---

## 12. Aide-mémoire urgences

| Symptôme | Action |
|---|---|
| App down | 🎛️ Coolify → tt-web → **Restart** |
| Postgres down | ☁️ `docker logs $(docker ps --filter name=tt-postgres -q)` puis `docker restart` |
| WebSocket KO | 🎛️ Vérifier les labels Traefik de tt-ws (étape 7.6) |
| SMS ne partent plus | 🖥️ `/admin/sms` → vérifier l'adaptateur actif + tester |
| Disque saturé | ☁️ `docker system prune -a --volumes --filter 'until=720h'` |
| Login KO | ☁️ Vérifier `JWT_ACCESS_SECRET` identique entre tt-web et tt-ws |

→ Voir aussi `docs/runbook.md` pour les procédures détaillées.

---

## 🎓 Ce qui se passe où — récapitulatif

| Activité | Outil | Fréquence |
|---|---|---|
| Coder, tester, push | 🖥️ [LOCAL] VS Code + Git | Continue |
| Surveiller l'app, voir logs, redémarrer | 🎛️ [COOLIFY] | Quotidien jour de tournoi |
| Voir les SMS envoyés / activer adapter | 🖥️ [LOCAL] navigateur sur `/admin/sms` | Avant chaque tournoi |
| Backup ponctuel manuel | ☁️ [VPS] mRemoteNG SSH + script | Avant tournoi |
| Mises à jour OS du VPS | ☁️ [VPS] `apt upgrade` | Mensuel |
| Snapshot OVH | 🌐 [OVH WEB] | Avant gros changement |
| Audit SSL | 🖥️ [LOCAL] navigateur | Annuel |
| Redéploiement après code change | Push GitHub → 🎛️ [COOLIFY] auto-deploy | À chaque feature |

---

## 🚀 Cycle de mise à jour de l'app après livraison initiale

Quand on ajoute une fonctionnalité (ou je te livre une amélioration) :

1. 🖥️ [LOCAL] Tester en local : `pnpm dev`
2. 🖥️ [LOCAL] Commit + push sur la branche `v2-ovh-coolify`
3. 🎛️ [COOLIFY] Détecte automatiquement le push (si auto-deploy activé) ou cliquer **Deploy**
4. ⏱️ Build ~5 minutes, restart automatique avec migration Prisma
5. 🖥️ [LOCAL] Vérifier `https://tournoi-chellestt.fr/api/health` après le déploiement

---

## 💰 Coût total estimé

| Poste | Coût mensuel | Coût annuel |
|---|---|---|
| VPS-2 OVH | 12 € | 144 € |
| Domaine `.fr` | — | 7 € |
| Object Storage backups | ~0,3 € | ~4 € |
| **Total fixe** | **~12,30 €/mois** | **~155 €/an** |
| OVH SMS Pro | à l'usage | ~0,045 € HT / SMS |
| **Coût d'un tournoi 1 000 compétiteurs** | **~90-135 €** | (2-3 SMS/joueur) |

---

## 📚 Liens utiles

- Coolify docs : https://coolify.io/docs
- OVH SMS Pro API : https://api.ovh.com/console/#/sms
- FFTT (lookup non officiel) : http://fftt.dafunker.com/v1
- Repo : https://github.com/Fonipanda/TT_Tournoi
- mRemoteNG : https://mremoteng.org/

---

## ✅ Tu es en production !

Une fois cette checklist complète, ton app **TT Tournoi v2** est en production sur `https://tournoi-chellestt.fr`.

🎯 **À faire 2 semaines avant le 1er vrai tournoi** :
1. Test à blanc complet avec données réelles (pas le seed démo)
2. Inviter 5-10 personnes du club à se connecter en parallèle pour vérifier la charge
3. Tester un envoi SMS à TOUS les inscrits avant de déclencher le mode auto le jour J
4. Snapshot OVH manuel "pré-tournoi"

🆘 **En cas de souci pendant un tournoi** : ouvrir cette page sur ton téléphone, suivre la section §12 "Aide-mémoire urgences", et appeler un développeur si besoin.

<div align="center">

# TT Tournoi - Chelles Tennis de Table

### Plateforme de gestion de tournois de Tennis de Table

<br>

<img src="https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white" alt="Django">
<img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js">
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS">
<img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite">
<img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">

<br><br>

[Demarrage rapide](#-demarrage-rapide) &bull; [Fonctionnalites](#-fonctionnalites) &bull; [Architecture](#-architecture) &bull; [API](#-api) &bull; [Configuration](#-configuration)

<br>

</div>

---

## Philosophie

**TT Tournoi** est une application **tout-en-un** concue pour simplifier et automatiser l'organisation de tournois de tennis de table. Nee au sein du club de **Chelles TT**, elle repond a un besoin concret : remplacer les feuilles de calcul, les tableaux papier et les allers-retours constants par un outil numerique fluide, accessible en temps reel depuis n'importe quel appareil.

L'application s'articule autour de trois principes :

- **Simplicite d'utilisation** -- Un double-clic suffit pour lancer l'ensemble des serveurs. L'interface est pensee pour etre utilisee aussi bien par l'organisateur que par les joueurs et les spectateurs.
- **Temps reel** -- Les tables, les matchs en cours et les resultats se mettent a jour en direct. Joueurs et spectateurs consultent les informations sans delai.
- **Respect des regles FFTT** -- La logique de competition (ordre des matchs en poule, departage, calcul de progression de points) suit les articles officiels de la FFTT (Art. I.301 a I.305).

---

## Fonctionnalites

<table>
  <tr>
    <th width="50%">Module</th>
    <th width="50%">Description</th>
  </tr>
  <tr>
    <td><strong>Accueil</strong></td>
    <td>Presentation du tournoi, programme de la journee, informations pratiques (lieu, contact, horaires), compteurs d'inscrits par tableau.</td>
  </tr>
  <tr>
    <td><strong>Inscription</strong></td>
    <td>Recherche automatique par licence FFTT (nom, club, points officiels). Selection des tableaux (avec limite de 2 par jour). Integration avec AssoConnect pour le paiement.</td>
  </tr>
  <tr>
    <td><strong>Live -- Vue salle</strong></td>
    <td>Carte visuelle de la salle en temps reel : statut de chaque table (libre, occupee), match en cours, joueurs, et defilement automatique entre les salles.</td>
  </tr>
  <tr>
    <td><strong>Live -- Joueurs</strong></td>
    <td>Liste des matchs en attente et en cours, avec noms, clubs, classements et duree du match.</td>
  </tr>
  <tr>
    <td><strong>Progression</strong></td>
    <td>Visualisation des arbres d'elimination et classements de poules. Calcul automatique des gains/pertes de points FFTT.</td>
  </tr>
  <tr>
    <td><strong>Buvette</strong></td>
    <td>Menu numerique consultable par tous : sections, articles, descriptions et prix.</td>
  </tr>
  <tr>
    <td><strong>Notifications</strong></td>
    <td>Alertes en temps reel pour les joueurs : match cree, table assignee, resultat enregistre.</td>
  </tr>
  <tr>
    <td><strong>Administration</strong></td>
    <td>Tableau de bord complet : creation de tournois/tableaux, configuration de la salle (drag & drop), generation des matchs (poules + elimination), gestion des joueurs, et generation de QR codes.</td>
  </tr>
</table>

---

## Architecture

```
TT_Tournoi/
|
|-- backend/                  # API Django + Django REST Framework
|   |-- config/               #   Settings, URLs racine, WSGI
|   |-- tournament/           #   App principale (models, views, serializers, urls)
|   |   |-- models.py         #     Tournament, Bracket, Player, Match, Table, Room, Menu...
|   |   |-- views.py          #     ViewSets DRF + logique FFTT
|   |   |-- serializers.py    #     Serialisation JSON
|   |   |-- urls.py           #     Endpoints API
|   |   +-- migrations/       #     Migrations de base de donnees
|   |-- requirements.txt      #   Dependances Python
|   +-- db.sqlite3            #   Base de donnees SQLite
|
|-- frontend/                 # Application Next.js 14 (App Router)
|   |-- src/
|   |   |-- app/
|   |   |   +-- page.tsx      #     Point d'entree, routage par onglets, gestion des roles
|   |   |-- components/
|   |   |   |-- AccueilPage.tsx
|   |   |   |-- InscriptionPage.tsx
|   |   |   |-- LivePage.tsx
|   |   |   |-- JoueursLivePage.tsx
|   |   |   |-- ProgressionPage.tsx
|   |   |   |-- BuvettePage.tsx
|   |   |   +-- AdminPage.tsx
|   |   +-- lib/              #     Utilitaires (cn, helpers)
|   +-- package.json
|
|-- start_tournoi.bat         # Lancement automatique (Backend + Frontend + Navigateur)
|-- stop_tournoi.bat          # Arret de tous les serveurs
+-- README.md
```

### Stack technique

<table>
  <tr>
    <th>Couche</th>
    <th>Technologie</th>
    <th>Role</th>
  </tr>
  <tr>
    <td rowspan="4"><strong>Backend</strong></td>
    <td>Django 4.2+</td>
    <td>Framework web Python</td>
  </tr>
  <tr>
    <td>Django REST Framework 3.14+</td>
    <td>API RESTful</td>
  </tr>
  <tr>
    <td>SQLite3</td>
    <td>Base de donnees embarquee</td>
  </tr>
  <tr>
    <td>django-cors-headers</td>
    <td>Gestion du cross-origin (CORS)</td>
  </tr>
  <tr>
    <td rowspan="5"><strong>Frontend</strong></td>
    <td>Next.js 14.1</td>
    <td>Framework React (App Router)</td>
  </tr>
  <tr>
    <td>TypeScript 5.3</td>
    <td>Typage statique</td>
  </tr>
  <tr>
    <td>Tailwind CSS 3.4</td>
    <td>Styles utilitaires</td>
  </tr>
  <tr>
    <td>Framer Motion</td>
    <td>Animations</td>
  </tr>
  <tr>
    <td>Radix UI</td>
    <td>Composants accessibles (Dialog, Tabs, Select, Toast...)</td>
  </tr>
</table>

---

## Demarrage rapide

### Prerequis

| Outil | Version minimale |
|-------|-----------------|
| **Python** | 3.12+ |
| **Node.js** | 18+ |
| **npm** | 9+ |

### Installation

```bash
# 1. Cloner le depot
git clone https://github.com/votre-utilisateur/TT_Tournoi.git
cd TT_Tournoi

# 2. Backend -- Environnement virtuel et dependances
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# 3. Backend -- Initialiser la base de donnees
python manage.py migrate

# 4. Creer un super-utilisateur (optionnel)
python manage.py createsuperuser

# 5. Frontend -- Installer les dependances
cd ..\frontend
npm install
```

### Lancement

#### Methode rapide (recommandee)

Double-cliquer sur **`start_tournoi.bat`** a la racine du projet. Ce script :
1. Demarre le serveur Django (port 8000)
2. Demarre le serveur Next.js (port 3000)
3. Ouvre automatiquement le navigateur sur l'application

Pour arreter : executez **`stop_tournoi.bat`** ou fermez les fenetres de terminal.

#### Methode manuelle

```powershell
# Terminal 1 -- Backend
cd backend
.\venv\Scripts\Activate.ps1
python manage.py runserver

# Terminal 2 -- Frontend
cd frontend
npm run dev
```

### Acces

| Service | URL |
|---------|-----|
| **Application (Frontend)** | [http://localhost:3000](http://localhost:3000) |
| **API REST (Backend)** | [http://127.0.0.1:8000/api/](http://127.0.0.1:8000/api/) |
| **Admin Django** | [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/) |

---

## API

L'API REST est construite avec Django REST Framework et expose les endpoints suivants :

<table>
  <tr>
    <th>Endpoint</th>
    <th>Methode</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>/api/tournaments/</code></td>
    <td>GET, POST</td>
    <td>Liste et creation de tournois</td>
  </tr>
  <tr>
    <td><code>/api/brackets/</code></td>
    <td>GET, POST</td>
    <td>Tableaux du tournoi (categories par points)</td>
  </tr>
  <tr>
    <td><code>/api/players/</code></td>
    <td>GET, POST</td>
    <td>Gestion des joueurs inscrits</td>
  </tr>
  <tr>
    <td><code>/api/matches/</code></td>
    <td>GET, POST, PATCH</td>
    <td>Matchs (creation, scores, resultats)</td>
  </tr>
  <tr>
    <td><code>/api/tables/</code></td>
    <td>GET, PATCH</td>
    <td>Tables physiques (statut, assignation)</td>
  </tr>
  <tr>
    <td><code>/api/rooms/</code></td>
    <td>GET, POST</td>
    <td>Salles et configuration spatiale</td>
  </tr>
  <tr>
    <td><code>/api/live/tables/</code></td>
    <td>GET</td>
    <td>Donnees live des tables (pour affichage salle)</td>
  </tr>
  <tr>
    <td><code>/api/live/matches/</code></td>
    <td>GET</td>
    <td>Matchs en cours et en attente</td>
  </tr>
  <tr>
    <td><code>/api/fftt/lookup/&lt;licence&gt;/</code></td>
    <td>GET</td>
    <td>Recherche d'un joueur via la licence FFTT</td>
  </tr>
  <tr>
    <td><code>/api/auth/admin-login/</code></td>
    <td>POST</td>
    <td>Connexion administrateur</td>
  </tr>
  <tr>
    <td><code>/api/auth/player-register/</code></td>
    <td>POST</td>
    <td>Inscription/connexion joueur</td>
  </tr>
  <tr>
    <td><code>/api/menu-sections/</code></td>
    <td>GET, POST</td>
    <td>Sections du menu buvette</td>
  </tr>
  <tr>
    <td><code>/api/menu-items/</code></td>
    <td>GET, POST</td>
    <td>Articles de la buvette</td>
  </tr>
  <tr>
    <td><code>/api/notifications/</code></td>
    <td>GET</td>
    <td>Notifications du joueur connecte</td>
  </tr>
</table>

---

## Configuration

### Variables d'environnement

Creer un fichier `.env` dans le dossier `backend/` :

```env
# Django
SECRET_KEY=votre-cle-secrete
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000

# FFTT (optionnel -- pour la recherche de licence)
FFTT_API_KEY=votre-cle-fftt

# Email / SMS (optionnel -- pour les notifications)
EMAIL_HOST=smtp.example.com
EMAIL_HOST_USER=votre-email
EMAIL_HOST_PASSWORD=votre-mot-de-passe
```

---

## Roles utilisateurs

L'application gere trois niveaux d'acces :

<table>
  <tr>
    <th>Role</th>
    <th>Acces</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><strong>Visiteur</strong></td>
    <td>Accueil, Live, Progression, Buvette</td>
    <td>Consultation libre sans compte. Ideal pour les spectateurs.</td>
  </tr>
  <tr>
    <td><strong>Joueur</strong></td>
    <td>+ Inscription, Notifications</td>
    <td>Connexion via licence FFTT. Recoit des alertes sur ses matchs.</td>
  </tr>
  <tr>
    <td><strong>Administrateur</strong></td>
    <td>+ Administration complete</td>
    <td>Gestion du tournoi, des tableaux, des salles, des matchs et de la buvette.</td>
  </tr>
</table>

---

## Modeles de donnees

<details>
<summary><strong>Diagramme des entites principales</strong></summary>

```
Tournament
 |-- name, date, location, description
 |
 +-- Bracket (1..n)
 |    |-- name, min_points, max_points, entry_fee, prize
 |    +-- players (M2M -> Player)
 |
 +-- Player (1..n)
 |    |-- first_name, last_name, license_number
 |    |-- club, points, email, phone
 |    +-- user (FK -> UserAccount)
 |
 +-- Match (1..n)
 |    |-- bracket (FK), round, table (FK)
 |    |-- player1, player2, winner
 |    |-- score_player1, score_player2
 |    |-- sets (JSON), status (waiting/in_progress/completed/blocked)
 |    +-- pool_number, pool_match_order
 |
 +-- Room (1..n)
 |    |-- name, markers (JSON)
 |    +-- Table (1..n)
 |         |-- number, x_position, y_position, rotation
 |         +-- is_available, current_match
 |
 +-- MenuSection (1..n)
      +-- MenuItem (1..n)
           |-- name, description, price
           +-- is_available
```

</details>

---

## Regles de competition FFTT

L'application implemente les regles officielles de la Federation Francaise de Tennis de Table :

- **Art. I.301 -- I.303** : Ordre des matchs en poule (round-robin) selon le nombre de joueurs (3, 4, 5, 6)
- **Art. I.304** : Classement en poule (victoires, sets, points)
- **Art. I.305** : Departage en cas d'egalite (confrontation directe, sous-poule virtuelle)

---

## Liens utiles

| Ressource | Lien |
|-----------|------|
| FFTT -- Federation Francaise de Tennis de Table | [https://www.fftt.com](https://www.fftt.com) |
| Documentation Django | [https://docs.djangoproject.com](https://docs.djangoproject.com) |
| Documentation Next.js | [https://nextjs.org/docs](https://nextjs.org/docs) |
| Documentation DRF | [https://www.django-rest-framework.org](https://www.django-rest-framework.org) |
| Tailwind CSS | [https://tailwindcss.com/docs](https://tailwindcss.com/docs) |
| Radix UI | [https://www.radix-ui.com](https://www.radix-ui.com) |

---

<div align="center">

Developpe pour le **Club de Chelles Tennis de Table**

</div>

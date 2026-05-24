# Tournoi Chelles TT - Guide de Demarrage

## Fichiers Batch

### start_tournoi.bat
Lance les deux serveurs (Backend + Frontend) et ouvre automatiquement le navigateur.

**Double-cliquez sur ce fichier ou creez un raccourci sur le bureau.**

### stop_tournoi.bat
Arrete tous les serveurs en cours d'execution.

---

## Configuration PyCharm

### Option 1 : External Tools (Recommande)

1. Ouvrez PyCharm
2. Allez dans **File > Settings > Tools > External Tools**
3. Cliquez sur **+** pour ajouter un nouvel outil
4. Configurez :
   - **Name** : `Demarrer Tournoi`
   - **Program** : `C:\Users\franc\TT_Tournoi\start_tournoi.bat`
   - **Working directory** : `C:\Users\franc\TT_Tournoi`
5. Cliquez **OK**

Pour lancer : **Tools > External Tools > Demarrer Tournoi**

### Option 2 : Run Configuration

1. Allez dans **Run > Edit Configurations**
2. Cliquez sur **+** > **Shell Script**
3. Configurez :
   - **Name** : `Tournoi - Start`
   - **Script path** : `C:\Users\franc\TT_Tournoi\start_tournoi.bat`
   - **Working directory** : `C:\Users\franc\TT_Tournoi`
4. Cliquez **OK**

---

## URLs

- **Frontend (Application)** : http://localhost:3000
- **Backend (API)** : http://127.0.0.1:8000/api/

---

## Prerequis

- Python 3.12+ avec virtualenv dans `backend/venv`
- Node.js 18+ avec npm
- Packages installes (`pip install -r requirements.txt` et `npm install`)

---

## Demarrage Manuel

### Backend Django
```powershell
cd C:\Users\franc\TT_Tournoi\backend
.\venv\Scripts\Activate.ps1
python manage.py runserver
```

### Frontend Next.js
```powershell
cd C:\Users\franc\TT_Tournoi\frontend
npm run dev
```

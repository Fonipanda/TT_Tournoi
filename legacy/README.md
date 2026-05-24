# Legacy — code v1 à archiver

Ce dossier contient les artefacts de l'ancien code (Django + Next.js 14) en cours d'archivage.

## À déplacer manuellement (verrouillage Windows)

Lors de la refonte v2, les dossiers `backend/` (Django) et `frontend/` (Next.js 14) doivent être déplacés ici :

```powershell
# Fermer tous les éditeurs (VSCode, etc.) et arrêter tout serveur Next.js dev
# Puis :

cd C:\Users\franc\TT_Tournoi
Remove-Item -Recurse -Force frontend\.next
git mv backend  legacy/backend
git mv frontend legacy/frontend
git commit -m "chore: archive v1 dans legacy/"
```

## Fichiers déjà archivés

- `start_tournoi.bat`, `stop_tournoi.bat`, `creer_raccourci.vbs` : scripts Windows v1
- `DEMARRAGE.md` : ancienne doc de démarrage

## Suppression définitive

Une fois la v2 stabilisée en production (après le premier tournoi de validation), tout ce dossier `legacy/` peut être supprimé :

```bash
git rm -r legacy/
git commit -m "chore: remove v1 legacy code"
```

Les commits d'origine restent dans l'historique git.

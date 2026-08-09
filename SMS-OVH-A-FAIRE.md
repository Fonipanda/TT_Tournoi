# SMS OVH — Actions manuelles en attente

> **Statut global : ⏸️ EN ATTENTE** — bloqué par la validation de l'expéditeur `ChellesTT` par OVH.
>
> **Côté code : ✅ terminé.** Le module SMS est intégralement développé, testé et déployable.
> Il ne reste que des actions à effectuer dans les interfaces OVH et Coolify.
> Ce document isole ces actions pour les reprendre plus tard sans relire tout `DEPLOIEMENT.md`.

---

## Ce qui est déjà fait (aucune action requise)

| Élément | État |
|---|---|
| Adaptateur OVH (signature SHA1 `$1$`) | ✅ codé |
| Normalisation des numéros en E.164 (`06…`, `+33…`, `0033…`, séparateurs) | ✅ codé + testé |
| Amorçage de la configuration par variables `OVH_SMS_*` | ✅ codé |
| Masquage des secrets (jamais renvoyés au navigateur) | ✅ codé |
| File d'attente BullMQ, limiteur 40 SMS / 60 s | ✅ codé |
| Déclencheurs automatiques (`table_assigned`, `match_created`, `result`) | ✅ codés + interrupteurs dans `/admin/sms` |
| Journal des envois (`/admin/sms` → onglet *Historique*) | ✅ codé |
| Documentation de déploiement (`DEPLOIEMENT.md` §8 et §9) | ✅ rédigée |

Tant que les actions ci-dessous ne sont pas faites, l'application fonctionne normalement :
les envois échouent proprement et sont tracés dans l'historique, **sans jamais interrompre
une opération de tournoi** (un score reste enregistré même si le SMS ne part pas).

---

## Action 1 — Valider l'expéditeur `ChellesTT` 🔴 BLOQUANT

**Où** : Manager OVH → **Télécom** → **SMS** → onglet **Expéditeurs** → *Ajouter un expéditeur*

**Valeur** : `ChellesTT`

**Contraintes** :
- 11 caractères maximum
- alphanumérique uniquement (pas d'espace, pas d'accent, pas de tiret)
- validation manuelle par OVH (délai variable, souvent 24–72 h ouvrées)
- un justificatif peut être demandé (preuve de lien avec le nom commercial)

> ⚠️ **Sans expéditeur validé, l'API OVH refuse tout envoi.** C'est le point bloquant actuel.

- [ ] Demande d'ajout déposée
- [ ] Expéditeur validé par OVH

---

## Action 2 — Générer le token API OVH

**Lien pré-rempli** (les droits sont déjà positionnés dans l'URL) :

```
https://auth.eu.ovhcloud.com/api/createToken?GET=/sms/&GET=/sms/*/jobs&POST=/sms/*/jobs
```

**Droits accordés** — volontairement minimaux : l'application n'appelle qu'un seul endpoint,
`POST /sms/{serviceName}/jobs`. Accorder `PUT` ou `DELETE` sur `/sms/*` serait inutile et risqué.

| Droit | Utilité |
|---|---|
| `GET /sms/` | lister les services SMS du compte |
| `GET /sms/*/jobs` | relire l'état des envois |
| `POST /sms/*/jobs` | **envoyer un SMS** — seul droit indispensable |

**Champs à renseigner** :
- *Account ID* : ton identifiant OVH
- *Password* : ton mot de passe OVH
- *Validity* : `Unlimited` (ou 1 an)
- *Application name* : `TT-Tournoi`
- *Application description* : `App TT Tournoi v2`

**Résultat** : 3 clés à conserver dans un gestionnaire de mots de passe.

> ⚠️ Les 3 clés ne sont affichées **qu'une seule fois**. Perdues = token à regénérer.

- [ ] Token généré
- [ ] `Application Key` conservée
- [ ] `Application Secret` conservé
- [ ] `Consumer Key` conservée

---

## Action 3 — Relever le nom du service SMS et le crédit

**Où** : Manager OVH → **Télécom** → **SMS**

- **Nom du service** : de la forme `sms-ab12345-1` → c'est la valeur de `OVH_SMS_SERVICE_NAME`
- **Crédit restant** : vérifier qu'il reste des SMS achetés (§8.1 de `DEPLOIEMENT.md`)

- [ ] Nom du service relevé : `________________`
- [ ] Crédit SMS suffisant

---

## Action 4 — Renseigner les variables dans Coolify

**Où** : Coolify → application **`tt-web`** → **Environment Variables** → *Production Environment Variables*

| Variable | Valeur | Secret | Available at Runtime | Available at Buildtime |
|---|---|:--:|:--:|:--:|
| `OVH_SMS_APP_KEY` | `<Application Key>` | ✅ | ✅ | ❌ |
| `OVH_SMS_APP_SECRET` | `<Application Secret>` | ✅ | ✅ | ❌ |
| `OVH_SMS_CONSUMER_KEY` | `<Consumer Key>` | ✅ | ✅ | ❌ |
| `OVH_SMS_SERVICE_NAME` | `sms-ab12345-1` | ❌ | ✅ | ❌ |
| `OVH_SMS_DEFAULT_SENDER` | `ChellesTT` | ❌ | ✅ | ❌ |

Puis **Save** → **Redeploy** (les variables ne sont pas rechargées à chaud).

- [ ] 5 variables saisies
- [ ] 3 clés cochées *Secret*
- [ ] Redéploiement effectué

---

## Action 5 — Vérifier le fonctionnement

1. **Contrôler la source de configuration** — Coolify → `tt-web` → **Logs**, chercher :
   ```
   [sms] Adaptateur actif « OVH SMS Pro (env) » (ovh) — configuration issue de : variables d'environnement.
   ```

2. **Envoyer un SMS de test** — `https://tournoi-chellestt.fr/admin/sms` → bouton **`Envoyer un SMS test`**
   - *To* : `06XXXXXXXX` **ou** `+336XXXXXXXX` (les deux formats sont acceptés, la conversion est automatique)
   - *Message* : `Test TT Tournoi`
   - ✅ Réception attendue sous ~30 secondes

3. **En cas d'échec** — onglet **`Historique`** de `/admin/sms` :

   | Message | Cause | Correction |
   |---|---|---|
   | `Aucun adaptateur SMS actif` | Ni adaptateur actif en base, ni les 4 clés complètes | Activer l'adaptateur dans l'onglet *Adaptateurs*, ou compléter les variables Coolify puis redéployer |
   | `Numéro non normalisable : …` | Numéro destinataire inexploitable | Corriger la fiche joueur |
   | Erreur renvoyée par OVH | Expéditeur non validé, crédit épuisé, droits insuffisants | Reprendre les actions 1 à 3 |

- [ ] Log de configuration vu dans Coolify
- [ ] SMS de test reçu

---

## Action 6 — Activer les envois automatiques (optionnel)

`/admin/sms` → onglet **`Automatisations`**.

| Déclencheur | Événement | Par défaut |
|---|---|---|
| `table_assigned` | Une table est affectée à un match (appel à la table) | **Activé** |
| `match_created` | Création d'un match à l'unité (convocation) | Désactivé |
| `result` | Un score est enregistré | Désactivé |

> 💡 La génération d'un tableau complet (poules ou élimination) n'envoie volontairement
> **aucun** SMS : elle en créerait des centaines d'un coup.

- [ ] Déclencheurs revus selon le besoin du tournoi

---

## Référence

Le détail pas-à-pas complet reste dans [`DEPLOIEMENT.md`](./DEPLOIEMENT.md) :
- **§8** — Configuration OVH SMS Pro (pack SMS, token, variables Coolify)
- **§9.3 à §9.5** — Activation de l'adaptateur, test d'envoi, diagnostic, automatisations

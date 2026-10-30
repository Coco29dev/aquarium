# Documentation par phase

Mise à jour : 30 octobre 2026. Décrit l'état réel du dépôt (phases 0 à 3++ commitées, puis passe de fiabilisation décrite en fin de document).

## Vue d'ensemble

| Phase | Commit | Contenu | État |
| --- | --- | --- | --- |
| 0 | `430d335` | Prototype de risque : PWA, auth, push VAPID | Fait, déployé |
| 1 | `3531c72` | MVP : aquariums, mesures, tâches, alertes, cyclage, hors ligne, export | Fait, déployé |
| 2 | `db284d4` | Calculateurs, inventaire, dépenses, notes, photos | Fait, déployé |
| 3 | `da5507f` | Espèces (FishBase/SeaLifeBase), compatibilité, charge biologique, consommables | Fait, déployé (9 025 espèces importées) |
| 3++ | commité | Encyclopédie « noyau » rédigée à la main, photos Wikimedia, champs verrouillables | Fait |

Architecture commune : SvelteKit 2 / Svelte 5 (runes), TypeScript, Tailwind 4, adapter-node ; Postgres Railway (migrations `node-pg-migrate` lancées au démarrage du serveur) ; serveur = source de vérité, IndexedDB (Dexie) = cache. Logique métier dans `src/lib/domain/` (fonctions pures testées avec vitest).

---

## Phase 0 : prototype de risque

**Objectif** : prouver installation, push et persistance sur iPhone avant toute fonction métier.

**Réalisé**
- Projet SvelteKit + Tailwind + adapter-node, `npm start` = `node build/index.js`, route `/health` (healthcheck Railway, voir `railway.json`).
- PWA via `@vite-pwa/sveltekit` : manifeste standalone, icônes 192/512 et `apple-touch-icon` 180 (`pwa-assets.config.ts`, `static/`), service worker maison `src/service-worker.ts` (ressources du build en cache, pages réseau d'abord, affichage obligatoire d'une notification à chaque push pour iOS).
- Auth : mot de passe unique `APP_PASSWORD`, cookie de session signé valable 90 jours (`server/session.ts`), clé dérivée du mot de passe (le changer invalide les sessions), freinage global des essais. `hooks.server.ts` refuse toute route d'API sans session.
- Web Push : `server/push.ts` (VAPID, nettoyage automatique des abonnements 404/410), routes `/api/push/{key,subscribe,test,unsubscribe}`, table `push_subscriptions`. Côté client `lib/push-client.ts` revérifie et recrée l'abonnement à chaque ouverture.
- Variables : `DATABASE_URL`, `APP_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (modèle dans `.env.example`, jamais committées).

**Déploiement** : service `app` créé dans le projet Railway, domaine `app-production-9ed3.up.railway.app`, dernier déploiement en succès.

**À valider par toi** (critères du brief, non vérifiables depuis le code) : plein écran sans barre Safari, push écran verrouillé, push encore reçu après 3 à 7 jours, données présentes après une semaine, alerte et limite d'usage Railway réglées.

---

## Phase 1 : MVP

**Données** (`migrations/1761800000000_init.sql`) : `aquariums`, `parameter_defs` (plage min/max, seuil de dérive par semaine), `measurements`, `recurring_tasks`, `task_completions`, `app_state` (clé/valeur interne). Chaque mesure et chaque réalisation garde sa date.

**Fonctions**
- Aquariums et modèles de paramètres par type d'eau (douce, plantée, mer, récif) dans `lib/templates.ts`, tous modifiables par aquarium.
- Journal de mesures : saisie rapide avec valeurs précédentes préremplies, graphes uPlot (`components/Chart.svelte`).
- Tâches récurrentes : prochaine échéance comptée depuis le jour de réalisation (`domain/tasks.ts`), écran « à faire aujourd'hui » sur l'accueil.
- Alertes (`domain/drift.ts`) : hors plage, et dérive par régression linéaire sur 7 jours ; seuil par défaut = 25 % de la largeur de la plage.
- Coach de cyclage (`domain/cycling.ts`) : étapes `aucune_mesure`, `demarrage`, `pic_nitrites`, `finalisation`, `pret` à partir de NH3/NO2/NO3 (seuil de détection des tests colorimétriques).
- Hors ligne : `client/store.svelte.ts` + Dexie (`client/db.ts`) ; les saisies partent dans une file renvoyée à l'ouverture via `/api/sync`, l'état frais vient de `/api/state`.
- Rappel quotidien (`server/scheduler.ts`) : node-cron toutes les 5 minutes, envoi à l'heure réglée dans Réglages › Notifications (08:30 par défaut), fuseau Europe/Paris, un seul envoi par jour (clé `last_reminder_day`), rattrapage si le service redémarre.
- Export JSON/CSV : `/api/export`.

**Tests** : `domain.test.ts` (20 cas : dérive, cyclage, tâches, dates).

---

## Phase 2 : calculateurs, inventaire, photos

**Données** (`migrations/1761900000000_inventaire.sql`) : `inhabitants`, `equipment`, `consumables`, `expenses`, `notes`, `photos`.

**Fonctions**
- Calculateurs (`domain/calculators.ts`, fonctions pures, unités métriques) : volume réel, changement d'eau (litres, valeur obtenue, pourcentage pour atteindre une cible), dosage, mélange robinet/osmose, reminéralisation, salinité (sel pour un lot, ajustement ; conversion densité ↔ ppt approximative à ±0,5 ppt). Page `outils`.
- Inventaire faune, flore et matériel (garantie, consommables), dépenses, notes, journal : API générique `/api/r/[resource]` (`server/resources.ts`).
- Photos : décision prise = **bucket Railway** (S3 via `aws4fetch`, `server/storage.ts`), repli sur le dossier local `.data/photos` en développement ; compression côté client (`client/image.ts`), route `/api/photos`.

**Tests** : `calculators.test.ts` (16 cas).

---

## Phase 3 : espèces, compatibilité, consommables

**Données** (`migrations/1762000000000_especes.sql`) : table `species`, lien `inhabitants.species_id`, `consumables.unit_price`, `consumable_replacements`.

**Fonctions**
- Base d'espèces amorcée depuis FishBase/SeaLifeBase (instantanés rfishbase v25.04 lus avec hyparquet par `scripts/build-species-seed.mjs` → `data/species.seed.json`, importés au démarrage : 9 025 espèces en production). Licence CC-BY-NC 4.0 : usage personnel uniquement. Table « maison » pour les fiches saisies à la main (`SpeciesForm`), sélecteur `SpeciesPicker`, page `especes`.
- Compatibilité (`domain/species.ts`, `checkCompatibility`) : type d'eau, volume minimal estimé, température et pH, groupes minimaux, territorialité, plantes/récif, prédation, tempéraments ; gravité `bloquant | attention | info`, chaque avertissement explique pourquoi ; signale les fiches incomplètes.
- Charge biologique (`bioload`) : masse adulte estimée (forme × longueur³) face à une capacité en g/L ; niveaux `ok | elevee | limite | surcharge` ; les espèces sans taille ne sont pas comptées (signalé).
- Simulateur de peuplement : page `aquariums/[id]/peuplement`.
- Durée de vie des consommables (`domain/consumables.ts`) : durée mesurée sur les 3 derniers remplacements dès 2 remplacements, sinon durée prévue ; statuts `ok | bientot | en_retard | inconnu` ; remplacement via `/api/consumables/[id]/replace` ; les consommables en retard entrent dans le rappel quotidien.

**Tests** : `species.test.ts` (22 cas).

---

## Phase 3++ : encyclopédie « noyau » (non commitée)

**Pourquoi** : les données FishBase/SeaLifeBase sont scientifiques, pas des fiches d'élevage (comportement, pH, tempérament souvent absents). Le changement : un jeu de fiches d'élevage rédigées à la main passe devant le seed.

**Réalisé**
- `migrations/1762100000000_encyclopedie.sql` : source `noyau`, colonnes `description`, `curated`, `data_quality` (`claude` ou `verifie`), `locked[]`, `photo_key/source/author/license`, index sur `curated` et unicité du nom scientifique pour le noyau.
- `data/core/01…06*.jsonl` : environ 405 fiches (characins et cyprinidés, fond/labyrinthes, cichlidés, invertébrés, plantes, poissons marins avec drapeau récif `rf`). Format compact : `s` nom scientifique, `fr`/`en`, `k` type, `w` eau, `L` taille, `v` volume minimal, `t` température, `p` pH, `b` bioload, `m` tempérament, `r` régime, `z` zone, `g` groupe, `d` description.
- `scripts/check-core.mjs` : contrôle de cohérence des fichiers avant import.
- `seedCore` (`server/species.ts`) : version = sha1 des noms et contenus, import ignoré si `app_state.species_core` est déjà à jour ; une espèce existante non « maison » est mise à jour sans toucher aux colonnes verrouillées, sinon insérée en `noyau`. Toute modification manuelle verrouille le champ concerné et une fiche vérifiée passe en `verifie`.
- Photos Wikimedia Commons avec auteur et licence (`server/species-photos.ts`, route `/api/species/[id]/photo`), synchronisées en arrière-plan au démarrage.
- `hooks.server.ts` : migrate → seedSpecies → seedCore → syncSpeciesPhotos (arrière-plan) → startScheduler. Page `especes` : filtre « fiches d'élevage », badge de qualité, option `all=1` de l'API.
- 7 tests ajoutés dans `species.test.ts`.

**Limites connues**
- Les fiches sont rédigées par Claude (`data_quality = 'claude'`), non vérifiées : à relire avant de s'y fier pour l'achat d'animaux vivants, en particulier les poissons marins et récifaux.
- Aucun corail, aucune anémone ni invertébré marin dans le noyau pour l'instant.
- Le fichier d'instantané des photos (`data/species.photos.json`) n'existe pas : les photos dépendent d'un accès réseau à Wikimedia au démarrage.

---

## Écarts et risques

1. Le dernier déploiement Railway correspond à la phase 3 ; le noyau (3++) n'est pas en ligne tant que non commité et poussé.
2. `CLAUDE.md` est obsolète : il dit encore que le service de l'appli, le domaine et les clés VAPID restent à créer, et que le projet est en phase 0.
3. Tests et vérification de types : non exécutés dans cette analyse (environnement local macOS). Lancer `npm test` et `npm run check` avant de commiter.
4. Licence CC-BY-NC du seed FishBase : à conserver pour un usage strictement personnel.
5. Phase 0 : les critères sur iPhone (push verrouillé, 3 à 7 jours, une semaine sans ouverture) restent à confirmer par toi ; le brief demandait un accord explicite avant la phase 1.
6. Repli du push (e-mail ou ntfy), prévu par le brief, n'apparaît pas dans le code.
7. Phase 4 (capteurs ESP32, IA) : non commencée, comme prévu.

---

## Passe de fiabilisation (30 octobre 2026)

- **Coach de cyclage** : « prêt » exige d'avoir mesuré au moins une fois de l'ammoniaque ou des nitrites (un bac neuf à l'eau du robinet n'est plus déclaré cyclé). `hasCycled` distingue un bac mûr (pic d'ammoniaque = alerte) d'un bac en cyclage.
- **Alertes** (`collectTankAlerts`) : la dérive repart du dernier changement d'eau ; pas d'alerte NH3/NO2 pendant un cyclage ; le récapitulatif quotidien ne répète pas une alerte déjà poussée depuis moins de 3 jours ; nouvel essai (6 maximum) si ni push ni ntfy n'ont abouti.
- **Sauvegarde** : l'export JSON contient désormais l'historique des consommables, les espèces « maison » et les réglages de notification ; restauration depuis Réglages › Sauvegarde (`server/restore.ts`, route `/api/settings/backup/restore`, envoi compressé en gzip) avec sauvegarde de sécurité préalable ; sauvegarde hebdomadaire rattrapée si le service était éteint.
- **Hors ligne** : une opération invalide ne bloque plus la file ; envoi par lots de 500.
- **Sécurité et robustesse** : freinage de connexion par adresse (voir `ADDRESS_HEADER`/`XFF_DEPTH` dans `.env.example`), endpoints push limités à Apple/Google/Mozilla/Microsoft, cache des pages purgé à la déconnexion, validations (400/404, plage min/max, départ après arrivée).
- **Historique** : 400 jours dans l'état synchronisé, période « 1 an » sur les courbes.
- **CI** : `.github/workflows/ci.yml` lance `svelte-check` et les tests à chaque push.

Reste à faire : modifications hors ligne (corriger une mesure, reporter une tâche, inventaire), synchronisation incrémentale, linter, tests des routes API, copie de sauvegarde hors de Railway.

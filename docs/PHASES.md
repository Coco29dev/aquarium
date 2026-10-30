# Documentation par phase

Mise à jour : 30 octobre 2026, 12 h. Décrit le dépôt `Coco29dev/aquarium` jusqu'au commit `3ba8f2e` (dernier déploiement Railway en succès, 11 h 51).

## Vue d'ensemble

| Phase | Commits | Contenu | État |
| --- | --- | --- | --- |
| 0 | `430d335` | Prototype de risque : PWA, auth, push VAPID | Fait, déployé |
| 1 | `3531c72` | MVP : aquariums, mesures, tâches, alertes, cyclage, hors ligne, export | Fait, déployé |
| 2 | `db284d4` | Calculateurs, inventaire, dépenses, notes, photos | Fait, déployé |
| 3 | `da5507f` | Espèces FishBase/SeaLifeBase, compatibilité, charge biologique, consommables | Fait, déployé |
| 3++ | `7ce20ba`, `fab22e6` | Encyclopédie « noyau » de 638 fiches, photos Wikimedia, champs verrouillables | Fait, déployé |
| 4 (hors brief) | `662ef5c` à `dfc5fe4`, `a9f302c`, `a3a37be` | Refonte de l'interface : trois directions graphiques successives, la dernière « façon iOS » retenue | Fait, déployé |
| 5 (hors brief) | `f589a37`, `66382b5`, `ffd2b95`, `3ba8f2e` | Édition des données, réglages de notifications, repli ntfy, sauvegarde hebdomadaire | Fait, déployé |

Note de numérotation : le brief appelait « phase 4 » les capteurs ESP32 et l'IA. Ce document réserve « 4 » et « 5 » au travail réellement fait ; les capteurs deviennent la phase 6 (non commencée).

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
- Rappel quotidien (`server/scheduler.ts`) : node-cron, un seul envoi par jour (clé `last_reminder_day`), rattrapage si le service redémarre. Version initiale : toutes les heures de 8 h à 21 h. Remplacé en phase 5 par un passage toutes les 5 minutes avec heure réglable.
- Export JSON/CSV : `/api/export`.

**Tests** : `domain.test.ts` (22 cas aujourd'hui : dérive, cyclage, tâches, dates).

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

## Phase 3++ : encyclopédie « noyau »

**Pourquoi** : FishBase et SeaLifeBase donnent des données scientifiques, pas des fiches d'élevage (tempérament, pH, groupe souvent absents). Des fiches d'élevage rédigées à la main passent donc devant le seed.

**Réalisé**
- `migrations/1762100000000_encyclopedie.sql` : source `noyau`, colonnes `description`, `curated`, `data_quality` (`claude` ou `verifie`), `locked[]`, `photo_key/source/author/license`, index sur `curated`, unicité du nom scientifique pour le noyau.
- `data/core/01…10*.jsonl` : **638 fiches** en dix fichiers : characins et cyprinidés, fond et labyrinthes, cichlidés, invertébrés d'eau douce, plantes, poissons marins, invertébrés marins (26), coraux et anémones (69), compléments eau douce et mer. Le manque signalé plus tôt (aucun corail ni invertébré marin) est donc comblé. Format compact : `s` nom scientifique, `fr`/`en`, `k` type, `w` eau, `L` taille, `v` volume minimal, `t` température, `p` pH, `b` bioload, `m` tempérament, `r` régime, `z` zone, `g` groupe, `rf` compatible récif, `d` description.
- `scripts/check-core.mjs` : contrôle de cohérence avant import.
- `seedCore` (`server/species.ts`) : version = sha1 des fichiers, import ignoré si inchangé ; une espèce existante non « maison » est mise à jour sans toucher aux colonnes verrouillées, sinon insérée en `noyau`. Toute modification manuelle verrouille le champ ; une fiche vérifiée passe en `verifie`.
- Photos Wikimedia Commons avec auteur et licence (`server/species-photos.ts`, route `/api/species/[id]/photo`). Un instantané `data/species.photos.json` (574 entrées) est versionné ; `fab22e6` ajoute des passes de reprise après limite de débit de Wikimedia.
- Démarrage (`hooks.server.ts`) : migrate → seedSpecies → seedCore → syncSpeciesPhotos (arrière-plan) → startScheduler.
- Tests : `species.test.ts` à 22 cas.

**Limites**
- Fiches rédigées par Claude (`data_quality = 'claude'`), non vérifiées : à relire avant un achat d'animaux, surtout poissons marins, coraux et anémones.
- Les photos restent soumises aux limites de Wikimedia au démarrage si l'instantané ne couvre pas une espèce (574 photos pour 638 fiches).

---

## Phase 4 : refonte de l'interface (hors brief)

**Ce qui s'est passé** : l'interface a changé de direction trois fois en une heure, sur la même logique métier.
1. `662ef5c` : charte « Bulle » (palette Chirurgien, jetons clair/sombre, polices Fredoka et Figtree, icône poisson-chirurgien). Ce commit est signé `Co-authored-by: Claude` et rattaché à la PR #1 : il vient d'une autre branche, fusionnée dans `main`.
2. `34e781f` à `0ac80d2` : charte « Carnet de bac » (jetons, polices, icône poisson riso sur fond lagon, navigation, écran Aujourd'hui, bacs, atelier, encyclopédie, mesure en deux touches, onglets Vivants et Journal).
3. `6a9167e` à `a9f302c` : charte finale **« Aquarium façon iOS »**, qui remplace les deux précédentes.

**État final (charte iOS)**
- Jetons dans `src/routes/layout.css` : couleurs système d'iOS en clair et en sombre, matériaux en verre, polices système (SF Pro). Thème Automatique, Clair ou Sombre appliqué avant l'affichage via `data-scheme` (script de `app.html`).
- Bibliothèque `src/lib/ios/` (24 fichiers) : barre de navigation à grand titre, barre d'onglets flottante, listes groupées (`Section`, `Row`), feuilles (`Sheet`), alertes (`AlertHost`), segmenté, interrupteur, stepper, lignes balayables (`SwipeRow`), menus par appui long (`ContextMenuHost`, `contextMenu.ts`), recherche, mini-graphe (`Spark`).
- Écrans refaits : Aujourd'hui, Bacs (liste, création en feuille, suivi façon Santé), page paramètre, tâches façon Rappels, Mesurer (feuille façon Santé, saisie en deux touches), Vivants, Peuplement, Journal, Atelier (outils), Encyclopédie, Dépenses, Réglages, connexion. Nouvelles routes : `/bienvenue` (accueil guidé au premier lancement), `/recherche` (recherche globale), `/mesurer`.
- Coque (`a3a37be`) : glissement de lignes, menu par appui long, tirer pour synchroniser, retour par le bord de l'écran, pastille d'état, indicateur hors ligne, thème manuel (`client/ui.svelte.ts`).
- Graphe : uPlot est remplacé par un **graphe SVG interactif** (curseur et bulle de verre au glissement du doigt), dans le même fichier `components/Chart.svelte` ; les anciens composants et la dépendance sont retirés (`package.json` ne contient plus que aws4fetch, dexie, node-cron, node-pg-migrate, pg, web-push).
- `lib/tank.ts` : `tankHealth` résume l'état d'un bac (niveaux `ok | warn | bad | cycle`) pour les cartes.

**Points d'attention** : les trois chartes ont laissé beaucoup de réécriture (plusieurs milliers de lignes ajoutées puis supprimées) ; une recherche dans `src/` et `static/` ne retrouve plus ni « Carnet de bac », ni la palette Bulle, ni uPlot. Le rendu n'a pas été confronté à ton iPhone dans cette analyse.

---

## Phase 5 : données et notifications (hors brief)

**Données**
- `migrations/1762200000000_couverture.sql` : `aquariums.cover_photo_id` (photo de couverture façon Plans, `ON DELETE SET NULL`).
- Mesures modifiables et supprimables (`/api/measurements/[id]`), date de mesure choisissable, comparaison de deux paramètres sur un même graphe avec repères de changement d'eau, réordonnancement des paramètres.
- Tâches : « fait », « reporter » (feuille `PostponeSheet`) ou « ignorer » ; ignorer décale d'un cycle, jamais dans le passé (`skipDue` dans `domain/notifications.ts`). Une tâche cochée reste annulable pendant un court délai avant envoi (bannière « Annuler »).
- Les réalisations de tâches figurent dans l'état synchronisé ; les dérives « rassurantes » sont ignorées (`34e781f`).

**Notifications** (`/reglages/notifications`, `/api/settings/notifications`, `server/settings.ts`, `domain/notifications.ts`)
- Réglages : heure du récapitulatif (08:30 par défaut), heures de silence (plage pouvant passer minuit), bacs concernés (tous par défaut), sujet ntfy.
- Planificateur (`server/scheduler.ts`) : passage toutes les 5 minutes, récapitulatif envoyé une fois par jour à l'heure choisie, rattrapage après un redémarrage.
- **Repli ntfy** : si un sujet est réglé, le récapitulatif part aussi via ntfy.sh, pour le cas où le push iOS cesse de fonctionner. C'était une exigence du brief, absente de mon bilan précédent, désormais présente.
- Pastille d'application mise à jour via le push.
- Tests : `notifications.test.ts` (10 cas : silence, heure du récapitulatif, validation, report).

**Sauvegarde** (`/reglages/sauvegarde`, `/api/settings/backup`, `server/backup.ts`)
- Export JSON complet écrit chaque **dimanche à 3 h 10** (Europe/Paris) dans le bucket (`backups/aquarium-AAAA-MM-JJ.json`), 8 sauvegardes conservées. Sans bucket, le fichier va sur le disque du service, qui est éphémère sur Railway.
- Dernière sauvegarde et taille visibles dans l'appli, lancement manuel possible (POST sur la même route).
- Complète l'export JSON/CSV de la phase 1. Cela ne remplace pas une sauvegarde de Postgres elle-même (modèle Railway à envisager, comme le brief le suggère).

---

## État des tests

70 cas vitest : calculateurs 16, domaine (dérive, cyclage, tâches) 22, notifications 10, espèces 22. Non exécutés dans cette analyse ; lancer `npm test` et `npm run check`. Aucun test d'interface.

## Écarts et risques

1. **CLAUDE.md obsolète** : il indique encore que le service de l'appli, le domaine et les clés VAPID restent à créer, et qu'on est en phase 0. Ligne 24 à corriger, avec le domaine `app-production-9ed3.up.railway.app`, le bucket `photos` et les phases faites.
2. **Dossier local en retard** : `/Users/corentin/Desktop/aquarium` s'arrête à `fab22e6` ; GitHub est à `3ba8f2e` (11 commits d'avance, dont l'interface iOS et la phase 5). Un `git pull` est nécessaire avant de continuer à travailler en local.
3. **Critères iPhone de la phase 0** non confirmés (plein écran, push écran verrouillé, 3 à 7 jours, une semaine sans ouverture), alors que le brief demandait de valider avant la phase 1. L'alerte et la limite d'usage Railway restent aussi à vérifier.
4. **Un déploiement a échoué** (10 h 53, commit `0ac80d2`) ; le même commit a été redéployé à 10 h 55 et tous les suivants sont en succès. Les logs montrent aussi des `npm error` sur `SIGTERM` à chaque arrêt de conteneur : normal lors d'un redéploiement.
5. **Fiches non vérifiées** (`data_quality = 'claude'`) : à relire avant tout achat d'animaux.
6. **Licence FishBase CC-BY-NC 4.0** : usage strictement personnel. Les photos Wikimedia exigent d'afficher l'auteur et la licence, ce que l'appli stocke.
7. **Sauvegarde Postgres** : l'export JSON hebdomadaire est en place, pas de sauvegarde de la base elle-même.
8. **Capteurs ESP32 et IA** (phase 6 de ce document) : non commencés, comme prévu.

---

## Passe de fiabilisation (30 octobre 2026)

- **Coach de cyclage** : « prêt » exige d'avoir mesuré au moins une fois de l'ammoniaque ou des nitrites (un bac neuf à l'eau du robinet n'est plus déclaré cyclé). `hasCycled` distingue un bac mûr (pic d'ammoniaque = alerte) d'un bac en cyclage.
- **Alertes** (`collectTankAlerts`) : la dérive repart du dernier changement d'eau ; pas d'alerte NH3/NO2 pendant un cyclage ; le récapitulatif quotidien ne répète pas une alerte déjà poussée depuis moins de 3 jours ; nouvel essai (6 maximum) si ni push ni ntfy n'ont abouti.
- **Sauvegarde hebdomadaire** rattrapée si le service était éteint à l'heure prévue (`backupDue`, vérifiée toutes les 5 minutes).
- **Hors ligne** : une opération invalide ne bloque plus la file ; envoi par lots de 500.
- **Sécurité et robustesse** : freinage de connexion par adresse (voir `ADDRESS_HEADER`/`XFF_DEPTH` dans `.env.example`), endpoints push limités à Apple/Google/Mozilla/Microsoft, cache des pages purgé à la déconnexion, validations (400/404, plage min/max, départ après arrivée).
- **Historique** : 400 jours dans l'état synchronisé, période « 1 an » sur les courbes.
- **CI** : `.github/workflows/ci.yml` lance `svelte-check` et les tests à chaque push.

### Durcissement sécurité (30 octobre 2026)

- Freinage : l'adresse vient de `getClientAddress()` (plus de lecture brute de `x-forwarded-for`, falsifiable) ; `ADDRESS_HEADER=x-forwarded-for` et `XFF_DEPTH=1` définis sur le service `app`.
- En-têtes sur toutes les réponses : CSP (nonce/empreintes SvelteKit, aucune ressource externe), `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- Corps de requête limité à 2 Mo (7 Mo pour une photo, illimité pour la restauration, plafonné par `BODY_SIZE_LIMIT`).
- Pool Postgres : écouteur d'erreur, `statement_timeout` 30 s, fermeture des connexions inactives.
- Déconnexion : efface IndexedDB et le cache `pages` de l'appareil (avec confirmation s'il reste des saisies non envoyées).
- Sauvegarde : message d'erreur générique (détail dans les logs) ; test push limité à un toutes les 10 s ; export CSV neutralise aussi les cellules commençant par tabulation ou retour chariot.

Reste à faire : modifications hors ligne (corriger une mesure, reporter une tâche, inventaire), synchronisation incrémentale, linter, tests des routes API, copie de sauvegarde hors de Railway.

---

## Encyclopédie (30 octobre 2026)

- **Écran dédié** : onglet « Encyclo » de la barre d'onglets (`/encyclopedie`) avec recherche, accès aux espèces (poissons, invertébrés, plantes, mer), guides par thème et rubrique « Un souci ? ». L'annuaire d'espèces vit maintenant sous `/encyclopedie/especes` ; l'ancienne adresse `/especes` redirige. La recherche globale cherche aussi dans les guides.
- **Guides** (`src/lib/content/`, contenu statique donc disponible hors ligne, testé par `content.test.ts`) : démarrer, entretien et algues, plantes, santé et maladies, vie du bac (nourrir, cohabitation, charge, reproduction, invertébrés), biotopes et styles, lexique. Les biotopes renvoient vers les fiches d'espèces.
- **Fiches enrichies** (`migrations/1763300000000_fiches_enrichies.sql`) : provenance, difficulté, conseils d'entretien, et pour les plantes lumière et CO₂. Les 378 fiches d'eau douce existantes en sont dotées ; une centaine d'espèces d'eau douce ont été ajoutées (`data/core/11-*` et `12-*`).
- **Vérification des noms** : `scripts/verify-names.mjs` compare les noms latins à GBIF et les noms français et tailles à FishBase. Renommages appliqués (champ `was`, l'identifiant de la fiche est conservé) : Marosatherina ladigesi, Corydoras splendens, Helostoma temminckii, Anentome helena, Megalechis thoracata, Micranthemum callitrichoides, Cryptocoryne walkeri.
- Les fiches et guides sont rédigés avec Claude à partir de connaissances générales : les fiches restent marquées « à vérifier » tant que tu ne les as pas confirmées.

---

## Refonte graphique : relief et accueil vivant (30 octobre 2026)

- **Système de relief** (`routes/layout.css`, `lib/relief/`) : élévations `raised` et `lifted` (ombre douce en clair, liseré clair en sombre), cartes colorées `tone-card` et teintées `tone-soft`, apparition au défilement `reveal`. Les mouvements d'ambiance (vagues, bulles, poissons) portent la classe `.ambient`, coupée pour qui préfère moins d'animations.
- **Composants** : `Scene` (ciel selon l'heure, eau qui ondule, bulles), `Tile` (tuile pleine, teintée ou claire avec icône en filigrane), `TankCard` (carte de bac en hauteur : photo de couverture ou eau teintée, température en grand, pied clair avec nourrissage), `Carousel`, `Dock` (raccourcis ronds).
- **Aujourd'hui** : scène d'accueil (salutation, état du moment, anneaux), raccourcis flottants, bloc « À regarder » seulement quand il y a quelque chose, carrousel des bacs, tuiles de tailles variées qui ouvrent leur détail en feuille (à surveiller, cyclage ou changement d'eau, à remplacer ou tests, stabilité, bilan), ruban de la semaine avec progression, puis « Pour toi » (conseils tirés de l'état des bacs, `domain/advice.ts`, puis découvertes du jour).
- **Bacs, Encyclopédie, Atelier** : mêmes principes (carte héroïne et grille de tuiles, mosaïque d'espèces, carrousel de lectures, calculateurs en tuiles).
- Le coach de cyclage ne s'invite plus dans un bac déclaré « actif » dont toutes les mesures sont à zéro.

---

## Idées de peuplement (30 octobre 2026)

- **Catalogue** : 64 idées de biotopes du nano au très grand bac, en eau douce, mer et récif (`src/lib/content/ideas/`). Chaque idée donne une fourchette de volume (indicative, avec une marge), l'eau visée, le décor, les plantes et une liste d'espèces avec quantités et rôles.
- **Calcul** (`src/lib/domain/ideas.ts`) : les quantités suivent le volume (bancs au prorata, vedettes beaucoup moins), respectent l'effectif de groupe de chaque fiche, puis sont réduites jusqu'à une charge biologique confortable (70 % de la capacité). Le calcul réutilise `bioload` et `checkCompatibility` du simulateur de peuplement. Un facteur `dense` permet les bacs volontairement entassés (mbuna, Tanganyika).
- **Écrans** : `/encyclopedie/idees` (volume + type d'eau, classement par pertinence, catalogue par taille), `/encyclopedie/idees/[slug]` (curseur de volume, quantités, charge, compatibilité, ajout à la liste de souhaits d'un bac en projet). Un carrousel « Idées pour N L » apparaît sur l'écran d'un bac en projet, et la fiche d'une espèce indique les idées où elle figure.
- **Données** : 13 fiches ajoutées (`data/core/13-…`), nouvelle clé `bl` (masse adulte en grammes) pour les espèces dont la formule longueur³ s'écarte trop (loches, anguilles, poissons-éléphants, hippocampes), 31 fiches complétées.
- **Tests** : chaque espèce citée existe dans le noyau ; aucune idée n'a de conflit bloquant ni de surcharge, aux trois volumes de sa fourchette ; toutes les tailles de bac ont au moins quatre idées en eau douce.
- **À savoir** : le modèle de charge est prudent pour les gros cichlidés (capacité 0,8 g/L en eau douce) ; les idées de grands cichlidés sont donc proposées à partir de volumes élevés. Contenu rédigé par Claude, non vérifié.

### Plantes et matériel par idée

- **Plantes** (`src/lib/content/ideas/plants.ts`) : pour chaque idée, une liste « biotope strict » (plantes du milieu d'origine, vide quand le biotope n'en a pas : lacs rocheux, récif) et une liste « biotope mixte » (le strict, complété de plantes compatibles avec l'eau, la température et la taille du bac). En mer, ce sont des macro-algues. Un test vérifie que chaque plante existe, qu'elle est du bon milieu et qu'elle supporte la température de l'idée.
- **Matériel** (`src/lib/domain/equipment.ts`) : filtration, chauffage, éclairage, sol, décor, eau (osmoseur, sels, feuilles), tests, engrais, CO₂, courant, couvercle, refroidissement, écumeur, roche, sel… selon le milieu, le volume et le choix de plantes. Chaque élément a une fourchette de prix, un interrupteur (indispensables cochés par défaut) et est reconnu s'il figure déjà dans le projet. Le bouton ajoute les éléments cochés au matériel du bac en projet, avec le milieu de la fourchette comme prix. Prix : ordres de grandeur du neuf en France.

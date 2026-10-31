# Appli perso de gestion d'aquariums (PWA)

Brief pour Claude Code. Interface et commentaires en français. Dernière mise à jour : 30 octobre 2026 (état au commit `3ba8f2e`). Historique détaillé par phase : `docs/PHASES.md`.

## Contexte

- Usage strictement personnel : une seule personne, deux aquariums, types variés (eau douce, plantée, eau de mer, récif).
- Application web déployée sur Railway, installée sur un iPhone (iOS 27) via « Sur l'écran d'accueil ». Pas de compte développeur Apple, pas d'App Store.
- Priorité produit : aide à la décision (alertes de dérive, coach de cyclage, compatibilité), avec une saisie très rapide.
- Pas de capteurs au départ, pas d'import : démarrage à vide. Un assistant conversationnel (Claude) a été ajouté en phase 7 ; pas de diagnostic de maladie par IA.
- **État** : phases 0 à 3 et encyclopédie d'espèces faites et déployées, plus une refonte d'interface « façon iOS » et des réglages de notifications / sauvegarde (voir « Avancement »).

## Infrastructure déjà en place

Créée et en production, ne pas recréer :

| Élément | Valeur |
| --- | --- |
| Projet Railway | `aquarium` (id `ea6c4864-958c-4606-a765-59d4fd86e451`) |
| Environnement | `production` (id `e2eef43d-a928-4382-82d2-e1d9ba9a2e5d`) |
| Service Postgres | `Postgres` (id `ea91637c-61ce-4219-aefa-2e55b042183c`), image Postgres 18 avec SSL, volume de 5 Go en `europe-west4` |
| Plan Railway | Hobby (5 $ par mois avec 5 $ d'usage inclus, puis facturation à la seconde sur RAM et CPU) |
| Service applicatif | `app` (id `8ca2cc89-8f32-4b8c-9bb7-901e5f3aa20f`), déployé depuis la branche `main` du dépôt, domaine `app-production-9ed3.up.railway.app` |
| Bucket Railway | `photos` (id `2304a1ea-8c7d-4f26-919c-1fc3fc8762f2`, région `ams`) : photos et sauvegardes JSON |
| Dépôt GitHub | `Coco29dev/aquarium`, privé (https://github.com/Coco29dev/aquarium), branche `main` |

Chaque push sur `main` redéploie le service `app` (build `npm run build`, démarrage `npm start`, healthcheck `/health`, voir `railway.json`).

Variables du service `app` (noms seulement, valeurs dans Railway) : `DATABASE_URL` (= `${{Postgres.DATABASE_URL}}`), `HOST`, `APP_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, accès au bucket (`S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`), `NTFY_TOPIC` facultative (repli de notification, sinon réglé dans l'appli), `ANTHROPIC_API_KEY` (assistant ; sans elle l'écran Assistant explique quoi configurer), `ASSISTANT_MODEL` et `ASSISTANT_DAILY_LIMIT` facultatives. Modèle local : `.env.example`.

- Pour que l'appli lise la base, utiliser la variable de référence `${{Postgres.DATABASE_URL}}` sur le service de l'appli (adresse privée Railway).
- Ne jamais écrire de mot de passe, de clé ou de jeton dans le dépôt ni dans ce fichier. Tout passe par des variables Railway et un fichier `.env` local ignoré par Git.
- Développement local : utiliser un Postgres local (Docker) plutôt que d'exposer la base de production.
- Un connecteur Supabase existe sur le compte mais n'est pas utilisé : la base est sur Railway.
- Outils : CLI Railway (`railway link` puis choisir le projet `aquarium`) ou le connecteur Railway.

## Stack

- Interface et serveur : SvelteKit (Svelte 5), TypeScript, Tailwind, `@sveltejs/adapter-node`. Versions en place : SvelteKit 2, Svelte 5, Tailwind 4, Vite 8, TypeScript 6, Node 22 ou plus.
- PWA : `@vite-pwa/sveltekit` (manifeste, service worker, mode hors ligne).
- Cache local : Dexie (IndexedDB), jamais seule source de vérité.
- Base : Postgres sur Railway, migrations SQL avec `node-pg-migrate` (dossier `migrations/`, lancées au démarrage du serveur). Un changement de schéma = une nouvelle migration, jamais une modification d'une migration déjà déployée.
- Rappels : planificateur interne au service (node-cron, passage toutes les 5 minutes, récapitulatif quotidien à l'heure réglée, sauvegarde JSON le dimanche à 3 h 10) qui envoie du Web Push (VAPID), avec repli ntfy. Ne pas utiliser le cron natif de Railway : intervalle minimal de 5 minutes, sans garantie de ponctualité.
- Photos et sauvegardes : **bucket Railway** (S3, `aws4fetch`), décision prise en phase 2. Sans variables S3, repli sur le dossier local `.data/` (éphémère sur Railway).
- Graphes : SVG maison (`components/Chart.svelte`), plus de bibliothèque de graphes.
- Interface : charte « façon iOS » (jetons dans `src/routes/layout.css`, composants dans `src/lib/ios/`). Ne pas réintroduire les anciennes chartes « Bulle » et « Carnet de bac ».
- Espèces : seed FishBase/SeaLifeBase (CC-BY-NC 4.0, usage personnel uniquement) + « noyau » de 638 fiches d'élevage dans `data/core/*.jsonl` (`data_quality` `claude` ou `verifie`, champs `locked` protégés des mises à jour). Contrôle : `node scripts/check-core.mjs`.
- Assistant : SDK officiel `@anthropic-ai/sdk`, modèle `claude-sonnet-5-5`, flux SSE (`src/lib/server/assistant.ts`, routes `/api/assistant`). Conversation par bac dans `chat_messages`, jamais modifiée après écriture (cache et blocs de réflexion). Le contexte du bac est joint à chaque message de l'utilisateur, jamais au prompt système. Les outils qui écrivent attendent une confirmation dans l'appli.
- Connexion : un seul compte géré par l'appli.

## Contraintes iOS à respecter

- Le push ne fonctionne que si la PWA est installée sur l'écran d'accueil. La permission se demande après un geste de l'utilisateur (bouton « Activer les rappels »).
- Des abonnements push peuvent cesser de fonctionner après une à deux semaines : revérifier l'abonnement à chaque ouverture, resouscrire si besoin, repli ntfy en place (sujet réglé dans Réglages › Notifications) et écran « Aujourd'hui ».
- Pas de Bluetooth, de NFC ni de Background Sync : la synchronisation se fait à l'ouverture de l'appli.
- Le stockage local peut être purgé : le serveur est la source de vérité, avec export JSON et CSV.
- Non vérifié : l'accès à la caméra dans la PWA. À tester avant toute fonction de scan.

## Avancement

| Phase | État |
| --- | --- |
| 0 : prototype de risque | Code et déploiement faits. **Critères iPhone à confirmer par Corentin** (plein écran, push écran verrouillé, 3 à 7 jours, une semaine sans ouverture, alerte et limite d'usage Railway). |
| 1 : MVP | Fait, déployé |
| 2 : calculateurs, inventaire, photos, dépenses, notes | Fait, déployé |
| 3 : espèces, compatibilité, charge biologique, simulateur, consommables | Fait, déployé |
| 3++ : encyclopédie noyau (638 fiches, photos Wikimedia) | Fait, déployé ; fiches non vérifiées |
| 4 : refonte de l'interface façon iOS (hors brief initial) | Fait, déployé |
| 5 : édition des données, réglages de notifications, ntfy, sauvegarde hebdomadaire (hors brief initial) | Fait, déployé |
| 6 : capteurs ESP32 | Non commencée (c'était la « phase 4 » du brief) |
| 7 : assistant conversationnel Claude (hors brief initial) | Code fait, **à tester avec la vraie clé** (variable `ANTHROPIC_API_KEY` à ajouter sur Railway) |

Restes connus : confirmer la phase 0 sur l'iPhone ; relire les fiches du noyau ; envisager une sauvegarde de Postgres elle-même (modèle Railway) en plus de l'export JSON ; tests d'interface inexistants (70 tests de logique métier, `npm test`).

Les trois sections ci-dessous gardent le plan d'origine à titre de référence ; l'état réel est dans le tableau ci-dessus et dans `docs/PHASES.md`.

## Phase 0 : prototype de risque (commencer ici)

Objectif : prouver sur l'iPhone que l'installation, le push et la persistance fonctionnent, avant d'écrire la moindre fonction métier.

1. Créer le projet SvelteKit (TypeScript, Tailwind, adaptateur Node) dans ce dépôt, avec un script `start` qui lance `node build/index.js`. Ajouter une route `/health` qui répond 200.
2. Ajouter `@vite-pwa/sveltekit` : manifeste (nom, icônes 192 et 512, icône `apple-touch-icon` 180, `display: standalone`, couleur de thème) et service worker minimal.
3. Protéger l'appli par un mot de passe unique lu dans la variable `APP_PASSWORD`, avec une session par cookie. Aucune route d'API ne répond sans session.
4. Générer les clés VAPID (bibliothèque `web-push`) et les stocker dans les variables Railway `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT`. Ne jamais les committer.
5. Créer une table `push_subscriptions` dans Postgres, une route d'abonnement et une route d'envoi de test.
6. Page unique : un bouton « Activer les rappels » (après installation uniquement), un bouton « Envoyer un test », et l'état de l'abonnement. À chaque ouverture, vérifier l'abonnement et le recréer s'il a disparu.
7. Déployer : créer le service de l'appli dans le projet `aquarium` à partir du dépôt GitHub, définir `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `HOST=0.0.0.0` et les variables ci-dessus, générer le domaine public en HTTPS.
8. M'indiquer l'adresse et attendre mon test sur l'iPhone.

Critères de passage :

- L'icône ajoutée à l'écran d'accueil ouvre l'appli en plein écran, sans barre Safari.
- La permission de notification est demandée après un appui, et le push de test arrive, écran verrouillé compris.
- Après 3 à 7 jours, le push arrive toujours, ou l'abonnement est recréé automatiquement.
- Les données restent présentes après une semaine sans ouverture.
- La facture Railway reste cohérente avec le plan Hobby : régler une alerte et une limite d'usage dès le premier déploiement.

~~Ne passe pas à la phase 1 sans mon accord.~~ Les phases suivantes ont été faites avant la validation sur iPhone : la validation reste due.

## Phase 1 : MVP (après validation de la phase 0)

- Deux aquariums avec modèles de paramètres par type d'eau (douce, plantée, mer, récif), tous modifiables, avec plage acceptable par paramètre.
- Journal de mesures avec saisie en deux touches (valeurs précédentes préremplies) et graphes.
- Tâches récurrentes (changement d'eau, nettoyage du filtre, tests, dosages) avec push et écran « à faire aujourd'hui ».
- Saisie hors ligne avec file d'envoi, renvoyée à l'ouverture suivante.
- Alertes de dérive : prévenir quand une valeur évolue trop vite (pente sur 7 jours), pas seulement hors plage.
- Coach de cyclage : lit ammoniaque, nitrites et nitrates et indique quand le bac peut recevoir des poissons.
- Export JSON et CSV.

## Phases suivantes

- Phase 2 : calculateurs (changement d'eau, dosages, reminéralisation, salinité, volume réel), inventaire faune, flore et matériel, photos, dépenses, notes.
- Phase 3 : base d'espèces, compatibilité, charge biologique, simulateur de peuplement, durée de vie des consommables. FishBase et SeaLifeBase donnent des données scientifiques, pas des fiches d'élevage : prévoir une table maison.
- Phase 6 (anciennement 4) : capteurs ESP32 (température, niveau, fuite) envoyant leurs mesures en HTTPS à une route de l'API avec un jeton ; IA si l'envie revient.

## Modèle de données de départ

Aquarium (nom, type d'eau, volume, date de mise en eau), définition de paramètre (nom, unité, plage par aquarium), mesure (valeur, date), tâche récurrente, réalisation de tâche, habitant (espèce, quantité, dates d'arrivée et de départ), matériel (achat, garantie, consommables), photo, dépense, note. Chaque mesure et chaque réalisation garde sa date : c'est ce qui rend graphes, alertes et corrélations possibles.

## Règles de travail

- Poser une question avant toute décision d'architecture non prévue ici, ou toute dépendance lourde.
- Écrire des tests pour la logique métier (alertes de dérive, coach de cyclage, calculateurs, notifications, compatibilité). Lancer `npm test` et `npm run check` avant chaque commit.
- Garder l'interface en français, avec des unités métriques.
- Prévoir une sauvegarde de la base : export JSON depuis l'appli, et envisager un modèle Railway de sauvegarde Postgres.
- Mettre à jour `docs/PHASES.md` et le tableau « Avancement » à chaque phase terminée.
- Ne jamais lire, afficher ni committer `.env` ni les valeurs des variables Railway.
- Hors périmètre : diagnostic de maladie par IA, communauté, multi-utilisateurs, Apple Watch, boutique de matériel.

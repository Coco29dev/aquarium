# Appli perso de gestion d'aquariums (PWA)

Brief pour Claude Code. Interface et commentaires en français. Dernière mise à jour : 30 octobre 2026.

## Contexte

- Usage strictement personnel : une seule personne, deux aquariums, types variés (eau douce, plantée, eau de mer, récif).
- Application web déployée sur Railway, installée sur un iPhone (iOS 27) via « Sur l'écran d'accueil ». Pas de compte développeur Apple, pas d'App Store.
- Priorité produit : aide à la décision (alertes de dérive, coach de cyclage, compatibilité), avec une saisie très rapide.
- Pas d'IA pour l'instant, pas de capteurs au départ, pas d'import : démarrage à vide.

## Infrastructure déjà en place

Créée depuis le chat, ne pas recréer :

| Élément | Valeur |
| --- | --- |
| Projet Railway | `aquarium` (id `ea6c4864-958c-4606-a765-59d4fd86e451`) |
| Environnement | `production` (id `e2eef43d-a928-4382-82d2-e1d9ba9a2e5d`) |
| Service Postgres | `Postgres` (id `ea91637c-61ce-4219-aefa-2e55b042183c`), image Postgres 18 avec SSL, volume de 5 Go en `europe-west4` |
| Plan Railway | Hobby (5 $ par mois avec 5 $ d'usage inclus, puis facturation à la seconde sur RAM et CPU) |
| Dépôt GitHub | `Coco29dev/aquarium`, privé (https://github.com/Coco29dev/aquarium), branche `main` |

Pas encore créé : le service de l'application, son domaine public, les variables VAPID. Le service de l'application se crée à partir du dépôt GitHub ci-dessus.

- Pour que l'appli lise la base, utiliser la variable de référence `${{Postgres.DATABASE_URL}}` sur le service de l'appli (adresse privée Railway).
- Ne jamais écrire de mot de passe, de clé ou de jeton dans le dépôt ni dans ce fichier. Tout passe par des variables Railway et un fichier `.env` local ignoré par Git.
- Développement local : utiliser un Postgres local (Docker) plutôt que d'exposer la base de production.
- Un connecteur Supabase existe sur le compte mais n'est pas utilisé : la base est sur Railway.
- Outils : CLI Railway (`railway link` puis choisir le projet `aquarium`) ou le connecteur Railway.

## Stack

- Interface et serveur : SvelteKit (Svelte 5), TypeScript, Tailwind, `@sveltejs/adapter-node`. Vérifier la version stable actuelle au démarrage (une version 3 est signalée en candidate de sortie).
- PWA : `@vite-pwa/sveltekit` (manifeste, service worker, mode hors ligne).
- Cache local : Dexie (IndexedDB), jamais seule source de vérité.
- Base : Postgres sur Railway. Proposer un outil de migrations simple avant de l'installer.
- Rappels : planificateur interne au service (node-cron) qui envoie du Web Push (VAPID). Ne pas utiliser le cron natif de Railway : intervalle minimal de 5 minutes, sans garantie de ponctualité.
- Photos : à trancher en phase 0 entre un volume Railway et un bucket Railway. Proposer les deux avec leurs compromis avant de choisir.
- Connexion : un seul compte géré par l'appli.

## Contraintes iOS à respecter

- Le push ne fonctionne que si la PWA est installée sur l'écran d'accueil. La permission se demande après un geste de l'utilisateur (bouton « Activer les rappels »).
- Des abonnements push peuvent cesser de fonctionner après une à deux semaines : revérifier l'abonnement à chaque ouverture, resouscrire si besoin, prévoir un repli (e-mail ou ntfy) et un écran « à faire aujourd'hui ».
- Pas de Bluetooth, de NFC ni de Background Sync : la synchronisation se fait à l'ouverture de l'appli.
- Le stockage local peut être purgé : le serveur est la source de vérité, avec export JSON et CSV.
- Non vérifié : l'accès à la caméra dans la PWA. À tester avant toute fonction de scan.

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

Ne passe pas à la phase 1 sans mon accord.

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
- Phase 4 : capteurs ESP32 (température, niveau, fuite) envoyant leurs mesures en HTTPS à une route de l'API avec un jeton ; IA si l'envie revient.

## Modèle de données de départ

Aquarium (nom, type d'eau, volume, date de mise en eau), définition de paramètre (nom, unité, plage par aquarium), mesure (valeur, date), tâche récurrente, réalisation de tâche, habitant (espèce, quantité, dates d'arrivée et de départ), matériel (achat, garantie, consommables), photo, dépense, note. Chaque mesure et chaque réalisation garde sa date : c'est ce qui rend graphes, alertes et corrélations possibles.

## Règles de travail

- Poser une question avant toute décision d'architecture non prévue ici, ou toute dépendance lourde.
- Écrire des tests pour la logique métier (alertes de dérive, coach de cyclage, calculateurs).
- Garder l'interface en français, avec des unités métriques.
- Prévoir une sauvegarde de la base : export JSON depuis l'appli, et envisager un modèle Railway de sauvegarde Postgres.
- Hors périmètre : diagnostic de maladie par IA, communauté, multi-utilisateurs, Apple Watch, boutique de matériel.

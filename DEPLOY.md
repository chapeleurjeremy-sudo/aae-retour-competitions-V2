# Déploiement GitHub + Cloudflare Workers

## 1. Mettre le projet dans GitHub
Crée un dépôt GitHub **privé** nommé `AAE-Retour-Competitions-V2`, puis décompresse ce ZIP et téléverse **le contenu du dossier**, pas le ZIP lui-même.

Le dépôt doit afficher à sa racine : `package.json`, `wrangler.jsonc`, `src/`, `public/`, `migrations/`.

## 2. Importer dans Cloudflare
Cloudflare → Workers & Pages → Create application → Connect GitHub → choisis `AAE-Retour-Competitions-V2`.

- Project name : `aae-retours-competitions-v2`
- Build command : laisser vide
- Deploy command : `npx wrangler deploy`

Cloudflare peut configurer et déployer un Worker depuis un dépôt GitHub connecté. Le fichier `wrangler.jsonc` est déjà fourni. Voir la documentation officielle Cloudflare sur l'intégration GitHub et Wrangler.

## 3. Base D1
Le fichier Wrangler utilise le provisionnement automatique D1 avec le binding `DB`. Si Cloudflare demande une création/liaison de base, accepte la base `aae-retours-competitions`.

Le Worker initialise également les tables au premier accès afin que le prototype soit immédiatement testable.

## 4. Token administrateur
Le ZIP contient volontairement un token de test : `CHANGE-ME-IMMEDIATELY`.

Après le premier déploiement, change-le impérativement dans Cloudflare → Workers → ton Worker → Settings → Variables and Secrets. Pour une utilisation officielle, utilise un secret et ne conserve jamais un token réel dans GitHub.

## 5. Tester
Après déploiement, ouvre :
- `/admin.html` pour créer une compétition et afficher son QR code
- `/dashboard.html` pour les résultats
- `/index.html?competition=ID` pour le questionnaire

Le QR code est généré dans la page d'administration.

## Important
Prototype de test uniquement. Avant une utilisation officielle AAE : validation SSI/DPO, politique de conservation, authentification administrateur robuste et choix d'hébergement validé.

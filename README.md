# AAE – Retours compétitions V2.2

Prototype full-stack Cloudflare Workers + D1 pour recueillir anonymement le retour des compétiteurs.

## Fonctionnalités
- Questionnaire mobile
- 8 critères communs + recommandation + note globale /10 + commentaires
- Hébergement/restauration avec option « Non utilisé »
- Jusqu'à 3 questions spécifiques par discipline
- Création de compétition
- QR code automatique
- Dashboard compétition
- Vue nationale
- Historique par année
- Export CSV
- Bilan automatique : score, recommandation, 3 points forts, 3 axes d'amélioration
- Aucune collecte de matricule, unité, grade, téléphone ou donnée opérationnelle
- D1 provisionnable automatiquement par Wrangler

## Dépôt GitHub
Téléverser le **contenu** de ce dossier à la racine d'un dépôt GitHub privé.

## Cloudflare
Connecter le dépôt à Workers via `npx wrangler deploy`.

## Test admin
Token initial de prototype : `CHANGE-ME-IMMEDIATELY`.
À remplacer immédiatement après le premier déploiement.

## QR code
L'administration utilise QRCode.js depuis cdnjs pour le prototype. Pour une version officielle, il est préférable de figer/bundler la dépendance après validation SSI.

## Sécurité
Ce projet est un prototype. Il ne doit pas être utilisé pour recueillir des informations personnelles, médicales, opérationnelles ou classifiées. Une validation SSI/DPO est nécessaire avant une mise en production AAE.


## V2.2
- Mode API/D1 uniquement : aucun fallback localStorage pour les compétitions ou réponses.
- Endpoint `/api/health` pour diagnostiquer Worker + D1.
- Les erreurs serveur sont affichées clairement à l'utilisateur.

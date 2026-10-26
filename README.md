# Optitam

Logiciel de planning opérationnel pour organismes de formation : sessions, salles, formateurs, matériel et formations réglementées (CACES, habilitations, SST).

Au-delà du planning classique, Optitam vérifie le planning en continu et aide à le construire :

- **Détection des conflits en temps réel** : salle, formateur ou engin réservé deux fois ; ressource indisponible ; salle trop petite ; formateur sans la compétence ou avec une habilitation expirée ; testeur CACES au-delà de sa capacité journalière ; testeur ou matériel manquant.
- **Suggestions d'affectation** : formateurs, salles et engins disponibles et compatibles, classés (site, interne ou externe, charge de la semaine, taille de salle).
- **Espace formateur mobile** (application web installable) avec agenda, détail des stagiaires et saisie des indisponibilités.
- **Émargement et résultats sur le téléphone** : le formateur fait signer chaque stagiaire au doigt, demi-journée par demi-journée, puis signe pour clore la feuille ; le testeur saisit les résultats théorie et pratique. Convocations, feuilles d'émargement, attestations de fin de formation et PV des tests en sortent sans ressaisie, et les certificats des reçus alimentent les recyclages.
- **Synchronisation agenda** : flux iCal par formateur pour Google Agenda, Outlook ou le téléphone.
- **API REST** documentée (OpenAPI) avec clés d'accès.

## Fonctionnalités

| Écran | Rôle |
|---|---|
| Planning | Frise par formateur, salle ou matériel ; semaine par semaine, par site ; glisser-déposer pour changer de jour ou de ressource ; conflits signalés en rouge |
| Sessions | Liste et fiche de session : formation, dates par demi-journée (théorie, pratique, test), salle, formateurs par rôle, matériel, stagiaires ; vérification à la volée ; brouillon ou confirmée |
| Recyclages | Certificats qui arrivent à échéance (30, 90, 180 jours). Par client et par formation, Optitam propose trois dates tenables avant l'échéance (formateur, salle, testeur et engins libres) et prépare un lien pour le client : il choisit sa date en un clic, la session est créée en brouillon avec ses ressources et le devis est édité |
| Référentiels | Formateurs (compétences datées, capacité de test), salles, matériel, catalogue, stagiaires et certificats, indisponibilités |
| Émargement et documents | Sur la fiche de session : état de l'émargement par créneau, résultats, création des certificats en un clic, documents prêts à imprimer ou à enregistrer en PDF |
| Paramètres | Identité de l'organisme (SIRET, déclaration d'activité, signataire) reprise sur les documents |
| Écran d'accueil | `/accueil` : formations du jour et leurs salles, pour l'écran à l'entrée du centre |
| API et agendas | Clés d'API et liste des points d'accès |

Une session **confirmée** ne peut pas être enregistrée avec un conflit bloquant sans confirmation explicite ; un **brouillon** peut l'être, pour être corrigé ensuite.

## Stack

- Next.js 16 (App Router) et TypeScript
- PostgreSQL avec Drizzle ORM
- Tailwind CSS 4
- Vitest pour le moteur de règles (`src/domain`)

Le moteur de règles (`src/domain`) est du TypeScript pur, sans dépendance à la base ni à l'interface : il est partagé par l'interface, l'API et les tests.

## Démarrer en local

Prérequis : Node.js 22 et PostgreSQL 16.

```bash
npm install
cp .env.example .env          # puis renseigner DATABASE_URL
npm run db:migrate            # crée les tables
npm run db:seed               # données de démonstration (centre fictif)
npm run dev                   # http://localhost:3000
```

Sans `ADMIN_PASSWORD`, le back-office est ouvert : pratique en local, à ne pas faire en production.

```bash
npm test          # tests du moteur de règles
npm run typecheck
npm run lint
```

## Mise en ligne

1. Créer une base PostgreSQL (par exemple chez Supabase) et récupérer son URL de connexion.
2. Lancer `npm run db:migrate` avec cette `DATABASE_URL`.
3. Déployer sur Vercel avec les variables `DATABASE_URL`, `ADMIN_PASSWORD` et `AUTH_SECRET` (chaîne aléatoire longue).

## Accès

- **Back-office** : protégé par `ADMIN_PASSWORD`.
- **Espace formateur** : `/formateur/<jeton>`, lien personnel affiché sur la fiche du formateur. L'émargement d'un créneau ouvre un quart d'heure avant son début ; la saisie des résultats, au premier créneau de test.
- **Propositions client** : `/proposition/<jeton>` et son devis `/proposition/<jeton>/devis`, sans connexion ; le lien expire au bout de 14 jours.
- **Documents** : `/documents/<session>/<convocation|emargement|attestation|pv>`, réservés au back-office.
- **Agenda iCal** : `/api/calendar/<jeton>.ics`.
- **API** : `/api/v1/...` avec l'en-tête `Authorization: Bearer <clé>` ; description sur `/api/openapi`.

## Pistes suivantes

Comptes utilisateurs et rôles (planificateur, lecture seule, cloisonnement par agence) ; optimisation automatique d'un mois entier ; synchronisation agenda dans les deux sens ; webhooks ; envoi automatique des propositions par e-mail ; financements et facturation.

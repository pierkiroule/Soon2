# Prompt radical unique — Refactor UX flow Soon2

Tu es responsable de la refonte UX/architecture de ce projet React + Vite.

## Objectif non négociable
Imposer un flow utilisateur clair, testable, sans régression, et sortir progressivement du legacy monolithique.

## Contexte imposé
- Le runtime legacy existe dans `src/features/legacy/` et ne doit plus recevoir de nouvelle logique métier.
- Toute nouvelle logique doit être React native, structurée par feature.
- Flows critiques à fiabiliser en priorité :
  1. Authentification/session
  2. Création et gestion de room (hôte)
  3. Rejoindre une room par lien direct (invité sans compte)
  4. Attribution/lecture des rôles (`viewer` / `player` / `cohost`)
  5. Achat/accès expérience + historique

## Contraintes d’implémentation (obligatoires)
1. Interdiction d’ajouter du métier dans `legacyApp.js`.
2. Chaque écran doit exposer explicitement ses états UX : `idle | loading | success | empty | error | forbidden`.
3. Aucune navigation implicite : CTA principal visible, retour arrière clair, feedback utilisateur systématique.
4. Aucune erreur silencieuse : chaque échec réseau/permission doit afficher un message actionnable.
5. Séparation stricte :
   - UI/Composants : `src/features/*/components`
   - Orchestration flow : `src/features/*/hooks`
   - Data access : `src/integrations/supabase/*Repository*`
6. Contrat de rôles explicite (`host` / `cohost` / `player` / `viewer` / `guest`) avec permissions UI lisibles.
7. Non-régression obligatoire via tests de parcours utilisateur sur les flows critiques.

## Livrables attendus (dans cet ordre)
1. `docs/ux-flow-map.md`
   - Cartographie des 5 parcours critiques (étapes, décisions, erreurs, issues).
2. `docs/arena-role-matrix.md`
   - Matrice rôle → permissions → UI visible → message en cas de blocage.
3. `docs/ux-error-guidelines.md`
   - Standards de messages d’erreur (réseau, RLS, ressource absente, session expirée).
4. `docs/qa-ux-checklist.md`
   - Checklist de non-régression par parcours.
5. Structure feature-first consolidée :
   - `src/features/auth/`
   - `src/features/arena/`
   - `src/features/profile/`
   - `src/features/echohypnose/`
   - `src/shared/ui/`
   - `src/integrations/supabase/`
6. Extraction d’un App Shell React natif (navigation + feedback global + statut session).
7. Hooks d’orchestration de flow par feature (au moins auth et arena en priorité).
8. Repositories Supabase par domaine avec format de retour unifié `{ data, error, status }`.
9. Tests de parcours utilisateur pour les flows prioritaires.

## Critères d’acceptation (Definition of Done)
Une PR est refusée si un seul point échoue :
- Aucun ajout de logique métier dans le legacy.
- Chaque écran gère explicitement les 6 états UX.
- Les rôles et permissions sont visibles et compréhensibles côté UI.
- Les erreurs sont actionnables (pas de message vague).
- Les flows prioritaires sont couverts par tests de parcours.
- Documentation UX à jour dans `docs/`.
- L’expérience invité (sans compte) est fluide de bout en bout avec `?room=...`.

## Plan d’exécution forcé
1. Stabiliser la perception UX : shell React, feedback global, états explicites.
2. Sécuriser le multiutilisateur : rôle/permission matrix + écrans par contexte.
3. Fiabiliser la data layer : repositories Supabase + gestion uniforme erreurs/loading.
4. Verrouiller la qualité : checklist QA + tests de parcours + critères bloquants.

## Format de restitution attendu
- Résumé des changements par fichier.
- Liste des décisions UX prises et pourquoi.
- Liste des régressions évitées / risques restants.
- Commandes de test exécutées + résultat.
- Prochaines étapes priorisées (P1 / P2 / P3).

Si une contrainte ci-dessus n’est pas respectée, considère la tâche comme échouée.

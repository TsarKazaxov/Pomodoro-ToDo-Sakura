# BACKLOG — hors V1

Idées notées, **non codées**. Re-priorisation après les 5 jours d'usage du critère de réussite.

## Hors V1 (brief, section 7)
- Comptes utilisateurs et serveur
- Version Windows
- Intégrations Jira / Notion / Calendrier
- Tâches récurrentes
- Sous-tâches
- Statistiques par projet
- Signature Apple Developer + notarisation (99 $/an) — supprime le contournement Gatekeeper
- Application iPhone

## Repérées pendant le cadrage
- **Fusion multi-Mac simultanée** (fusion par `id` + `updatedAt`, pierres tombales `deletedAt`, absorption des copies de conflit iCloud) — inutile tant qu'un seul Mac écrit à la fois (D-014).
- **Mise à jour automatique** (`tauri-plugin-updater`) — demande une signature des mises à jour ; en V1, mise à jour manuelle via la page Releases.
- **Journal de focus** : une note libre à la fin d'un pomodoro (« sur quoi j'ai bloqué »).
- **Découpage assisté d'une XL** : bouton « découper » qui crée N tâches S/M liées.
- **Pause automatique à la mise en veille / verrouillage d'écran** (aujourd'hui le temps continue de courir, ce qui est le comportement attendu d'un minuteur à horodatages).
- **Mode « ne pas déranger »** : couper le son et les pétales pendant un partage d'écran.
- **Seuils de heatmap par quartiles** : déjà prévu V1 après 30 jours ; une version « par semaine glissante » pourrait mieux suivre les changements de rythme.
- **Interface en anglais / japonais** (les chaînes sont centralisées, D-004).
- **Historique de calibration** : évolution du ratio par taille dans le temps (est-ce que je m'améliore ?).

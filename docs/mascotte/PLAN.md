# Rai — plan de la mascotte vivante

Moodboard : https://claude.ai/artifact/VcGLtqDjm1e7wEwuaT4SGz (concept, réactions, place à l'écran).

## Intention

Rendre le Pomodoro **drôle et impossible à oublier**, sans gêner : Rai vit au bord de l'écran, réagit à ce que tu fais (ou ne fais pas), se moque gentiment, fête tes victoires, et s'écarte s'il te gêne.

## Décisions prises

| Sujet | Décision |
|---|---|
| Personnage | Rai, raijū (bête-éclair du folklore japonais), renard-hérisson indigo, trois piquants, queue en éclair. Forme super dorée, yeux rouges (archétype « super » du shōnen). Personnage **original** : pas de copie de Sonic. |
| Style | Manga réaliste en couleur (shōnen). Abandon du pixel art. |
| Production des images | Générées par l'utilisateur dans ChatGPT avec `PROMPTS-GPT.md`, puis découpées et animées dans l'app. Claude ne dessine pas le rendu final (limite assumée). |
| Langues | Chaque réplique : japonais d'abord (kana + romanisation), puis traduction FR ou EN au choix, ou aucune. Même ordre pour le texte et la voix. |
| Voix | Réglable (activée / désactivée). V1 : voix système macOS (japonais : Kyoko/Otoya ; français : Thomas/Amélie ; anglais : Samantha/Daniel). Option ultérieure : clips enregistrés avec une voix de synthèse « anime ». |
| Place | Huit positions sur les bords (D-041). Fiche du minuteur sous le personnage en haut/bas au centre, à côté de lui sur les bords et dans les coins, toujours du côté de l'écran. |
| Gêne | Curseur immobile près de Rai > 1,5 s sans clic, pendant que tu travailles → il file vers la place libre la plus proche. Le glisser manuel reste. |

## Réactions (déclencheurs)

| Réaction | Image(s) | Déclencheur | Priorité |
|---|---|---|---|
| attente | attente-a/b | minuteur arrêté depuis 2 min (répété toutes les 10 min) | basse |
| focus | focus-a/b | focus lancé | moyenne |
| transformation | transfo → super | 10 min de focus continu (activité sans pause > 2 min) | haute |
| super | super-a/b | prolongation (D-042) ou 3 tâches en 10 min | haute |
| dodo | dodo-a puis dodo-b | focus en cours, 3 min sans clavier ni souris | moyenne |
| sursaut | sursaut | activité reprise pendant qu'il dort | haute |
| réveil | reveil | fin de focus | haute |
| pause | pause-a/b | pendant la pause | basse |
| victoire | victoire | tâche cochée | haute |
| esquive | esquive | curseur qui s'attarde (voir « Gêne ») | haute |
| moque | moque | pause > 2× sa durée ; « J'dormais pas » | moyenne |
| akanbe | akanbe | clic sur Rai | haute |
| salut | salut | 4ᵉ pomodoro du cycle | haute |
| bulletin | bulletin | première ouverture après 18 h, une fois par jour | moyenne |

Règles anti-saturation : une bulle toutes les 3 min au plus (sauf priorité haute) ; mode discret = aucune bulle ni voix pendant un focus, sauf fin de focus ; bulle 5 s. **Remplacé par D-048** : il ne parle plus qu'en fin de focus, fin de pause, tâche cochée, clic sur lui et bulletin du soir ; le mode discret n'existe plus.

## Architecture (à implémenter)

1. **Moteur de comportement** (`src/companion/`, pur, testé) : entrées = état du minuteur, activité (temps d'inactivité, D-042), événements (tâche cochée, fin de focus, clic, curseur proche), heure ; sortie = `{ reaction, line, until }` avec priorités, temps de recharge et minuteries. Tests unitaires sur des scénarios temporels (horloge simulée).
2. **Répliques** (`src/companion/lines.ts`) : `{ id, ja, romaji, fr, en }`, plusieurs variantes par réaction, tirage sans répétition immédiate.
3. **Rendu** : images WebP (converties depuis les PNG, ~256 px de haut pour l'écran Retina), animation par permutation d'images + mouvements CSS sur le compositeur (respiration, rebond, secousse, flash), effets dessinés en CSS/SVG (Zzz, bulle de morve, sueur, lignes de vitesse, aura). Réduction des animations macOS respectée. Animations suspendues quand l'écran est verrouillé.
4. **Voix** : `speechSynthesis` du WebView (ou commande `say` côté Rust si indisponible) ; file d'attente JA → traduction ; volume lié au réglage sonore ; jamais pendant un appel si détectable (sinon : mode discret).
5. **Fenêtre** : le widget devient « compagnon » : Rai + fiche du minuteur, disposition selon la position (D-041). Les zones transparentes laissent passer les clics : Rust interroge la position du curseur (toutes les 50 ms quand il est proche) et bascule `set_ignore_cursor_events` hors des zones opaques.
6. **Esquive et balade** : Rust anime le déplacement de la fenêtre le long du bord (~400 ms) ; esquive pendant le travail, balade seulement en pause ou inactivité.
7. **Réglages** : Afficher Rai, Bulles, Voix, Langue de Rai (une seule : japonais, espagnol, russe, français, anglais — D-047), Sous-titres en français, Mode discret, Balade.

## Risques

- **Cohérence des images générées** entre poses : pack de prompts + image de référence + checklist ; prévoir des retouches.
- **Fond transparent** : si ChatGPT livre un fond vert, détourage par chroma-key dans un script du dépôt.
- **CPU** (budget < 2 %, D-036) : animations sur le compositeur uniquement, cadence des permutations ≤ 4 images/s, rien quand l'écran est verrouillé.
- **Clics à travers la fenêtre** : à valider en premier sur Mac (prototype dédié).
- **Voix système japonaise** : robotique ; acceptable pour des exclamations courtes, sinon passer aux clips.

## Ordre de travail

0. Prototype technique sur Mac : clics qui traversent + voix JA/FR + coût CPU d'une animation (avant tout le reste).
1. Images : génération (utilisateur), détourage, conversion WebP, planche de contrôle.
2. Moteur de comportement + répliques + tests.
3. Fenêtre compagnon, dispositions, bulles.
4. Voix, réglages, mode discret.
5. Esquive, balade, bulletin du soir.
6. Passe qualité : CPU, checklist QA, version 1.1.0.

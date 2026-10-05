# Passe qualité — V1

Rôle : QA / Release. Ce document dit ce qui est **prouvé** (tests automatiques, mesures) et ce qui reste **à vérifier sur un Mac**, faute de Mac dans l'environnement de développement (D-001).

## 1. Cas limites (brief, Phase 6 étape 20)

| Cas | Comment c'est vérifié | Résultat |
|---|---|---|
| Veille de 2 h pendant un focus | `src/core/timer.test.ts` « veille de 2 h » : le focus finit à son heure réelle, la pause aussi, puis arrêt | ✅ automatique |
| Veille juste avant la pause longue | `timer.test.ts` | ✅ |
| Horloge qui recule, passage à l'heure d'hiver pendant un focus | `timer.test.ts`, `tests/timezone.test.ts` : 25 vraies minutes | ✅ |
| Changement de fuseau (Paris → Tokyo, → New York) | `tests/timezone.test.ts` : les jours déjà enregistrés ne bougent pas, la série tient, le minuteur garde sa durée | ✅ |
| Fichier corrompu (JSON illisible, forme invalide) | `dataStore.test.ts`, `store.test.ts` : jamais écrasé, sauvegardes proposées, restauration | ✅ |
| Fichier d'une version plus récente | `dataStore.test.ts` : refusé, non écrasé | ✅ |
| Fichier encore dans iCloud (stockage optimisé) | `dataStore.test.ts` : état « téléchargement » au lieu de « vide » | ✅ |
| 1 000 tâches | Stockage : `dataStore.test.ts` (aller-retour de 1 001 tâches). Interface : 1 026 lignes, cocher une tâche = 181 ms en mode développement après optimisation (363 ms avant) | ✅ |
| Deux instances sur le même fichier | `tests/twoMacs.test.ts` sur le vrai disque : lecture croisée, refus d'écraser avant relecture, fichier remplacé avec une date plus ancienne détecté | ✅ |
| Aucune tâche · aucune activité · minuteur arrêté sans tâche | États dessinés et vérifiés dans le navigateur (widget et vue complète) | ✅ visuel |
| Fin de session widget replié | Pastille + pétales au prochain déploiement (testé navigateur) ; notification macOS (code, à vérifier sur Mac) | ✅ / 🔶 |
| Fermeture forcée | Écriture atomique (Rust : temporaire, `fsync`, renommage) testée ; le minuteur est persistant et reprend au relancement | ✅ |

## 2. Performance (étape 21)

Mesuré sur l'app compilée en release, sous Linux (WebKitGTK, écran virtuel **sans GPU** : tout le rendu est logiciel, donc plus coûteux que sur un Mac). Moyenne sur 60 s, tous processus de l'app.

| Situation | CPU | Mémoire (PSS) |
|---|---|---|
| Au repos (minuteur arrêté, widget replié) | 0,65 % | 336 Mo |
| Focus en cours (widget replié) | 2,2 % | 338 Mo |

Corrections faites pendant la mesure (D-036) :

| Problème trouvé | Avant | Après |
|---|---|---|
| Transition CSS continue de l'ensō pendant le focus (60 images/s pour ~0,2 px/s de trait) | **57 %** CPU | 2,5 % |
| Vue complète cachée mais vivante (un processus web entier) | 402 Mo | 341 Mo |
| Partie déployée du widget mise à jour chaque seconde même repliée | 2,5 % | 2,2 % |
| Liste de tâches entièrement redessinée à chaque changement | 363 ms | 181 ms |

Répartition en focus : rendu web 1,7 %, processus principal 0,5 % (barre de menu).

**Ce que ces chiffres ne disent pas** : la consommation réelle sur macOS (WKWebView, rendu GPU). Le budget du brief (< 2 % CPU, < 150 Mo) est à vérifier sur le Mac avec la checklist ci-dessous. Le seul poste au-dessus du budget mémoire sous Linux est le moteur web lui-même (WebKitGTK ≈ 190 Mo pour le widget), pas les données de Sakura.

## 3. Checklist sur ton Mac (10 minutes)

Coche au fur et à mesure. Si une ligne échoue, note ce que tu vois : c'est la matière de la V1.1.

**Installation**
- [ ] Le `.dmg` s'ouvre ; après `xattr -cr`, Sakura se lance.
- [ ] Pas d'icône dans le Dock ; un ensō dans la barre de menu.
- [ ] Premier lancement : l'écran d'accueil s'affiche, « Commencer » le ferme et le widget apparaît dans le coin choisi.

**Widget**
- [ ] Le widget est visible sur tous les bureaux (change de bureau avec ⌃→).
- [ ] Il reste visible **par-dessus une app en plein écran** (Safari en plein écran, par exemple).
- [ ] Curseur immobile 0,3 s dessus → il se déploie, **même si une autre app est active** (Figma au premier plan). Si non : risque D-028, à signaler.
- [ ] Passer le curseur dessus sans s'arrêter → il ne s'ouvre pas.
- [ ] Il se replie 0,6 s après la sortie, sauf si tu tapes dans l'ajout rapide.
- [ ] Un clic sur « Démarrer » agit du premier coup, même quand Sakura n'est pas l'app active.
- [ ] Cocher 4 priorités en moins de 10 min : pétales, puis pluie sur tout l'écran au 4ᵉ ; les clics passent à travers la pluie.

**Minuteur**
- [ ] Lance un focus, mets le Mac en veille 5 min, réveille-le : le temps restant a bien avancé de 5 min.
- [ ] Fin de focus widget replié : notification macOS + son ; pétales au prochain survol.
- [ ] Le temps restant s'affiche à côté de l'ensō dans la barre de menu.

**Raccourcis et menu**
- [ ] ⌥⌘P démarre / suspend ; ⌥⌘N ouvre le widget avec le curseur dans l'ajout rapide ; ⌥⌘S ouvre la vue complète.
- [ ] Barre de menu → Quitter : la tâche ajoutée juste avant est toujours là au relancement.

**Données**
- [ ] `iCloud Drive/Sakura/sakura-data.json` existe.
- [ ] Forcer la fermeture (⌥⌘Échap) pendant un focus, relancer : le focus continue.
- [ ] Réglages → « Lancer au démarrage » activé → redémarrer le Mac : Sakura revient.

**Mesure**
- [ ] Moniteur d'activité, onglet Processeur, focus en cours depuis 2 min : additionne « Sakura » et ses processus « Sakura Web Content » / « Networking ». Cible : < 2 %.
- [ ] Onglet Mémoire, même addition. Cible : < 150 Mo.

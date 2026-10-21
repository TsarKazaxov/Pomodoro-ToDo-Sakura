# PRODUCT — Sakura

Ce que Sakura est, pour qui, et ce qui guide chaque choix. Le *comment* technique est dans
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ; le *pourquoi* de chaque choix précis dans
[`DECISIONS.md`](DECISIONS.md) ; les idées non faites dans [`BACKLOG.md`](BACKLOG.md).

État : **V1.4.1** (macOS, usage personnel, une seule personne, un ou plusieurs Mac).

---

## 1. Le problème

Travailler en Pomodoro avec une liste de tâches demande aujourd'hui deux ou trois outils (un
minuteur, une todo, un tableur pour voir si les estimations tiennent). Résultat : on ne lance
pas le minuteur, on n'estime pas, et on ne sait jamais si une « petite tâche » a pris 30 min ou
une demi-journée.

## 2. La promesse

**Un minuteur toujours visible qui sait sur quoi tu travailles, combien ça devait prendre, et
combien ça a pris — sans compte, sans serveur, sans te déranger.**

## 3. Pour qui

Une personne qui travaille seule sur son Mac (design, code, écriture), plusieurs écrans,
souvent en Stage Manager, qui veut :
- lancer un focus en un geste, sans quitter ce qu'elle fait ;
- estimer en tailles T-shirt et voir, avec le temps, si ses estimations sont justes ;
- un peu de jeu (récompense, mascotte) sans que ça devienne une distraction.

## 4. Principes (à respecter dans toute évolution)

1. **Toujours là, jamais devant.** Le widget reste visible sur tous les écrans et espaces, mais
   petit ; les clics traversent son vide (D-038, D-045).
2. **Un geste.** Démarrer, cocher, ajouter une tâche : un clic ou un raccourci (⌥⌘P, ⌥⌘N, ⌥⌘S).
3. **Protéger le focus.** Rien ne parle ni ne bouge brusquement pendant un focus, sauf ce que
   tu déclenches toi-même. Une réplique doit t'apprendre quelque chose ou répondre à un geste ;
   sinon, une pose suffit (D-048).
4. **Pas de reproche.** Le minuteur arrêté peut être voulu (réunion, mails). On montre, on ne
   sermonne pas.
5. **Tes données restent chez toi.** Un fichier JSON lisible, sur iCloud Drive ou en local ;
   écriture atomique, sauvegarde quotidienne, import/export (D-014, D-024, D-029, D-030).
6. **Mesurer le réel.** Le temps compté est le temps de focus effectif (pauses déduites) ;
   l'estimation est confrontée au réel, pas l'inverse (D-046).
7. **Léger.** Cible < 2 % CPU et < 150 Mo en focus (D-036).

## 5. Ce que fait Sakura aujourd'hui

### Minuteur
- Focus / pause courte / pause longue (25 / 5 / 15 min, pause longue tous les 4 focus ; réglable).
- Fondé sur des horodatages : survit à une fermeture forcée ou à un redémarrage.
- **Prolongation** : si tu travailles encore à la fin du focus, il continue (« +mm:ss ») ; la
  pause démarre après 2 min sans clavier ni souris (D-042).

### Widget
- Fiche compacte (ensō qui se dessine, temps, tâche en cours) à l'une des **8 positions** de
  l'écran ; se déploie au survol ou au clic ; glisser pour déplacer (D-040, D-041).
- Déployé : contrôles du minuteur, tâche en cours avec **temps passé / estimé** et sous-tâches,
  priorités du jour, ajout rapide, mini heatmap.
- En pause, la fiche affiche **le temps restant** sur le projet en cours.

### Tâches
- Ajout en une ligne : `Relire la spec #M`. Tailles **XS, S, M, L, XL**.
- Chaque taille vaut des **points** (heatmap) et une **durée de focus estimée**
  (par défaut XS 30 min, S 1 h, M 2 h, L 4 h, XL 8 h), traduite en journées selon les heures
  de vraie concentration par jour (4 h par défaut).
- **Sous-tâches** (un niveau), chacune avec sa taille ; le découpage est comparé au budget de
  la tâche parente.
- Temps passé = focus réels sur la tâche et ses sous-tâches, comparé à l'estimation
  (reste / dépassé de).

### Activité
- **Heatmap** façon GitHub, remplie par les points des tâches terminées.
- **Calibration** par taille : pomodoros réels ÷ attendus (sur- ou sous-estimation).
- **Récompense graduelle** : pétales, son de bol, série jusqu'à ×4 et pluie plein écran (D-019).

### Rai, la mascotte
- Raijū manga (renard-hérisson indigo, forme super dorée), 17 poses illustrées, à côté du widget.
- Il vit au rythme du minuteur : travaille, s'endort si tu décroches, se transforme après 10 min
  de concentration, mange un onigiri en pause, se balade pendant les pauses.
- **Il ne parle que** : fin de focus, fin de pause, tâche cochée (≤ 1 fois / 3 min), clic sur
  lui, bulletin du soir (D-048).
- **Une langue à la fois** : japonais (défaut), espagnol, russe, français, anglais ; sous-titres
  français facultatifs (D-047).
- **Voix** ElevenLabs (personnage japonais, accent gardé dans toutes les langues), 60 clips
  embarqués ; voix de macOS en secours (D-049).

### macOS
- Barre de menu (temps restant, démarrer/suspendre), raccourcis globaux, notifications,
  lancement au démarrage, plusieurs écrans, Stage Manager.
- `.dmg` universel (Intel + Apple Silicon) construit par GitHub à chaque mise à jour.
  Non signé : `xattr -cr /Applications/Sakura.app` après chaque installation.

## 6. Hors périmètre (volontairement)

Comptes, serveur, Windows, iPhone, intégrations Jira/Notion/Calendrier, tâches récurrentes,
fusion de données entre deux Mac écrivant en même temps. Détail et idées : [`BACKLOG.md`](BACKLOG.md).

## 7. Critère de réussite

Utiliser Sakura **5 jours ouvrés d'affilée** sans revenir à un autre minuteur ni à une autre
todo, et que la calibration dise quelque chose d'utile sur tes estimations au bout de 2 semaines.

## 8. Questions ouvertes

- Faut-il un **bilan par projet** (temps passé cumulé sur une semaine) au-delà de la tâche en cours ?
- Le **bulletin du soir** compte comme « siestes » 3 min sans clavier (souvent de la lecture) :
  garder ce critère ou l'allonger à 5 min ?
- **Signature Apple** (99 $/an) pour supprimer la commande `xattr` : à décider si l'app sort de
  l'usage personnel.

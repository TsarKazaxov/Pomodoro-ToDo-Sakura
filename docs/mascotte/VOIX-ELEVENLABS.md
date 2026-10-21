# Voix de Rai avec ElevenLabs

Rai parle une seule langue à la fois (japonais, espagnol, russe, français ou anglais ; Réglages →
Rai). Par défaut, il utilise la voix de macOS. Avec ElevenLabs, chaque réplique est enregistrée une
fois pour toutes, avec **une seule voix pour les cinq langues** : c'est le même personnage qui
parle japonais, espagnol ou russe.

Budget : toutes les répliques dans les cinq langues font environ **900 caractères** (60 clips), à générer
une seule fois. Le plan gratuit d'ElevenLabs suffit en principe (environ 10 000 caractères par
mois, à vérifier sur leur page de tarifs). Avec le plan gratuit, l'usage doit rester personnel.

## 1. Créer la voix (10 min, dans le navigateur)

1. Crée un compte sur elevenlabs.io.
2. **Voices** → **Create a voice** (ou « + Add voice ») → **Voice Design**.
3. Dans **Describe the voice**, colle :

   > Young male anime character, about 16 years old, cocky and playful shōnen sidekick. Bright,
   > slightly raspy mid-high voice, fast and bouncy delivery, full of energy, teasing and ironic,
   > with short laughs. Japanese anime dubbing style. Clean studio recording, no background noise.

4. Dans **Text to preview**, colle :

   > よっしゃ、行くぞ！集中モード、オン！…おい、まだかよ〜？寝てないし！ちょっと目を閉じてただけだって。
   > やった！次のタスクも片付けようぜ。休憩だ！おにぎりタイム、キーボードから手を離せ！
   > 今日の成績、なかなかやるじゃん。

5. **Generate**. Écoute les 3 propositions. Si aucune n'est Rai, régénère ou ajuste la
   description (« higher pitch », « less childish », « more sarcastic »…).
6. Garde la meilleure : **Save voice**, nom `Rai`.
7. Vérifie qu'il tient dans les autres langues : **Text to Speech**, voix `Rai`, modèle
   **Eleven Multilingual v2**, puis colle une réplique en espagnol (« ¡Eh, que me haces
   cosquillas! ») et une en russe (« Эй, щекотно! »). Si l'accent te gêne, refais l'étape 5.
8. Copie l'**ID de la voix** : dans **Voices**, menu « ⋯ » de Rai → **Copy voice ID**
   (une suite de ~20 lettres et chiffres).

## 2. Donner l'accès au dépôt (3 min)

1. ElevenLabs → ton profil → **API Keys** → **Create API key**. Limite ses droits à
   **Text to Speech** si l'option existe. Copie la clé.
2. GitHub → dépôt `Pomodoro-ToDo-Sakura` → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret** :
   - Name : `ELEVENLABS_API_KEY`
   - Secret : la clé.

**Ne colle jamais la clé dans le chat ni dans un fichier du dépôt.** L'ID de la voix, lui, n'est
pas secret.

## 3. Me donner l'ID de la voix

Envoie-moi l'ID dans le chat. Je le mets dans `src/assets/rai/voice/voice.json` et je pousse ;
le workflow GitHub **Voix de Rai** enregistre alors les clips (`scripts/rai-voice.mjs`), les
commite dans `src/assets/rai/voice/`, et le `.dmg` suivant les embarque.

Ensuite, à chaque réplique ajoutée ou modifiée, seuls les clips concernés sont refaits. Changer de
voix (nouvel ID) refait tout.

## Ce qui reste en voix de macOS

- Le bulletin du soir : ses chiffres changent chaque jour. Le clip dit seulement « 今日の成績！ »
  (ou « ¡El boletín de hoy! »…), les chiffres sont dans la bulle.
- Toute réplique sans clip à jour (texte modifié depuis l'enregistrement).

## Pourquoi pas ElevenLabs en direct dans l'app

Il faudrait la clé dans l'app, une connexion Internet, et chaque réplique coûterait des crédits.
Les clips enregistrés une fois coûtent ~900 caractères, marchent hors ligne et ne laissent
aucun secret dans le `.dmg`.

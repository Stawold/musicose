# musicose
Blind Test en ligne

## Déroulé d'une partie (65 chansons)

| Manche | Nom | Chansons | Temps | Réponse | Points |
|---|---|---|---|---|---|
| 1 | Chansons en rafale | 1 → 15 | 30 s | 1 choix parmi 4 micros (modifiable jusqu'au bout) | 1 pt si juste, +1 pour le plus rapide **parmi les bonnes réponses** |
| 2 | Le Focus | 16 → 30 | 30 s | titre seul, avec un **thème** affiché | 2 pts, +1 pour la première bonne réponse |
| 3 | Fast & Musicous | 31 → 55 | 45 s | titre + artiste | 1 pt (titre OU artiste), 3 pts (les deux), bonus 3 / 2 / 1 pts aux 3 premiers à avoir les deux |
| 4 | Le Battle Royal d'Ose | 56 → 65 | 45 s (musique coupée à 30 s) | titre ou artiste | 5 pts (les deux), 2 pts (un seul), 0 = éliminé |

Classements intermédiaires : après les chansons 15, 30 et 55. Podium : après la chanson 65.
L'artiste peut être donné en entier **ou** par son nom de famille (dernier mot).

## Format de `public/playlistN/data.json`

Les chansons doivent être **dans l'ordre du jeu** (15 + 15 + 25 + 10) :

```json
{
  "name": "Playlist 4",
  "songs": [
    { "id": 1, "title": "Alors on danse", "artist": "Stromae", "file": "1.mp3",
      "choices": [
        { "title": "Formidable", "artist": "Stromae" },
        { "title": "Papaoutai", "artist": "Stromae" },
        { "title": "Tous les mêmes", "artist": "Stromae" }
      ] },
    { "id": 16, "title": "Sweet Dreams", "artist": "Eurythmics", "file": "16.mp3", "theme": "Années 80" }
  ]
}
```

- `choices` (manche 1, facultatif) : les **3 mauvaises** propositions. Si absent ou incomplet, elles sont complétées automatiquement avec d'autres chansons de la playlist.
- `theme` (manche 2, facultatif) : affiché aux joueurs à la place de l'artiste. Si absent, l'artiste est affiché.
- La régie affiche `⚠ n/65 CHANSONS` si la playlist n'a pas exactement 65 chansons.

## Tests

```bash
npm test          # tests unitaires (règles, points, propositions) — aucune dépendance
npm run test:e2e  # partie complète simulée : régie + grand écran + 3 téléphones (nécessite playwright + Chromium)
```

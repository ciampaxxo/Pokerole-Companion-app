# Master Pokérole

App da master per le campagne di Pokérole 3.0: generatore di Pokémon e allenatori, catalogo allenatori, assistente di battaglia, database e regole.

**Apri l'app:** https://ciampaxxo.github.io/Pokerole-Companion-app/

- Su iPhone: apri il link con Safari → Condividi → *Aggiungi alla schermata Home*.
- Su Android / PC: apri il link con Chrome o Edge → *Installa*.

Dopo la prima apertura funziona anche offline e si aggiorna da sola quando c'è una nuova versione.
I dati salvati (allenatori, Pokémon, lotta) restano sul dispositivo; per spostarli usa *Opzioni → Backup*.

**Diario per i giocatori:** https://ciampaxxo.github.io/Pokerole-Companion-app/diario.html

Qui compaiono le voci del diario che il master pubblica dall'app. Si installa allo stesso modo (Safari → Condividi → Aggiungi alla schermata Home).

## Sviluppo

- `index.html` contiene interfaccia e logica; i dati di gioco stanno in `dati.json` e gli sprite in `sprite.json` (caricati all'avvio e salvati offline dal service worker). L'app va aperta da un indirizzo web, non da un file locale.
- Test: `npm i -g playwright` (o usa quello già installato), poi `node tests/smoke.js`. Controlla caricamento, ricerca, backup su file, annulla in lotta, avviso di salvataggio, generatore su tutte le specie e funzionamento offline.
- A ogni rilascio aggiorna `APPV`/`APPD` in `index.html` e la riga `// versione …` in `sw.js`, così i dispositivi scaricano la nuova versione.

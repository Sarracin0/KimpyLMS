# Practice Arena

Una guida operativa su come funziona la Practice Arena, la generazione dei contenuti con l'AI e la gestione dei token/endorsement.

## Obiettivo della feature
La Practice Arena fornisce ai learner un esercizio post-capitolo guidato dall'AI per allenare soft-skill e iterare su un piano d'azione. L'HR ottiene insight quantitativi (punteggio, miglioramento, token) e qualitativi (feedback AI, endorsement) per valutare l'efficacia dell'apprendimento esperienziale.

## Flusso generazione (builder HR)
1. **Accesso**: dal course builder apri un blocco `Gamification` e seleziona il tab *Practice Arena*.
2. **Documenti di contesto**: scegli gli attachment che l'AI userà come base (slide, pillole, policy).
3. **Impostazioni chiave**:
   - Assi di valutazione (2-5) e soft skill primaria.
   - Focus per l'iterazione e visibilità endorsement (`private`, `team`, `company`).
   - Note addizionali per contestualizzare tono/policy.
4. **Generazione**: al click su *Generate with AI* l'endpoint `POST /api/courses/{course}/modules/{module}/lessons/{lesson}/blocks/{block}/gamification` crea il payload. Lo stato del blocco passa da `DRAFT → GENERATING → READY`.
5. **Output**: nel builder trovi un riassunto con titolo, ruolo learner, numero assi e learning goals. Il link *Preview learner view* punta a `/courses/{courseId}/arenas/{blockId}`.

Di backend vengono aggiornate le tabelle:
- `GamificationBlock.result` con il JSON del payload (`arena` + `raw`).
- `LessonBlock` mantiene tipo e config.

## Esperienza learner
Route: `/courses/{courseId}/arenas/{blockId}`.

1. **Brief e rubrica**: la pagina mostra scenario, obiettivi, sezioni attese e assi di valutazione con rubric.
2. **Invio piano**: textarea (max 300 parole) con prompt generato. Al submit (`POST /api/arenas/{blockId}/attempts`):
   - Viene salvato un `ScenarioAttempt` con `attemptType = 'ARENA'`.
   - L'AI valuta il piano (`evaluatePracticeArenaPlan`), calcola score 0-100 e feedback per asse.
   - Award token: `baseAward` al primo tentativo, `improvementBonus` se il nuovo punteggio supera il precedente di almeno 5 punti.
   - `userLessonProgress` viene marcato `isCompleted = true` e `pointsAwarded` incrementato dei token assegnati.
3. **Feedback**: card con punteggio complessivo, grafico per asse, sintesi e coaching tip.
4. **Cronologia**: elenco tentativi con score, token e endorsement ricevuti.

## Endorsement (HR/Trainer)
Dashboard: `/manage/gamification` (solo HR Admin / Trainer).

- Sezione *Ultime iterazioni Practice Arena* mostra i tentativi più recenti: corso, titolo blocco, delta punteggio e token.
- Pulsante `Concedi endorsement` chiama `POST /api/arenas/{blockId}/attempts/{attemptId}/endorse`.
  - Aggiunge `endorsementBonus` token (di default 5) al tentativo e al progresso lezione del learner.
  - Il tentativo salva lo storico nella chiave `reflections.endorsements` (profileId, nome, timestamp).
  - La UI aggiorna badge "Endorsement n" e disabilita il pulsante.
- Tooltip HR: "Premia il piano con un endorsement: aggiunge X Insight Tokens e segnala agli altri che il contenuto è rilevante.".

> **Nota**: temporaneamente non blocchiamo l'endorsement se l'HR è anche autore del tentativo (utile per test). In produzione ripristinare il check commentato (`profile.id !== attemptOwnerId`).

## Dati principali
- `ScenarioAttempt`
  - `attemptType`: `'ARENA'` (vs `'SCENARIO'` per decision lab).
  - `score`: punteggio AI 0-100.
  - `insightTokens`: somma di base + improvement + endorsement.
  - `reflections`: JSON con `evaluation`, `previousScore`, `scoreDelta`, `tokensAwarded`, `endorsements`.
- `UserLessonProgress`
  - Aggiornato su ogni submit/endorsement (`pointsAwarded` incrementato dei token).
- Dashboard HR calcola metriche da questi dati (tentativi, media punteggio, miglioramento medio, iteration rate, total tokens).

## Testing rapido
1. Genera Practice Arena dal builder e assicurati che lo stato passi a `READY`.
2. Come learner invia un piano → verifica in DB (`ScenarioAttempt`, `userLessonProgress`).
3. Come HR apri `/manage/gamification`, premi `Concedi endorsement`, controlla token e DB.
4. Ricarica la pagina learner: la cronologia deve mostrare `Endorsement 1` e token maggiorati.

Per debug API usa `NEXT_PUBLIC_CLERK_DEBUG=true` e Prisma Studio (`npx prisma studio`) per ispezionare `ScenarioAttempt`.

## Variabili `.env` utili
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`: login utenti HR/learner.
- `OPENAI_GAMIFICATION_MODEL`: modello usato nell'AI generator (default `gpt-4.1-mini`).
- `NEXT_PUBLIC_APP_URL`: necessario per link/redirect corretti.

## TODO / evoluzioni possibili
- Reintrodurre il controllo per evitare auto-endorsement (vedi TODO nel component dashboard).
- Esporre gli endorsement anche lato learner con avatar/nomi.
- Opzionale: sincronizzare Insight Tokens nei punti globali e distinguere nelle analytics tramite tag.


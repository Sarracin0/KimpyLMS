# TODO - Funzionalità KimpyLMS

## 🎯 Priorità Alta

### 1. Sistema di Punteggi Quiz - Logica e Implementazione

**Stato Attuale Analizzato:**
- ✅ Quiz hanno `pointsReward` generale (ricompensa per completamento)
- ✅ Ogni `QuizQuestion` ha `points` (punti per domanda)
- ✅ Ogni `QuizOption` ha `points` (punti per opzione specifica)
- ✅ `QuizAnswer` ha `scoreAwarded` (punteggio effettivamente assegnato)

**Problemi Identificati:**
- ❌ Logica di calcolo punteggi non chiara nel codice
- ❌ Relazione tra punti domanda vs punti opzioni confusa
- ❌ Manca documentazione su come dovrebbe funzionare

**Proposta di Implementazione:**
```
Logica Suggerita:
1. Punti Domanda = Punteggio massimo ottenibile per quella domanda
2. Punti Opzioni = Punteggio parziale per opzioni specifiche (utile per domande multiple choice con punteggi graduali)
3. Calcolo finale: somma dei punti delle opzioni selezionate, limitato al massimo della domanda
4. Ricompensa Quiz = bonus aggiuntivo se si supera la soglia passScore
```

**Tasks:**
- [ ] Definire chiaramente la logica di scoring nel database
- [ ] Implementare algoritmo di calcolo punteggi
- [ ] Aggiornare quiz-player per mostrare punteggi in tempo reale
- [ ] Aggiungere validazione nel quiz-editor
- [ ] Documentare la logica per gli utenti

### 2. Team Management Avanzato

**Stato Attuale Analizzato:**
- ✅ Modelli `CompanyTeam` e `TeamMembership` esistenti
- ✅ Pagina `/manage/teams` funzionante per HR Admin
- ✅ Integrazione con Clerk users tramite `UserProfile.userId`

**Funzionalità da Implementare:**
- [ ] **Creazione Team da Team Management**
  - Migliorare form di creazione team
  - Aggiungere bulk assignment di utenti
  - Implementare import da CSV/Excel
  
- [ ] **Badge Team in add-participants-modal**
  - Modificare `add-participants-modal.tsx` per mostrare team badge
  - Aggiungere filtro per team
  - Implementare aggiunta rapida per team completi
  
- [ ] **Statistiche Team Aggregate**
  - Dashboard team con metriche aggregate
  - Progressi corsi per team
  - Punteggi gamification team
  - Leaderboard team vs team

**Database Updates Needed:**
```sql
-- Aggiungere campi per statistiche team
ALTER TABLE CompanyTeam ADD COLUMN totalCourseCompletions INT DEFAULT 0;
ALTER TABLE CompanyTeam ADD COLUMN averageQuizScore DECIMAL(5,2) DEFAULT 0;
ALTER TABLE CompanyTeam ADD COLUMN lastActivityAt TIMESTAMP;
```

### 3. Engagement Analytics - Momento WoW

**Obiettivo:** Dashboard completo per HR con focus sui punteggi gamification

**Funzionalità da Sviluppare:**
- [ ] **Dashboard Analytics Principale**
  - Metriche engagement per corso
  - Heatmap attività utenti
  - Trend completamento corsi
  - ROI formazione (tempo vs risultati)

- [ ] **Gamification Analytics**
  - Top performers per quiz
  - Distribuzione punteggi
  - Streak analysis
  - Badge distribution
  - Team vs individual performance

- [ ] **Reportistica Avanzata**
  - Export PDF/Excel reports
  - Scheduled reports via email
  - Custom date ranges
  - Drill-down capabilities

**Schema Database per Analytics:**
```sql
-- Tabella per metriche pre-calcolate
CREATE TABLE EngagementMetrics (
  id TEXT PRIMARY KEY,
  companyId TEXT NOT NULL,
  courseId TEXT,
  teamId TEXT,
  userId TEXT,
  metricType TEXT NOT NULL, -- 'completion_rate', 'avg_quiz_score', etc.
  value DECIMAL(10,2) NOT NULL,
  period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  calculatedAt TIMESTAMP DEFAULT NOW()
);
```

## 🎯 Priorità Media

### 4. Video Player Avanzato

**Ricerca Librerie Open Source:**
- [ ] **Valutare Opzioni:**
  - Video.js con plugin per note
  - Plyr.js con custom controls
  - ReactPlayer con overlay personalizzati
  - Custom solution con HTML5 video

**Funzionalità Target:**
- [ ] Note rapide con timestamp
- [ ] Bookmarks video
- [ ] Speed control avanzato
- [ ] Subtitle support
- [ ] Progress tracking granulare
- [ ] Interactive overlays
- [ ] Mobile-first design

**Integrazione Esistente:**
- Verificare compatibilità con YouTube embeds
- Mantenere tracking progresso attuale
- Integrazione con `UserLessonProgress`

### 5. Dashboard Gamification

**Funzionalità da Implementare:**
- [ ] **Aggregazione Quiz Utente**
  - Vista tutti quiz completati
  - Storico punteggi
  - Trend performance
  - Confronto con media aziendale

- [ ] **Sezione HR Admin**
  - Quiz con punteggi migliori
  - Utenti top performer
  - Quiz più difficili (basso completion rate)
  - Metriche engagement quiz

**UI/UX Design:**
- Dashboard cards con KPI
- Grafici interattivi (Chart.js/Recharts)
- Filtri avanzati (data, team, corso)
- Export capabilities

## 📦 Installazioni e Setup

### Librerie da Valutare/Installare:

**Per Analytics e Grafici:**
```bash
npm install recharts date-fns
npm install @tanstack/react-table  # Per tabelle avanzate
npm install react-export-table-to-excel  # Per export Excel
```

**Per Video Player:**
```bash
npm install video.js @videojs/themes
# oppure
npm install plyr-react
# oppure
npm install react-player
```

**Per UI Enhancements:**
```bash
npm install framer-motion  # Per animazioni
npm install react-hot-toast  # Già presente
npm install lucide-react  # Per icone aggiuntive
```

**Per File Processing:**
```bash
npm install papaparse @types/papaparse  # Per CSV import
npm install xlsx  # Per Excel import/export
```

## 🗄️ Database Schema Updates

### Nuove Tabelle Necessarie:

```sql
-- Video Notes
CREATE TABLE VideoNotes (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  lessonBlockId TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  note TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- Engagement Metrics (pre-calculated)
CREATE TABLE EngagementMetrics (
  id TEXT PRIMARY KEY,
  companyId TEXT NOT NULL,
  entityType TEXT NOT NULL, -- 'course', 'team', 'user'
  entityId TEXT NOT NULL,
  metricType TEXT NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  period TEXT NOT NULL,
  calculatedAt TIMESTAMP DEFAULT NOW()
);

-- Quiz Performance Cache
CREATE TABLE QuizPerformanceCache (
  id TEXT PRIMARY KEY,
  quizId TEXT NOT NULL,
  totalAttempts INTEGER DEFAULT 0,
  averageScore DECIMAL(5,2) DEFAULT 0,
  passRate DECIMAL(5,2) DEFAULT 0,
  lastUpdated TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Roadmap di Implementazione

### Fase 1 (Settimana 1-2):
1. ✅ Analisi sistema punteggi quiz
2. 🔄 Implementazione logica scoring corretta
3. 🔄 Miglioramenti Team Management

### Fase 2 (Settimana 3-4):
1. Dashboard Gamification base
2. Video player research e prototipo
3. Database schema updates

### Fase 3 (Settimana 5-6):
1. Engagement Analytics MVP
2. Video player implementation
3. Testing e refinement

### Fase 4 (Settimana 7-8):
1. Engagement Analytics completo (momento WoW)
2. Performance optimization
3. Documentation e training

## 📝 Note Tecniche

### Considerazioni Performance:
- Implementare caching per metriche analytics
- Usare background jobs per calcoli pesanti
- Ottimizzare query database con indici appropriati
- Implementare pagination per liste lunghe

### Sicurezza:
- Validare permessi per analytics (solo HR Admin)
- Sanitizzare input per note video
- Rate limiting per API analytics
- Audit log per azioni sensibili

### Monitoraggio:
- Metriche usage per nuove funzionalità
- Performance monitoring
- Error tracking
- User feedback collection

---

**Ultimo aggiornamento:** $(date)
**Prossima revisione:** Da programmare dopo Fase 1
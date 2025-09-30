# Course Builder - Migliorie Implementate

## Panoramica delle Modifiche

Sono state implementate quattro importanti migliorie al wizard di creazione corsi:

1. **Upload Video**: Opzione per caricare file video oltre all'inserimento di URL.
2. **Fix Accordion Bug**: Risoluzione del problema di chiusura accordion durante la digitazione.
3. **Persistenza completa**: CRUD per moduli, lezioni e blocchi con salvataggio immediato su Prisma.
4. **Toggle Publish Gerarchico**: Azioni esplicite per marcare draft/published lungo tutta la gerarchia.

## 🎥 Funzionalità Upload Video

### Componente VideoInput
**File**: `video-input.tsx`

**Caratteristiche**:
- **Toggle Mode**: L'utente può scegliere tra "Insert URL" e "Upload File"
- **Upload Integration**: Utilizza l'endpoint `chapterVideo` esistente di uploadthing
- **URL Support**: Mantiene il supporto per URL video (YouTube, Vimeo, etc.)
- **Visual Feedback**: Indicatori visivi per video caricati/inseriti
- **Clear Function**: Pulsante per rimuovere il video selezionato

**Implementazione**:
```typescript
// Toggle tra modalità upload e URL
const [mode, setMode] = useState<VideoInputMode>('url')

// Gestione upload con endpoint esistente
<FileUpload
  endpoint="chapterVideo"
  onChange={handleUploadComplete}
/>
```

### Integrazione nel ModuleAccordion
- **Sostituzione Input**: L'input URL video è stato sostituito con `VideoInput`
- **Gestione Stati**: Mantiene la compatibilità con la struttura dati esistente
- **UX Migliorata**: L'utente ha controllo completo su come aggiungere video

## 🔧 Fix Bug Accordion

### Problema Identificato
L'accordion si chiudeva durante la digitazione perché:
1. **Re-rendering**: Ogni cambio di stato causava re-rendering del componente
2. **State Loss**: L'accordion perdeva lo stato di apertura durante l'editing
3. **Event Handling**: I cambiamenti di stato interferivano con la gestione degli eventi

### Soluzione Implementata

#### 1. **Stati Controllati per Accordion**
```typescript
// Stati per gestire l'apertura degli accordion
const [openModuleId, setOpenModuleId] = useState<string | null>(module.id)
const [openLessonId, setOpenLessonId] = useState<string | null>(null)

// Accordion controllato con prevenzione chiusura
<Accordion 
  value={openModuleId === module.id ? module.id : undefined}
  onValueChange={(value) => {
    // Prevenire chiusura se stiamo editando
    if (isEditingModule || editingLesson || editingBlock) {
      return
    }
    setOpenModuleId(value === module.id ? module.id : null)
  }}
>
```

#### 2. **Gestione Focus e Refs**
```typescript
// Refs per gestire il focus e prevenire chiusura accidentale
const moduleInputRef = useRef<HTMLInputElement>(null)
const lessonInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
const blockInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

// Gestione focus per mantenere accordion aperto
const handleModuleFocus = () => {
  setOpenModuleId(module.id)
}

const handleLessonFocus = (lessonId: string) => {
  setOpenLessonId(lessonId)
  setOpenModuleId(module.id)
}
```

#### 3. **Delay per Stabilizzazione**
```typescript
// Delay per permettere al componente di stabilizzarsi
onBlur={() => {
  setTimeout(() => setIsEditingModule(false), 150)
}}

// Gestione aggiornamenti con prevenzione chiusura
const handleModuleUpdate = (field: keyof Module, value: string | boolean) => {
  onUpdateModule(module.id, { [field]: value })
  if (field === 'title' || field === 'description') {
    setTimeout(() => setIsEditingModule(false), 100)
  }
}
```

#### 4. **Prevenzione Chiusura Durante Editing**
```typescript
// Prevenire chiusura se stiamo editando
if (isEditingModule || editingLesson || editingBlock) {
  return
}
```

## 💾 Persistenza & API

### Cosa è stato fatto
- Collegamento diretto tra UI e API REST (`app/api/courses/[courseId]/modules/**`).
- Stato locale aggiornato in modo ottimistico e persistito su ogni blur/toggle.
- Sincronizzazione legacy automatica per mantenere la tabella `Chapter` allineata.

### Endpoints Principali
- `POST /modules`
- `PATCH` / `DELETE /modules/[moduleId]`
- `POST /modules/[moduleId]/lessons`
- `PATCH` / `DELETE /modules/[moduleId]/lessons/[lessonId]`
- `POST /modules/[moduleId]/lessons/[lessonId]/blocks`
- `PATCH` / `DELETE /modules/[moduleId]/lessons/[lessonId]/blocks/[blockId]`

Ogni rotta impone ruolo (`HR_ADMIN` o `TRAINER`) e ownership del corso.

### Bridge Legacy
- Campo `LessonBlock.legacyChapterId` per collegare blocchi video a `Chapter`.
- Helper `lib/sync-legacy-chapter.ts` invocato da tutte le mutazioni pertinenti.
- Script one-shot: `pnpm tsx scripts/sync-legacy-chapters.ts`.
- Comandi ricorrenti: `npx prisma migrate deploy` + `npx prisma generate`.
- Un capitolo è pubblicato solo se corso, modulo, lezione e blocco sono `isPublished = true`.

## 👁️ Toggle Publish Gerarchico

### Interazione UI
- Icone `Eye/EyeOff` su modulo, lezione e blocco dentro `ModuleAccordion`.
- Aggiornamento immediato dello stato locale e chiamata `PATCH` con il nuovo flag.
- Toast di conferma per feedback utente.

### Impatto Backend
- Il toggle dei blocchi video aggiorna o rimuove il relativo `Chapter`.
- Il toggle del corso (`publish/unpublish`) richiama `syncLegacyChaptersForCourse` per riallineare l'intera gerarchia.

## 🎯 Risultati Ottenuti

### Upload Video
- ✅ **Flessibilità**: L'utente può scegliere tra upload file o URL
- ✅ **Integrazione**: Utilizza l'infrastruttura uploadthing esistente
- ✅ **UX Intuitiva**: Toggle chiaro tra le due modalità
- ✅ **Feedback Visivo**: Indicatori chiari per stato upload/URL

### Fix Accordion Bug
- ✅ **Editing Stabile**: L'accordion rimane aperto durante la digitazione
- ✅ **Focus Management**: Gestione corretta del focus per tutti gli input
- ✅ **State Persistence**: Gli stati di apertura sono mantenuti durante l'editing
- ✅ **Keyboard Support**: Supporto completo per Escape e Enter

### Persistenza & Publish
- ✅ **Salvataggio Immediato**: Moduli, lezioni e blocchi vengono scritti su Prisma con feedback realtime.
- ✅ **Bridge Legacy**: I blocchi video popolano automaticamente `Chapter`, mantenendo la library attuale.
- ✅ **Toggle Consistenti**: I pulsanti publish/unpublish propagano lo stato lungo tutta la gerarchia.
- ✅ **Reversibilità**: Eliminazioni puliscono anche i capitoli legacy associati.

## 🔍 Spiegazione Tecnica del Bug

### Perché si verificava il bug:
1. **Re-rendering Chain**: Ogni `onChange` causava re-rendering → perdita stato accordion
2. **Uncontrolled Components**: Gli accordion non erano controllati, quindi perdevano lo stato
3. **Event Timing**: I cambiamenti di stato interferivano con la gestione degli eventi di apertura/chiusura

### Come è stato risolto:
1. **Controlled Accordion**: Utilizzo di `value` e `onValueChange` per controllo completo
2. **State Management**: Stati separati per gestire apertura moduli e lezioni
3. **Focus Handling**: Gestione esplicita del focus per mantenere accordion aperti
4. **Delay Strategy**: Timeout per permettere stabilizzazione del componente
5. **Prevention Logic**: Logica per prevenire chiusura durante editing attivo

## 📁 File Modificati

- ✅ **`video-input.tsx`**: Nuovo componente per gestione video
- ✅ **`module-accordion.tsx`**: Refactoring completo + toggle publish + integrazione `VideoInput`
- ✅ **`curriculum-manager.tsx`**: Stato centralizzato + orchestrazione chiamate API
- ✅ **`app/api/courses/[courseId]/modules/**`**: CRUD completo con sync legacy
- ✅ **`lib/sync-legacy-chapter.ts` & migrazione**: Bridge verso `Chapter`

## 🚀 Benefici

1. **UX Migliorata**: Editing fluido senza interruzioni
2. **Flessibilità Video**: Supporto completo per upload e URL
3. **Persistenza Affidabile**: Dati salvati in tempo reale con feedback chiaro
4. **Compatibilità Learner**: I contenuti appaiono subito nella library attuale
5. **Performance**: Gestione ottimizzata degli stati e re-rendering
6. **Accessibilità**: Supporto keyboard completo (Escape, Enter)

Le modifiche mantengono la compatibilità con la struttura esistente mentre offrono un'esperienza utente significativamente migliorata! 🎉

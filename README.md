# Valuta Casa — Roma vs OMI

Servizio web: incolli un link Idealista/Immobiliare (o dati a mano) → opinione di
Claude basata sui valori OMI ufficiali (Agenzia Entrate, II sem 2025), con
benchmark aggiustato per stato/piano e rendimento affitto netto reale.

Protetto da password condivisa. La Claude API key sta solo nel backend.

## Come funziona
Frontend e backend sono divisi in moduli piccoli e mirati — modificare una
feature significa toccare un file da 30-90 righe, non un blob da 270.

- `index.html` — markup puro (form + risultato), carica CSS/JS come asset statici
  - `css/style.css` — stili (glass-card, mesh-background, gauge-bar, chips, rendimento)
  - `js/app.js` — entry point: wiring, password, parsing `?d=`, fetch `/api/valuta`
  - `js/zones.js` — deriva la lista zone (autocomplete) dal JSON OMI via `fetch()`
  - `js/markdown.js`, `js/verdict.js`, `js/result-view.js` — rendering risultato
    (badge, zona+fiducia, chips caratteristiche, gauge OMI, breakdown rendimento)
- `api/valuta.js` — handler HTTP sottile: password → rate limit → orchestrazione
  - `api/_lib/zones.js` — **fonte canonica unica** per la lista zone (deriva dal
    JSON OMI; backend, frontend ed estensione derivano tutti da qui)
  - `api/_lib/extract.js` — estrazione da HTML fetchato: JSON portale
    (`__NEXT_DATA__` immobiliare.it, `utag_data` idealista) → JSON-LD → regex.
    Estrae anche caratteristiche (piano/stato/ascensore/anno/classe) e lat/lng.
  - `api/_lib/geo.js` — geocoding best-effort Nominatim (OSM): quartiere +
    municipio + via dalle coordinate → zona OMI molto più precisa. Ogni errore
    ritorna null e la valutazione procede senza.
  - `api/_lib/claude.js` — prompt + chiamata Claude API (vision per foto e
    planimetrie). Claude ritorna solo CLASSIFICAZIONI: ZONA/FIDUCIA/ZONA_ALT/STATO.
  - `api/_lib/valuation.js` — math deterministica (benchmark aggiustato per
    stato/piano, sconto, rendimento lordo E netto con cedolare/IMU/sfitto/costi
    d'acquisto — **non spostare a Claude**, vedi commento di testa nel file).
    Le assunzioni economiche sono tutte nel `CONFIG` in testa: ritocca lì.
  - `api/_lib/omi-prompt.js` — blocco dati OMI per il prompt, precomputato 1 volta
- `estensione/` — estensione Chrome (estrae da annunci live, vedi sezione sotto)
- `data/omi_roma_compatto.json` — valori OMI 211 zone Roma (fonte-verità unica:
  backend, frontend ed estensione derivano la lista zone da QUESTO file)

## Perché la valutazione è più precisa (v2)
1. **Zona**: coordinate GPS dal portale (o geocoding dell'indirizzo) → quartiere
   OSM nel prompt → Claude sceglie la zona OMI con FIDUCIA dichiarata e zona
   alternativa se indeciso.
2. **Stato**: OMI censisce lo stato NORMALE. Claude classifica lo stato reale
   (foto > dichiarato) e il backend corregge il benchmark (±10/−18%), più
   correzione seminterrato/piano terra. Correzioni visibili nella UI.
3. **Rendimento**: non più lordo secco — netto con sfitto 1 mese, cedolare 21%,
   IMU (zero se prima casa), manutenzione, e costo totale d'ingresso (registro,
   notaio, agenzia, ristrutturazione se da rifare) come denominatore.

## Estensione Chrome
Su un annuncio live, un click estrae prezzo/mq/zona/foto/planimetrie +
caratteristiche strutturate + coordinate GPS (browser reale → IP residenziale,
supera i blocchi anti-scraping) e apre il servizio precompilato.

- `estensione/extractor.src.js` — **file da editare** per modifiche all'estrazione
  (leggibile, syntax-highlight, lint). Contiene un placeholder `ZONE_NAMES` —
  `chrome.scripting.executeScript({func:...})` richiede una funzione
  autocontenuta (MV3 inietta il testo sorgente, niente `import`/closure esterne),
  quindi l'array zone deve restare un letterale dentro la funzione.
- `estensione/generated/extractor.inject.js` — **generato, non editare a mano**.
  `npm run sync-extension` legge `extractor.src.js` + deriva l'array zone da
  `omi_roma_compatto.json` (via `api/_lib/zones.js`) e produce questo file.
  `background.js` lo carica con `importScripts()`. NB: la cartella si chiama
  `generated` SENZA underscore — Chrome rifiuta estensioni unpacked con
  directory `_*` (riservate al sistema).

**PAIRED FILE**: `extractor.src.js` e `api/_lib/extract.js` implementano la
*stessa* estrazione (prezzo/mq/zona/foto/caratteristiche/geo) indipendentemente —
una gira su `document` live nella pagina, l'altra su HTML fetchato server-side
(API diverse per vincolo di piattaforma, non scelta). Se trovi un bug di
estrazione, controlla **entrambi** i file: tendono a manifestarsi in coppia.

## Deploy su Vercel (una volta)
1. Push questo repo su GitHub.
2. vercel.com → Add New → Project → importa il repo.
3. **Environment Variables** (Settings → Environment Variables), aggiungi:
   - `ANTHROPIC_API_KEY` = la tua chiave (console.anthropic.com)
   - `APP_PASSWORD` = una password a tua scelta (la condividi coi fidati)
   - `SCRAPERAPI_KEY` = (opzionale) per scraping server-side di portali blindati;
     con l'estensione di solito non serve
4. Deploy. Avrai un URL tipo `valuta-casa.vercel.app`.

## Sicurezza / costi
- Senza password corretta → nessuna chiamata a Claude → nessun costo.
- Rate limit: 30 richieste/IP/giorno (in `api/valuta.js`, `LIMIT_PER_DAY`).
- Modelli: Haiku per testo (~mezzo centesimo), Sonnet quando ci sono foto/
  planimetrie (qualche centesimo — è dove si gioca l'accuratezza dello stato).
- Geocoding: Nominatim OSM, gratuito, nessuna chiave (best-effort, con cache).
- **Metti un tetto di spesa** sulla console Anthropic per sicurezza.

## Aggiornare i dati OMI
Sostituisci `data/omi_roma_compatto.json`, poi:

1. `npm run sync-extension` — rigenera `estensione/generated/extractor.inject.js`
   con la nuova lista zone (altrimenti l'estensione resta sui nomi vecchi).
2. Ricarica l'estensione in `chrome://extensions` (icona ↻ su "Valuta Casa").
3. Ri-pusha — Vercel ri-deploya da solo (backend e frontend derivano la lista
   zone a runtime dal JSON, nessun altro passo manuale serve per loro).

La stessa rigenerazione serve anche se editi `estensione/extractor.src.js`
(il placeholder `ZONE_NAMES` va re-iniettato nel file generato).

## Ritoccare le assunzioni economiche
Tutto in `api/_lib/valuation.js` → `CONFIG` (commentato riga per riga):
fattori stato/piano, €/mq ristrutturazione, aliquote registro/IMU/cedolare,
mesi di sfitto, soglie AFFARE/CARO. Modifica → push → Vercel ri-deploya.

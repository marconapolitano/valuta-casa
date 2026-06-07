# Valuta Casa — Roma vs OMI

Servizio web: incolli un link Idealista (o dati a mano) → opinione di Claude
basata sui valori OMI ufficiali (Agenzia Entrate, II sem 2025).

Protetto da password condivisa. La Claude API key sta solo nel backend.

## Come funziona
- `index.html` — frontend (campo link + password + risultato)
- `api/valuta.js` — funzione serverless: password → estrai dati → OMI → Claude → opinione
- `data/omi_roma_compatto.json` — valori OMI 211 zone Roma

## Deploy su Vercel (una volta)
1. Push questo repo su GitHub.
2. vercel.com → Add New → Project → importa il repo.
3. **Environment Variables** (Settings → Environment Variables), aggiungi:
   - `ANTHROPIC_API_KEY` = la tua chiave (console.anthropic.com)
   - `APP_PASSWORD` = una password a tua scelta (la condividi coi fidati)
4. Deploy. Avrai un URL tipo `valuta-casa.vercel.app`.

## Sicurezza / costi
- Senza password corretta → nessuna chiamata a Claude → nessun costo.
- Rate limit: 30 richieste/IP/giorno (in `api/valuta.js`, `LIMIT_PER_DAY`).
- Modello: Claude Haiku (~mezzo centesimo a valutazione).
- **Metti un tetto di spesa** sulla console Anthropic per sicurezza.

## Aggiornare i dati OMI
Sostituisci `data/omi_roma_compatto.json` e ri-pusha (Vercel ri-deploya da solo).

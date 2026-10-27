# Specchietto titoli

PWA per seguire prezzo e andamento dei titoli investiti e osservati, da telefono e PC.
Nessuna build: file statici pubblicati su Vercel, dati letti da Supabase (progetto `consumi-casa`, schema `finanza`).

## Cosa mostra
Per ogni titolo, diviso tra **Investiti** e **Osservati**:
- nome, tipologia, ISIN e data d'inizio osservazione;
- valore attuale in euro, con data e ora della quotazione (per i fondi, la data del NAV);
- variazione dall'inizio (sul prezzo unitario) e variazione dell'ultimo giorno;
- andamento degli ultimi 4 mesi, con la linea tratteggiata del prezzo d'inizio.

Nessun importo investito: l'app non mostra dati riservati.

## Da dove arrivano i dati
| Componente | Ruolo |
|---|---|
| `finanza.titoli` | Elenco titoli: nome, tipologia, ISIN, stato, data d'inizio, fonte, simbolo, divisore (es. oncia → grammo) |
| `finanza.quotazioni`, `finanza.storico`, `finanza.cache` | Ultimi prezzi, storico BTP, JSON pronto |
| Funzione `finanza-widget` | Prezzi da Yahoo Finance (fondi, ETF, oro, crypto) e Borsa Italiana (BTP), conversione in EUR, variazioni |
| Cron `finanza-widget` | Aggiorna ogni 30 minuti |

L'app chiama `https://qgwrdiioqozxhxncblly.supabase.co/functions/v1/finanza-widget`
(`?refresh=1` dal pulsante Aggiorna, al massimo un aggiornamento ogni 2 minuti).
I titoli si aggiungono o modificano nella tabella `finanza.titoli`: l'app non va toccata.

## File
| File | Ruolo |
|---|---|
| `index.html` | Pagina unica |
| `app.js` | Lettura dati, grafici, copia offline |
| `styles.css` | Stile, tema chiaro e scuro |
| `sw.js` | Service worker per l'uso offline |
| `manifest.webmanifest`, `icons/` | Installazione come app |

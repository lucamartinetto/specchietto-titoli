// Specchietto titoli — logica dell'app (nessuna build, nessuna dipendenza)

(() => {
  const API = "https://qgwrdiioqozxhxncblly.supabase.co/functions/v1/finanza-widget";
  const STORE = "specchietto-titoli:ultimo";
  const TZ = "Europe/Rome";
  const TIPI = { azione:"Azione", etf:"ETF", fondo:"Fondo", obbligazione:"Obbligazione", materiale:"Materia prima", crypto:"Crypto" };

  const $ = (id) => document.getElementById(id);
  let lastData = null, lastLoad = 0, busy = false;

  // ---------- formattazione ----------
  const dayFmt = new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"});
  const hm = new Intl.DateTimeFormat("it-IT",{timeZone:TZ,hour:"2-digit",minute:"2-digit"});
  const dm = new Intl.DateTimeFormat("it-IT",{timeZone:TZ,day:"2-digit",month:"2-digit"});
  const dmy = (iso) => { const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; };
  const romeDay = (d) => dayFmt.format(d);
  const daysBetween = (a,b) => Math.round((Date.parse(b+"T00:00:00Z") - Date.parse(a+"T00:00:00Z"))/86400000);
  function eur(v){
    if (v == null) return "—";
    const big = Math.abs(v) >= 10000;
    return new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",minimumFractionDigits:big?0:2,maximumFractionDigits:big?0:2}).format(v);
  }
  function pct(v, digits=2){
    if (v == null || !isFinite(v)) return "—";
    const s = new Intl.NumberFormat("it-IT",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Math.abs(v));
    if (Math.abs(v) < 0.005) return "0,00 %";
    return (v > 0 ? "+" : "−") + s + " %";
  }
  const dir = (v) => v == null || Math.abs(v) < 0.005 ? "flat" : (v > 0 ? "up" : "down");
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ---------- sparkline ----------
  function spark(item){
    const pts = (item.serie || []).filter(p => Array.isArray(p) && isFinite(p[1]));
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS,"svg");
    svg.setAttribute("viewBox","0 0 128 40"); svg.setAttribute("preserveAspectRatio","none");
    svg.setAttribute("class","spark"); svg.setAttribute("role","img");
    if (pts.length < 2){ svg.setAttribute("aria-label","Andamento non ancora disponibile"); return svg; }
    const vals = pts.map(p=>p[1]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const start = item.prezzo_inizio_eur;
    if (hi - lo < 1e-9){ lo -= 1; hi += 1; }
    const pad = (hi-lo)*0.12; lo -= pad; hi += pad;
    const x = (i) => 2 + i*(124/(pts.length-1));
    const y = (v) => 3 + (1-(v-lo)/(hi-lo))*34;
    const d = pts.map((p,i)=>(i?"L":"M")+x(i).toFixed(1)+" "+y(p[1]).toFixed(1)).join(" ");
    const first = vals[0], last = vals[vals.length-1];
    const trend = item.var_inizio_pct != null ? item.var_inizio_pct : (last-first);
    const color = trend > 0.005 ? "var(--up)" : trend < -0.005 ? "var(--down)" : "var(--muted)";
    const area = document.createElementNS(NS,"path");
    area.setAttribute("d", d+` L${x(pts.length-1).toFixed(1)} 40 L${x(0).toFixed(1)} 40 Z`);
    area.setAttribute("fill",color); area.setAttribute("fill-opacity","0.12");
    svg.appendChild(area);
    if (start != null && start > lo && start < hi){
      const r = document.createElementNS(NS,"line");
      r.setAttribute("x1","0"); r.setAttribute("x2","128"); r.setAttribute("y1",y(start)); r.setAttribute("y2",y(start));
      r.setAttribute("class","ref"); svg.appendChild(r);
    }
    const ln = document.createElementNS(NS,"path");
    ln.setAttribute("d",d); ln.setAttribute("class","ln"); ln.setAttribute("stroke",color);
    ln.setAttribute("vector-effect","non-scaling-stroke"); svg.appendChild(ln);
    const dot = document.createElementNS(NS,"circle");
    dot.setAttribute("cx",x(pts.length-1)); dot.setAttribute("cy",y(last)); dot.setAttribute("r","2.6"); dot.setAttribute("fill",color);
    svg.appendChild(dot);
    svg.setAttribute("aria-label",`Andamento ultimi ${daysBetween(pts[0][0],pts[pts.length-1][0])} giorni, da ${eur(first)} a ${eur(last)}`);
    return svg;
  }

  // ---------- righe ----------
  function priceWhen(item){
    if (!item.prezzo_del) return { text:"orario non disponibile", old:false };
    const d = new Date(item.prezzo_del), today = romeDay(new Date()), day = romeDay(d);
    const lag = daysBetween(day, today);
    const isNav = item.tipologia === "fondo";
    if (isNav) return { text:`NAV del ${dm.format(d)}`, old: lag > 4 };
    if (lag === 0) return { text:`oggi ${hm.format(d)}`, old:false };
    return { text:`del ${dm.format(d)} ${hm.format(d)}`, old: lag > 3 };
  }

  function row(item){
    const r = el("div","row"); r.tabIndex = 0;
    const info = el("div","info");
    info.appendChild(el("div","name",item.nome));
    const meta = el("div","meta");
    meta.appendChild(el("span","chip",TIPI[item.tipologia] || item.tipologia));
    meta.appendChild(el("span",null,(item.stato === "investito" ? "investito dal " : "osservato dal ") + dmy(item.data_inizio)));
    if (item.isin) meta.appendChild(el("span","isin",item.isin));
    info.appendChild(meta);
    r.appendChild(info);
    r.appendChild(spark(item));

    const val = el("div","val");
    const w = priceWhen(item);
    const priceLine = el("div","price",eur(item.prezzo_eur));
    val.appendChild(priceLine);
    val.appendChild(el("div","when"+(w.old?" old":""),w.text));
    const deltas = el("div","deltas");
    if (item.var_giorno_pct != null){
      const t = el("span","today","1g ");
      t.appendChild(el("span",dir(item.var_giorno_pct),pct(item.var_giorno_pct)));
      deltas.appendChild(t);
    }
    if (item.var_inizio_pct != null){
      const p = el("span","pill "+dir(item.var_inizio_pct),pct(item.var_inizio_pct));
      p.title = "Variazione dall'inizio osservazione";
      deltas.appendChild(p);
    } else {
      deltas.appendChild(el("span","pill wait","in attesa"));
    }
    val.appendChild(deltas);
    r.appendChild(val);

    const sl = el("div","startline");
    const s1 = el("span",null,"Inizio ");
    if (item.prezzo_inizio_eur != null){
      s1.appendChild(el("span","mono",eur(item.prezzo_inizio_eur)));
      s1.appendChild(document.createTextNode(" · " + (item.prezzo_inizio_nota || (item.prezzo_inizio_data ? "del " + dmy(item.prezzo_inizio_data) : ""))));
    } else {
      s1.appendChild(document.createTextNode(item.tipologia === "fondo"
        ? `· in attesa del primo NAV dal ${dmy(item.data_inizio)}`
        : `· in attesa della prima chiusura dal ${dmy(item.data_inizio)}`));
    }
    sl.appendChild(s1);
    if (item.unita) sl.appendChild(el("span",null,"Prezzo " + item.unita));
    if (item.valuta_orig && item.valuta_orig !== "EUR" && item.prezzo_orig != null){
      sl.appendChild(el("span",null,`${new Intl.NumberFormat("it-IT",{maximumFractionDigits:2}).format(item.prezzo_orig)} ${item.valuta_orig} al cambio ${new Intl.NumberFormat("it-IT",{maximumFractionDigits:4}).format(item.cambio)}`));
    }
    r.appendChild(sl);
    if (item.errore) r.appendChild(el("div","err","Ultimo aggiornamento non riuscito: " + item.errore + ". Mostro l'ultimo valore disponibile."));

    r.setAttribute("aria-label", `${item.nome}: ${eur(item.prezzo_eur)}, ${item.var_inizio_pct != null ? pct(item.var_inizio_pct) + " dall'inizio" : "variazione in attesa"}`);
    return r;
  }

  function render(data, cachedAt){
    lastData = data;
    const items = data.items || [];
    for (const g of ["investito","osservato"]){
      const list = $("l-"+g), sel = items.filter(i => i.stato === g);
      list.replaceChildren(...sel.map(row));
      $("g-"+g).hidden = sel.length === 0;
      $("c-"+g).textContent = sel.length === 1 ? "1 titolo" : sel.length + " titoli";
    }
    const ts = new Date(data.ultimo_aggiornamento || cachedAt || data.generato_il);
    const ageMin = (Date.now() - ts) / 60000;
    const st = $("stamp");
    st.className = "stamp" + (ageMin > 75 ? " old" : "");
    st.replaceChildren(document.createTextNode("Aggiornato "), el("b",null,
      romeDay(ts) === romeDay(new Date()) ? "oggi alle " + hm.format(ts) : dm.format(ts) + " alle " + hm.format(ts)),
      document.createTextNode(" · si aggiorna ogni 30 min"));

    const notes = $("notes"); notes.replaceChildren(notes.firstElementChild);
    for (const i of items){
      if (i.tipologia === "obbligazione") notes.appendChild(el("div",null,`${i.nome}: corso secco di Borsa Italiana (MOT); la variazione non include le cedole incassate né il premio fedeltà.`));
      if (i.tipologia === "materiale" && /oro/i.test(i.nome)) notes.appendChild(el("div",null,"Oro: prezzo al grammo in euro, ricavato dal future COMEX (contratto più vicino, in dollari per oncia troy da 31,1035 g); segue da vicino il prezzo spot."));
    }
    const provv = items.filter(i => i.inizio_provvisorio && i.prezzo_inizio_eur != null);
    if (provv.length) notes.appendChild(el("div",null,`Prezzo d'inizio provvisorio per ${provv.map(i => i.nome).join(", ")}: diventa definitivo con la chiusura del giorno di inizio.`));
  }

  function showStatus(kind, title, text){
    const s = $("status");
    if (!kind){ s.hidden = true; s.replaceChildren(); return; }
    s.hidden = false; s.className = "notice" + (kind === "bad" ? " bad" : "");
    s.replaceChildren(el("strong",null,title), el("div",null,text));
  }

  // ---------- dati ----------
  // La funzione Supabase restituisce il JSON pronto; se i prezzi hanno più di 25 minuti li aggiorna prima di rispondere.
  async function fetchData(force){
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(API + (force ? "?refresh=1" : ""), { cache:"no-store", signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      if (!j || !Array.isArray(j.items)) throw new Error(j && j.errore ? j.errore : "risposta inattesa");
      return j;
    } finally { clearTimeout(t); }
  }

  function saveLocal(data){ try { localStorage.setItem(STORE, JSON.stringify(data)); } catch(e){} }
  function readLocal(){ try { const s = localStorage.getItem(STORE); return s ? JSON.parse(s) : null; } catch(e){ return null; } }

  async function load(force){
    if (busy) return;
    busy = true;
    const b = $("refresh");
    if (force){ b.disabled = true; b.classList.add("spin"); b.querySelector("span").textContent = "Aggiorno…"; }
    try {
      const data = await fetchData(force);
      lastLoad = Date.now();
      showStatus(null);
      render(data);
      saveLocal(data);
    } catch(e){
      const offline = navigator.onLine === false;
      const title = offline ? "Sei offline" : "Aggiornamento non riuscito";
      const msg = offline ? "Riprovo appena torna la connessione."
        : (e && e.name === "AbortError" ? "Il server non ha risposto in tempo." : "Il server delle quotazioni non risponde (" + String(e && e.message || e).slice(0,120) + ").");
      showStatus("bad", title, lastData ? msg + " Intanto vedi gli ultimi valori salvati." : msg + " Premi Aggiorna per riprovare.");
    } finally {
      busy = false;
      if (force){ b.disabled = false; b.classList.remove("spin"); b.querySelector("span").textContent = "Aggiorna"; }
    }
  }

  $("refresh").addEventListener("click", () => load(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastLoad > 120000) load(false);
  });
  window.addEventListener("online", () => load(false));
  setInterval(() => { if (document.visibilityState === "visible") load(false); }, 5*60000);

  const cached = readLocal();
  if (cached) render(cached);
  load(false);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();

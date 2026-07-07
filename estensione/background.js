// Al click sull'icona: esegue l'estrattore nella pagina attiva (browser reale,
// IP residenziale → non bloccato), riceve dati+foto, apre il servizio.
//
// `estrai` arriva da generated/extractor.inject.js (caricato qui sotto via
// importScripts — l'API storica dei service worker MV3 classici, disponibile
// perché il manifest non dichiara "type":"module"). Quel file è generato da
// extractor.src.js + l'array zone derivato da data/omi_roma_compatto.json:
// "npm run sync-extension" lo rigenera dopo modifiche a uno dei due. File
// sorgente da editare: estensione/extractor.src.js — NON generated/*.
// NB: la cartella si chiama "generated" SENZA underscore iniziale: Chrome
// rifiuta di caricare estensioni unpacked con directory che iniziano per "_"
// (riservate al sistema, tipo _locales).
importScripts("generated/extractor.inject.js");

const SERVICE = "https://valuta-casa.vercel.app/";

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https?:/.test(tab.url || "")) return;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: estrai,           // funzione iniettata, gira nella pagina
    });
    const d = res?.result;
    if (!d) return;
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(d))));
    chrome.tabs.create({ url: SERVICE + "?d=" + encodeURIComponent(enc) });
  } catch (e) {
    chrome.tabs.create({ url: SERVICE });
  }
});


// Genera estensione/generated/extractor.inject.js da extractor.src.js.
//
// Perché serve: chrome.scripting.executeScript({func: estrai}) richiede una
// funzione autocontenuta — niente import, l'array zone DEVE essere un letterale
// dentro estrai(). Questo script chiude il cerchio: legge l'array dalla fonte
// canonica (api/_lib/zones.js + data/omi_roma_compatto.json, le stesse usate da
// backend e frontend) e lo splicizza nel placeholder di extractor.src.js — così
// non serve più copiarlo a mano (era l'origine delle 2 copie morte eliminate
// in Stage 2: stesso set, stesso ordine, verificato byte-per-byte).
//
// Uso: npm run sync-extension (esegui dopo modifiche a omi_roma_compatto.json
// o a extractor.src.js, poi ricarica l'estensione unpacked in chrome://extensions)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import omiData from "../data/omi_roma_compatto.json" with { type: "json" };
import { deriveZoneNames } from "../api/_lib/zones.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "estensione", "extractor.src.js");
// "generated" SENZA underscore: Chrome rifiuta estensioni unpacked con
// directory "_*" (riservate al sistema, tipo _locales).
const OUT_DIR = join(ROOT, "estensione", "generated");
const OUT = join(OUT_DIR, "extractor.inject.js");

const PLACEHOLDER = /\/\*__ZONE_NAMES__\*\/\[\]/;

const zoneNames = deriveZoneNames(omiData);
const src = readFileSync(SRC, "utf8");

if (!PLACEHOLDER.test(src)) {
  console.error(`Placeholder /*__ZONE_NAMES__*/[] non trovato in ${SRC} — extractor.src.js è cambiato? Aggiorna questo script.`);
  process.exit(1);
}

const generated = src.replace(PLACEHOLDER, JSON.stringify(zoneNames));

const header = `// FILE GENERATO — non editare a mano. Modifica estensione/extractor.src.js
// e rilancia "npm run sync-extension" (o data/omi_roma_compatto.json per
// aggiornare l'array zone). Caricato da background.js via importScripts().
//
// Generato da scripts/sync-extension.mjs il ${new Date().toISOString().slice(0, 10)}
// — ${zoneNames.length} zone da data/omi_roma_compatto.json.

`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, header + generated);

console.log(`OK: ${OUT}`);
console.log(`${zoneNames.length} zone splicizzate nel placeholder ZONE_NAMES.`);

// ── bookmarklet + comando rapido iOS ────────────────────────────────────────
// Stesso estrattore in due impacchettamenti:
// - BOOKMARKLET: javascript: URI per la barra preferiti (qualsiasi desktop)
// - SHORTCUT_JS: corpo per l'azione "Esegui JavaScript su pagina web" dei
//   Comandi Rapidi iOS (foglio di condivisione — su iPhone è il metodo
//   affidabile; incollare 10KB nel campo URL di un segnalibro Safari no).
// ZONE_NAMES vuoto (il backend risolve la zona con GPS+poligoni/geocoding,
// l'array peserebbe 6KB). Nessun auto-invio: la pagina valuta aspetta conferma.
//
// NON scritti in file statici pubblici: finiscono in api/_lib/bookmarklet.gen.js
// e li serve /api/strumenti SOLO con la password giusta (pagina Strumenti gated).
const SERVICE = "https://valuta-casa.vercel.app/";
const slim = src
  .replace(PLACEHOLDER, "[]")
  .split("\n")
  .filter((l) => !/^\s*\/\//.test(l) && l.trim() !== "")
  .join("\n");
const redirect = `var d=estrai();d.src="bookmarklet";location.href="${SERVICE}?d="+encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(d)))))`;
const bookmarklet = "javascript:void function(){" + slim + ";" + redirect + "}();";
const shortcutJs = slim + ";\n" + redirect + ";\ncompletion();";
const GEN_OUT = join(ROOT, "api", "_lib", "bookmarklet.gen.js");
writeFileSync(GEN_OUT,
  `// FILE GENERATO da scripts/sync-extension.mjs — non editare a mano.
// Servito SOLO da /api/strumenti dietro password (niente asset statici pubblici).
export const BOOKMARKLET = ${JSON.stringify(bookmarklet)};
export const SHORTCUT_JS = ${JSON.stringify(shortcutJs)};
`);
console.log(`OK: ${GEN_OUT} (bookmarklet ${(bookmarklet.length / 1024).toFixed(1)} KB)`);

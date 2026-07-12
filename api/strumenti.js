// Serverless function (Vercel): consegna bookmarklet e comando rapido iOS
// SOLO a chi ha la password — la pagina /strumenti.html è un guscio vuoto
// finché questa API non risponde. Niente codici in asset statici pubblici.

import { BOOKMARKLET, SHORTCUT_JS } from "./_lib/bookmarklet.gen.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { password } = req.body || {};
  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD)
    return res.status(401).json({ error: "Password errata" });
  return res.status(200).json({ bookmarklet: BOOKMARKLET, shortcut: SHORTCUT_JS });
}

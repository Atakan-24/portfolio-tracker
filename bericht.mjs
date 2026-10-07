#!/usr/bin/env node
// Kurzbericht auf Abruf: wer war auf der Portfolio-Seite, von wo, worauf geklickt.
// Owner-only report of historical records; visitor metadata may contain personal information.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));

export function ladeEnv() {
  const envPfad = path.join(HIER, ".env.local");
  const inhalt = fs.existsSync(envPfad) ? fs.readFileSync(envPfad, "utf8") : '';
  const werte = {};
  for (const zeile of inhalt.split("\n")) {
    const m = zeile.match(/^([A-Z_]+)=(.*)$/);
    if (m) werte[m[1]] = m[2].trim();
  }
  return { ...werte, ...process.env };
}

export function tageArg(argv = process.argv) {
  const arg = argv.find((a) => a.startsWith("--tage="));
  const n = arg ? Number(arg.split("=")[1]) : 7;
  if (!Number.isInteger(n) || n < 1 || n > 365) throw new Error('--tage requires 1 to 365 whole days');
  return n;
}

export function ownerConfig(env) {
  const url = new URL(env.SUPABASE_URL || '');
  if (url.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) ||
      url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use the HTTPS origin of your hosted Supabase project');
  }
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Historical logs require owner access via SUPABASE_SERVICE_ROLE_KEY');
  return { origin: url.origin, key };
}

export function display(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, 500);
}

function zaehleUnd(sortiert, feld) {
  const zaehler = new Map();
  for (const zeile of sortiert) {
    const wert = zeile[feld] || "unbekannt";
    zaehler.set(wert, (zaehler.get(wert) || 0) + 1);
  }
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1]);
}

export async function main() {
  const env = ladeEnv();
  const config = ownerConfig(env);
  const tage = tageArg();
  const seit = new Date(Date.now() - tage * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL('/rest/v1/portfolio_visits', config.origin);
  url.search = new URLSearchParams({select:'event_type,country,region,referrer,click_target,created_at',
    created_at:`gte.${seit}`,order:'created_at.desc',limit:'1000'}).toString();
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Abfrage fehlgeschlagen: HTTP ${res.status}`);
  }
  const zeilen = await res.json();
  if (!Array.isArray(zeilen)) throw new Error('Unexpected report response');

  const pageviews = zeilen.filter((z) => z.event_type === "pageview");
  const clicks = zeilen.filter((z) => z.event_type === "click");

  console.log(`Portfolio-Besucher — letzte ${tage} Tage`);
  console.log(`(Quelle: ${config.origin}, Tabelle portfolio_visits)`);
  if (zeilen.length === 1000) console.log('Hinweis: auf 1000 Datensätze begrenzt; keine vollständigen Gesamtsummen.');
  console.log("");
  console.log(`Seitenaufrufe: ${pageviews.length}`);
  console.log(`Klicks auf Links: ${clicks.length}`);

  if (pageviews.length === 0 && clicks.length === 0) {
    console.log("");
    console.log("Keine Besuche im Zeitraum — kein Fehler, es war einfach niemand da.");
    return;
  }

  console.log("");
  console.log("Länder (Seitenaufrufe):");
  for (const [land, n] of zaehleUnd(pageviews, "country")) {
    console.log(`  ${display(land)}: ${n}`);
  }

  console.log("");
  console.log("Top-Referrer (Seitenaufrufe):");
  for (const [ref, n] of zaehleUnd(pageviews, "referrer").slice(0, 10)) {
    console.log(`  ${display(ref)}: ${n}`);
  }

  if (clicks.length > 0) {
    console.log("");
    console.log("Meistgeklickte Links:");
    for (const [ziel, n] of zaehleUnd(clicks, "click_target").slice(0, 10)) {
      console.log(`  ${display(ziel)}: ${n}`);
    }
  }

  console.log("");
  console.log("Letzte 10 Besuche:");
  for (const z of zeilen.slice(0, 10)) {
    const wo = z.country ? `${display(z.country)}${z.region ? " / " + display(z.region) : ""}` : "Land unbekannt";
    const von = display(z.referrer) || "direkt/kein Referrer";
    if (z.event_type === "pageview") {
      console.log(`  ${display(z.created_at)}  Aufruf   ${wo}  von: ${von}`);
    } else {
      console.log(`  ${display(z.created_at)}  Klick    ${wo}  auf: ${display(z.click_target)}  von: ${von}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(err.message); process.exitCode = 1; });
}

#!/usr/bin/env node
// Kurzbericht auf Abruf: wer war auf der Portfolio-Seite, von wo, worauf geklickt.
// Speichert/liest keine IP und keinen Namen -- siehe README.md in diesem Ordner.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));

function ladeEnv() {
  const envPfad = path.join(HIER, ".env.local");
  const inhalt = fs.readFileSync(envPfad, "utf8");
  const werte = {};
  for (const zeile of inhalt.split("\n")) {
    const m = zeile.match(/^([A-Z_]+)=(.*)$/);
    if (m) werte[m[1]] = m[2].trim();
  }
  return werte;
}

function tageArg() {
  const arg = process.argv.find((a) => a.startsWith("--tage="));
  const n = arg ? Number(arg.split("=")[1]) : 7;
  return Number.isFinite(n) && n > 0 ? n : 7;
}

function zaehleUnd(sortiert, feld) {
  const zaehler = new Map();
  for (const zeile of sortiert) {
    const wert = zeile[feld] || "unbekannt";
    zaehler.set(wert, (zaehler.get(wert) || 0) + 1);
  }
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1]);
}

async function main() {
  const env = ladeEnv();
  const tage = tageArg();
  const seit = new Date(Date.now() - tage * 24 * 60 * 60 * 1000).toISOString();

  const url = `${env.SUPABASE_URL}/rest/v1/portfolio_visits?select=*&created_at=gte.${seit}&order=created_at.desc`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    console.error(`Abfrage fehlgeschlagen: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const zeilen = await res.json();

  const pageviews = zeilen.filter((z) => z.event_type === "pageview");
  const clicks = zeilen.filter((z) => z.event_type === "click");

  console.log(`Portfolio-Besucher — letzte ${tage} Tage`);
  console.log(`(Quelle: Supabase-Projekt kglqsnltlokyiocvugbo, Tabelle portfolio_visits)`);
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
    console.log(`  ${land}: ${n}`);
  }

  console.log("");
  console.log("Top-Referrer (Seitenaufrufe):");
  for (const [ref, n] of zaehleUnd(pageviews, "referrer").slice(0, 10)) {
    console.log(`  ${ref}: ${n}`);
  }

  if (clicks.length > 0) {
    console.log("");
    console.log("Meistgeklickte Links:");
    for (const [ziel, n] of zaehleUnd(clicks, "click_target").slice(0, 10)) {
      console.log(`  ${ziel}: ${n}`);
    }
  }

  console.log("");
  console.log("Letzte 10 Besuche:");
  for (const z of zeilen.slice(0, 10)) {
    const wo = z.country ? `${z.country}${z.region ? " / " + z.region : ""}` : "Land unbekannt";
    const von = z.referrer || "direkt/kein Referrer";
    if (z.event_type === "pageview") {
      console.log(`  ${z.created_at}  Aufruf   ${wo}  von: ${von}`);
    } else {
      console.log(`  ${z.created_at}  Klick    ${wo}  auf: ${z.click_target}  von: ${von}`);
    }
  }
}

main();

import fs from 'node:fs';
import path from 'node:path';
import { percentile, round, esc } from '../util.js';

// --- Normalizadores: cada motor -> un mismo shape de metricas ---

export function normalizeK6(summaryPath) {
  const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const m = data.metrics || {};
  const dur = m.http_req_duration?.values || {};
  return {
    http_reqs: Math.round(m.http_reqs?.values?.count || 0),
    avg_ms: round(dur.avg),
    p90_ms: round(dur['p(90)']),
    p95_ms: round(dur['p(95)']),
    max_ms: round(dur.max),
    error_rate: m.http_req_failed?.values?.rate ?? 0,
    vus_max: m.vus_max?.values?.max ?? null,
    duration_s: round((data.state?.testRunDurationMs || 0) / 1000),
  };
}

export function normalizeJmeter(jtlPath) {
  const lines = fs.readFileSync(jtlPath, 'utf8').trim().split('\n');
  const header = lines.shift().split(',');
  const iElapsed = header.indexOf('elapsed');
  const iSuccess = header.indexOf('success');
  const times = [];
  let fails = 0;
  for (const line of lines) {
    if (!line) continue;
    const cols = line.split(',');
    times.push(Number(cols[iElapsed]));
    if (cols[iSuccess] !== 'true') fails++;
  }
  times.sort((a, b) => a - b);
  const count = times.length || 1;
  return {
    http_reqs: times.length,
    avg_ms: round(times.reduce((a, b) => a + b, 0) / count),
    p90_ms: round(percentile(times, 90)),
    p95_ms: round(percentile(times, 95)),
    max_ms: round(times[times.length - 1] || 0),
    error_rate: fails / count,
    vus_max: null,
    duration_s: null,
  };
}

// --- Reporte HTML por corrida ---

export function writeReport(outDir, meta) {
  const html = renderReport(meta);
  const htmlPath = path.join(outDir, 'report.html');
  fs.writeFileSync(htmlPath, html);
  return htmlPath;
}

function metricCard(label, value, sub = '') {
  return `<div class="card"><div class="k">${esc(label)}</div><div class="v">${esc(value)}</div>${
    sub ? `<div class="s">${esc(sub)}</div>` : ''
  }</div>`;
}

function renderReport(m) {
  const pass = m.pass;
  const errPct = `${(m.error_rate * 100).toFixed(2)}%`;
  const barPct = Math.min(100, Math.round((m.p95_ms / (m.thresholds.p95_ms * 1.5)) * 100));
  const barColor = pass ? '#16a34a' : '#dc2626';
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reporte ${esc(m.tool)} ${esc(m.type)} - ${esc(m.timestamp)}</title>
<style>
  :root{color-scheme:light dark}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#0b0e14;color:#e6e6e6}
  @media(prefers-color-scheme:light){body{background:#f6f7f9;color:#1a1a1a}}
  .wrap{max-width:900px;margin:0 auto;padding:32px 20px}
  h1{font-size:22px;margin:0 0 4px}
  .meta{opacity:.7;font-size:14px;margin-bottom:20px}
  .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-weight:700;font-size:13px;color:#fff}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:20px 0}
  .card{background:#151a24;border:1px solid #232a38;border-radius:12px;padding:14px 16px}
  @media(prefers-color-scheme:light){.card{background:#fff;border-color:#e5e7eb}}
  .card .k{font-size:12px;opacity:.7;text-transform:uppercase;letter-spacing:.04em}
  .card .v{font-size:24px;font-weight:700;margin-top:4px}
  .card .s{font-size:12px;opacity:.6;margin-top:2px}
  .bar{height:14px;background:#232a38;border-radius:8px;overflow:hidden;margin-top:8px}
  .bar>span{display:block;height:100%}
  table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}
  td{padding:6px 8px;border-bottom:1px solid #232a38}
  @media(prefers-color-scheme:light){td{border-color:#eee}}
  .lbl{opacity:.65}
  a{color:#60a5fa}
</style></head>
<body><div class="wrap">
  <h1>Reporte de performance</h1>
  <div class="meta">
    <span class="badge" style="background:${pass ? '#16a34a' : '#dc2626'}">${pass ? 'PASS' : 'FAIL'}</span>
    &nbsp; ${esc(m.tool.toUpperCase())} &middot; ${esc(m.platform)} &middot; ${esc(m.type)} &middot; ${esc(m.timestamp)}
  </div>
  <table>
    <tr><td class="lbl">Target</td><td>${esc(m.target)}</td></tr>
    <tr><td class="lbl">Umbral p95</td><td>${esc(m.thresholds.p95_ms)} ms</td></tr>
    <tr><td class="lbl">Umbral error</td><td>${(m.thresholds.error_rate * 100).toFixed(2)}%</td></tr>
  </table>
  <div class="grid">
    ${metricCard('p95', `${m.p95_ms ?? '-'} ms`, `umbral ${m.thresholds.p95_ms} ms`)}
    ${metricCard('p90', `${m.p90_ms ?? '-'} ms`)}
    ${metricCard('promedio', `${m.avg_ms ?? '-'} ms`)}
    ${metricCard('maximo', `${m.max_ms ?? '-'} ms`)}
    ${metricCard('errores', errPct)}
    ${metricCard('peticiones', m.http_reqs ?? '-')}
    ${metricCard('VUs max', m.vus_max ?? 'n/a')}
    ${metricCard('duracion', m.duration_s != null ? `${m.duration_s} s` : 'n/a')}
  </div>
  <div class="lbl" style="font-size:13px">p95 vs umbral</div>
  <div class="bar"><span style="width:${barPct}%;background:${barColor}"></span></div>
</div></body></html>`;
}

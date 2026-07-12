import fs from 'node:fs';
import path from 'node:path';
import { REPORTS_DIR, esc } from '../util.js';

const INDEX_JSON = path.join(REPORTS_DIR, 'index.json');
const INDEX_HTML = path.join(REPORTS_DIR, 'index.html');

export function loadIndex() {
  if (!fs.existsSync(INDEX_JSON)) return [];
  try {
    return JSON.parse(fs.readFileSync(INDEX_JSON, 'utf8'));
  } catch {
    return [];
  }
}

// Agrega una corrida al historico (fuente de verdad = index.json).
export function appendIndex(meta) {
  const runs = loadIndex();
  runs.push({
    timestamp: meta.timestamp,
    tool: meta.tool,
    platform: meta.platform,
    type: meta.type,
    target: meta.target,
    p95_ms: meta.p95_ms,
    p99_ms: meta.p99_ms,
    error_rate: meta.error_rate,
    availability: meta.availability,
    rps: meta.rps,
    http_reqs: meta.http_reqs,
    alerts: (meta.alerts || []).length,
    pass: meta.pass,
    dir: meta.dir,
  });
  fs.writeFileSync(INDEX_JSON, JSON.stringify(runs, null, 2));
  return runs;
}

// Regenera el dashboard historico a partir de index.json.
export function buildIndex() {
  const runs = loadIndex().slice().reverse(); // mas reciente primero
  fs.writeFileSync(INDEX_HTML, renderIndex(runs));
  return INDEX_HTML;
}

function bars(runs) {
  const list = runs.slice(0, 40).reverse();
  if (!list.length) return '<p class="lbl">Sin corridas todavia.</p>';
  const max = Math.max(...list.map((r) => r.p95_ms || 0), 1);
  const w = 100 / list.length;
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" class="chart">${list
    .map((r, i) => {
      const h = ((r.p95_ms || 0) / max) * 38;
      const color = r.pass ? '#16a34a' : '#dc2626';
      return `<rect x="${(i * w).toFixed(2)}" y="${(40 - h).toFixed(2)}" width="${(w * 0.8).toFixed(
        2
      )}" height="${h.toFixed(2)}" fill="${color}"><title>${esc(r.tool)} ${esc(r.type)} - ${
        r.p95_ms
      } ms</title></rect>`;
    })
    .join('')}</svg>`;
}

function rows(runs) {
  if (!runs.length) return '<tr><td colspan="11" class="lbl">Sin corridas todavia.</td></tr>';
  return runs
    .map((r) => {
      const badge = r.pass ? 'PASS' : 'FAIL';
      const bg = r.pass ? '#16a34a' : '#dc2626';
      const alertTag = r.alerts ? `<span class="badge" style="background:#d97706">${r.alerts}</span>` : '';
      return `<tr data-tool="${esc(r.tool)}" data-type="${esc(r.type)}">
      <td>${esc(r.timestamp)}</td>
      <td>${esc(r.tool)}</td>
      <td>${esc(r.platform)}</td>
      <td>${esc(r.type)}</td>
      <td class="trunc" title="${esc(r.target)}">${esc(r.target)}</td>
      <td>${r.availability != null ? esc(r.availability) + '%' : '-'}</td>
      <td>${esc(r.p95_ms)} ms</td>
      <td>${(r.error_rate * 100).toFixed(2)}%</td>
      <td>${r.rps != null ? esc(r.rps) : '-'}</td>
      <td><span class="badge" style="background:${bg}">${badge}</span> ${alertTag}</td>
      <td><a href="runs/${esc(r.dir)}/report.html">ver</a></td>
    </tr>`;
    })
    .join('');
}

function renderIndex(runs) {
  const total = runs.length;
  const passed = runs.filter((r) => r.pass).length;
  const withAlerts = runs.filter((r) => r.alerts).length;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard de performance</title>
<style>
  :root{color-scheme:light dark}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#0b0e14;color:#e6e6e6}
  @media(prefers-color-scheme:light){body{background:#f6f7f9;color:#1a1a1a}}
  .wrap{max-width:1100px;margin:0 auto;padding:32px 20px}
  h1{font-size:24px;margin:0 0 4px}
  .sub{opacity:.7;margin-bottom:20px}
  .stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
  .stat{background:#151a24;border:1px solid #232a38;border-radius:12px;padding:12px 18px}
  @media(prefers-color-scheme:light){.stat,.panel{background:#fff;border-color:#e5e7eb}}
  .stat .n{font-size:22px;font-weight:700}
  .stat .l{font-size:12px;opacity:.7;text-transform:uppercase}
  .panel{background:#151a24;border:1px solid #232a38;border-radius:12px;padding:16px;margin-bottom:20px}
  .chart{width:100%;height:120px;display:block}
  .filters{margin:0 0 12px;display:flex;gap:8px;flex-wrap:wrap}
  .filters button{background:#232a38;color:inherit;border:0;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px}
  .filters button.active{background:#3b82f6;color:#fff}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{padding:8px;border-bottom:1px solid #232a38;text-align:left}
  @media(prefers-color-scheme:light){th,td{border-color:#eee}}
  th{opacity:.7;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.04em}
  .trunc{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .badge{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:700;font-size:11px;color:#fff}
  .lbl{opacity:.6}
  a{color:#60a5fa}
</style></head>
<body><div class="wrap">
  <h1>Dashboard de performance</h1>
  <div class="sub">Historico unificado de corridas k6 y JMeter</div>
  <div class="stats">
    <div class="stat"><div class="n">${total}</div><div class="l">corridas</div></div>
    <div class="stat"><div class="n">${passed}</div><div class="l">pasadas</div></div>
    <div class="stat"><div class="n">${total - passed}</div><div class="l">falladas</div></div>
    <div class="stat"><div class="n">${withAlerts}</div><div class="l">con alertas</div></div>
  </div>
  <div class="panel">
    <div class="lbl" style="font-size:13px;margin-bottom:8px">p95 por corrida (verde = PASS, rojo = FAIL)</div>
    ${bars(runs)}
  </div>
  <div class="filters">
    <button class="active" data-f="all">Todas</button>
    <button data-f="tool:k6">k6</button>
    <button data-f="tool:jmeter">JMeter</button>
    <button data-f="type:smoke">Smoke</button>
    <button data-f="type:load">Load</button>
    <button data-f="type:stress">Stress</button>
    <button data-f="type:spike">Spike</button>
    <button data-f="type:soak">Soak</button>
  </div>
  <div class="panel" style="padding:0;overflow-x:auto">
    <table>
      <thead><tr>
        <th>Fecha</th><th>Motor</th><th>Plataforma</th><th>Tipo</th><th>Target</th>
        <th>Disp.</th><th>p95</th><th>Error</th><th>TPS/QPS</th><th>Resultado</th><th>Reporte</th>
      </tr></thead>
      <tbody id="rows">${rows(runs)}</tbody>
    </table>
  </div>
</div>
<script>
  const btns = document.querySelectorAll('.filters button');
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    const f = b.dataset.f;
    document.querySelectorAll('#rows tr').forEach((tr) => {
      if (f === 'all') { tr.style.display = ''; return; }
      const [k, v] = f.split(':');
      tr.style.display = tr.dataset[k] === v ? '' : 'none';
    });
  }));
</script>
</body></html>`;
}

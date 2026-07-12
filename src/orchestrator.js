import path from 'node:path';
import { ROOT, REPORTS_DIR, ensureDir, nowStamp } from './util.js';
import { runK6 } from './runner/k6Runner.js';
import { runJmeter } from './runner/jmeterRunner.js';
import { normalizeK6, normalizeJmeter, writeReport } from './report/buildReport.js';
import { appendIndex, buildIndex, loadIndex } from './report/buildIndex.js';
import { evaluateAlerts } from './alerts/evaluate.js';
import { sendGithubAlert } from './alerts/github.js';

// Ejecuta una corrida completa: motor -> metricas normalizadas -> reporte ->
// historico -> dashboard. Devuelve la metadata con el veredicto (pass).
export async function run(opts, config) {
  const stamp = nowStamp();
  const dirName = `${stamp}-${opts.tool}-${opts.type}-${opts.platform}`;
  const outDir = path.join(REPORTS_DIR, 'runs', dirName);
  ensureDir(outDir);

  console.log(`\nEjecutando ${opts.tool} - ${opts.platform} - ${opts.type} - ${opts.target}\n`);

  let metrics;
  if (opts.tool === 'k6') {
    const { summaryPath } = runK6({ ...opts, outDir, thresholds: config.thresholds });
    metrics = normalizeK6(summaryPath);
  } else {
    const { jtlPath } = runJmeter({ ...opts, outDir, binary: config.jmeter?.binary });
    metrics = normalizeJmeter(jtlPath);
  }

  // Gate unificado: mismo criterio para k6 y JMeter.
  const pass =
    (metrics.p95_ms ?? Infinity) <= config.thresholds.p95_ms &&
    (metrics.error_rate ?? 1) <= config.thresholds.error_rate;

  const meta = {
    ...opts,
    ...metrics,
    timestamp: stamp,
    dir: dirName,
    pass,
    thresholds: config.thresholds,
  };

  // Evalua alertas contra el historico ANTES de agregar esta corrida.
  const history = loadIndex();
  meta.alerts = evaluateAlerts(meta, history, config);

  writeReport(outDir, meta);
  appendIndex(meta);
  buildIndex();

  // Reporte de alertas en consola.
  if (meta.alerts.length) {
    console.log('\nAlertas:');
    for (const al of meta.alerts) {
      console.log(`  [${al.severity === 'critical' ? 'CRITICO' : 'AVISO'}] ${al.message}`);
    }
  }

  // Envio al canal configurado (solo si se pidio --notify).
  if (opts.notify && meta.alerts.length && (config.alerts?.channels || []).includes('github')) {
    sendGithubAlert(meta.alerts, meta);
  }

  const rel = (p) => path.relative(ROOT, p);
  console.log(
    `\n${pass ? 'PASS' : 'FAIL'}  p95: ${metrics.p95_ms} ms  errores: ${(metrics.error_rate * 100).toFixed(
      2
    )}%  reqs: ${metrics.http_reqs}`
  );
  console.log(`Reporte:   ${rel(path.join(outDir, 'report.html'))}`);
  console.log(`Dashboard: ${rel(path.join(REPORTS_DIR, 'index.html'))}\n`);

  return meta;
}

// Evalua las senales de oro de una corrida contra los umbrales absolutos y
// contra el comportamiento historico (baseline). Devuelve una lista de alertas.
//
//   meta     -> metricas normalizadas de la corrida actual (+ target/platform/type)
//   history  -> corridas previas (reports/index.json), sin incluir la actual
//   config   -> perf.config.json (thresholds + alerts)

function median(nums) {
  const arr = nums.filter((n) => n != null).sort((a, b) => a - b);
  if (!arr.length) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

// Baseline = mediana de corridas previas del mismo target/plataforma/tipo.
function baseline(history, meta, field, minSamples) {
  const sameContext = history.filter(
    (r) => r.target === meta.target && r.platform === meta.platform && r.type === meta.type
  );
  if (sameContext.length < minSamples) return null;
  return median(sameContext.map((r) => r[field]));
}

export function evaluateAlerts(meta, history, config) {
  const alerts = [];
  const t = config.thresholds || {};
  const a = config.alerts || {};
  const minSamples = a.min_baseline_samples ?? 3;

  const availPct = meta.availability ?? 100;
  const minAvail = (a.availability_min ?? 0.99) * 100;

  // 1. Disponibilidad -> caida total o degradacion de errores
  if (availPct <= 50) {
    alerts.push({
      severity: 'critical',
      signal: 'availability',
      message: `Posible caida de ${meta.target}: disponibilidad ${availPct}% (${(
        meta.error_rate * 100
      ).toFixed(1)}% de peticiones fallando).`,
    });
  } else if (availPct < minAvail) {
    alerts.push({
      severity: 'warning',
      signal: 'availability',
      message: `Disponibilidad de ${meta.target} en ${availPct}% (esperado >= ${minAvail}%).`,
    });
  }

  // 2. Errores sobre el umbral (si no se disparo ya por disponibilidad critica)
  if (meta.error_rate > (t.error_rate ?? 0.01) && availPct > 50) {
    alerts.push({
      severity: 'warning',
      signal: 'error_rate',
      message: `Tasa de error ${(meta.error_rate * 100).toFixed(2)}% supera el umbral ${(
        (t.error_rate ?? 0.01) * 100
      ).toFixed(2)}%.`,
    });
  }

  // 3. Latencia sobre el umbral absoluto
  if (meta.p95_ms != null && meta.p95_ms > (t.p95_ms ?? Infinity)) {
    alerts.push({
      severity: 'warning',
      signal: 'latency_threshold',
      message: `p95 ${meta.p95_ms} ms supera el umbral de ${t.p95_ms} ms.`,
    });
  }

  // 4. Latencia mas lenta de lo normal (regresion vs baseline)
  const baseP95 = baseline(history, meta, 'p95_ms', minSamples);
  const factor = a.p95_regression_factor ?? 1.5;
  if (baseP95 && meta.p95_ms != null && meta.p95_ms > baseP95 * factor) {
    alerts.push({
      severity: 'warning',
      signal: 'latency_regression',
      message: `${meta.target} esta mas lento de lo normal: p95 ${meta.p95_ms} ms vs ${round(
        baseP95
      )} ms habitual (x${(meta.p95_ms / baseP95).toFixed(1)}).`,
    });
  }

  // 5. Caida de throughput (TPS/QPS) vs baseline
  const baseRps = baseline(history, meta, 'rps', minSamples);
  const drop = a.rps_drop_factor ?? 0.5;
  if (baseRps && meta.rps != null && meta.rps < baseRps * drop) {
    alerts.push({
      severity: 'warning',
      signal: 'throughput_drop',
      message: `Throughput cayo a ${meta.rps} req/s vs ${round(baseRps)} habitual en ${meta.target}.`,
    });
  }

  return alerts;
}

function round(n) {
  return n == null ? null : Math.round(n * 100) / 100;
}

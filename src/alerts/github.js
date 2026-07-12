import { spawnSync } from 'node:child_process';

// Crea un GitHub Issue con las alertas detectadas usando la CLI `gh`.
// Requiere `gh` autenticado (local) o GITHUB_TOKEN + gh disponible (CI).
// Evita duplicados: si ya hay un issue abierto con el mismo titulo, comenta.
export function sendGithubAlert(alerts, meta) {
  if (!alerts.length) return { skipped: 'sin alertas' };

  const worst = alerts.some((a) => a.severity === 'critical') ? 'CRITICO' : 'AVISO';
  const title = `[${worst}] Performance: ${meta.target} (${meta.type}/${meta.platform})`;
  const body = buildBody(alerts, meta);

  // Verifica que gh este disponible.
  const check = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  if (check.error) {
    console.warn('Aviso: `gh` no esta disponible; no se pudo crear el issue.');
    return { skipped: 'gh no disponible' };
  }

  // Busca un issue abierto con el mismo titulo para no duplicar.
  const existing = spawnSync(
    'gh',
    ['issue', 'list', '--state', 'open', '--search', `in:title ${title}`, '--json', 'number', '--limit', '1'],
    { encoding: 'utf8' }
  );
  let number = null;
  try {
    const arr = JSON.parse(existing.stdout || '[]');
    if (arr.length) number = arr[0].number;
  } catch {
    /* sin issues previos */
  }

  if (number) {
    const res = spawnSync('gh', ['issue', 'comment', String(number), '--body', body], { encoding: 'utf8' });
    console.log(res.status === 0 ? `Alerta agregada al issue #${number}` : `No se pudo comentar: ${res.stderr}`);
    return { commented: number };
  }

  const res = spawnSync(
    'gh',
    ['issue', 'create', '--title', title, '--body', body, '--label', 'performance,alerta'],
    { encoding: 'utf8' }
  );
  if (res.status === 0) {
    console.log(`Issue de alerta creado: ${res.stdout.trim()}`);
    return { created: res.stdout.trim() };
  }
  // Si fallan las labels (no existen en el repo), reintenta sin ellas.
  const retry = spawnSync('gh', ['issue', 'create', '--title', title, '--body', body], { encoding: 'utf8' });
  console.log(retry.status === 0 ? `Issue creado: ${retry.stdout.trim()}` : `No se pudo crear issue: ${retry.stderr}`);
  return retry.status === 0 ? { created: retry.stdout.trim() } : { error: retry.stderr };
}

function buildBody(alerts, meta) {
  const rows = alerts
    .map((a) => `| ${a.severity === 'critical' ? 'CRITICO' : 'AVISO'} | ${a.signal} | ${a.message} |`)
    .join('\n');
  return `## Alerta de performance

**Target:** ${meta.target}
**Motor:** ${meta.tool} · **Plataforma:** ${meta.platform} · **Tipo:** ${meta.type}
**Fecha:** ${meta.timestamp}

### Alertas
| Severidad | Senal | Detalle |
|---|---|---|
${rows}

### Metricas de la corrida
| KPI | Valor |
|---|---|
| Disponibilidad | ${meta.availability}% |
| p95 | ${meta.p95_ms} ms |
| p99 | ${meta.p99_ms} ms |
| Errores | ${(meta.error_rate * 100).toFixed(2)}% |
| Throughput (TPS/QPS) | ${meta.rps} req/s |
| Peticiones | ${meta.http_reqs} |

_Generado automaticamente por frmPerformanceK6. Menciona @claude en este issue para que el agente investigue._`;
}

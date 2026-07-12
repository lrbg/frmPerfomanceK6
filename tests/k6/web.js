import http from 'k6/http';
import { check, sleep } from 'k6';
import { profiles } from '../../src/profiles.js';

// Parametros inyectados por el orquestador (o valores por defecto para correr suelto).
const TYPE = __ENV.TEST_TYPE || 'smoke';
const BASE_URL = __ENV.BASE_URL || 'https://test.k6.io';
const P95 = Number(__ENV.THRESH_P95 || 800);
const ERR = Number(__ENV.THRESH_ERR || 0.01);

export const options = {
  stages: profiles[TYPE].stages,
  // Incluye p(99) en el resumen para el KPI de latencia de cola.
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_duration: [`p(95)<${P95}`],
    http_req_failed: [`rate<${ERR}`],
  },
};

export default function () {
  const res = http.get(BASE_URL);
  check(res, { 'status es 200': (r) => r.status === 200 });
  sleep(1);
}

// Escribe el resumen crudo; el reporte HTML lo genera Node (buildReport.js).
export function handleSummary(data) {
  const out = __ENV.OUT_DIR || 'reports';
  return { [`${out}/summary.json`]: JSON.stringify(data) };
}

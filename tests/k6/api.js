import http from 'k6/http';
import { check, sleep } from 'k6';
import { profiles } from '../../src/profiles.js';

const TYPE = __ENV.TEST_TYPE || 'smoke';
const BASE_URL = __ENV.BASE_URL || 'https://httpbin.test.k6.io/get';
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
  const res = http.get(BASE_URL, { headers: { Accept: 'application/json' } });
  check(res, {
    'status 2xx': (r) => r.status >= 200 && r.status < 300,
    'tiene cuerpo': (r) => r.body && r.body.length > 0,
  });
  sleep(1);
}

export function handleSummary(data) {
  const out = __ENV.OUT_DIR || 'reports';
  return { [`${out}/summary.json`]: JSON.stringify(data) };
}

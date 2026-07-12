// Perfiles de carga por tipo de prueba, definidos una sola vez como datos.
// - stages:  curva de carga para k6 (VUs = usuarios virtuales concurrentes).
// - jmeter:  equivalente para JMeter (threads, ramp-up en seg, duracion en seg).
// Agregar un tipo nuevo es una entrada mas en este objeto, no un archivo nuevo.
export const profiles = {
  smoke: {
    label: 'Smoke - verifica que el sistema responde con carga minima',
    stages: [{ duration: '30s', target: 1 }],
    jmeter: { threads: 1, rampup: 1, duration: 30 },
  },
  load: {
    label: 'Load - carga esperada en operacion normal',
    stages: [
      { duration: '1m', target: 20 },
      { duration: '3m', target: 20 },
      { duration: '1m', target: 0 },
    ],
    jmeter: { threads: 20, rampup: 30, duration: 240 },
  },
  stress: {
    label: 'Stress - sube por encima de lo normal hasta degradar',
    stages: [
      { duration: '2m', target: 50 },
      { duration: '3m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '1m', target: 0 },
    ],
    jmeter: { threads: 200, rampup: 120, duration: 300 },
  },
  spike: {
    label: 'Spike - pico brusco de trafico y regreso',
    stages: [
      { duration: '10s', target: 5 },
      { duration: '20s', target: 300 },
      { duration: '30s', target: 5 },
    ],
    jmeter: { threads: 300, rampup: 5, duration: 60 },
  },
  soak: {
    label: 'Soak - carga sostenida por tiempo prolongado (fugas de memoria)',
    stages: [
      { duration: '2m', target: 30 },
      { duration: '30m', target: 30 },
      { duration: '2m', target: 0 },
    ],
    jmeter: { threads: 30, rampup: 30, duration: 1800 },
  },
};

export const TEST_TYPES = Object.keys(profiles);

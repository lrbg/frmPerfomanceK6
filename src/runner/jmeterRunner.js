import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT } from '../util.js';
import { profiles } from '../profiles.js';

// Ejecuta JMeter en modo no-GUI. El .jmx toma los parametros de carga y el
// target por propiedades -J. Los resultados quedan en results.jtl (CSV).
export function runJmeter({ platform, type, target, outDir, binary = 'jmeter' }) {
  const jmx = path.join(ROOT, 'tests', 'jmeter', `${platform}.jmx`);
  const jtl = path.join(outDir, 'results.jtl');
  const p = profiles[type].jmeter;

  const u = new URL(target);
  const protocol = u.protocol.replace(':', '');
  const port = u.port || (protocol === 'https' ? '443' : '80');
  const routePath = `${u.pathname}${u.search}` || '/';

  const args = [
    '-n',
    '-t', jmx,
    '-l', jtl,
    `-Jprotocol=${protocol}`,
    `-Jdomain=${u.hostname}`,
    `-Jport=${port}`,
    `-Jpath=${routePath}`,
    `-Jthreads=${p.threads}`,
    `-Jrampup=${p.rampup}`,
    `-Jduration=${p.duration}`,
  ];

  const res = spawnSync(binary, args, { stdio: 'inherit' });
  if (res.error) {
    throw new Error(
      `No se pudo ejecutar JMeter (${res.error.message}). Instalalo y asegurate de que "${binary}" este en el PATH.`
    );
  }
  return {
    jtlPath: jtl,
    exitCode: res.status ?? 1,
  };
}

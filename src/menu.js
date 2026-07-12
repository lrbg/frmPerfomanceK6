import fs from 'node:fs';
import path from 'node:path';
import { select, input } from '@inquirer/prompts';
import { ROOT, cap } from './util.js';
import { profiles, TEST_TYPES } from './profiles.js';

export function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'perf.config.json'), 'utf8'));
}

// --flag valor  -> { flag: 'valor' }
export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      o[a.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return o;
}

// Un target puede venir como nombre (definido en config) o como URL directa.
function resolveTarget(config, platform, target) {
  const named = config.targets?.[platform]?.[target];
  if (named) return named;
  if (/^https?:\/\//.test(target)) return target;
  throw new Error(
    `Target "${target}" no existe para plataforma "${platform}" y no es una URL. ` +
      `Opciones: ${Object.keys(config.targets?.[platform] || {}).join(', ')}`
  );
}

// Resuelve opciones desde flags (CI) o desde el menu interactivo (local).
export async function resolveOptions(argv) {
  const flags = parseArgs(argv);
  const config = loadConfig();

  if (flags.tool) {
    // Modo no-interactivo (CI): todo por flags.
    const platform = flags.platform || 'web';
    const opts = {
      tool: flags.tool,
      platform,
      type: flags.type || 'load',
      target: resolveTarget(config, platform, flags.target || 'demo'),
    };
    validate(opts);
    return { opts, config };
  }

  // Modo interactivo (menu).
  const tool = await select({
    message: 'Motor de pruebas',
    choices: [
      { name: 'k6', value: 'k6' },
      { name: 'JMeter', value: 'jmeter' },
    ],
  });
  const platform = await select({
    message: 'Plataforma',
    choices: [
      { name: 'Web', value: 'web' },
      { name: 'API', value: 'api' },
    ],
  });
  const type = await select({
    message: 'Tipo de prueba',
    choices: TEST_TYPES.map((t) => ({ name: `${cap(t)} - ${profiles[t].label}`, value: t })),
  });
  const targets = config.targets?.[platform] || {};
  const choices = [
    ...Object.entries(targets).map(([k, v]) => ({ name: `${k} (${v})`, value: v })),
    { name: 'URL manual...', value: '__manual__' },
  ];
  let target = await select({ message: 'Target', choices });
  if (target === '__manual__') {
    target = await input({ message: 'URL (https://...)', validate: (v) => /^https?:\/\//.test(v) || 'URL invalida' });
  }

  const opts = { tool, platform, type, target };
  validate(opts);
  return { opts, config };
}

function validate(opts) {
  if (!['k6', 'jmeter'].includes(opts.tool)) throw new Error(`Motor invalido: ${opts.tool}`);
  if (!['web', 'api'].includes(opts.platform)) throw new Error(`Plataforma invalida: ${opts.platform}`);
  if (!TEST_TYPES.includes(opts.type)) throw new Error(`Tipo invalido: ${opts.type}`);
}

// Utilidades compartilhadas: pasta da empresa, leitura e escrita de JSON.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const RAIZ = process.env.EMPRESA_IA || path.join(os.homedir(), 'empresa-ia');
export const PASTAS = ['leads', 'clientes', 'financeiro', 'marketing', 'marketing/posts', 'atendimentos', 'aprovar', 'aprovar/decididos', 'diario', 'saida'];

export function caminho(...p) { return path.join(RAIZ, ...p); }
export function lerJSON(arq, padrao = null) {
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return padrao; }
}
export function gravarJSON(arq, dados) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = arq + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 2) + '\n');
  fs.renameSync(tmp, arq);
}
export function hoje() {
  const tz = lerJSON(caminho('empresa.json'), {})?.fusoHorario || 'America/Sao_Paulo';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());
}
export function agora() { return new Date().toISOString(); }
export function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}
export function listarJSON(pasta) {
  const p = caminho(pasta);
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter(f => f.endsWith('.json'))
    .map(f => ({ arquivo: path.join(p, f), ...lerJSON(path.join(p, f), {}) }));
}

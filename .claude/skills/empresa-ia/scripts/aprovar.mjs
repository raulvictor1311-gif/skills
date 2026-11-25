// Fila "Para aprovar": nada sai da empresa sem passar por aqui.
//   novo --agente sdr-ia --tipo mensagem --titulo "..." --arquivo item.json
//   listar [--todos]
//   aprovar <id|todos> | recusar <id> [--motivo "..."] | executado <id> [--resultado "..."]
//   falhou <id> --erro "..." | pode-executar <id>   (sai com código 1 se não puder)
import fs from 'node:fs';
import path from 'node:path';
import { caminho, lerJSON, gravarJSON, agora, args, listarJSON } from './_base.mjs';

const a = args();
const cmd = a._[0];
const TIPOS = ['mensagem', 'reuniao', 'anuncio', 'post', 'cobranca', 'reembolso', 'email', 'outro'];

function arq(id) {
  for (const p of ['aprovar', 'aprovar/decididos']) {
    const f = caminho(p, `${id}.json`);
    if (fs.existsSync(f)) return f;
  }
  return null;
}
function carregar(id) {
  const f = arq(id);
  if (!f) { console.error(`✖ item ${id} não existe`); process.exit(1); }
  return [f, lerJSON(f)];
}
function mover(f, item) {
  const destino = ['executado', 'recusado'].includes(item.status)
    ? caminho('aprovar/decididos', path.basename(f)) : caminho('aprovar', path.basename(f));
  gravarJSON(destino, item);
  if (destino !== f) fs.unlinkSync(f);
}
function autonomo(agente, tipo) {
  const emp = lerJSON(caminho('empresa.json'), {});
  const regra = emp?.autonomia?.[agente];
  return Array.isArray(regra) && regra.includes(tipo);
}

if (cmd === 'novo') {
  if (!a.agente || !a.tipo || !a.titulo) { console.error('✖ precisa de --agente, --tipo e --titulo'); process.exit(1); }
  if (!TIPOS.includes(a.tipo)) { console.error(`✖ tipo deve ser um de: ${TIPOS.join(', ')}`); process.exit(1); }
  const extra = a.arquivo ? lerJSON(a.arquivo, null) : {};
  if (extra === null) { console.error('✖ --arquivo não é JSON válido'); process.exit(1); }
  const id = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${a.agente}-${Math.random().toString(36).slice(2, 6)}`;
  const auto = autonomo(a.agente, a.tipo);
  const item = {
    id, agente: a.agente, tipo: a.tipo, titulo: a.titulo, time: a.time || null,
    resumo: extra.resumo || '', conteudo: extra.conteudo || null, acao: extra.acao || null,
    risco: extra.risco || 'baixo', ref: extra.ref || null,
    status: auto ? 'aprovado' : 'pendente', aprovadoPor: auto ? 'autonomia (empresa.json)' : null,
    criadoEm: agora(), historico: [{ em: agora(), evento: auto ? 'criado e aprovado por autonomia' : 'criado' }],
  };
  gravarJSON(caminho('aprovar', `${id}.json`), item);
  console.log(`${auto ? '✔ aprovado por autonomia' : '⏳ pendente'} ${id} · ${a.titulo}`);
} else if (cmd === 'listar') {
  const itens = [...listarJSON('aprovar'), ...(a.todos ? listarJSON('aprovar/decididos') : [])]
    .sort((x, y) => (x.criadoEm || '').localeCompare(y.criadoEm || ''));
  if (!itens.length) { console.log('Nada na fila.'); process.exit(0); }
  for (const i of itens) console.log(`[${i.status}] ${i.id} · ${i.agente} · ${i.tipo} · ${i.titulo}${i.risco !== 'baixo' ? ` · risco ${i.risco}` : ''}`);
  const pend = itens.filter(i => i.status === 'pendente').length;
  console.log(`\n${pend} esperando a sua decisão.`);
} else if (cmd === 'aprovar' || cmd === 'recusar') {
  const ids = a._[1] === 'todos' ? listarJSON('aprovar').filter(i => i.status === 'pendente').map(i => i.id) : [a._[1]];
  for (const id of ids) {
    const [f, item] = carregar(id);
    if (item.status !== 'pendente') { console.log(`· ${id} já está ${item.status}`); continue; }
    item.status = cmd === 'aprovar' ? 'aprovado' : 'recusado';
    item.aprovadoPor = cmd === 'aprovar' ? 'dono' : null;
    item.historico.push({ em: agora(), evento: item.status, motivo: a.motivo || undefined });
    mover(f, item);
    console.log(`${cmd === 'aprovar' ? '✔' : '✖'} ${id} ${item.status}`);
  }
} else if (cmd === 'pode-executar') {
  const [, item] = carregar(a._[1]);
  if (item.status !== 'aprovado') { console.error(`✖ ${item.id} está ${item.status}; só executa aprovado`); process.exit(1); }
  console.log(`✔ ${item.id} pode executar`);
} else if (cmd === 'executado' || cmd === 'falhou') {
  const [f, item] = carregar(a._[1]);
  if (item.status !== 'aprovado') { console.error(`✖ ${item.id} está ${item.status}`); process.exit(1); }
  if (cmd === 'executado') { item.status = 'executado'; item.resultado = a.resultado || null; }
  else item.erro = a.erro || 'erro sem descrição';
  item.historico.push({ em: agora(), evento: cmd, detalhe: a.resultado || a.erro });
  mover(f, item);
  console.log(`${cmd === 'executado' ? '✔' : '⚠'} ${item.id} ${cmd}`);
} else {
  console.log('uso: aprovar.mjs novo|listar|aprovar|recusar|pode-executar|executado|falhou');
  process.exit(1);
}

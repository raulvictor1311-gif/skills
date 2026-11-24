#!/usr/bin/env node
/**
 * A fila de um lote de reels: o que existe, em que etapa está, onde foi postado e quanto rendeu.
 *
 *   node fila.mjs novo      --lote semana-48 --fuso America/Sao_Paulo --redes instagram,youtube
 *   node fila.mjs adicionar --lote semana-48 --arquivo pauta.json
 *   node fila.mjs status    --lote semana-48            # lê os arquivos e atualiza a etapa de cada reel
 *   node fila.mjs vai       --lote semana-48            # a pessoa disse VAI: libera a publicação
 *   node fila.mjs pausar    --lote semana-48            # volta atrás: nada mais é publicado
 *   node fila.mjs hospedado --lote semana-48 --slug <slug> --url https://...mp4
 *   node fila.mjs postado   --lote semana-48 --slug <slug> --rede instagram --id 1789 --url https://...
 *   node fila.mjs agendado  --lote semana-48 --slug <slug> --rede youtube --id abc --url https://...
 *   node fila.mjs erro      --lote semana-48 --slug <slug> --rede instagram --msg "texto do erro"
 *   node fila.mjs metricas  --lote semana-48 --slug <slug> --rede instagram --views 1200 --curtidas 80 \
 *                           --comentarios 12 --salvamentos 30 --compartilhamentos 9 --alcance 1000
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  lerArgs, falhar, pastaLote, lerFila, salvarFila, etapaProducao, slugificar, validarFuso,
  REDES, ESTUDIO, local, tabela,
} from './_base.mjs';

const args = lerArgs();
const cmd = args._[0];
const lote = pastaLote(args);

const acharItem = (fila) => {
  if (typeof args.slug !== 'string') falhar('Falta --slug <slug>.');
  const it = fila.itens.find((i) => i.slug === args.slug);
  if (!it) falhar(`Não há reel "${args.slug}" neste lote.`);
  return it;
};
const acharRede = (fila) => {
  const r = args.rede;
  if (!fila.redes.includes(r)) falhar(`--rede precisa ser uma destas: ${fila.redes.join(', ')}.`);
  return r;
};

const resumo = (fila) => {
  const cont = {};
  for (const it of fila.itens) cont[it.etapa] = (cont[it.etapa] || 0) + 1;
  const pub = {};
  for (const r of fila.redes) {
    pub[r] = { postado: 0, agendado: 0, erro: 0, pendente: 0 };
    for (const it of fila.itens) pub[r][it.redes[r].status] += 1;
  }
  return { cont, pub };
};

if (cmd === 'novo') {
  if (fs.existsSync(path.join(lote, 'fila.json'))) falhar(`O lote ${lote} já existe.`);
  const fuso = typeof args.fuso === 'string' ? args.fuso : 'America/Sao_Paulo';
  if (!validarFuso(fuso)) falhar(`Fuso "${fuso}" não existe. Use um nome IANA, ex.: America/Sao_Paulo.`);
  const redes = (typeof args.redes === 'string' ? args.redes : 'instagram,youtube').split(',').map((s) => s.trim()).filter(Boolean);
  const ruins = redes.filter((r) => !REDES.includes(r));
  if (ruins.length) falhar(`Rede desconhecida: ${ruins.join(', ')}. Use: ${REDES.join(', ')}.`);
  fs.mkdirSync(lote, { recursive: true });
  fs.mkdirSync(path.join(ESTUDIO, 'reels'), { recursive: true });
  fs.mkdirSync(path.join(ESTUDIO, 'out'), { recursive: true });
  salvarFila(lote, {
    lote: path.basename(lote), criadoEm: new Date().toISOString(), fuso, redes,
    aprovadoEm: null, itens: [],
  });
  console.log(`✔ Lote criado em ${lote} (fuso ${fuso}, redes: ${redes.join(', ')}).`);
} else if (cmd === 'adicionar') {
  if (typeof args.arquivo !== 'string') falhar('Falta --arquivo pauta.json (lista de ideias).');
  let pauta;
  try { pauta = JSON.parse(fs.readFileSync(path.resolve(args.arquivo), 'utf8')); } catch (e) { falhar(`Não consegui ler a pauta: ${e.message}`); }
  if (!Array.isArray(pauta)) pauta = pauta.itens || pauta.ideias;
  if (!Array.isArray(pauta) || !pauta.length) falhar('A pauta precisa ser uma lista de ideias.');
  const fila = lerFila(lote);
  const usados = new Set(fila.itens.map((i) => i.slug));
  const ganchos = new Set(fila.itens.map((i) => i.gancho.toLowerCase()));
  let n = fila.itens.length;
  const novos = [];
  for (const p of pauta) {
    if (!p || typeof p.gancho !== 'string' || !p.gancho.trim()) { console.log('! ideia sem "gancho" ignorada'); continue; }
    if (ganchos.has(p.gancho.toLowerCase())) { console.log(`! gancho repetido ignorado: ${p.gancho}`); continue; }
    n += 1;
    let slug = `${fila.lote}-${String(n).padStart(2, '0')}-${slugificar(p.gancho, 30)}`;
    while (usados.has(slug)) slug += 'x';
    usados.add(slug); ganchos.add(p.gancho.toLowerCase());
    const it = {
      n, slug, gancho: p.gancho.trim(), ideia: p.ideia || '', angulo: p.angulo || '', formato: p.formato || '',
      cta: p.cta || '', etapa: 'pauta', horario: null, hospedado: null,
      redes: Object.fromEntries(fila.redes.map((r) => [r, { status: 'pendente' }])),
      metricas: Object.fromEntries(fila.redes.map((r) => [r, []])),
    };
    fila.itens.push(it); novos.push(it);
  }
  salvarFila(lote, fila);
  console.log(`✔ ${novos.length} ideias adicionadas (lote com ${fila.itens.length}).`);
  console.log('Pastas dos reels: ' + path.join(ESTUDIO, 'reels', '<slug>'));
} else if (cmd === 'status') {
  const fila = lerFila(lote);
  for (const it of fila.itens) it.etapa = etapaProducao(it);
  salvarFila(lote, fila);
  const { cont, pub } = resumo(fila);
  console.log(`Lote ${fila.lote}: ${fila.itens.length} reels · ${fila.aprovadoEm ? 'VAI dado em ' + local(fila.aprovadoEm, fila.fuso).curta : 'aguardando o VAI'}`);
  console.log('Produção: ' + ['pauta', 'sem-legenda', 'roteirizado', 'pronto'].map((e) => `${e} ${cont[e] || 0}`).join(' · '));
  for (const r of fila.redes) console.log(`${r}: ` + Object.entries(pub[r]).map(([k, v]) => `${k} ${v}`).join(' · '));
  if (args.detalhe || fila.itens.length <= 60) {
    console.log('\n' + tabela(fila.itens.map((it) => ({
      '#': it.n, slug: it.slug, etapa: it.etapa,
      horario: it.horario ? local(it.horario, fila.fuso).curta : '-',
      ...Object.fromEntries(fila.redes.map((r) => [r, it.redes[r].status])),
    })), ['#', 'slug', 'etapa', 'horario', ...fila.redes]));
  }
  const faltando = fila.itens.filter((it) => it.etapa === 'sem-legenda').map((it) => it.slug);
  if (faltando.length) console.log(`\n! Sem post.json (legenda): ${faltando.join(', ')}`);
} else if (cmd === 'vai' || cmd === 'pausar') {
  const fila = lerFila(lote);
  if (cmd === 'vai') {
    for (const it of fila.itens) it.etapa = etapaProducao(it);
    const naoProntos = fila.itens.filter((it) => it.etapa !== 'pronto');
    const semHorario = fila.itens.filter((it) => it.etapa === 'pronto' && !it.horario);
    if (semHorario.length) falhar(`${semHorario.length} reels prontos ainda sem horário. Rode agendar.mjs antes do VAI.`);
    fila.aprovadoEm = new Date().toISOString();
    salvarFila(lote, fila);
    console.log(`✔ VAI registrado. ${fila.itens.length - naoProntos.length} reels liberados para publicar.`);
    if (naoProntos.length) console.log(`! ${naoProntos.length} não estão prontos e ficam de fora até ficarem.`);
  } else {
    fila.aprovadoEm = null;
    salvarFila(lote, fila);
    console.log('✔ Lote pausado. Nada novo será publicado até o próximo VAI.');
  }
} else if (cmd === 'hospedado') {
  const fila = lerFila(lote);
  const it = acharItem(fila);
  if (typeof args.url !== 'string' || !/^https:\/\//.test(args.url)) falhar('--url precisa ser um link https público do MP4.');
  it.hospedado = args.url;
  salvarFila(lote, fila);
  console.log(`✔ ${it.slug}: MP4 hospedado.`);
} else if (cmd === 'postado' || cmd === 'agendado') {
  const fila = lerFila(lote);
  const it = acharItem(fila);
  const r = acharRede(fila);
  it.redes[r] = {
    status: cmd, id: typeof args.id === 'string' ? args.id : null, url: typeof args.url === 'string' ? args.url : null,
    em: new Date().toISOString(),
  };
  salvarFila(lote, fila);
  console.log(`✔ ${it.slug} → ${r}: ${cmd}.`);
} else if (cmd === 'erro') {
  const fila = lerFila(lote);
  const it = acharItem(fila);
  const r = acharRede(fila);
  const tent = (it.redes[r].tentativas || 0) + 1;
  it.redes[r] = { ...it.redes[r], status: 'erro', erro: String(args.msg || 'erro sem mensagem').slice(0, 500), tentativas: tent, em: new Date().toISOString() };
  salvarFila(lote, fila);
  console.log(`✔ Erro registrado em ${it.slug} → ${r} (tentativa ${tent}).`);
} else if (cmd === 'metricas') {
  const fila = lerFila(lote);
  const it = acharItem(fila);
  const r = acharRede(fila);
  const campos = ['views', 'alcance', 'curtidas', 'comentarios', 'salvamentos', 'compartilhamentos', 'retencao'];
  const leitura = { em: new Date().toISOString() };
  for (const c of campos) {
    if (args[c] === undefined) continue;
    const v = Number(String(args[c]).replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) falhar(`--${c} precisa ser um número.`);
    leitura[c] = v;
  }
  if (leitura.views === undefined) falhar('--views é obrigatório (é o número que a fábrica usa para aprender).');
  it.metricas[r].push(leitura);
  salvarFila(lote, fila);
  const csv = path.join(ESTUDIO, 'metricas.csv');
  if (!fs.existsSync(csv)) fs.writeFileSync(csv, ['em', 'lote', 'slug', 'rede', ...campos].join(',') + '\n');
  fs.appendFileSync(csv, [leitura.em, fila.lote, it.slug, r, ...campos.map((c) => leitura[c] ?? '')].join(',') + '\n');
  console.log(`✔ ${it.slug} → ${r}: ${leitura.views} views registradas.`);
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
  if (cmd) falhar(`Comando "${cmd}" não existe.`);
}

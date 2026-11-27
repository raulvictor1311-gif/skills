#!/usr/bin/env node
/**
 * Controle das respostas a comentários (para não responder duas vezes).
 *   echo '<json da API>' | node comentarios.mjs pendentes --conta rauul.vktor
 *       lê a lista de comentários (formato do INSTAGRAM_GET_IG_MEDIA_COMMENTS, campo data[])
 *       e devolve os que ainda não foram respondidos, com o tipo: lead | elogio | duvida
 *   node comentarios.mjs marcar --id <comment_id> [--resposta "texto"] [--lead @user]
 *   node comentarios.mjs leads            # leads ainda não avisados ao usuário
 *   node comentarios.mjs avisado --id <comment_id>
 */
import fs from 'node:fs';
import path from 'node:path';
import { lerArgs, falhar, ESTUDIO } from './_base.mjs';

const ARQ = path.join(ESTUDIO, 'comentarios.json');
const ler = () => { try { return JSON.parse(fs.readFileSync(ARQ, 'utf8')); } catch { return { respondidos: {}, leads: [] }; } };
const salvar = (d) => fs.writeFileSync(ARQ, JSON.stringify(d, null, 2) + '\n');
const args = lerArgs();
const cmd = args._[0];
const d = ler();

const tipo = (t = '') => {
  const s = t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/portf?olio|portifolio|quero|orcamento|preco|valor|interess|como contrat/.test(s)) return 'lead';
  if (/\?/.test(t)) return 'duvida';
  return 'elogio';
};

if (cmd === 'pendentes') {
  const conta = String(args.conta || '');
  const entrada = JSON.parse(fs.readFileSync(0, 'utf8'));
  const lista = Array.isArray(entrada) ? entrada : (entrada.data?.data || entrada.data || []);
  const out = [];
  for (const c of lista) {
    if (!c?.id || d.respondidos[c.id]) continue;
    if (c.username && c.username === conta) continue;               // comentário da própria conta
    const jaTemResposta = (c.replies?.data || []).length > 0;       // alguém (você) já respondeu
    if (jaTemResposta) { d.respondidos[c.id] = { em: new Date().toISOString(), resposta: '(já respondido)' }; continue; }
    out.push({ id: c.id, texto: c.text || '', usuario: c.username || null, tipo: tipo(c.text) });
  }
  salvar(d);
  console.log(JSON.stringify(out, null, 2));
} else if (cmd === 'marcar') {
  if (typeof args.id !== 'string') falhar('Falta --id');
  d.respondidos[args.id] = { em: new Date().toISOString(), resposta: args.resposta || '' };
  if (typeof args.lead === 'string') d.leads.push({ id: args.id, usuario: args.lead, em: new Date().toISOString(), avisado: false });
  salvar(d); console.log(`✔ ${args.id} marcado`);
} else if (cmd === 'leads') {
  console.log(JSON.stringify(d.leads.filter((l) => !l.avisado), null, 2));
} else if (cmd === 'avisado') {
  for (const l of d.leads) if (l.id === args.id) l.avisado = true;
  salvar(d); console.log('✔ avisado');
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
}

#!/usr/bin/env node
/**
 * Distribui os reels prontos de um lote em horários da semana e escreve agenda.md.
 *
 *   node agendar.mjs --lote semana-48 --por-dia 6
 *   node agendar.mjs --lote semana-48 --por-dia 6 --inicio 2026-11-25 --horarios 09:00,11:30,14:00,16:30,19:00,21:30
 *   node agendar.mjs --lote semana-48 --refazer      # redistribui tudo que ainda não foi postado
 *   node agendar.mjs --lote semana-48 --simular      # só mostra, não grava
 *
 * Regras: horário que já passou (com folga de 20 min) é pulado; reel já postado ou agendado
 * em alguma rede não muda de horário; a ordem segue o número do reel na fila.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  lerArgs, falhar, pastaLote, lerFila, salvarFila, etapaProducao, paraUTC, local, somarDias, hojeNoFuso, tabela,
} from './_base.mjs';

const args = lerArgs();
const lote = pastaLote(args);
const fila = lerFila(lote);
const fuso = fila.fuso;

const porDia = Number(args['por-dia'] || 6);
if (!Number.isInteger(porDia) || porDia < 1 || porDia > 24) falhar('--por-dia precisa ser um inteiro entre 1 e 24.');

/** Horários espalhados entre 09:00 e 21:30 quando a pessoa não diz quais. */
const horariosPadrao = (n) => {
  if (n === 1) return ['18:00'];
  const ini = 9 * 60, fim = 21 * 60 + 30;
  return Array.from({ length: n }, (_, i) => {
    const m = Math.round((ini + ((fim - ini) * i) / (n - 1)) / 15) * 15;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  });
};

let horarios = typeof args.horarios === 'string'
  ? args.horarios.split(',').map((h) => h.trim()).filter(Boolean)
  : horariosPadrao(porDia);
for (const h of horarios) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(h)) falhar(`Horário "${h}" inválido. Use HH:MM.`);
horarios = [...new Set(horarios)].sort();
if (typeof args.horarios === 'string' && horarios.length !== porDia && args['por-dia']) {
  console.log(`! --por-dia ${porDia} ignorado: vale a lista de ${horarios.length} horários.`);
}

const inicio = typeof args.inicio === 'string' ? args.inicio : hojeNoFuso(fuso);
if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) falhar('--inicio precisa ser AAAA-MM-DD.');

for (const it of fila.itens) it.etapa = etapaProducao(it);
const travado = (it) => Object.values(it.redes).some((r) => r.status === 'postado' || r.status === 'agendado');

if (args.refazer) for (const it of fila.itens) if (!travado(it)) it.horario = null;

const ocupados = new Set(fila.itens.filter((it) => it.horario).map((it) => it.horario));
const aAgendar = fila.itens.filter((it) => it.etapa === 'pronto' && !it.horario).sort((a, b) => a.n - b.n);
const limite = Date.now() + 20 * 60 * 1000;

let dia = inicio, k = 0, guarda = 0;
for (const it of aAgendar) {
  for (;;) {
    if (guarda++ > 100000) falhar('Não achei horários livres suficientes.');
    if (k >= horarios.length) { k = 0; dia = somarDias(dia, 1); }
    const iso = paraUTC(dia, horarios[k], fuso).toISOString();
    k += 1;
    if (new Date(iso).getTime() < limite || ocupados.has(iso)) continue;
    it.horario = iso; ocupados.add(iso);
    break;
  }
}

const agendados = fila.itens.filter((it) => it.horario).sort((a, b) => a.horario.localeCompare(b.horario));
const naoProntos = fila.itens.filter((it) => it.etapa !== 'pronto' && !it.horario);

console.log(tabela(agendados.map((it) => ({
  quando: local(it.horario, fuso).curta, '#': it.n, slug: it.slug, gancho: it.gancho.slice(0, 50),
})), ['quando', '#', 'slug', 'gancho']));
console.log(`\n${aAgendar.length} reels receberam horário agora · ${agendados.length} com horário no total · fuso ${fuso}`);
if (naoProntos.length) console.log(`! ${naoProntos.length} ainda não estão prontos (sem MP4 ou sem post.json) e ficaram sem horário.`);

if (args.simular) { console.log('\n(simulação: nada foi gravado)'); process.exit(0); }
salvarFila(lote, fila);

/* agenda.md: uma coluna por dia, uma linha por horário */
const porData = new Map();
for (const it of agendados) {
  const l = local(it.horario, fuso);
  if (!porData.has(l.data)) porData.set(l.data, { semana: l.semana, slots: [] });
  porData.get(l.data).slots.push({ hora: l.hora, it });
}
const datas = [...porData.keys()].sort();
const linhas = Math.max(0, ...[...porData.values()].map((d) => d.slots.length));
const cab = datas.map((d) => `${porData.get(d).semana} ${d.slice(8)}/${d.slice(5, 7)}`);
let md = `# Agenda do lote ${fila.lote}\n\nFuso: ${fuso} · ${agendados.length} reels · ${fila.aprovadoEm ? 'VAI dado' : 'esperando o VAI'}\n\n`;
md += `| ${cab.join(' | ')} |\n| ${cab.map(() => '---').join(' | ')} |\n`;
for (let i = 0; i < linhas; i++) {
  md += `| ${datas.map((d) => { const s = porData.get(d).slots[i]; return s ? `${s.hora} #${s.it.n}` : ''; }).join(' | ')} |\n`;
}
md += '\n## Lista\n\n';
for (const it of agendados) md += `- **${local(it.horario, fuso).curta}** · #${it.n} · ${it.gancho}\n`;
fs.writeFileSync(path.join(lote, 'agenda.md'), md);
console.log(`✔ Agenda gravada em ${path.join(lote, 'agenda.md')}`);

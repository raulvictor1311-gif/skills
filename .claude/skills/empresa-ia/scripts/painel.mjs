// Gera saida/painel.html: o organograma da empresa com os números de hoje,
// a fila "Para aprovar" e o diário. Só lê arquivos; nunca chama conector.
import fs from 'node:fs';
import { caminho, lerJSON, listarJSON, hoje } from './_base.mjs';

const dia = hoje();
const emp = lerJSON(caminho('empresa.json'), {});
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const doDia = x => (x.criadoEm || x.atualizadoEm || '').slice(0, 10) === dia;

const leads = listarJSON('leads');
const lh = leads.filter(doDia);
const conta = (arr, st) => arr.filter(l => (l.historicoStatus || []).some(h => h.status === st) || l.status === st).length;
const anuncios = lerJSON(caminho('marketing', 'anuncios.json'), { anuncios: [] });
const roas = (() => { const g = anuncios.anuncios.reduce((s, x) => s + (x.gasto || 0), 0); const r = anuncios.anuncios.reduce((s, x) => s + (x.receita || 0), 0); return g ? (r / g).toFixed(1).replace('.', ',') + 'x' : '—'; })();
const posts = listarJSON('marketing/posts');
const caixa = lerJSON(caminho('financeiro', `caixa-${dia}.json`), null);
const cobr = listarJSON('aprovar').concat(listarJSON('aprovar/decididos')).filter(i => i.tipo === 'cobranca' && doDia(i));
const atend = listarJSON('atendimentos').filter(doDia);
const fila = listarJSON('aprovar').filter(i => i.status === 'pendente');
const diario = fs.existsSync(caminho('diario', `${dia}.md`)) ? fs.readFileSync(caminho('diario', `${dia}.md`), 'utf8').split('\n').filter(l => l.startsWith('- ')) : [];
const brl = n => n == null ? '—' : 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0 });

const times = [
  { n: '01', nome: 'Vendas', verbo: 'vender', cor: '#f43f5e', agentes: ['SDR de IA', 'Qualificador', 'Agendador'],
    stats: [['leads hoje', lh.length], ['qualificados', conta(lh, 'qualificado')], ['reuniões', conta(lh, 'agendado')]] },
  { n: '02', nome: 'Marketing', verbo: 'divulgar', cor: '#22d3ee', agentes: ['Gestor de Tráfego', 'Social Media'],
    stats: [['ROAS', roas], ['anúncios ativos', anuncios.anuncios.filter(x => x.status === 'ativo').length], ['posts prontos', posts.filter(p => p.status === 'pronto').length]] },
  { n: '03', nome: 'Financeiro', verbo: 'controlar', cor: '#34d399', agentes: ['Caixa do Dia', 'Cobrança'],
    stats: [['caixa conferido', caixa ? `${caixa.conferidoPct ?? 0}%` : '—'], ['entrou hoje', brl(caixa?.entradas)], ['cobranças', cobr.length]] },
  { n: '04', nome: 'Atendimento', verbo: 'responder', cor: '#a78bfa', agentes: ['Atendente de IA', 'Pós-venda'],
    stats: [['atendimentos', atend.length], ['resolvidos', atend.filter(x => x.status === 'resolvido').length], ['na fila', atend.filter(x => x.status === 'aberto').length]] },
  { n: '05', nome: 'Assistente', verbo: 'organizar', cor: '#fbbf24', agentes: ['Assistente Pessoal'],
    stats: [['decisões pra você', fila.length]] },
];

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(emp.nome || 'Sua Empresa')} · IA</title><style>
:root{--bg:#0b0f17;--card:#121826;--line:#1f2937;--tx:#e5e7eb;--mut:#8b95a7;--acc:#f97316}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px 16px}
.w{max-width:1100px;margin:auto}h1{font-size:28px;margin:0}h1 b{color:var(--acc)}.sub{color:var(--mut);font-family:ui-monospace,monospace;font-size:13px;margin:4px 0 24px}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.c{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
.t{display:flex;justify-content:space-between;align-items:baseline}.n{font-family:ui-monospace,monospace;font-size:12px}.v{color:var(--mut);font-size:12px;font-family:ui-monospace,monospace}
h2{margin:4px 0 8px;font-size:20px}ul{margin:0;padding:0;list-style:none}li{font-size:13px;padding:2px 0;color:#cbd5e1}
.s{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;border-top:1px solid var(--line);padding-top:8px}.s div{font-family:ui-monospace,monospace;font-size:12px;color:var(--mut)}.s b{display:block;font-size:20px;color:var(--tx)}
.sec{margin-top:24px}.sec h3{font-family:ui-monospace,monospace;letter-spacing:.08em;font-size:13px;color:var(--mut);margin:0 0 10px}
.ap{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.ap small{color:var(--mut)}.pill{font-size:12px;border:1px solid var(--acc);color:var(--acc);border-radius:99px;padding:2px 10px;white-space:nowrap;align-self:center}
pre{white-space:pre-wrap;font:12px/1.6 ui-monospace,monospace;color:#cbd5e1;margin:0}.foot{color:var(--mut);font-size:12px;margin-top:24px}
</style></head><body><div class="w">
<h1>${esc(emp.nome || 'Sua Empresa')} <b>[IA]</b></h1>
<div class="sub">${dia} · 5 times · 10 funcionários de IA · você aprova</div>
<div class="g">${times.map(t => `<div class="c" style="border-top:3px solid ${t.cor}"><div class="t"><span class="n" style="color:${t.cor}">${t.n}</span><span class="v">${t.verbo}</span></div>
<h2>${t.nome}</h2><ul>${t.agentes.map(a => `<li>▸ ${a}</li>`).join('')}</ul>
<div class="s">${t.stats.map(([k, v]) => `<div><b>${esc(v)}</b>${k}</div>`).join('')}</div></div>`).join('')}</div>
<div class="g sec"><div class="c"><h3>PARA APROVAR · ${fila.length}</h3>${fila.length ? fila.map(i => `<div class="ap"><div>${esc(i.titulo)}<br><small>${esc(i.agente)} · ${esc(i.tipo)}${i.resumo ? ' · ' + esc(i.resumo) : ''}</small></div><span class="pill">aprovar</span></div>`).join('') : '<small style="color:var(--mut)">Nada esperando você.</small>'}
<p class="v" style="margin-top:10px">Para aprovar, diga no Claude Code: "aprova tudo" ou "aprova o ${esc(fila[0]?.id || 'id')}".</p></div>
<div class="c"><h3>HOJE · O QUE ANDOU</h3><pre>${diario.length ? esc(diario.join('\n').replace(/\*\*/g, '')) : 'Nenhuma rotina rodou ainda hoje.'}</pre></div></div>
<p class="foot">Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: emp.fusoHorario || 'America/Sao_Paulo' })} a partir dos arquivos da empresa. Números reais dos conectores; onde aparece — ainda não há dado.</p>
</div></body></html>`;
fs.mkdirSync(caminho('saida'), { recursive: true });
fs.writeFileSync(caminho('saida', 'painel.html'), html);
console.log(caminho('saida', 'painel.html'));

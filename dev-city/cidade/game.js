/* =========================================================================
   DEV CITY 3D · JOGO E INTERFACE
   Reaproveita do protótipo anterior: missões, quiz, entrega, recompensas,
   conquistas, salvamento (mesma chave do modo clássico), exportar/importar.
   Novo: câmera em terceira pessoa / isométrica / mapa 2D, HUD em vidro,
   minimapa com rota, painel lateral de missão, mapa com filtros.
   ========================================================================= */
(() => {
"use strict";
const DC = window.DC, CW = window.CityWorld, LAY = CW.LAYOUT;
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = u => /^https:\/\//.test(u || "") ? esc(u) : "";
const fmt = n => "$" + Math.round(n).toLocaleString("pt-BR");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/* -------------------------------------------------------------------------
   1. AJUSTES (só neste aparelho)
   ------------------------------------------------------------------------- */
const SET_KEY = "devcity.city.settings.v2";
const isTouch = matchMedia("(pointer: coarse)").matches;
const smallScreen = Math.min(screen.width, screen.height) < 700;
const SET = Object.assign({
  quality: isTouch ? (smallScreen ? "desempenho" : "equilibrada") : "alta",
  cam: "terceira", time: "ciclo", reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
  effects: true, sound: true, miniZoom: 2.4, fpsHint: false
}, (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch (e) { return {}; } })());
const saveSet = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) {} };
document.documentElement.classList.toggle("reduce", !!SET.reduce);

/* -------------------------------------------------------------------------
   2. PROGRESSO (mesma chave do modo clássico)
   ------------------------------------------------------------------------- */
let S, leaving = false;
function loadS(){
  try { S = JSON.parse(localStorage.getItem(DC.KEY) || "null"); } catch (e) { S = null; }
  if (!S || typeof S !== "object") {
    S = {app:"dev-city", v:3, sel:null, done:{}, steps:{}, proj:{}, heist:{}, openHeist:null, days:[], bestStreak:0, bonus:0, firstTries:0, profile:null, ach:{}};
    try { const o = JSON.parse(localStorage.getItem("devcity.v2") || "null"); if (o) { S.sel = o.sel || null; S.done = o.done || {}; S.heist = o.heist || {}; } } catch (e) {}
  }
  S.city = DC.sanitizeCity(S.city);
  if (!Array.isArray(S.days)) S.days = [];
}
const save = () => { if (leaving) return; try { localStorage.setItem(DC.KEY, JSON.stringify(S)); } catch (e) {} };
loadS();
function streak(){
  const set = new Set(S.days), d = new Date(); let n = 0;
  const key = x => x.getFullYear() + "-" + String(x.getMonth()+1).padStart(2,"0") + "-" + String(x.getDate()).padStart(2,"0");
  if (!set.has(key(d))) d.setDate(d.getDate() - 1);
  while (set.has(key(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function touch(){ const d = DC.today(); if (!S.days.includes(d)) { S.days.push(d); S.days.sort(); } S.bestStreak = Math.max(S.bestStreak || 0, streak()); }

/* -------------------------------------------------------------------------
   3. MISSÕES (aulas e links vêm das trilhas existentes em data.js)
   ------------------------------------------------------------------------- */
const TR = Object.fromEntries(DC.T.map(t => [t.id, t]));
const HRS = [0, 4, 6, 10, 14, 20];
const DIFF = ["", "Fácil", "Fácil", "Moderada", "Difícil", "Lendária"];
const DNAME = {centro:"Centro", orla:"Orla Azul", caribe:"Barrio Caribe"};
const MIS = [
  {id:"intro", name:"Chegada à Costa Solar", d:"centro", type:"intro", spot:"intro", req:[], xp:20,
    npc:["Nina","guia do Metrô Central","#56d6e4","Bem-vindo ao Centro! Cada pessoa com um anel amarelo no chão tem uma missão. Comece pela Dona Bia, na entrada da Torre Nó Central, do outro lado da rua."],
    concept:"Como a cidade funciona: missões, aulas, desafios e recompensas"},
  {id:"expediente", name:"Primeiro Expediente", d:"centro", type:"main", spot:"expediente", track:"backend", i:0, req:[],
    npc:["Dona Bia","coordenadora do coworking Nó Central","#c9a6e6","Primeiro dia por aqui? Toda carreira começa pela lógica: sem ela, nenhum código fica de pé."],
    concept:"Variáveis, condições e repetições", ex:"Crie um programa que receba três notas e calcule a média. Mostre Aprovado (média 7 ou mais), Recuperação (de 5 a 7) ou Reprovado. Pode usar Portugol, Python ou JavaScript."},
  {id:"commit", name:"Commit na Estação", d:"centro", type:"main", spot:"commit", track:"backend", i:2, req:["expediente"],
    npc:["Téo","operador do Metrô Central","#7fb2ff","Aqui nenhum trem sai sem registro. No código é igual: cada mudança vira um commit."], concept:"Versionamento com Git e GitHub"},
  {id:"interface", name:"Interface à Beira-Mar", d:"orla", type:"main", spot:null, track:"frontend", i:0, req:["expediente"],
    npc:["Kauê","dono do Quiosque Coral","#f0a64a","Meu quiosque precisa aparecer bonito no celular. Me ajuda a montar um cartão de apresentação?"],
    concept:"HTML semântico, CSS e Flexbox", ex:"Crie um cartão de perfil responsivo com HTML e CSS: foto, nome, uma frase e três links. Ele precisa ficar bom no celular e no computador."},
  {id:"pedidos", name:"Pedidos na Areia", d:"orla", type:"main", spot:null, track:"frontend", i:3, req:["interface"],
    npc:["Marina","chef da barraca Maré Mansa","#5fd38d","Os pedidos chegam todos de uma vez! Preciso de uma lista que eu consiga marcar e limpar."],
    concept:"Arrays, funções e eventos em JavaScript", ex:"Crie uma lista de pedidos em JavaScript: um campo de texto, um botão Adicionar e, em cada pedido, um botão para marcar como pronto e outro para remover."},
  {id:"bairro", name:"Sistema do Bairro", d:"caribe", type:"main", spot:null, track:"backend", i:4, req:["commit"],
    npc:["Seu Ramón","dono do Mercadito Ramón","#ef8a9a","¡Hola! Quero cadastrar os produtos da venda num sistema. Dá para fazer uma API para mim?"],
    concept:"APIs REST: rotas, métodos HTTP e JSON", ex:"Crie uma API para registrar os produtos de uma loja do bairro, com rotas de cadastro (POST), listagem (GET), atualização (PUT) e exclusão (DELETE). Teste no Postman ou Insomnia."}
];
const SPECIAL = {id:"carreira", name:"Conversa de Carreira", d:"centro", type:"special", spot:"carreira", req:["expediente"], xp:150,
  npc:["Lia","recrutadora, sempre no Café Byte","#a891ff","Senta aí! Vou te contar o que eu olho no perfil de quem está começando."],
  concept:"Carreira e organização dos estudos", ex:"Monte um plano de estudos de 4 semanas: escolha uma trilha, defina 3 horários fixos por semana e crie um repositório no GitHub para guardar os exercícios.",
  quiz:[["Para quem está começando, o que mais ajuda a conseguir a primeira vaga?",["Decorar o nome de muitas linguagens","Ter projetos práticos publicados no GitHub","Esperar terminar todos os cursos para praticar"],1],
        ["Qual rotina de estudo costuma render mais?",["10 horas seguidas uma vez por mês","Pouco tempo, mas com frequência e prática","Só assistir vídeos, sem programar"],1]]};
const DAILY = {id:"diario", name:"Desafio do Dia", d:"centro", type:"daily", spot:"diario", req:[], xp:50,
  npc:["Terminal da Praça","tela pública da Praça Central","#56d6e4","Uma pergunta nova todo dia. Acertou, levou."]};
const PROJ = {
  centro:{name:"Sistema de Organização de Estudos", spot:"proj-centro", needs:["expediente","commit"], tech:["Lógica de programação","Git e GitHub","Markdown"],
    desc:"Um sistema simples para organizar seus estudos: metas da semana, tarefas e registro do que foi feito.", reqs:["Cadastro de metas e tarefas (pode ser no terminal)","Cálculo de quanto da semana foi concluído","Código versionado no GitHub com commits claros","README explicando como usar"]},
  orla:{name:"Portfólio Pessoal Responsivo", spot:null, needs:["interface","pedidos"], tech:["HTML","CSS","JavaScript"],
    desc:"Seu site de apresentação, bonito no celular, com projetos e contato.", reqs:["Seções Sobre, Projetos e Contato","Layout responsivo no celular e no computador","Uma interação em JavaScript (filtro, tema ou lista)","Publicado online (GitHub Pages, Netlify ou Vercel)"]},
  caribe:{name:"API de Comércio Local", spot:null, needs:["bairro"], tech:["Node.js ou Java","API REST","Banco de dados SQL"],
    desc:"A API completa do Mercadito: produtos, estoque e vendas do dia.", reqs:["CRUD de produtos","Dados salvos em banco SQL","Rota de relatório de vendas do dia","Documentação das rotas com exemplos"]}
};
const PROJ_XP = 500, PROJ_CASH = 5000, QUIZ_BONUS = 250;
const POINTS = [...MIS, SPECIAL, DAILY, ...Object.entries(PROJ).map(([d, p]) => Object.assign({id:"proj-" + d, type:"project", d, req:p.needs}, p))];
const TRACK_OF = m => m.track ? TR[m.track].area : m.type === "special" || m.type === "intro" ? "Carreira" : m.type === "daily" ? "Revisão" : "Projeto";
/* posição do marcador: 1,3 m à frente de quem entrega a missão */
POINTS.forEach(m => { const s = m.spot && LAY.SPOTS[m.spot]; if (s) { m.at = [s.x + Math.sin(s.face) * 1.3, s.z + Math.cos(s.face) * 1.3]; m.place = s.label; } });

function lesson(m){ if (!m.track) return null; const t = TR[m.track], r = t.m[m.i]; return {track:t, title:r[0], course:r[1], prof:r[2], link:r[3], diff:r[4], xp:r[5], desc:r[6], topic:DC.topicFor(r[0])}; }
const rec = k => S.city.rec[k];
const recKey = m => m.type === "daily" ? "d:" + DC.today() : m.type === "project" ? "p:" + m.d : (m.type === "special" ? "s:" : "m:") + m.id;
const isDone = m => !!rec(recKey(m));
const districtOpen = d => d === "centro" || (d === "orla" && !!rec("m:expediente")) || (d === "caribe" && !!rec("m:commit"));
const reqsMet = m => (m.req || []).every(id => rec("m:" + id));
function stateOf(m){
  if (isDone(m)) return "done";
  if (!districtOpen(m.d) || !reqsMet(m)) return "locked";
  const st = S.city.m[m.id];
  return st && (st.acc || st.w || st.p || st.q) ? "progress" : "available";
}
const LOCK_SVG = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="#111"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="#111" stroke-width="1.8"/></svg>`;
function look(m){
  const st = stateOf(m);
  if (st === "done") return {c:"#5fd38d", ic:"✓", label:"Concluída", st};
  if (st === "locked") return {c:"#8792a3", ic:LOCK_SVG, label:"Bloqueada", st};
  if (m.type === "project") return {c:"#f0a64a", ic:"P", label: st === "progress" ? "Projeto em andamento" : "Projeto final", st};
  if (m.type === "special") return {c:"#a891ff", ic:"★", label: st === "progress" ? "Especial em andamento" : "Missão especial", st};
  if (m.type === "daily") return {c:"#56d6e4", ic:"D", label:"Desafio diário", st};
  if (st === "progress") return {c:"#6aa6ff", ic:"…", label:"Em andamento", st};
  return {c:"#f5c84c", ic:"!", label:"Disponível", st};
}
function reward(m){
  if (m.type === "project") return {xp:PROJ_XP, cash:PROJ_CASH};
  if (m.type === "daily" || m.type === "special" || m.type === "intro") return {xp:m.xp, cash:m.xp * DC.CASH_X};
  const l = lesson(m); return {xp:l.xp, cash:l.xp * DC.CASH_X};
}
const titleOf = m => m.type === "project" ? "Projeto: " + m.name : m.name;
const npcOf = m => m.npc || (m.type === "project" ? ["Mesa de estudos", "projeto final de " + DNAME[m.d], "#f0a64a", "Juntou o que aprendeu por aqui? Hora de construir algo seu."] : null);
const distTo = m => m.at ? Math.hypot(P.x - m.at[0], P.z - m.at[1]) : Infinity;

/* -------------------------------------------------------------------------
   4. SIMULAÇÃO E RENDERIZAÇÃO
   ------------------------------------------------------------------------- */
const sim = CW.createSim();
let W3 = null, mode = SET.cam === "2d" ? "2d" : "3d";
function webglOK(){ try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; } }
const HAS3D = !!(window.THREE && window.THREE.BufferGeometryUtils) && webglOK();
let hour = 17.4;   // começa na hora dourada
const PRESET = {manha:8.6, tarde:14, por:18.2, noite:21.5};
const hourNow = () => SET.time === "ciclo" ? hour : PRESET[SET.time] ?? hour;
const periodName = h => h < 5 ? "Madrugada" : h < 12 ? "Manhã" : h < 17.3 ? "Tarde" : h < 19 ? "Pôr do sol" : "Noite";

/* -------------------------------------------------------------------------
   5. JOGADOR E COLISÃO
   ------------------------------------------------------------------------- */
const P = {x:LAY.spawn.x, z:LAY.spawn.z, rot:LAY.spawn.yaw + Math.PI, speed:0, moving:false};
const keys = new Set(), joy = {x:0, y:0, active:false};
const NPC_BOX = Object.values(LAY.SPOTS).filter(s => !s.board).map(s => ({x0:s.x - .4, x1:s.x + .4, z0:s.z - .4, z1:s.z + .4, h:1.8}));
const SOLID = [...LAY.COLLIDERS, ...NPC_BOX];
const LIM = LAY.EDGE - 1.5;
function blocked(x, z){
  const r = .32;
  if (Math.abs(x) > LIM || Math.abs(z) > LIM) return "edge";
  for (const o of SOLID) if (x + r > o.x0 && x - r < o.x1 && z + r > o.z0 && z - r < o.z1) return true;
  return false;
}
let lastEdge = 0, lastRot = 0;
function movePlayer(dt){
  let ix = 0, iz = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) iz += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) iz -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
  if (joy.active) { ix += joy.x; iz -= joy.y; }
  const mag = Math.hypot(ix, iz); if (mag > 1) { ix /= mag; iz /= mag; }
  const run = keys.has("ShiftLeft") || keys.has("ShiftRight") || (joy.active && Math.hypot(joy.x, joy.y) > .92);
  const yaw = mode === "2d" ? 0 : SET.cam === "iso" ? CAM.isoYaw : CAM.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const target = Math.min(1, Math.hypot(ix, iz)) * (run ? 6.4 : 3.3);
  P.speed = lerp(P.speed, target, Math.min(1, dt * 8));
  P.moving = P.speed > .15;
  if (Math.hypot(ix, iz) < .05) { if (P.speed < .2) P.speed = 0; return; }
  const dx = fx * iz + rx * ix, dz = fz * iz + rz * ix, l = Math.hypot(dx, dz) || 1;
  const want = Math.atan2(dx, dz);
  P.rot += angDiff(P.rot, want) * Math.min(1, dt * 12);
  const nx = P.x + dx / l * P.speed * dt, nz = P.z + dz / l * P.speed * dt;
  const bx = blocked(nx, P.z), bz = blocked(P.x, nz);
  if (!bx) P.x = nx; if (!bz) P.z = nz;
  if ((bx === "edge" || bz === "edge") && performance.now() - lastEdge > 4000) { lastEdge = performance.now();
    const dir = Math.abs(P.x) > Math.abs(P.z) ? (P.x > 0 ? "Orla Azul (leste)" : "Barrio Caribe (oeste)") : (P.z < 0 ? "Distrito de Tecnologia (norte)" : "Porto Solar (sul)");
    toast(`Área em obras. Em breve: ${dir}. As missões de lá já estão na lista (J).`); }
}

/* -------------------------------------------------------------------------
   6. CÂMERA: terceira pessoa (padrão), isométrica ou mapa 2D
   ------------------------------------------------------------------------- */
const CAM = {yaw:LAY.spawn.yaw, pitch:.3, dist: isTouch ? 4.6 : 5.6, cur:null, d:5.6, isoYaw:Math.PI/4, lastManual:-9};
function camClear(tx, ty, tz, yaw, pitch, want){
  const cp = Math.cos(pitch);
  for (let s = .8; s <= want; s += .25) {
    const x = tx + Math.sin(yaw) * cp * s, y = ty + Math.sin(pitch) * s, z = tz + Math.cos(yaw) * cp * s;
    for (const o of LAY.COLLIDERS) if (o.h > 1.2 && y < o.h + .3 && x > o.x0 - .3 && x < o.x1 + .3 && z > o.z0 - .3 && z < o.z1 + .3) return Math.max(.35, s - .45);
  }
  return want;
}
function updateCamera(dt, t){
  if (!W3) return;
  const cam = W3.camera;
  let px, py, pz, lx, ly, lz, fov = 55;
  if (!started) {   /* abertura: voo lento sobre o cruzamento */
    const a = t * .05 + .6; px = Math.cos(a) * 42; pz = Math.sin(a) * 42; py = 17; lx = 0; ly = 5; lz = 0;
  } else if (SET.cam === "iso") {
    const d = 30, pit = .92; px = P.x + Math.sin(CAM.isoYaw) * Math.cos(pit) * d; py = Math.sin(pit) * d; pz = P.z + Math.cos(CAM.isoYaw) * Math.cos(pit) * d; lx = P.x; ly = 1; lz = P.z; fov = 32;
  } else {
    /* segue a direção do personagem quando ele anda e o mouse está parado */
    if (P.moving && t - CAM.lastManual > 1.4) CAM.yaw += angDiff(CAM.yaw, P.rot + Math.PI) * Math.min(1, dt * 1.6);
    const near = nearPoint && !anyOpen();
    const wantD = near ? Math.min(CAM.dist, 4.2) : CAM.dist; let pit = near ? Math.min(CAM.pitch, .24) : CAM.pitch;
    const ty = 1.55; let clear = camClear(P.x, ty, P.z, CAM.yaw, pit, wantD);
    /* parede logo atrás: em vez de colar no personagem, a câmera sobe (visão de cima) */
    if (clear < 2.2) for (const alt of [.75, 1.1]) { const c2 = camClear(P.x, ty, P.z, CAM.yaw, alt, wantD); if (c2 > clear + .5) { clear = c2; pit = alt; break; } }
    CAM.pitNow = lerp(CAM.pitNow ?? pit, pit, Math.min(1, dt * 4)); pit = CAM.pitNow;
    CAM.d = clear < CAM.d ? clear : lerp(CAM.d, clear, Math.min(1, dt * 2.5));
    const cp = Math.cos(pit);
    px = P.x + Math.sin(CAM.yaw) * cp * CAM.d; py = ty + Math.sin(pit) * CAM.d; pz = P.z + Math.cos(CAM.yaw) * cp * CAM.d;
    lx = P.x; ly = 1.35; lz = P.z;
  }
  const k = CAM.cur ? 1 - Math.exp(-dt * (started ? 9 : 2)) : 1;
  CAM.cur = CAM.cur || {px, py, pz, lx, ly, lz, fov};
  for (const [a, b] of [["px", px], ["py", py], ["pz", pz], ["lx", lx], ["ly", ly], ["lz", lz], ["fov", fov]]) CAM.cur[a] = lerp(CAM.cur[a], b, k);
  cam.position.set(CAM.cur.px, Math.max(.6, CAM.cur.py), CAM.cur.pz); cam.lookAt(CAM.cur.lx, CAM.cur.ly, CAM.cur.lz);
  if (Math.abs(cam.fov - CAM.cur.fov) > .01) { cam.fov = CAM.cur.fov; cam.updateProjectionMatrix(); }
}

/* -------------------------------------------------------------------------
   7. MAPA BASE, ROTA, MINIMAPA E MODO 2D
   ------------------------------------------------------------------------- */
const MAP = {x0:-110, x1:110, z0:-110, z1:110, s:3};
const base = document.createElement("canvas");
const mx = x => (x - MAP.x0) * MAP.s, mz = z => (z - MAP.z0) * MAP.s;
function drawBase(){
  base.width = (MAP.x1 - MAP.x0) * MAP.s; base.height = (MAP.z1 - MAP.z0) * MAP.s;
  const g = base.getContext("2d"), s = MAP.s;
  const R = (x0, x1, z0, z1, c) => { g.fillStyle = c; g.fillRect(mx(x0), mz(z0), (x1 - x0) * s, (z1 - z0) * s); };
  g.fillStyle = "#0e1626"; g.fillRect(0, 0, base.width, base.height);
  /* áreas vizinhas (em reconstrução / em breve) */
  for (const a of LAY.AREAS) if (a.state !== "open") { R(Math.max(a.x0, MAP.x0), Math.min(a.x1, MAP.x1), Math.max(a.z0, MAP.z0), Math.min(a.z1, MAP.z1), "#111b2c");
    g.save(); g.beginPath(); g.rect(mx(Math.max(a.x0, MAP.x0)), mz(Math.max(a.z0, MAP.z0)), (Math.min(a.x1, MAP.x1) - Math.max(a.x0, MAP.x0)) * s, (Math.min(a.z1, MAP.z1) - Math.max(a.z0, MAP.z0)) * s); g.clip();
      g.strokeStyle = "rgba(255,255,255,.05)"; g.lineWidth = 2; for (let k = -base.height; k < base.width; k += 14) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + base.height, base.height); g.stroke(); } g.restore(); }
  for (const q of LAY.QUADS) R(Math.max(q.x0, -LAY.EDGE), Math.min(q.x1, LAY.EDGE), Math.max(q.z0, -LAY.EDGE), Math.min(q.z1, LAY.EDGE), "#1b2436");
  R(LAY.AV.x0, LAY.AV.x1, MAP.z0, MAP.z1, "#2a3448"); R(MAP.x0, MAP.x1, LAY.ST.z0, LAY.ST.z1, "#2a3448");
  g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1; g.setLineDash([6, 8]);
  for (const x of [-3.7, 3.7]) { g.beginPath(); g.moveTo(mx(x), mz(MAP.z0)); g.lineTo(mx(x), mz(MAP.z1)); g.stroke(); }
  g.setLineDash([]); g.strokeStyle = "rgba(226,184,58,.5)"; g.beginPath(); g.moveTo(mx(MAP.x0), mz(0)); g.lineTo(mx(MAP.x1), mz(0)); g.stroke();
  R(-.6, .6, MAP.z0, -12, "#24432f"); R(-.6, .6, 12, MAP.z1, "#24432f");
  g.fillStyle = "rgba(255,255,255,.35)"; for (let x = -8.6; x <= 8.2; x += 1.1) { g.fillRect(mx(x), mz(-9.6), .6 * s, 3.2 * s); g.fillRect(mx(x), mz(6.4), .6 * s, 3.2 * s); }
  for (let z = -4.8; z <= 4.4; z += 1.1) { g.fillRect(mx(-13.6), mz(z), 3.2 * s, .6 * s); g.fillRect(mx(10.4), mz(z), 3.2 * s, .6 * s); }
  const p = LAY.PLAZA; R(p.x0, p.x1, p.z0, p.z1, "#1f3a33"); g.fillStyle = "#2f5f7a"; g.beginPath(); g.arc(mx(p.fountain[0]), mz(p.fountain[1]), 3.3 * s, 0, 7); g.fill();
  for (const b of LAY.BUILDINGS) { R(b.x0, b.x1, b.z0, b.z1, b.style === "station" ? "#23405a" : "#2c3852"); g.strokeStyle = b.style === "station" ? "#56d6e4" : "#3d4c6a"; g.lineWidth = 1.5; g.strokeRect(mx(b.x0), mz(b.z0), (b.x1 - b.x0) * s, (b.z1 - b.z0) * s); }
  g.fillStyle = "#2f5537"; for (const t of LAY.TREES) { g.beginPath(); g.arc(mx(t.x), mz(t.z), (t.big ? 1.6 : 1.1) * s, 0, 7); g.fill(); }
}
function drawNames(g, X, Z, k){
  g.save(); g.textAlign = "center"; g.textBaseline = "middle";
  for (const a of LAY.AREAS) { const side = a.id === "orla" || a.id === "caribe";
    const cx = X(side ? (a.id === "orla" ? (LAY.EDGE + MAP.x1) / 2 + 4 : (MAP.x0 + -LAY.EDGE) / 2 - 4) : clamp((a.x0 + a.x1) / 2, MAP.x0 + 20, MAP.x1 - 20));
    const cz = Z(a.state === "open" ? LAY.EDGE - 6 : side ? -24 : clamp((a.z0 + a.z1) / 2, MAP.z0 + 12, MAP.z1 - 12));
    g.font = `700 ${Math.round((side ? 13 : 15) * k)}px Sora, Inter, sans-serif`; g.fillStyle = a.state === "open" ? "rgba(238,242,247,.9)" : "rgba(174,184,199,.85)"; g.fillText(a.name.toUpperCase(), cx, cz);
    if (a.state !== "open") { g.font = `500 ${Math.round(11 * k)}px Inter, sans-serif`; g.fillStyle = "rgba(174,184,199,.7)"; g.fillText(a.state === "rebuild" ? "em reconstrução" : "em breve", cx, cz + 15 * k); if (side) g.fillText("missões pela lista", cx, cz + 29 * k); } }
  g.font = `600 ${Math.round(11 * k)}px Inter, sans-serif`; g.fillStyle = "rgba(238,242,247,.55)";
  g.save(); g.translate(X(0), Z(-34)); g.rotate(-Math.PI/2); g.fillText("AV. HORIZONTE", 0, 0); g.restore(); g.fillText("R. DAS MARÉS", X(-40), Z(0));
  for (const b of LAY.BUILDINGS) if (k >= .9) { g.font = `500 ${Math.round(10 * k)}px Inter, sans-serif`; g.fillStyle = "rgba(238,242,247,.55)"; g.fillText(b.name, X((b.x0 + b.x1) / 2), Z((b.z0 + b.z1) / 2)); }
  g.restore();
}
function drawIcon(g, m, x, y, r, highlight){
  const lk = look(m);
  g.save(); g.translate(x, y);
  if (highlight) { g.beginPath(); g.arc(0, 0, r * 1.9, 0, 7); g.fillStyle = "rgba(245,200,76,.18)"; g.fill(); }
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.fillStyle = lk.c; g.fill(); g.lineWidth = 2; g.strokeStyle = "rgba(8,12,20,.9)"; g.stroke();
  g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
  if (lk.st === "locked") { g.fillRect(-r * .42, -r * .05, r * .84, r * .6); g.lineWidth = r * .18; g.beginPath(); g.arc(0, -r * .08, r * .28, Math.PI, 0); g.stroke(); }
  else { g.font = `700 ${Math.round(r * 1.1)}px Inter, sans-serif`; g.fillText(lk.ic, 0, 1); }
  g.restore();
}
function drawPlayer(g, x, y, rot, r){ g.save(); g.translate(x, y); g.rotate(Math.PI - rot);
  g.beginPath(); g.arc(0, 0, r * 1.7, 0, 7); g.fillStyle = "rgba(86,214,228,.18)"; g.fill();
  g.beginPath(); g.moveTo(0, -r * 1.2); g.lineTo(r * .85, r * .9); g.lineTo(0, r * .45); g.lineTo(-r * .85, r * .9); g.closePath(); g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 2; g.strokeStyle = "#56d6e4"; g.stroke(); g.restore(); }
/* rota: menor caminho pelo grafo de calçadas e faixas de pedestre */
let route = [], routeFor = null, routeT = 0;
function computeRoute(target){
  if (!target || !target.at) return [];
  const N = LAY.NODES, ids = Object.keys(N), adj = {};
  ids.forEach(i => adj[i] = []); for (const [a, b] of LAY.EDGES) { const d = Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1]); adj[a].push([b, d]); adj[b].push([a, d]); }
  const nearest = (x, z) => ids.reduce((best, i) => Math.hypot(N[i][0] - x, N[i][1] - z) < Math.hypot(N[best][0] - x, N[best][1] - z) ? i : best, ids[0]);
  const direct = Math.hypot(P.x - target.at[0], P.z - target.at[1]);
  const quad = (x, z) => (x > 0 ? "e" : "w") + (z > 0 ? "s" : "n");
  if (quad(P.x, P.z) === quad(target.at[0], target.at[1]) || direct < 14) return [[P.x, P.z], target.at];
  const s = nearest(P.x, P.z), e = nearest(target.at[0], target.at[1]);
  const dist = {}, prev = {}, Q = new Set(ids); ids.forEach(i => dist[i] = Infinity); dist[s] = 0;
  while (Q.size) { let u = null; for (const i of Q) if (u === null || dist[i] < dist[u]) u = i; Q.delete(u); if (u === e) break; for (const [v, d] of adj[u]) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; } }
  const path = []; for (let u = e; u; u = prev[u]) path.unshift(N[u]);
  return [[P.x, P.z], ...path, target.at];
}
const mini = $("mini"), mg = mini.getContext("2d");
function drawMini(){
  const Wm = mini.width, Hm = mini.height, sc = SET.miniZoom;
  mg.fillStyle = "#0e1626"; mg.fillRect(0, 0, Wm, Hm);
  const cx = mx(P.x), cz = mz(P.z), vw = Wm / sc, vh = Hm / sc;
  mg.drawImage(base, cx - vw / 2, cz - vh / 2, vw, vh, 0, 0, Wm, Hm);
  const T = (x, z) => [(mx(x) - cx) * sc + Wm / 2, (mz(z) - cz) * sc + Hm / 2];
  if (route.length > 1) { mg.save(); mg.strokeStyle = "rgba(245,200,76,.9)"; mg.lineWidth = 5; mg.lineCap = "round"; mg.lineJoin = "round"; mg.setLineDash([2, 10]); mg.beginPath(); route.forEach((p, i) => { const [x, y] = T(p[0], p[1]); i ? mg.lineTo(x, y) : mg.moveTo(x, y); }); mg.stroke(); mg.restore(); }
  const tr = tracked();
  for (const m of POINTS) { if (!m.at) continue; const isT = m === tr; const st = stateOf(m);
    if (!isT && (st === "locked" || distTo(m) > 60)) continue;
    let [x, y] = T(m.at[0], m.at[1]); const inside = Math.hypot(x - Wm / 2, y - Hm / 2) < Wm / 2 - 18;
    if (!inside) { if (!isT) continue; const a = Math.atan2(y - Hm / 2, x - Wm / 2); x = Wm / 2 + Math.cos(a) * (Wm / 2 - 20); y = Hm / 2 + Math.sin(a) * (Hm / 2 - 20); }
    drawIcon(mg, m, x, y, isT ? 13 : 9, isT); }
  drawPlayer(mg, Wm / 2, Hm / 2, P.rot, 12);
}
const c2 = $("map2d"), g2 = c2.getContext("2d");
let zoom2d = 2.2;
function draw2D(){
  const dpr = Math.min(devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
  if (c2.width !== Math.round(w * dpr) || c2.height !== Math.round(h * dpr)) { c2.width = Math.round(w * dpr); c2.height = Math.round(h * dpr); }
  const g = g2; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sc = zoom2d, cx = mx(P.x), cz = mz(P.z);
  g.fillStyle = "#0e1626"; g.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = true; g.drawImage(base, cx - w / sc / 2, cz - h / sc / 2, w / sc, h / sc, 0, 0, w, h);
  const X = x => (mx(x) - cx) * sc + w / 2, Z = z => (mz(z) - cz) * sc + h / 2;
  drawNames(g, X, Z, Math.min(1.2, sc / 2.2));
  if (route.length > 1) { g.save(); g.strokeStyle = "rgba(245,200,76,.85)"; g.lineWidth = 4; g.setLineDash([3, 9]); g.lineCap = "round"; g.beginPath(); route.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.stroke(); g.restore(); }
  for (const c of sim.cars) { g.save(); g.translate(X(c.x), Z(c.z)); g.rotate(-c.rot); const L = c.type === "bus" ? 11.5 : 4.4; g.fillStyle = c.color; g.fillRect(-.9 * MAP.s * sc, -L / 2 * MAP.s * sc, 1.8 * MAP.s * sc, L * MAP.s * sc); g.restore(); }
  for (const p of sim.peds) if (p.visible) { g.fillStyle = p.look.top; g.beginPath(); g.arc(X(p.x), Z(p.z), Math.max(3, .35 * MAP.s * sc), 0, 7); g.fill(); }
  for (const s of sim.still) if (!s.night || sim.night > .5) { g.fillStyle = s.look.top; g.beginPath(); g.arc(X(s.x), Z(s.z), Math.max(3, .35 * MAP.s * sc), 0, 7); g.fill(); }
  const tr = tracked(); for (const m of POINTS) if (m.at) drawIcon(g, m, X(m.at[0]), Z(m.at[1]), m === tr ? 13 : 11, m === tr);
  drawPlayer(g, w / 2, h / 2, P.rot, 12);
  const night = W3 ? W3.env.night : (hourNow() > 19.5 || hourNow() < 6 ? .8 : 0);
  if (night > .05) { g.fillStyle = `rgba(4,8,20,${night * .35})`; g.fillRect(0, 0, w, h); }
}

/* -------------------------------------------------------------------------
   8. RÓTULOS DO MUNDO (surgem perto; são botões acessíveis)
   ------------------------------------------------------------------------- */
const labelEls = {};
function buildLabels(){
  const box = $("labels"); box.innerHTML = "";
  for (const m of POINTS) if (m.at) { const b = document.createElement("button"); b.type = "button"; b.className = "mlabel"; b.style.opacity = "0"; b.hidden = true; box.appendChild(b); labelEls[m.id] = b; b.onclick = () => openPoint(m.id); }
  refreshLabels();
}
function refreshLabels(){
  for (const m of POINTS) { const b = labelEls[m.id]; if (!b) continue; const lk = look(m), rw = reward(m);
    b.style.setProperty("--c", lk.c);
    b.innerHTML = `<span class="ic" aria-hidden="true">${lk.ic}</span><span><b>${esc(titleOf(m))}</b><small>${lk.label} · +${rw.xp} XP · <span class="d"></span></small></span>`;
    b.setAttribute("aria-label", `${titleOf(m)}. ${lk.label}. ${m.place}. Recompensa ${rw.xp} XP e ${fmt(rw.cash)}. Abrir painel.`); }
}
let LIMTOP = 140;
function placeLabels(){
  const w = innerWidth, h = innerHeight, tr = tracked();
  for (const m of POINTS) { const b = labelEls[m.id]; if (!b) continue;
    const d = distTo(m), st = stateOf(m), range = m === tr ? 40 : st === "locked" ? 12 : 24;
    let x, y, front = true;
    if (mode === "3d" && W3) { const p = W3.project(m.at[0], 2.55, m.at[1], w, h); x = p.x; y = p.y; front = p.front; }
    else { x = (mx(m.at[0]) - mx(P.x)) * zoom2d + w / 2; y = (mz(m.at[1]) - mz(P.z)) * zoom2d + h / 2 - 20; }
    const show = front && d < range && x > -120 && x < w + 120 && y > LIMTOP && y < h - 40 && !anyOpen();
    const op = show ? clamp((range - d) / 6, 0, 1) : 0;
    if (op <= 0.01) { if (!b.hidden) { b.style.opacity = "0"; b.hidden = true; } continue; }
    if (b.hidden) b.hidden = false;
    b.style.opacity = String(op);
    b.classList.toggle("far", d > 14);
    const ds = b.querySelector(".d"); if (ds) ds.textContent = Math.round(d) + " m";
    b.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    b.style.zIndex = String(1000 - Math.round(d));
  }
}

/* -------------------------------------------------------------------------
   9. HUD
   ------------------------------------------------------------------------- */
function tracked(){
  const t = POINTS.find(m => m.id === S.city.track);
  if (t && !["done","locked"].includes(stateOf(t))) return t;
  return POINTS.find(m => m.type === "main" && m.at && ["progress","available"].includes(stateOf(m)))
    || POINTS.find(m => m.at && m.type !== "daily" && ["progress","available"].includes(stateOf(m)))
    || POINTS.find(m => ["progress","available"].includes(stateOf(m)) && m.type !== "daily") || null;
}
function renderHUD(){
  const s = DC.playerTotals(S), L = s.level, lo = DC.xpForLevel(L), hi = DC.xpForLevel(L + 1), pct = (s.xp - lo) / (hi - lo);
  $("hLvl").textContent = L; $("hRing").setAttribute("stroke-dashoffset", String(125.66 * (1 - pct)));
  $("hRank").innerHTML = `Nível ${L} <span>· ${esc(DC.RANKS[s.rank])}</span>`;
  $("hCash").textContent = fmt(s.cash); $("hResp").textContent = "Respeito " + s.respect; $("hXpTxt").textContent = `${s.xp.toLocaleString("pt-BR")} XP`;
  document.querySelector(".player").setAttribute("aria-label", `Nível ${L}, ${DC.RANKS[s.rank]}. ${s.xp} XP, ${Math.round(pct * 100)}% para o próximo nível. Dinheiro ${fmt(s.cash)}. Respeito ${s.respect}. Sequência de ${streak()} dias.`);
}
function updateObjective(){
  const t = tracked();
  if (!t) { $("objName").textContent = "Tudo em dia no Centro"; $("objDist").textContent = "Novos bairros em breve"; $("objArrow").style.visibility = "hidden"; return; }
  $("objName").textContent = titleOf(t);
  if (!t.at) { $("objDist").textContent = `${DNAME[t.d]} · disponível pela lista (J)`; $("objArrow").style.visibility = "hidden"; $("objective").setAttribute("aria-label", `Objetivo: ${titleOf(t)}. Disponível pela lista de missões.`); return; }
  const dx = t.at[0] - P.x, dz = t.at[1] - P.z, d = Math.hypot(dx, dz);
  $("objDist").textContent = `${t.place} · ${d < 3.5 ? "você chegou" : Math.round(d) + " m"}`;
  const yaw = mode === "2d" ? 0 : SET.cam === "iso" ? CAM.isoYaw : CAM.yaw;
  const a = Math.atan2(dx, dz) - (yaw + Math.PI);
  $("objArrow").style.visibility = d < 3.5 ? "hidden" : "visible"; $("objArrow").style.transform = `rotate(${-a * 180 / Math.PI}deg)`;
  $("objective").setAttribute("aria-label", `Objetivo: ${titleOf(t)}, ${t.place}, a ${Math.round(d)} metros. Abrir lista de missões.`);
}
let nearPoint = null;
function updatePrompt(){
  if (anyOpen()) { if (!$("prompt").hidden) { $("prompt").hidden = true; $("actBtn").hidden = true; } nearPoint = undefined; return; }
  let best = null, bd = 3.2;
  for (const m of POINTS) { const d = distTo(m); if (d < bd) { bd = d; best = m; } }
  if (best !== nearPoint) { nearPoint = best;
    if (best) { const lk = look(best), n = npcOf(best);
      $("pKind").textContent = ({main:"Missão", special:"Missão especial", daily:"Desafio diário", project:"Projeto final", intro:"Boas-vindas"}[best.type] + " · " + lk.label).toUpperCase();
      $("pName").textContent = titleOf(best); $("pMeta").textContent = `${n ? n[0] + " · " : ""}${best.place}`;
      $("prompt").hidden = false; $("actBtn").hidden = !isTouch; $("actBtn").textContent = best.type === "project" || best.type === "daily" ? "Abrir" : "Falar";
      $("actBtn").setAttribute("aria-label", `Interagir: ${titleOf(best)}`); sfx("near"); }
    else { $("prompt").hidden = true; $("actBtn").hidden = true; } }
  if (best) $("pMeta").textContent = `${npcOf(best) ? npcOf(best)[0] + " · " : ""}${best.place} · ${Math.max(0, Math.round(bd))} m`;
}
let lastZone = null, bannerT;
function updateZone(){
  const zx = P.x > 0 ? "leste" : "oeste", zz = P.z > 0 ? "sul" : "norte";
  const zone = Math.abs(P.x) < 10 && Math.abs(P.z) < 6 ? "Cruzamento Horizonte × Marés" : ({nordeste:"Torre Nó Central e Café Byte", noroeste:"Praça Central", sudeste:"Metrô Central", sudoeste:"Livraria e Edifício Prisma"}[(zz === "norte" ? "nor" : "sud") + zx]);
  if (zone === lastZone) return; lastZone = zone;
  $("bannerT").textContent = "Centro"; $("bannerS").textContent = zone; $("banner").hidden = false;
  clearTimeout(bannerT); bannerT = setTimeout(() => $("banner").hidden = true, 2400);
  const corner = (zz === "norte" ? "n" : "s") + (zx === "leste" ? "e" : "w"); if (!S.city.visited.includes("centro")) S.city.visited.push("centro");
  S.city.corners = S.city.corners || []; if (!S.city.corners.includes(corner)) { S.city.corners.push(corner); checkAch(); }
}
function updateClock(){ const h = hourNow(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60); $("clock").innerHTML = `<b>${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}</b> · ${periodName(h)}`; }

/* -------------------------------------------------------------------------
   10. PAINEL DE MISSÃO (lado direito; folha inferior no celular)
   ------------------------------------------------------------------------- */
const answers = {};
let openId = null;
function openPoint(id){ const m = POINTS.find(p => p.id === id); if (!m) return; openId = id; renderMission(m); openDialog($("dMission")); sfx("open"); }
function stepState(id){ return S.city.m[id] || (S.city.m[id] = {acc:false, w:false, p:false, q:false, tries:0, link:""}); }
function quizOf(m){
  if (m.type === "special") return SPECIAL.quiz;
  if (m.type === "daily") { const all = DC.K.flatMap(k => k[1].q); let hsh = 0; for (const ch of DC.today()) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; return [all[hsh % all.length]]; }
  return lesson(m).topic.q;
}
function renderMission(m){
  const lk = look(m), st = lk.st, rw = reward(m), n = npcOf(m), l = lesson(m), body = $("mBody");
  $("mKind").textContent = `${({main:"Missão", special:"Missão especial", daily:"Desafio diário", project:"Projeto final", intro:"Boas-vindas"})[m.type]} · ${lk.label}`;
  $("mTitle").textContent = titleOf(m);
  const url = l ? safeUrl(l.link) : "";
  const time = l ? "≈ " + HRS[l.diff] + " h" : m.type === "project" ? "≈ 20 h" : m.type === "daily" ? "≈ 2 min" : m.type === "intro" ? "≈ 1 min" : "≈ 30 min";
  let html = `<div class="chips"><span class="chip"><i style="--c:${lk.c}"></i>${lk.label}</span><span class="chip">${esc(DNAME[m.d])}</span><span class="chip">${esc(TRACK_OF(m))}</span><span class="chip rw">+${rw.xp} XP · ${fmt(rw.cash)}</span></div>`;
  if (n) html += `<div class="npc"><span class="face" style="background:${n[2]}" aria-hidden="true">${esc(n[0].split(" ").map(w => w[0]).join("").slice(0,2))}</span><div class="bubble"><b>${esc(n[0])} · ${esc(n[1])}</b>${esc(n[3])}</div></div>`;
  const objective = m.type === "project" ? m.desc : l ? l.topic.o : m.type === "daily" ? "Acertar a pergunta do dia sobre programação." : m.type === "intro" ? "Conhecer a cidade e o jeito de aprender por missões." : "Organizar seus estudos para não parar no meio do caminho.";
  html += `<div class="meta">
      <div><span>Bairro</span><b>${esc(DNAME[m.d])}${m.place ? " · " + esc(m.place) : ""}</b></div><div><span>Trilha</span><b>${esc(l ? l.track.area : TRACK_OF(m))}</b></div>
      <div><span>Dificuldade</span><b>${l ? DIFF[l.diff] : m.type === "project" ? "Difícil" : "Fácil"}</b></div><div><span>Tempo estimado</span><b>${time}</b></div></div>
    <div class="sec"><h3>Objetivo</h3><p>${esc(objective)}</p></div>`;
  if (m.concept) html += `<div class="sec"><h3>Conteúdo ensinado</h3><p>${esc(m.concept)}</p></div>`;
  if (l) html += `<div class="sec"><h3>Aula recomendada</h3><p>${esc(l.course)} · ${esc(l.prof)}</p></div>`;
  const exercise = m.type === "project" || m.type === "intro" ? "" : m.ex || (l ? l.topic.e : "");
  if (exercise) html += `<div class="sec" id="exSec"><h3>Exercício</h3><p>${esc(exercise)}</p></div>`;
  if (!m.at) html += `<p class="note">${esc(DNAME[m.d])} está sendo reconstruído no novo visual. Enquanto isso, esta missão funciona inteira por aqui.</p>`;
  const s = stepState(m.id);
  const back = `<button type="button" class="btn ghost sm" data-close>Voltar ao mapa</button>`;
  const aula = url ? `<a class="btn ghost sm" href="${url}" target="_blank" rel="noopener" aria-label="Ver aula ${esc(l.course)} (abre em nova aba)">Ver aula</a>` : "";
  if (st === "locked") {
    const need = (m.req || []).filter(id => !rec("m:" + id)).map(id => MIS.find(x => x.id === id).name);
    const why = !districtOpen(m.d) ? `${DNAME[m.d]} libera quando você concluir “${m.d === "orla" ? "Primeiro Expediente" : "Commit na Estação"}”.` : `Conclua antes: ${need.join(", ")}.`;
    html += `<p class="note"><strong>Bloqueada.</strong> ${esc(why)}</p><div class="row">${aula}${back}</div>`;
  } else if (st === "done") {
    const r = rec(recKey(m));
    html += `<p class="done"><strong>Concluída${r && r.at ? " em " + r.at.split("-").reverse().join("/") : ""}.</strong> Você recebeu +${r ? r.xp : rw.xp} XP e ${fmt(r ? r.cash : rw.cash)}.${m.type === "daily" ? " Volte amanhã para um desafio novo." : ""}</p>`;
    html += `<div class="row">${m.type === "project" ? `<button type="button" class="btn sm" data-act="result">Ver resultado</button>` : ""}${aula ? aula.replace("Ver aula", "Rever aula") : ""}${back}</div>`;
  } else if (m.type === "intro") {
    html += `<div class="row"><button type="button" class="btn lg" data-act="intro">Concluir chegada</button>${back}</div>`;
  } else if (m.type === "project") {
    const pj = S.city.proj[m.d] || (S.city.proj[m.d] = {reqs:[], link:""});
    const ok = m.reqs.every((_, k) => pj.reqs[k]);
    html += `<div class="sec"><h3>Tecnologias</h3><p>${esc(m.tech.join(" · "))}</p></div>
      <ul class="steps" aria-label="Requisitos do projeto">${m.reqs.map((r, k) => `<li class="${pj.reqs[k] ? "ok" : ""}"><label class="check"><input type="checkbox" id="req-${m.d}-${k}" data-req="${k}" ${pj.reqs[k] ? "checked" : ""}> ${esc(r)}</label></li>`).join("")}</ul>
      <div class="field"><label for="plink">Link do projeto ou repositório (opcional)</label><input id="plink" type="url" data-plink="1" placeholder="https://..." value="${esc(pj.link)}"></div>
      <div class="deliver"><p id="pdm">${ok ? `Recompensa: <strong>+${PROJ_XP} XP e ${fmt(PROJ_CASH)}</strong>.` : "Marque todos os requisitos para entregar."}</p>
      <button type="button" class="btn" data-act="deliverProj" ${ok ? "" : "disabled"} aria-describedby="pdm">Entregar projeto</button></div><div class="row">${back}</div>`;
  } else if (m.type === "daily") {
    html += quizHtml(m, s, true) + `<div class="row">${back}</div>`;
  } else if (!s.acc) {
    html += `<div class="row"><button type="button" class="btn lg" data-act="accept">Aceitar missão</button></div>
      <div class="row">${aula}${exercise ? `<button type="button" class="btn ghost sm" data-act="peek">Abrir desafio</button>` : ""}${back}</div>`;
  } else {
    const missing = [!s.w && (l ? "assistir à aula" : "ouvir a conversa"), !s.p && "fazer o exercício", !s.q && "acertar o quiz"].filter(Boolean);
    html += `<ol class="steps" aria-label="Etapas da missão">
        <li class="${s.w ? "ok" : ""}"><h4>1 · ${l ? "Assistir à aula" : "Conversar"}</h4>
          <div class="row">${url ? `<a class="btn cyan sm" href="${url}" target="_blank" rel="noopener">Abrir aula</a>` : ""}<label class="check"><input type="checkbox" id="st-w" data-step="w" ${s.w ? "checked" : ""}> ${l ? "Assisti às aulas" : "Li as dicas"}</label></div></li>
        <li class="${s.p ? "ok" : ""}" id="stepEx"><h4>2 · Exercício prático</h4><p style="margin:0 0 6px">${esc(exercise)}</p>
          <label class="check"><input type="checkbox" id="st-p" data-step="p" ${s.p ? "checked" : ""}> Fiz o exercício</label>
          <div class="field"><label for="st-link">Link do seu código ou anotações (opcional)</label><input id="st-link" type="url" data-link="1" placeholder="https://github.com/..." value="${esc(s.link)}"></div></li>
        <li class="${s.q ? "ok" : ""}"><h4>3 · Mini quiz</h4>${quizHtml(m, s, false)}</li></ol>
      <div class="deliver"><p id="dm">${missing.length ? "Falta: " + missing.join(", ") + "." : `Tudo pronto. Recompensa: <strong>+${rw.xp} XP e ${fmt(rw.cash)}</strong>.`}</p>
        <button type="button" class="btn" data-act="deliver" ${missing.length ? "disabled" : ""} aria-describedby="dm">Entregar missão</button></div><div class="row">${back}</div>`;
  }
  body.innerHTML = html;
}
function quizHtml(m, s, isDaily){
  const qs = quizOf(m), sel = answers[m.id] || [], done = !isDaily && s.q;
  return `<div class="quiz">${qs.map((q, qi) => `<fieldset><legend>${qi + 1}. ${esc(q[0])}</legend>${q[1].map((o, oi) => `<label class="opt"><input type="radio" name="q-${m.id}-${qi}" id="q-${m.id}-${qi}-${oi}" value="${oi}" data-q="${qi}" ${sel[qi] === oi ? "checked" : ""} ${done ? "disabled" : ""}> ${esc(o)}</label>`).join("")}</fieldset>`).join("")}
    ${done ? `<p class="fb good">Quiz certo${s.tries === 0 ? " de primeira" : ""}.</p>` : `<button type="button" class="btn cyan sm" data-act="${isDaily ? "daily" : "quiz"}">Responder</button>`}
    <p class="fb" id="qfb" role="status"></p></div>`;
}
$("mBody").addEventListener("click", e => {
  const m = POINTS.find(p => p.id === openId); if (!m) return;
  const a = e.target.closest("[data-act]"); if (!a || a.disabled) return;
  const s = stepState(m.id), act = a.dataset.act;
  if (act === "accept") { s.acc = true; S.city.track = m.id; touch(); save(); refreshAll(); renderMission(m); sfx("ok"); announce(`Missão aceita: ${m.name}.`); const f = $("mBody").querySelector("input,a.btn"); f && f.focus(); return; }
  if (act === "peek") { const ex = $("exSec"); if (ex) { ex.scrollIntoView({block:"center", behavior: SET.reduce ? "auto" : "smooth"}); ex.setAttribute("tabindex", "-1"); ex.focus({preventScroll:true}); } return; }
  if (act === "quiz" || act === "daily") return answerQuiz(m, s, act === "daily");
  if (act === "deliver") return deliver(m);
  if (act === "deliverProj") return deliverProject(m);
  if (act === "result") return showResult(m);
  if (act === "intro") { const rw = reward(m); S.city.rec["m:intro"] = {xp:rw.xp, cash:rw.cash, at:DC.today()}; touch(); save(); complete(m, rw); }
});
$("mBody").addEventListener("change", e => {
  const m = POINTS.find(p => p.id === openId), el = e.target; if (!m) return;
  if (el.dataset.step) { stepState(m.id)[el.dataset.step] = el.checked; if (el.checked) touch(); save(); keepFocus(() => renderMission(m)); refreshAll(); }
  else if (el.dataset.q) (answers[m.id] = answers[m.id] || [])[+el.dataset.q] = +el.value;
  else if (el.dataset.req) { S.city.proj[m.d].reqs[+el.dataset.req] = el.checked; save(); keepFocus(() => renderMission(m)); }
});
$("mBody").addEventListener("input", e => {
  const m = POINTS.find(p => p.id === openId), el = e.target; if (!m) return;
  if (el.dataset.link) { stepState(m.id).link = el.value.slice(0, 300); save(); }
  if (el.dataset.plink) { S.city.proj[m.d].link = el.value.slice(0, 300); save(); }
});
function keepFocus(fn){ const id = document.activeElement && document.activeElement.id; const y = $("dMission").scrollTop; fn(); $("dMission").scrollTop = y; if (id && $(id)) $(id).focus({preventScroll:true}); }
function answerQuiz(m, s, isDaily){
  const qs = quizOf(m), sel = answers[m.id] || [], fb = $("qfb");
  if (qs.some((_, k) => sel[k] === undefined)) { fb.className = "fb bad"; fb.textContent = "Responda todas as perguntas."; return; }
  const wrong = qs.map((q, k) => sel[k] === q[2] ? null : k + 1).filter(Boolean);
  touch();
  if (wrong.length) { s.tries++; save(); fb.className = "fb bad"; fb.textContent = (wrong.length === 1 ? `A pergunta ${wrong[0]} não está certa.` : `As perguntas ${wrong.join(" e ")} não estão certas.`) + " Tente de novo."; sfx("deny"); return; }
  if (isDaily) { const rw = reward(m); S.city.rec["d:" + DC.today()] = {xp:rw.xp, cash:rw.cash, at:DC.today()}; save(); complete(m, rw); return; }
  s.q = true; let msg = "Quiz certo!";
  if (s.tries === 0) { S.bonus = (S.bonus || 0) + QUIZ_BONUS; S.firstTries = (S.firstTries || 0) + 1; msg = `Certo de primeira! Bônus de +${fmt(QUIZ_BONUS)}.`; }
  save(); keepFocus(() => renderMission(m)); refreshAll(); sfx("ok");
  const f2 = $("qfb"); if (f2) { f2.className = "fb good"; f2.textContent = msg; }
  const dv = $("mBody").querySelector('[data-act="deliver"]'); if (dv && !dv.disabled) dv.focus();
  announce(msg);
}
function deliver(m){ const s = stepState(m.id); if (!(s.w && s.p && s.q)) return; const rw = reward(m); S.city.rec[recKey(m)] = {xp:rw.xp, cash:rw.cash, at:DC.today()}; touch(); save(); complete(m, rw); }
function deliverProject(m){
  const pj = S.city.proj[m.d]; if (!m.reqs.every((_, k) => pj.reqs[k])) return;
  S.city.rec["p:" + m.d] = {xp:PROJ_XP, cash:PROJ_CASH, at:DC.today()}; touch(); save();
  closeDialog($("dMission")); refreshAll(); celebrate("Projeto entregue", `<b>+${PROJ_XP} XP</b> · ${fmt(PROJ_CASH)}`); checkAch();
  setTimeout(() => showResult(m), SET.reduce ? 50 : 1300);
}
function complete(m, rw){
  const opened = m.id === "expediente" ? "orla" : m.id === "commit" ? "caribe" : null;
  if (openId === m.id) closeDialog($("dMission"));   /* só fecha o painel desta missão (a chegada automática não fecha outro painel aberto) */
  if (S.city.track === m.id) S.city.track = null;
  const nx = tracked(); if (nx) S.city.track = nx.id; save();
  refreshAll(); routeFor = null;
  celebrate(m.type === "daily" ? "Desafio do dia" : m.type === "intro" ? "Bem-vindo" : "Missão concluída", `<b>+${rw.xp} XP</b> · ${fmt(rw.cash)}`);
  checkAch();
  setTimeout(() => toast(opened ? `${DNAME[opened]}: missões liberadas na lista (J).` : nx ? `Próximo objetivo: ${titleOf(nx)}` : "Tudo concluído por aqui!"), SET.reduce ? 0 : 1500);
  announce(`${m.name} concluída. Mais ${rw.xp} XP e ${fmt(rw.cash)}.`);
}
function showResult(m){
  const ms = MIS.filter(x => x.d === m.d && x.type === "main"), done = ms.filter(x => rec("m:" + x.id)).length, s = DC.playerTotals(S);
  const text = `Entreguei o projeto “${m.name}” no Dev City (${DNAME[m.d]}, Costa Solar)! Tecnologias: ${m.tech.join(", ")}. ${done}/${ms.length} missões do bairro, +${PROJ_XP} XP, nível ${s.level}.`;
  $("rTitle").textContent = m.name;
  $("rBody").innerHTML = `<svg class="medal" viewBox="0 0 120 140" aria-hidden="true"><path d="M40 0h16l6 34H48zM64 0h16l-8 34H58z" fill="#2b3a55"/><circle cx="60" cy="86" r="44" fill="#f5c84c"/><circle cx="60" cy="86" r="34" fill="#1b2436"/><path d="M60 64l6.5 13.5 15 2-11 10.5 2.7 14.8L60 97.6l-13.2 7.2 2.7-14.8-11-10.5 15-2z" fill="#f5c84c"/></svg>
    <p class="result-title">Projeto entregue</p>
    <div class="meta"><div><span>Projeto</span><b>${esc(m.name)}</b></div><div><span>Tecnologias</span><b>${esc(m.tech.join(", "))}</b></div>
      <div><span>Missões do bairro</span><b>${done}/${ms.length}</b></div><div><span>XP recebido</span><b class="rw">+${PROJ_XP} XP · ${fmt(PROJ_CASH)}</b></div>
      <div><span>Medalha</span><b>Obra de ${esc(DNAME[m.d])}</b></div><div><span>Nível</span><b>${s.level} · ${esc(DC.RANKS[s.rank])}</b></div></div>
    <label class="sr-only" for="shareTxt">Texto do resultado</label><textarea id="shareTxt" class="io" readonly style="min-height:84px">${esc(text)}</textarea>
    <div class="row"><button type="button" class="btn" id="rShare">Compartilhar</button><button type="button" class="btn ghost" id="rCopy">Exportar como texto</button><button type="button" class="btn ghost" id="rImg">Exportar como imagem</button></div>
    <p class="fb" id="rMsg" role="status"></p><div id="rImgBox"></div>`;
  $("rShare").onclick = async () => { try { if (navigator.share) { await navigator.share({title:"Dev City", text}); $("rMsg").textContent = "Compartilhado!"; return; } } catch (e) { if (e && e.name === "AbortError") return; } copyText(text, $("shareTxt"), $("rMsg")); };
  $("rCopy").onclick = () => copyText(text, $("shareTxt"), $("rMsg"));
  $("rImg").onclick = () => { const url = shareImage(m, done, ms.length, s.level);
    $("rImgBox").innerHTML = `<img class="share-img" src="${url}" alt="Resultado: ${esc(m.name)}, ${done} de ${ms.length} missões, mais ${PROJ_XP} XP"><div class="row" style="margin-top:8px"><a class="btn sm" href="${url}" download="dev-city-${m.d}.png">Baixar imagem</a></div><p class="note">No celular, toque e segure a imagem para salvar.</p>`; };
  openDialog($("dResult"));
}
async function copyText(t, ta, msg){ try { await navigator.clipboard.writeText(t); msg.className = "fb good"; msg.textContent = "Copiado!"; } catch (e) { ta.focus(); ta.select(); msg.className = "fb"; msg.textContent = "Texto selecionado. Use Copiar do seu aparelho."; } }
function shareImage(m, done, total, level){
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1080; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, "#1b2a4a"); gr.addColorStop(.6, "#0e1626"); gr.addColorStop(1, "#0b111c"); g.fillStyle = gr; g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = "rgba(245,200,76,.12)"; g.beginPath(); g.arc(540, 380, 300, 0, 7); g.fill();
  g.fillStyle = "#f5c84c"; g.beginPath(); g.arc(540, 380, 150, 0, 7); g.fill(); g.fillStyle = "#1b2436"; g.beginPath(); g.arc(540, 380, 118, 0, 7); g.fill();
  g.fillStyle = "#f5c84c"; g.font = "700 120px Sora, Inter, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("★", 540, 388);
  g.textBaseline = "alphabetic"; g.fillStyle = "#aeb8c7"; g.font = "600 34px Inter, sans-serif"; g.fillText("DEV CITY · COSTA SOLAR", 540, 120);
  g.fillStyle = "#eef2f7"; g.font = "800 76px Sora, Inter, sans-serif"; g.fillText("Projeto entregue", 540, 650);
  g.fillStyle = "#56d6e4"; g.font = "700 48px Sora, Inter, sans-serif"; wrapText(g, m.name, 540, 730, 920, 58);
  g.fillStyle = "#aeb8c7"; g.font = "500 36px Inter, sans-serif"; g.fillText(m.tech.join(" · "), 540, 860);
  g.fillStyle = "#f5c84c"; g.font = "700 42px Inter, sans-serif"; g.fillText(`+${PROJ_XP} XP · ${done}/${total} missões · nível ${level}`, 540, 940);
  return c.toDataURL("image/png");
}
function wrapText(g, t, x, y, maxW, lh){ const words = t.split(" "); let line = ""; for (const w of words) { const test = line ? line + " " + w : w; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; } else line = test; } g.fillText(line, x, y); }

/* -------------------------------------------------------------------------
   11. MAPA COMPLETO (filtros), LISTA, INVENTÁRIO, AJUSTES, SALVAMENTO
   ------------------------------------------------------------------------- */
const FILTERS = [["todas","Todas"],["backend","Back End"],["frontend","Front End"],["carreira","Carreira"],["projetos","Projetos"],["diario","Desafio diário"],["estudo","Locais de estudo"]];
let mapFilter = "todas", mapSel = null;
const passFilter = m => mapFilter === "todas" || (mapFilter === "projetos" ? m.type === "project" : mapFilter === "diario" ? m.type === "daily" : mapFilter === "carreira" ? m.type === "special" || m.type === "intro" : mapFilter === "estudo" ? false : m.track === mapFilter);
function openMap(){
  $("mapBody").innerHTML = `<div class="chips" role="group" aria-label="Filtrar por trilha">${FILTERS.map(([k, t]) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${k === mapFilter}">${t}</button>`).join("")}</div>
    <div class="map-wrap"><canvas id="bigmap" width="${base.width}" height="${base.height}" aria-label="Mapa completo do Centro e dos bairros vizinhos. Use a lista abaixo para escolher uma missão."></canvas></div>
    <div class="legend" aria-label="Legenda">${[["#f5c84c","!","Disponível"],["#6aa6ff","…","Em andamento"],["#5fd38d","✓","Concluída"],["#8792a3","","Bloqueada"],["#a891ff","★","Especial"],["#f0a64a","P","Projeto final"],["#56d6e4","D","Desafio diário"],["#2f5537","","Árvores e praças"]].map(([c, i, t]) => `<span><i style="background:${c}">${i}</i>${t}</span>`).join("")}<span><i style="background:#fff">▲</i>Você</span></div>
    <div id="mapSel"></div>
    <h3 class="dh">Progresso por bairro</h3>${progressByArea()}
    <h3 class="dh">Escolher missão sem caminhar</h3><div id="mapList">${pointList(true)}</div>`;
  drawBig(); openDialog($("dMap"));
}
function drawBig(){
  const c = $("bigmap"); if (!c) return; const g = c.getContext("2d");
  g.drawImage(base, 0, 0); drawNames(g, mx, mz, 1.2);
  if (route.length > 1) { g.save(); g.strokeStyle = "rgba(245,200,76,.9)"; g.lineWidth = 4; g.setLineDash([3, 8]); g.lineCap = "round"; g.beginPath(); route.forEach((p, i) => i ? g.lineTo(mx(p[0]), mz(p[1])) : g.moveTo(mx(p[0]), mz(p[1]))); g.stroke(); g.restore(); }
  if (mapFilter === "estudo" || mapFilter === "todas") for (const s of LAY.STUDY) { g.fillStyle = "#56d6e4"; g.beginPath(); g.roundRect ? g.roundRect(mx(s.x) - 9, mz(s.z) + 12, 18, 18, 4) : g.rect(mx(s.x) - 9, mz(s.z) + 12, 18, 18); g.fill(); g.fillStyle = "#111"; g.font = "700 11px Inter"; g.textAlign = "center"; g.fillText("E", mx(s.x), mz(s.z) + 25); }
  for (const m of POINTS) if (m.at && passFilter(m)) drawIcon(g, m, mx(m.at[0]), mz(m.at[1]), m === mapSel ? 15 : 11, m === mapSel);
  drawPlayer(g, mx(P.x), mz(P.z), P.rot, 12);
  c.onclick = e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * c.width, y = (e.clientY - r.top) / r.height * c.height;
    let best = null, bd = 40; for (const m of POINTS) if (m.at && passFilter(m)) { const d = Math.hypot(mx(m.at[0]) - x, mz(m.at[1]) - y); if (d < bd) { bd = d; best = m; } }
    mapSel = best; drawBig(); showSel(); };
}
function showSel(){ const m = mapSel, box = $("mapSel"); if (!box) return; if (!m) { box.innerHTML = ""; return; } const lk = look(m), rw = reward(m);
  box.innerHTML = `<div class="sel-card"><b>${esc(titleOf(m))}</b><span style="color:var(--muted)">${esc(m.place || DNAME[m.d])} · ${lk.label} · +${rw.xp} XP · ${m.at ? Math.round(distTo(m)) + " m" : "pela lista"}</span>
    <div class="row"><button type="button" class="btn sm" data-open="${m.id}">Abrir missão</button>${lk.st !== "done" && lk.st !== "locked" && m.at ? `<button type="button" class="btn ghost sm" data-track="${m.id}">Definir destino</button>` : ""}</div></div>`; }
$("mapBody").addEventListener("click", e => { const f = e.target.closest("[data-filter]"); if (f) { mapFilter = f.dataset.filter; $("mapBody").querySelectorAll("[data-filter]").forEach(b => b.setAttribute("aria-pressed", b.dataset.filter === mapFilter)); mapSel = null; showSel(); drawBig(); $("mapList").innerHTML = pointList(true); } });
function progressByArea(){
  return Object.entries(DNAME).map(([d, name]) => { const ms = POINTS.filter(m => m.d === d && m.type !== "daily"), done = ms.filter(isDone).length, pct = Math.round(done / ms.length * 100);
    return `<div><div class="row" style="justify-content:space-between"><b>${esc(name)}</b><small style="color:var(--muted)">${done}/${ms.length} · ${d === "centro" ? "aberto" : districtOpen(d) ? "missões liberadas (bairro em reconstrução)" : "bloqueado"}</small></div><div class="progress" role="progressbar" aria-label="Progresso em ${esc(name)}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>`; }).join("")
    + `<p class="note" style="margin:0">Em breve: Distrito de Tecnologia (IA, Dados, Cloud, DevOps) e Porto Solar (Docker, Linux, CI/CD).</p>`;
}
function pointList(compact){
  if (mapFilter === "estudo") return `<ul class="list">${LAY.STUDY.map(s => `<li class="item"><span class="ic" style="--c:#56d6e4" aria-hidden="true">E</span><div><b>${esc(s.name)}</b><small>${esc(s.desc)} · ${Math.round(Math.hypot(P.x - s.x, P.z - s.z))} m</small></div></li>`).join("")}</ul>`;
  return Object.entries(DNAME).map(([d, name]) => `<h4 class="dh">${esc(name)} <small>${d === "centro" ? "Lógica · Git · Carreira" : d === "orla" ? "Front End · HTML · CSS · JS" : "Back End · APIs · Bancos de dados"}</small></h4>
    <ul class="list">${POINTS.filter(m => m.d === d && passFilter(m)).map(m => { const lk = look(m), rw = reward(m), n = npcOf(m);
      return `<li class="item"><span class="ic" style="--c:${lk.c}" aria-hidden="true">${lk.ic}</span><div><b>${esc(titleOf(m))}</b><small>${lk.label} · ${esc(TRACK_OF(m))} · +${rw.xp} XP${n && !compact ? " · " + esc(n[0]) : ""}${m.at ? " · " + Math.round(distTo(m)) + " m" : ""}</small></div>
        <div class="acts"><button type="button" class="btn sm" data-open="${m.id}" aria-label="Abrir ${esc(titleOf(m))}">Abrir</button>${lk.st !== "done" && lk.st !== "locked" && m.at ? `<button type="button" class="btn ghost sm" data-track="${m.id}" aria-label="Definir ${esc(titleOf(m))} como destino">Destino</button>` : ""}</div></li>`; }).join("") || `<li class="note">Nada neste filtro.</li>`}</ul>`).join("");
}
function openJournal(){
  const t = tracked(), s = DC.playerTotals(S);
  $("jBody").innerHTML = `<div class="sel-card"><span class="eyebrow">Missão atual</span><b>${t ? esc(titleOf(t)) : "Nenhuma pendente"}</b><span style="color:var(--muted)">${t ? esc(t.place || DNAME[t.d]) : ""}</span>
    ${t ? `<div class="row"><button type="button" class="btn sm" data-open="${t.id}">Abrir</button></div>` : ""}</div>
    <p style="margin:0;color:var(--muted)">${s.cityMissions} missões na cidade · ${s.missions} no total (cidade + modo clássico).</p>${pointList(false)}`;
  openDialog($("dJournal"));
}
const ACH = [
  {id:"chegada", n:"Primeiro passo", d:"Entrar na cidade", ic:"1", ok:() => true},
  {id:"bem-vindo", n:"Bilhete único", d:"Concluir a chegada à Costa Solar", ic:"✓", ok:() => !!rec("m:intro")},
  {id:"expediente", n:"Bateu o ponto", d:"Concluir Primeiro Expediente", ic:"!", ok:() => !!rec("m:expediente")},
  {id:"cantos", n:"Conhece o Centro", d:"Passar pelos 4 cantos do cruzamento", ic:"+", ok:() => (S.city.corners || []).length >= 4},
  {id:"diario", n:"Freguês do terminal", d:"Acertar um desafio diário", ic:"D", ok:() => Object.keys(S.city.rec).some(k => k[0] === "d")},
  {id:"carreira", n:"Papo de futuro", d:"Concluir a Conversa de Carreira", ic:"★", ok:() => !!rec("s:carreira")},
  {id:"obra", n:"Obra de bairro", d:"Entregar um projeto final na cidade", ic:"P", ok:() => Object.keys(S.city.rec).some(k => k[0] === "p")},
  {id:"coruja", n:"Coruja", d:"Andar pelo Centro à noite", ic:"☾", ok:() => started && (hourNow() >= 20 || hourNow() < 5)},
  {id:"todas", n:"Cidade inteira", d:"Concluir as 5 missões principais", ic:"5", ok:() => MIS.filter(m => m.type === "main").every(m => rec("m:" + m.id))}
];
function checkAch(){ const fresh = []; for (const a of ACH) if (!S.city.ach[a.id] && a.ok()) { S.city.ach[a.id] = DC.today(); fresh.push(a.n); } if (fresh.length) { save(); setTimeout(() => toast("Conquista: " + fresh.join(", ")), 500); } }
function openInv(){
  const s = DC.playerTotals(S), L = s.level, st = streak(), t = tracked();
  const trackName = S.sel && TR[S.sel] ? TR[S.sel].area : "—";
  const opened = 1 + ["orla","caribe"].filter(districtOpen).length;
  $("iBody").innerHTML = `<div class="tiles">
      <div class="tile"><span>Nível</span><b>${L}</b><small>${esc(DC.RANKS[s.rank])}</small></div>
      <div class="tile"><span>XP</span><b>${s.xp.toLocaleString("pt-BR")}</b><small>faltam ${(DC.xpForLevel(L + 1) - s.xp).toLocaleString("pt-BR")} para o nível ${L + 1}</small></div>
      <div class="tile"><span>Dinheiro virtual</span><b style="color:var(--green)">${fmt(s.cash)}</b></div>
      <div class="tile"><span>Respeito</span><b>${s.respect}</b></div>
      <div class="tile"><span>Sequência de estudos</span><b>${st} ${st === 1 ? "dia" : "dias"}</b><small>recorde: ${Math.max(S.bestStreak || 0, st)}</small></div>
      <div class="tile"><span>Missões concluídas</span><b>${s.missions}</b><small>${s.cityMissions} na cidade</small></div>
      <div class="tile"><span>Bairros desbloqueados</span><b>${opened}/7</b><small>Centro aberto; Orla e Caribe pela lista</small></div>
      <div class="tile"><span>Projetos finalizados</span><b>${s.projects}</b></div>
      <div class="tile" style="grid-column:span 2"><span>Missão atual</span><b style="font-size:17px">${t ? esc(titleOf(t)) : "—"}</b></div>
      <div class="tile" style="grid-column:span 2"><span>Trilha atual (modo clássico)</span><b style="font-size:17px">${esc(trackName)}</b></div></div>
    <h3 class="dh">Conquistas</h3>
    <ul class="achs">${ACH.map(a => { const on = !!S.city.ach[a.id]; return `<li class="ach ${on ? "on" : ""}"><span class="ic" aria-hidden="true">${a.ic}</span><div><b>${esc(a.n)}</b><small>${esc(a.d)} · ${on ? "desbloqueada" : "bloqueada"}</small></div></li>`; }).join("")}</ul>
    <h3 class="dh">Salvamento</h3>
    <div class="row"><button type="button" class="btn cyan" id="ioExp">Exportar progresso</button><button type="button" class="btn ghost" id="ioImp">Importar progresso</button>
      <button type="button" class="btn ghost" id="ioCont">Continuar de onde parei</button><button type="button" class="btn ghost" id="ioReset">Resetar progresso</button></div>
    <p class="note" style="margin:0">O progresso fica salvo neste navegador e vale também no modo clássico. Resetar apaga tudo.</p>`;
  $("ioExp").onclick = () => openIO("export"); $("ioImp").onclick = () => openIO("import");
  $("ioCont").onclick = () => { closeDialog($("dInv")); const t2 = tracked(); if (t2) toast(`De volta ao objetivo: ${titleOf(t2)}`); };
  $("ioReset").onclick = function(){ if (!this.dataset.armed) { this.dataset.armed = "1"; this.textContent = "Toque de novo para apagar tudo"; setTimeout(() => { if (this.isConnected) { delete this.dataset.armed; this.textContent = "Resetar progresso"; } }, 4000); return; }
    leaving = true; try { localStorage.removeItem(DC.KEY); localStorage.removeItem("devcity.v2"); } catch (e) {} location.reload(); };
  openDialog($("dInv"));
}
function openIO(kind){
  if (kind === "export") {
    const json = JSON.stringify(Object.assign({exportedAt:new Date().toISOString()}, S, {city:Object.assign({}, S.city, {pos:{x:P.x, z:P.z, yaw:CAM.yaw}})}));
    $("ioTitle").textContent = "Exportar progresso";
    $("ioBody").innerHTML = `<p style="margin:0">Guarde este código ou o arquivo. No outro aparelho, use Importar progresso.</p><label class="sr-only" for="ioOut">Código do progresso</label><textarea id="ioOut" class="io" readonly>${esc(json)}</textarea>
      <div class="row"><button type="button" class="btn cyan" id="ioCopy">Copiar código</button><button type="button" class="btn ghost" id="ioDown">Baixar .json</button></div><p class="fb" id="ioMsg" role="status"></p>`;
    $("ioCopy").onclick = () => copyText(json, $("ioOut"), $("ioMsg"));
    $("ioDown").onclick = () => { try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], {type:"application/json"})); a.download = "dev-city-progresso-" + DC.today() + ".json"; document.body.appendChild(a); a.click(); a.remove(); $("ioMsg").textContent = "Se o download não começar, use Copiar código."; } catch (e) { $("ioMsg").textContent = "Download bloqueado. Use Copiar código."; } };
  } else {
    $("ioTitle").textContent = "Importar progresso";
    $("ioBody").innerHTML = `<p style="margin:0">O progresso deste aparelho será substituído (cidade e modo clássico).</p>
      <div class="field"><label for="ioFile">Arquivo .json</label><input type="file" id="ioFile" accept="application/json,.json"></div>
      <div class="field"><label for="ioIn">Ou cole o código</label><textarea id="ioIn" class="io"></textarea></div>
      <div class="row"><button type="button" class="btn cyan" id="ioCheck">Verificar</button><button type="button" class="btn" id="ioApply" disabled>Confirmar importação</button></div><p class="fb" id="ioMsg" role="status"></p>`;
    let pending = null;
    const check = () => { pending = null; $("ioApply").disabled = true; let o; try { o = JSON.parse($("ioIn").value); } catch (e) { $("ioMsg").className = "fb bad"; $("ioMsg").textContent = "Não consegui ler o código."; return; }
      if (!o || typeof o !== "object" || (o.app !== "dev-city" && !o.done)) { $("ioMsg").className = "fb bad"; $("ioMsg").textContent = "Esse código não é um progresso do Dev City."; return; }
      o.city = DC.sanitizeCity(o.city); pending = o; $("ioApply").disabled = false; const ct = DC.cityTotals(o.city);
      $("ioMsg").className = "fb good"; $("ioMsg").textContent = `Progresso válido: ${ct.missions} missões na cidade, ${Object.values(o.done || {}).reduce((a, b) => a + (+b || 0), 0)} no modo clássico.`; };
    $("ioFile").onchange = () => { const f = $("ioFile").files[0]; if (!f || f.size > 2e6) return; const r = new FileReader(); r.onload = () => { $("ioIn").value = r.result; check(); }; r.readAsText(f); };
    $("ioCheck").onclick = check;
    $("ioApply").onclick = () => { if (!pending) return; leaving = true; try { localStorage.setItem(DC.KEY, JSON.stringify(pending)); } catch (e) {} location.reload(); };
  }
  openDialog($("dIO"));
}
function openSettings(){
  const seg = (name, cur, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, t]) => `<label><input type="radio" name="${name}" value="${v}" ${cur === v ? "checked" : ""}>${t}</label>`).join("")}</div>`;
  const tog = (id, on, t, d) => `<label class="toggle"><span>${t}<small>${d}</small></span><input type="checkbox" id="${id}" ${on ? "checked" : ""}></label>`;
  $("sBody").innerHTML = `<div class="set">
    <div><h3 class="dh" style="margin-top:0">Qualidade gráfica</h3>${seg("q", SET.quality, [["alta","Alta"],["equilibrada","Equilibrada"],["desempenho","Desempenho"]])}
      <p class="note" style="margin:6px 0 0">Alta: sombras suaves, luzes reais e reflexos. Desempenho: sem sombras projetadas e menos detalhes. Aplica ao recarregar a cena.</p></div>
    <div><h3 class="dh">Câmera</h3>${seg("cam", mode === "2d" ? "2d" : SET.cam, [["terceira","Terceira pessoa"],["iso","Isométrica"],["2d","Mapa 2D"]])}</div>
    <div><h3 class="dh">Horário</h3>${seg("h", SET.time, [["ciclo","Ciclo"],["manha","Manhã"],["tarde","Tarde"],["por","Pôr do sol"],["noite","Noite"]])}</div>
    ${tog("sReduce", SET.reduce, "Reduzir animações", "Câmera mais estável e sem celebrações animadas.")}
    ${tog("sFx", SET.effects, "Efeitos de luz", "Feixes dos postes e halos dos letreiros.")}
    ${tog("sSound", SET.sound, "Sons", "Bipes curtos ao interagir e concluir.")}
    ${HAS3D ? "" : `<p class="note">O 3D não está disponível neste aparelho. Você está no mapa 2D, com todas as missões.</p>`}</div>`;
  $("sBody").onchange = e => { const el = e.target;
    if (el.name === "q") { SET.quality = el.value; saveSet(); persistPos(); toast("Aplicando qualidade…"); setTimeout(() => { leaving = false; location.reload(); }, 300); }
    if (el.name === "cam") setCam(el.value);
    if (el.name === "h") { SET.time = el.value; if (el.value !== "ciclo") hour = PRESET[el.value]; }
    if (el.id === "sReduce") { SET.reduce = el.checked; document.documentElement.classList.toggle("reduce", SET.reduce); }
    if (el.id === "sFx") SET.effects = el.checked;
    if (el.id === "sSound") SET.sound = el.checked;
    saveSet(); };
  openDialog($("dSet"));
}
document.addEventListener("click", e => {
  const o = e.target.closest("[data-open]"), t = e.target.closest("[data-track]");
  if (o) { const d = o.closest("dialog"); if (d && d.id !== "dMission") closeDialog(d); openPoint(o.dataset.open); }
  if (t) { S.city.track = t.dataset.track; save(); routeFor = null; const m = POINTS.find(p => p.id === t.dataset.track); toast(`Destino: ${titleOf(m)}. Siga a rota amarela no minimapa.`); const d = t.closest("dialog"); if (d) closeDialog(d); updateObjective(); }
});

/* -------------------------------------------------------------------------
   12. DIÁLOGOS, ENTRADA E SONS
   ------------------------------------------------------------------------- */
let lastFocus = null;
const anyOpen = () => [...document.querySelectorAll("dialog")].some(d => d.open);
function openDialog(d){ if (!d.open) { lastFocus = document.activeElement; [...document.querySelectorAll("dialog")].forEach(x => x !== d && x.open && x.close()); d.showModal ? d.showModal() : d.setAttribute("open", ""); } keys.clear(); joy.active = false; }
function closeDialog(d){ if (d.open) d.close ? d.close() : d.removeAttribute("open"); }
document.querySelectorAll("dialog").forEach(d => {
  d.addEventListener("click", e => { if (e.target.closest("[data-close]") || e.target === d) closeDialog(d); });
  d.addEventListener("close", () => { if (lastFocus && document.contains(lastFocus) && lastFocus !== document.body) lastFocus.focus({preventScroll:true}); refreshAll(); });
});
addEventListener("keydown", e => {
  if (!started || anyOpen() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","ShiftLeft","ShiftRight"].includes(e.code)) { keys.add(e.code); if (e.code.startsWith("Arrow")) e.preventDefault(); return; }
  if (e.code === "KeyE" && nearPoint) { e.preventDefault(); openPoint(nearPoint.id); }
  else if (e.code === "KeyM") openMap();
  else if (e.code === "KeyJ") openJournal();
  else if (e.code === "KeyI") openInv();
  else if (e.code === "KeyC") cycleCam();
  else if (e.code === "KeyQ") { if (SET.cam === "iso") CAM.isoYaw += Math.PI/2; else { CAM.yaw += .4; CAM.lastManual = performance.now() / 1000; } }
  else if (e.code === "KeyR") { if (SET.cam === "iso") CAM.isoYaw -= Math.PI/2; else { CAM.yaw -= .4; CAM.lastManual = performance.now() / 1000; } }
});
addEventListener("keyup", e => keys.delete(e.code));
addEventListener("blur", () => { keys.clear(); joy.active = false; });
const app = $("app"); let drag = null;
app.addEventListener("pointerdown", e => {
  if (!started || e.target.closest(".glass, .mlabel, .act, .joy, dialog, .intro, .mini, .icon-btn")) return;
  if (![$("gl"), $("map2d"), $("labels"), $("hud")].includes(e.target)) return;
  drag = {id:e.pointerId, x:e.clientX, y:e.clientY, sx:e.clientX, sy:e.clientY, t:performance.now()};
  try { app.setPointerCapture(e.pointerId); } catch (err) {}
});
app.addEventListener("pointermove", e => { if (!drag || e.pointerId !== drag.id || mode === "2d") return;
  const k = .0048; if (SET.cam === "iso") CAM.isoYaw -= (e.clientX - drag.x) * k; else { CAM.yaw -= (e.clientX - drag.x) * k; CAM.pitch = clamp(CAM.pitch + (e.clientY - drag.y) * k * .7, .06, 1.05); }
  CAM.lastManual = performance.now() / 1000; drag.x = e.clientX; drag.y = e.clientY; });
app.addEventListener("pointerup", e => { if (!drag || e.pointerId !== drag.id) return;
  const tap = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8 && performance.now() - drag.t < 350; drag = null;
  if (tap && mode === "2d") { let best = null, bd = 30; for (const m of POINTS) if (m.at) { const x = (mx(m.at[0]) - mx(P.x)) * zoom2d + innerWidth / 2, y = (mz(m.at[1]) - mz(P.z)) * zoom2d + innerHeight / 2, d = Math.hypot(x - e.clientX, y - e.clientY); if (d < bd) { bd = d; best = m; } } if (best) openPoint(best.id); } });
app.addEventListener("pointercancel", () => drag = null);
app.addEventListener("wheel", e => { if (!started || e.target.closest("dialog")) return; if (mode === "2d") zoom2d = clamp(zoom2d * (e.deltaY > 0 ? .9 : 1.1), 1, 6); else CAM.dist = clamp(CAM.dist + e.deltaY * .004, 3.2, 8.5); }, {passive:true});
const joyEl = $("joy"), knob = $("knob");
joyEl.addEventListener("pointerdown", e => { joy.active = true; joy.id = e.pointerId; try { joyEl.setPointerCapture(e.pointerId); } catch (err) {} moveJoy(e); e.preventDefault(); });
joyEl.addEventListener("pointermove", e => { if (joy.active && e.pointerId === joy.id) moveJoy(e); });
const endJoy = () => { joy.active = false; joy.x = joy.y = 0; knob.style.transform = ""; };
joyEl.addEventListener("pointerup", endJoy); joyEl.addEventListener("pointercancel", endJoy);
function moveJoy(e){ const r = joyEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width / 2 - 10;
  let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > max) { dx = dx / d * max; dy = dy / d * max; }
  joy.x = dx / max; joy.y = dy / max; knob.style.transform = `translate(${dx}px, ${dy}px)`; }
$("actBtn").onclick = () => { if (nearPoint) openPoint(nearPoint.id); };
$("tMap").onclick = openMap; $("miniBtn").onclick = openMap; $("tJournal").onclick = openJournal; $("objective").onclick = openJournal; $("tInv").onclick = openInv; $("tSet").onclick = openSettings; $("tCam").onclick = cycleCam;
$("zIn").onclick = () => { SET.miniZoom = clamp(SET.miniZoom * 1.25, 1.2, 5); saveSet(); };
$("zOut").onclick = () => { SET.miniZoom = clamp(SET.miniZoom / 1.25, 1.2, 5); saveSet(); };
let actx = null;
function sfx(kind){
  if (!SET.sound) return;
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const notes = {near:[880], open:[660, 990], ok:[523, 784], deny:[260, 200], win:[523, 659, 784, 1046]}[kind] || [440];
  notes.forEach((f, k) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = "sine"; o.frequency.value = f; const t0 = actx.currentTime + k * .09;
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.06, t0 + .015); g.gain.exponentialRampToValueAtTime(.0001, t0 + .22);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + .24); });
}
let toastT;
function toast(msg){ const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3800); }
function announce(msg){ const l = $("live"); l.textContent = ""; setTimeout(() => l.textContent = msg, 30); }
let passedT;
function celebrate(title, html){ sfx("win"); $("passedT").textContent = title; $("passedS").innerHTML = html; const p = $("passed"); p.hidden = true; void p.offsetWidth; p.hidden = false; clearTimeout(passedT); passedT = setTimeout(() => p.hidden = true, SET.reduce ? 1400 : 2200); }

/* -------------------------------------------------------------------------
   13. MODOS, ABERTURA E LAÇO
   ------------------------------------------------------------------------- */
const CAM_NAMES = {terceira:"Terceira pessoa", iso:"Isométrica", "2d":"Mapa 2D"};
function setCam(v){
  if (v !== "2d" && !W3) { toast("O 3D não está disponível neste aparelho. Seguimos no mapa 2D."); v = "2d"; }
  if (v === "2d") { mode = "2d"; } else { mode = "3d"; SET.cam = v; }
  SET.camMode = v; saveSet();
  $("gl").hidden = mode !== "3d"; $("map2d").hidden = mode !== "2d";
  $("tCamTxt").textContent = CAM_NAMES[v]; $("tCamSr").textContent = "Câmera atual: " + CAM_NAMES[v] + ". Trocar.";
  if (started) toast("Câmera: " + CAM_NAMES[v]);
}
function cycleCam(){ const order = ["terceira","iso","2d"], cur = mode === "2d" ? "2d" : SET.cam; setCam(order[(order.indexOf(cur) + 1) % order.length]); }
function refreshAll(){ renderHUD(); refreshLabels(); updateObjective(); routeFor = null; nearPoint = undefined; /* força o aviso a reler o estado */ }
function persistPos(){ if (started && !leaving) { S.city.pos = {x:P.x, z:P.z, yaw:CAM.yaw}; save(); } }
let started = false;
function enter(cont, opts){
  opts = opts || {};
  if (cont && S.city.pos && !blocked(S.city.pos.x, S.city.pos.z)) { P.x = S.city.pos.x; P.z = S.city.pos.z; CAM.yaw = S.city.pos.yaw; P.rot = CAM.yaw + Math.PI; }
  else { P.x = LAY.spawn.x; P.z = LAY.spawn.z; CAM.yaw = LAY.spawn.yaw; P.rot = CAM.yaw + Math.PI; }
  CAM.cur = null;
  $("intro").hidden = true; $("hud").hidden = false; $("labels").hidden = false; started = true;
  if (isTouch) { $("hud").classList.add("touch"); $("joy").hidden = false; }
  setCam(opts.mode2d ? "2d" : SET.camMode || (W3 ? SET.cam : "2d"));
  touch(); save(); refreshAll(); lastZone = null;
  requestAnimationFrame(() => { const pl = document.querySelector(".player").getBoundingClientRect(); LIMTOP = (isTouch ? Math.max(pl.bottom, document.querySelector(".mini-wrap").getBoundingClientRect().bottom) : pl.bottom) + 40; });
  /* chegada: a primeira missão (boas-vindas) se conclui ao entrar */
  if (!rec("m:intro")) setTimeout(() => { const m = MIS[0], rw = reward(m); S.city.rec["m:intro"] = {xp:rw.xp, cash:rw.cash, at:DC.today()}; touch(); save(); complete(m, rw); }, 1200);
  else { const t = tracked(); if (t) setTimeout(() => toast(`Objetivo: ${titleOf(t)}`), 700); }
  checkAch();
  if (opts.list) setTimeout(openJournal, 200);
}
$("enterBtn").onclick = () => enter(!!S.city.pos);
$("continueBtn").onclick = () => enter(true);
$("enter2d").onclick = () => enter(!!S.city.pos, {mode2d:true});
$("enterList").onclick = () => enter(!!S.city.pos, {list:true});
if (S.city.pos) $("continueBtn").hidden = false;
addEventListener("resize", () => { if (W3) W3.resize(innerWidth, innerHeight); });
addEventListener("beforeunload", persistPos);
document.addEventListener("visibilitychange", () => { if (document.hidden) persistPos(); });

function setLoad(p, msg){ $("loadBar").style.width = p + "%"; $("loading").textContent = msg; }
drawBase(); buildLabels();
function boot(){
  if (!HAS3D) { setLoad(100, "Este aparelho não tem 3D disponível: a cidade abre no mapa 2D, com todas as missões."); mode = "2d"; $("gl").hidden = true; $("map2d").hidden = false; $("enterBtn").disabled = false; return; }
  setLoad(30, "Erguendo os prédios do Centro…");
  setTimeout(() => {
    try {
      W3 = CW.createRenderer(THREE, $("gl"), sim, {quality:SET.quality, effects:SET.effects, reduce:SET.reduce});
      W3.resize(innerWidth, innerHeight);
      setLoad(75, "Acendendo as janelas…");
      W3.setTime(hourNow());
      setTimeout(() => { setLoad(100, "Cidade pronta."); $("enterBtn").disabled = false; $("enterBtn").focus({preventScroll:true}); }, 60);
    } catch (err) {
      console.error(err); W3 = null; mode = "2d"; $("gl").hidden = true; $("map2d").hidden = false;
      setLoad(100, "Não foi possível iniciar o 3D. A cidade abre no mapa 2D."); $("enterBtn").disabled = false;
    }
  }, 30);
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawBase(); });
boot();

let last = performance.now(), saveT = 0, slowT = 0, timeT = 0, hudT = 0, frames = 0, fpsT = 0, fpsLast = performance.now();
function loop(now){
  requestAnimationFrame(loop);
  if (document.hidden) { last = now; return; }
  const dt = Math.min(.1, (now - last) / 1000); last = now; const t = now / 1000;   // passo maior em aparelhos lentos: a velocidade de caminhada não depende do FPS
  if (started && !anyOpen()) movePlayer(dt);
  if (SET.time === "ciclo") hour = (hour + dt / 60) % 24;
  sim.update(dt, {player:P, night: W3 ? W3.env.night : (hourNow() > 19.5 || hourNow() < 6 ? 1 : 0)});
  if ((timeT += dt) > .25 && W3) { timeT = 0; W3.setTime(hourNow()); }
  if (mode === "3d" && W3) { updateCamera(dt, t); W3.update(dt, t, {player:P, near:!!nearPoint}); } else draw2D();
  if (started) {
    placeLabels(); drawMini(); updatePrompt(); updateZone();
    if ((hudT += dt) > .3) { hudT = 0; updateClock(); updateObjective(); const tr = tracked(); if (routeFor !== (tr && tr.id) || (routeT += .3) > 1.5) { routeT = 0; routeFor = tr && tr.id; route = computeRoute(tr); } if (!S.city.ach.coruja) checkAch(); }
    if ((saveT += dt) > 4) { saveT = 0; persistPos(); }
    /* aparelho lento: sugere o modo Desempenho uma vez */
    /* aparelho lento: abaixo de 15 FPS por ~8 s, troca sozinho para Desempenho (uma vez); entre 15 e 24, só sugere */
    frames++; fpsT += (now - fpsLast) / 1000; fpsLast = now;
    if (fpsT > 4) { const fps = frames / fpsT; frames = 0; fpsT = 0;
      if (mode === "3d" && SET.quality !== "desempenho" && !anyOpen()) {
        if (fps < 15 && !SET.autoPerf) { if ((slowT += 1) >= 2) { SET.autoPerf = true; SET.quality = "desempenho"; saveSet(); persistPos(); toast("Cena pesada neste aparelho: mudando para o modo Desempenho…"); setTimeout(() => location.reload(), 1400); } }
        else if (fps < 24 && !SET.fpsHint) { if ((slowT += 1) >= 2) { SET.fpsHint = true; saveSet(); toast("A cena está pesada neste aparelho. Em Ajustes, escolha Desempenho ou a câmera isométrica."); } }
        else slowT = 0; } }
  }
}
requestAnimationFrame(loop);
/* ganchos de teste (não afetam o jogo) */
window.DEVCITY = {get P(){ return P; }, get mode(){ return mode; }, get S(){ return S; }, get W3(){ return W3; }, sim, POINTS, LAY, teleport:(x, z) => { P.x = x; P.z = z; }, setHour:h => { hour = h; SET.time = "ciclo"; }, CAM};
})();

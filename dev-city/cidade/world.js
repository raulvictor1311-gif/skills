/* =========================================================================
   DEV CITY · MUNDO DO CENTRO (protótipo realista)
   Três partes independentes:
   1. LAYOUT  – dados puros da área (ruas, quadras, prédios, missões). Usado
                pelo 3D, pelo minimapa, pelo mapa e pelo modo 2D.
   2. SIM     – trânsito, semáforos e pedestres em JS puro (funciona sem WebGL).
   3. RENDER  – construção 3D com Three.js (geometria procedural, sem modelos
                externos). Estáticos são mesclados por material e repetições
                são instanciadas para manter poucas chamadas de desenho.
   Coordenadas: x = leste, z = sul (norte é -z). 1 unidade = 1 metro.
   ========================================================================= */
(function(){
"use strict";

/* -------------------------------------------------------------------------
   1. LAYOUT
   ------------------------------------------------------------------------- */
const AV = {x0:-9.4, x1:9.4};           // Avenida Horizonte (norte–sul): 2 faixas por sentido + vagas
const ST = {z0:-5.5, z1:5.5};           // Rua das Marés (leste–oeste): 1 faixa por sentido + vagas
const EDGE = 62;                         // limite da área jogável neste protótipo
const QUADS = [                          // calçadas elevadas (quadras) de cada canto do cruzamento
  {id:"ne", x0:AV.x1, x1:70, z0:-70, z1:ST.z0},
  {id:"nw", x0:-70, x1:AV.x0, z0:-70, z1:ST.z0},
  {id:"se", x0:AV.x1, x1:70, z0:ST.z1, z1:70},
  {id:"sw", x0:-70, x1:AV.x0, z0:ST.z1, z1:70}
];
/* Prédios detalhados. style define o "kit" de fachada. */
const BUILDINGS = [
  {id:"torre", name:"Torre Nó Central", style:"glass", x0:15, x1:33, z0:-40, z1:-11, h:66, podium:8, front:"s"},
  {id:"tijolo", name:"Edifício Ladrilho", style:"brick", x0:35, x1:57, z0:-31, z1:-11, h:27, floors:8, front:"s", shop:"cafe"},
  {id:"deco", name:"Edifício Aurora", style:"deco", x0:-48, x1:-16, z0:-63, z1:-45, h:36, floors:10, front:"s"},
  {id:"resid", name:"Residencial Brisa", style:"resid", x0:43, x1:58, z0:12, z1:42, h:25, floors:8, front:"w"},
  {id:"livraria", name:"Livraria Página Viva", style:"store", x0:-36, x1:-15, z0:11, z1:26, h:9.5, floors:2, front:"n", shop:"livraria"},
  {id:"moderno", name:"Edifício Prisma", style:"modern", x0:-60, x1:-40, z0:12, z1:38, h:46, floors:13, front:"e"},
  {id:"estacao", name:"Metrô Central", style:"station", x0:16, x1:40, z0:15, z1:31, h:7.5, front:"n"}
];
const PLAZA = {x0:-50, x1:-14, z0:-41, z1:-10, fountain:[-32, -26]};
const BUS_STOP = {x:11.6, z:-30};
const KIOSK = {x:-18.5, z:-14.5};        // terminal do Desafio do Dia
const SUBWAY_STAIRS = {x0:24, x1:32, z0:11.2, z1:14.6};
/* Mobiliário */
const LAMPS = [], TREES = [], PALMS = [], BENCHES = [];
for (let z = -58; z <= 58; z += 16) if (Math.abs(z) > 12) { LAMPS.push({x:10.3, z, r:Math.PI/2}, {x:-10.3, z: z + 8, r:-Math.PI/2}); }
for (let x = -58; x <= 58; x += 16) if (Math.abs(x) > 14) { LAMPS.push({x, z:-6.4, r:Math.PI}, {x: x + 8, z:6.4, r:0}); }
for (let z = -54; z <= 54; z += 16) if (Math.abs(z) > 14 && !(z > -38 && z < -22)) { TREES.push({x:11.4, z: z + 4}); TREES.push({x:-11.4, z: z - 4}); }
for (let x = -54; x <= 54; x += 16) if (Math.abs(x) > 18) { if (!(x > 14 && x < 34)) TREES.push({x: x + 4, z:-8.4}); TREES.push({x: x - 4, z:8.4}); }
for (let z = -58; z <= 58; z += 12) if (Math.abs(z) > 14) PALMS.push({x:0, z});
for (const [x, z] of [[-40,-16],[-24,-36],[-44,-32],[-20,-22],[-38,-36]]) TREES.push({x, z, big:true});
for (const [x, z, r] of [[-27,-20,0],[-37,-20,0],[-27,-32,Math.PI],[-37,-32,Math.PI],[-44,-24,Math.PI/2]]) BENCHES.push({x, z, r});
/* Vagas e carros estacionados (fora do ponto de ônibus) */
const PARKED = [
  {x:8.2, z:-46, r:Math.PI, t:"hatch"}, {x:8.2, z:-18, r:Math.PI, t:"sedan"}, {x:8.2, z:26, r:Math.PI, t:"suv"}, {x:8.2, z:44, r:Math.PI, t:"sedan"},
  {x:-8.2, z:-40, r:0, t:"sedan"}, {x:-8.2, z:20, r:0, t:"hatch"}, {x:-8.2, z:36, r:0, t:"suv"},
  {x:-26, z:4.5, r:Math.PI/2, t:"hatch"}, {x:44, z:-4.5, r:-Math.PI/2, t:"sedan"}
];
/* Semáforos: um por esquina, cada um com cabeças para as duas vias */
const SIGNALS = [{x:10.6, z:-6.6}, {x:-10.6, z:-6.6}, {x:10.6, z:6.6}, {x:-10.6, z:6.6}];
/* Rotas de veículos (mão direita). stop = posição da linha de retenção ao longo da rota. */
const LANES = [
  {id:"nb1", axis:"z", dir:-1, fixed:2.2, from:130, to:-130, stopAt:10.6, light:"ns"},
  {id:"nb2", axis:"z", dir:-1, fixed:5.3, from:130, to:-130, stopAt:10.6, light:"ns"},
  {id:"sb1", axis:"z", dir:1, fixed:-2.2, from:-130, to:130, stopAt:-10.6, light:"ns"},
  {id:"sb2", axis:"z", dir:1, fixed:-5.3, from:-130, to:130, stopAt:-10.6, light:"ns"},
  {id:"eb", axis:"x", dir:1, fixed:1.8, from:-130, to:130, stopAt:-14.2, light:"ew"},
  {id:"wb", axis:"x", dir:-1, fixed:-1.8, from:130, to:-130, stopAt:14.2, light:"ew"}
];
/* Colisores do jogador (caixas em planta) */
const COLLIDERS = [];
for (const b of BUILDINGS) COLLIDERS.push({x0:b.x0, x1:b.x1, z0:b.z0, z1:b.z1, h:b.h, kind:"building"});
COLLIDERS.push({x0:PLAZA.fountain[0]-3.4, x1:PLAZA.fountain[0]+3.4, z0:PLAZA.fountain[1]-3.4, z1:PLAZA.fountain[1]+3.4, h:1});
COLLIDERS.push({x0:BUS_STOP.x-.6, x1:BUS_STOP.x+.8, z0:BUS_STOP.z-2.6, z1:BUS_STOP.z+2.6, h:2.6});
COLLIDERS.push({x0:KIOSK.x-.6, x1:KIOSK.x+.6, z0:KIOSK.z-.4, z1:KIOSK.z+.4, h:2.2});
COLLIDERS.push({x0:SUBWAY_STAIRS.x0, x1:SUBWAY_STAIRS.x1, z0:SUBWAY_STAIRS.z0 + .4, z1:SUBWAY_STAIRS.z1, h:1.1});
for (const c of PARKED) { const along = Math.abs(Math.sin(c.r)) > .5; COLLIDERS.push(along ? {x0:c.x-2.2, x1:c.x+2.2, z0:c.z-.95, z1:c.z+.95, h:1.5} : {x0:c.x-.95, x1:c.x+.95, z0:c.z-2.2, z1:c.z+2.2, h:1.5}); }
for (const t of TREES) COLLIDERS.push({x0:t.x-.35, x1:t.x+.35, z0:t.z-.35, z1:t.z+.35, h:4});
for (const p of PALMS) COLLIDERS.push({x0:p.x-.4, x1:p.x+.4, z0:p.z-.4, z1:p.z+.4, h:6});
COLLIDERS.push({x0:-.6, x1:.6, z0:-EDGE, z1:-12, h:.3}, {x0:-.6, x1:.6, z0:12, z1:EDGE, h:.3});   // canteiro central
/* Locais de missão (pos = onde fica o personagem/terminal; o marcador fica 1,3 m à frente) */
const SPOTS = {
  intro:     {x:20.5, z:11.4, face:Math.PI, label:"Saída do Metrô Central"},
  expediente:{x:24, z:-9.2, face:0, label:"Entrada da Torre Nó Central"},
  commit:    {x:35.5, z:11.6, face:Math.PI, label:"Bilheteria do Metrô Central"},
  diario:    {x:KIOSK.x, z:KIOSK.z, face:0, label:"Terminal da Praça", terminal:true},
  carreira:  {x:46.5, z:-8.4, face:0, label:"Terraço do Café Byte"},
  "proj-centro":{x:-25.5, z:9.2, face:Math.PI, label:"Mesa de estudos da Livraria", board:true}
};
const STUDY = [{x:-25.5, z:9.6, name:"Livraria Página Viva", desc:"Ponto de estudo: mesas, Wi-Fi e livros de programação"},
               {x:24, z:-9.6, name:"Coworking Nó Central", desc:"Ponto de estudo: salas silenciosas"}];
/* Áreas da cidade ao redor (no mapa: em reconstrução / em breve) */
const AREAS = [
  {id:"centro", name:"Centro", x0:-EDGE, x1:EDGE, z0:-EDGE, z1:EDGE, state:"open"},
  {id:"orla", name:"Orla Azul", x0:EDGE + 8, x1:200, z0:-90, z1:90, state:"rebuild", dir:"leste"},
  {id:"caribe", name:"Barrio Caribe", x0:-200, x1:-EDGE - 8, z0:-90, z1:90, state:"rebuild", dir:"oeste"},
  {id:"tecnologia", name:"Distrito de Tecnologia", x0:-90, x1:90, z0:-200, z1:-EDGE - 8, state:"soon", dir:"norte"},
  {id:"porto", name:"Porto Solar", x0:-90, x1:90, z0:EDGE + 8, z1:200, state:"soon", dir:"sul"}
];
const STREETS = [{name:"Av. Horizonte", x:0, z:-30, v:true}, {name:"R. das Marés", x:-36, z:0, v:false}];
/* Grafo simples de calçadas e travessias para a rota até o objetivo */
const NODES = {
  ne:[11.8,-7.8], nw:[-11.8,-7.8], se:[11.8,7.8], sw:[-11.8,7.8],
  neN:[11.8,-58], nwN:[-11.8,-58], seS:[11.8,58], swS:[-11.8,58],
  neE:[58,-7.8], seE:[58,7.8], nwW:[-58,-7.8], swW:[-58,7.8]
};
const EDGES = [["ne","nw"],["nw","sw"],["sw","se"],["se","ne"],["ne","neN"],["nw","nwN"],["se","seS"],["sw","swS"],["ne","neE"],["se","seE"],["nw","nwW"],["sw","swW"]];

const LAYOUT = {AV, ST, EDGE, QUADS, BUILDINGS, PLAZA, BUS_STOP, KIOSK, SUBWAY_STAIRS, LAMPS, TREES, PALMS, BENCHES, PARKED, SIGNALS, LANES, COLLIDERS, SPOTS, STUDY, AREAS, STREETS, NODES, EDGES,
  spawn:{x:25, z:9.4, yaw:0}};   // saída do metrô, de frente para a Torre Nó Central (caminho livre)

/* -------------------------------------------------------------------------
   2. SIM · semáforos, veículos e pedestres (sem Three.js)
   ------------------------------------------------------------------------- */
function rng(seed){ return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function createSim(){
  const R = rng(4242);
  const sim = {t:0, phase:"ns", light:{ns:"green", ew:"red"}, cars:[], peds:[], night:0};
  /* Ciclo: avenida verde 16 s → amarelo 3 s → vermelho geral 1,5 s → rua verde 11 s → amarelo 3 s → vermelho geral 1,5 s */
  const CYCLE = [["ns","green",16],["ns","yellow",3],["all","red",1.5],["ew","green",11],["ew","yellow",3],["all","red",1.5]];
  const CYCLE_LEN = CYCLE.reduce((a, c) => a + c[2], 0);
  function lights(t){
    let k = t % CYCLE_LEN;
    for (const [who, col, d] of CYCLE) { if (k < d) return {ns: who === "ns" ? col : "red", ew: who === "ew" ? col : "red"}; k -= d; }
    return {ns:"red", ew:"red"};
  }
  /* Veículos: 3 carros + 1 ônibus (o ônibus para no ponto) */
  const vdefs = [{lane:"nb1", type:"sedan", color:"#c9ccd1", sp:11}, {lane:"sb2", type:"taxi", color:"#f2f2ef", sp:10}, {lane:"eb", type:"hatch", color:"#7d1f2b", sp:9}, {lane:"sb1", type:"bus", color:"#eef0f2", sp:8}];
  vdefs.forEach((v, k) => { const L = LANES.find(l => l.id === v.lane); sim.cars.push(Object.assign({}, v, {L, s: L.from + L.dir * (40 + k * 55), v: v.sp, wait:0, busStop:0, x:0, z:0, rot:0, brake:false})); });
  /* Pedestres: rotas por waypoints. cross = travessia que depende do semáforo. */
  const W = (x, z, o) => Object.assign({x, z}, o || {});
  const routes = [
    [W(11.8,-7.8), W(-11.8,-7.8,{cross:"av"}), W(-11.8,7.8,{cross:"st"}), W(11.8,7.8,{cross:"av"}), W(11.8,-7.8,{cross:"st"})],
    [W(13.3,-56), W(13.3,-12), W(46,-9.6), W(46,-10.4,{shop:6}), W(13.3,-9.6)],
    [W(-20,-15.5), W(-46,-15.5), W(-47.5,-39.5), W(-20,-39.5)],
    [W(28,9.4), W(11.8,8.2), W(-11.8,8.2,{cross:"av"}), W(-25,8.4), W(-25,10.4,{shop:7}), W(-25,8.4), W(-11.8,8.2), W(11.8,8.2,{cross:"av"})],
    [W(-12.4,-56), W(-12.4,-8.4), W(-12.4,8.4,{cross:"st"}), W(-12.4,56), W(-12.4,8.4), W(-12.4,-8.4,{cross:"st"})],
    /* extras que aparecem à noite (o Centro fica mais movimentado) */
    [W(-11.8,7.8), W(11.8,7.8,{cross:"av"}), W(11.8,-7.8,{cross:"st"}), W(-11.8,-7.8,{cross:"av"}), W(-11.8,7.8,{cross:"st"})],
    [W(12.4,12), W(12.4,56), W(12.4,12)],
    [W(-17,-12), W(-48,-12), W(-48,-19), W(-17,-19)],
    [W(46,-9.6), W(13.3,-9.6), W(13.3,-40), W(13.3,-9.6)]
  ];
  const looks = [
    {top:"#3d4f6b", bottom:"#2b2f38", skin:"#c58c66", hair:"#2a1d15", shoes:"#e9e9e6"},
    {top:"#b8b2a7", bottom:"#36404f", skin:"#8d5a3c", hair:"#14100d", shoes:"#3a3a3a"},
    {top:"#6e3b3b", bottom:"#c9bfae", skin:"#e8c2a0", hair:"#6b4a2b", shoes:"#f1f0ec"},
    {top:"#2f5d50", bottom:"#25282e", skin:"#a86f4c", hair:"#1b1410", shoes:"#d8d4cc"},
    {top:"#d8d4cb", bottom:"#4a5568", skin:"#5e3a26", hair:"#0f0c0a", shoes:"#2b2b2b"},
    {top:"#4b3f66", bottom:"#1f2430", skin:"#d3a17c", hair:"#3b2a1d", shoes:"#ececea"},
    {top:"#8a6d3b", bottom:"#2e3440", skin:"#7b4d33", hair:"#120e0b", shoes:"#c9c5bd"},
    {top:"#24384f", bottom:"#9a8f80", skin:"#e1b493", hair:"#5a3d26", shoes:"#f4f4f2"},
    {top:"#5c2a35", bottom:"#30343c", skin:"#b07a56", hair:"#22180f", shoes:"#e2dfd8"}
  ];
  routes.forEach((r, k) => sim.peds.push({route:r, i:0, x:r[0].x, z:r[0].z, rot:0, sp: 1.15 + R() * .35, night: k >= 5, wait:0, hidden:0, moving:false, look: looks[k % looks.length], phase: R() * 6}));
  /* Pessoas paradas: café, conversa na livraria, ponto de ônibus, grupo na praça */
  sim.still = [
    {x:44.2, z:-8.2, rot:Math.PI/2, pose:"sit", look:looks[5]}, {x:47.8, z:-8.2, rot:-Math.PI/2, pose:"sit", look:looks[6]}, {x:51.2, z:-8.2, rot:Math.PI/2, pose:"sit", look:looks[7], night:true},
    {x:-20, z:9.4, rot:-.4, pose:"stand", look:looks[8]}, {x:-19.1, z:9.9, rot:2.6, pose:"stand", look:looks[1]},
    {x:12.4, z:-30.8, rot:-Math.PI/2, pose:"stand", look:looks[3]},
    {x:-30, z:-21, rot:.3, pose:"stand", look:looks[2], night:true}, {x:-29.1, z:-20.2, rot:3.4, pose:"stand", look:looks[4], night:true}
  ];
  sim.update = function(dt, ctx){
    sim.t += dt; sim.light = lights(sim.t);
    const night = ctx.night || 0; sim.night = night;
    const P = ctx.player || {x:999, z:999};
    /* veículos */
    for (const c of sim.cars) {
      const L = c.L, along = s => L.axis === "z" ? [L.fixed, s] : [s, L.fixed];
      let target = c.sp;
      const ahead = c.s + L.dir * (c.type === "bus" ? 9 : 6);
      /* semáforo: para antes da linha de retenção */
      const toStop = (L.stopAt - c.s) * L.dir;
      const st = sim.light[L.light];
      if (st !== "green" && toStop > 0 && toStop < 26 && !(st === "yellow" && toStop < 4)) target = Math.min(target, Math.max(0, (toStop - 1.5) * .9));
      /* carro à frente na mesma faixa */
      for (const o of sim.cars) if (o !== c && o.L === L) { const gap = (o.s - c.s) * L.dir; if (gap > 0 && gap < 22) target = Math.min(target, Math.max(0, (gap - (o.type === "bus" || c.type === "bus" ? 13 : 8)) * .8)); }
      /* pedestre ou jogador na frente */
      const [ax, az] = along(ahead);
      if (Math.hypot(P.x - ax, P.z - az) < 3.2) target = 0;
      for (const p of sim.peds) if (p.moving && Math.hypot(p.x - ax, p.z - az) < 2.6) target = 0;
      /* ônibus para no ponto */
      if (c.type === "bus") { const toBus = (BUS_STOP.z - 1.5 - c.s) * L.dir;
        if (c.busStop > 0) { c.busStop -= dt; target = 0; } else if (c.L.id === "sb1" && toBus > 0 && toBus < 12 && !c.served) { target = Math.min(target, toBus * .7); if (toBus < .6) { c.busStop = 6; c.served = true; } } }
      c.brake = target < c.v - .5;
      c.v += Math.max(-9 * dt, Math.min(3 * dt, target - c.v));
      c.s += L.dir * c.v * dt;
      if ((c.s - L.to) * L.dir > 0) { c.s = L.from; c.served = false; }
      const [x, z] = along(c.s); c.x = x; c.z = z; c.rot = L.axis === "z" ? (L.dir > 0 ? 0 : Math.PI) : (L.dir > 0 ? Math.PI/2 : -Math.PI/2);
    }
    /* pedestres */
    const active = night > .5 ? sim.peds.length : 5;
    sim.peds.forEach((p, k) => {
      p.visible = k < active && p.hidden <= 0;
      if (k >= active) return;
      if (p.hidden > 0) { p.hidden -= dt; p.moving = false; return; }
      const w = p.route[(p.i + 1) % p.route.length];
      if (w.cross && p.wait <= 0) {
        /* travessia: atravessa a avenida quando a avenida está fechada (e vice-versa) */
        const ok = w.cross === "av" ? sim.light.ns === "red" && sim.light.ew === "green" : sim.light.ew === "red" && sim.light.ns === "green";
        const prev = p.route[p.i];
        if (!ok && Math.hypot(p.x - prev.x, p.z - prev.z) < .2) { p.moving = false; return; }
      }
      const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz);
      if (d < .08) { p.i = (p.i + 1) % p.route.length; if (w.shop) { p.hidden = w.shop; } return; }
      const sp = Math.min(d, p.sp * dt);
      p.x += dx / d * sp; p.z += dz / d * sp; p.rot = Math.atan2(dx, dz); p.moving = true;
    });
  };
  return sim;
}

/* -------------------------------------------------------------------------
   3. RENDER (Three.js)
   ------------------------------------------------------------------------- */
function createRenderer(THREE, canvas, sim, opts){
  const U = THREE.BufferGeometryUtils;
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
  const Q = opts.quality;   // "alta" | "equilibrada" | "desempenho"
  const HIGH = Q === "alta", PERF = Q === "desempenho";
  const renderer = new THREE.WebGLRenderer({canvas, antialias: !PERF, powerPreference:"high-performance"});
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = !PERF;
  renderer.shadowMap.type = HIGH ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, .1, 900);
  const R = rng(99);
  const col = new THREE.Color();
  const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), V3 = new THREE.Vector3(), SC = new THREE.Vector3(), EU = new THREE.Euler();

  /* ---------- texturas procedurais (canvas) ---------- */
  function tex(size, draw, repeat, srgb = true){
    const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"); draw(g, size);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = PERF ? 1 : 8;
    if (srgb) t.encoding = THREE.sRGBEncoding; if (repeat) t.repeat.set(repeat, repeat); return t;
  }
  function noise(g, s, a, b, n, alpha){ for (let i = 0; i < n; i++) { const v = a + Math.floor(R() * (b - a)); g.fillStyle = `rgba(${v},${v},${v},${alpha})`; const r = 1 + R() * 3; g.fillRect(R() * s, R() * s, r, r); } }
  const T = {
    asphalt: tex(512, (g, s) => { g.fillStyle = "#3b3d42"; g.fillRect(0,0,s,s); noise(g, s, 30, 90, 9000, .35); g.strokeStyle = "rgba(20,20,22,.35)"; g.lineWidth = 1.2;
      for (let i = 0; i < 10; i++) { g.beginPath(); let x = R() * s, y = R() * s; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - .5) * 60; y += (R() - .5) * 60; g.lineTo(x, y); } g.stroke(); } }),
    sidewalk: tex(256, (g, s) => { g.fillStyle = "#9f9b93"; g.fillRect(0,0,s,s); noise(g, s, 120, 180, 2500, .25);
      g.strokeStyle = "rgba(70,66,60,.55)"; g.lineWidth = 2; for (let k = 0; k <= s; k += s/4) { g.beginPath(); g.moveTo(k,0); g.lineTo(k,s); g.stroke(); g.beginPath(); g.moveTo(0,k); g.lineTo(s,k); g.stroke(); } }),
    paving: tex(256, (g, s) => { g.fillStyle = "#a79e90"; g.fillRect(0,0,s,s); const b = s / 8;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 140 + Math.floor(R() * 40); g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.fillRect(x * b + 1, y * b + 1, b - 2, b - 2); } }),
    concrete: tex(256, (g, s) => { g.fillStyle = "#bdbab3"; g.fillRect(0,0,s,s); noise(g, s, 120, 220, 4000, .22);
      for (let i = 0; i < 26; i++) { const x = R() * s, w = 2 + R() * 6; const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, "rgba(60,58,54,0)"); gr.addColorStop(1, "rgba(60,58,54,.18)"); g.fillStyle = gr; g.fillRect(x, R() * s * .5, w, s); } }),
    brick: tex(256, (g, s) => { g.fillStyle = "#6f6a63"; g.fillRect(0,0,s,s); const bh = s / 16, bw = s / 6;
      for (let y = 0; y < 16; y++) for (let x = -1; x < 7; x++) { const v = R(); g.fillStyle = `rgb(${150 + v * 40 | 0},${78 + v * 25 | 0},${58 + v * 18 | 0})`; g.fillRect(x * bw + (y % 2) * bw / 2 + 1.5, y * bh + 1.5, bw - 3, bh - 3); }
      noise(g, s, 40, 120, 1500, .2); }),
    plaster: tex(256, (g, s) => { g.fillStyle = "#e6e2da"; g.fillRect(0,0,s,s); noise(g, s, 170, 250, 5000, .2);
      for (let i = 0; i < 14; i++) { const x = R() * s; const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, "rgba(80,70,60,0)"); gr.addColorStop(1, "rgba(80,70,60,.14)"); g.fillStyle = gr; g.fillRect(x, 0, 3 + R() * 8, s); } }),
    grass: tex(256, (g, s) => { g.fillStyle = "#4d6b3a"; g.fillRect(0,0,s,s); for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${40 + R() * 50 | 0},${80 + R() * 60 | 0},${30 + R() * 30 | 0},.5)`; g.fillRect(R() * s, R() * s, 1, 2 + R() * 2); } }),
    pool: tex(128, (g, s) => { const gr = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2); gr.addColorStop(0, "rgba(255,214,160,.9)"); gr.addColorStop(.45, "rgba(255,190,120,.35)"); gr.addColorStop(1, "rgba(255,180,110,0)"); g.fillStyle = gr; g.fillRect(0,0,s,s); }, 0, false),
    blob: tex(128, (g, s) => { const gr = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2); gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(.6, "rgba(0,0,0,.25)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0,0,s,s); }, 0, false),
    halo: tex(128, (g, s) => { const gr = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.15, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0,0,s,s); }, 0, false),
    ao: tex(64, (g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, "rgba(0,0,0,.42)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0,0,s,s); }, 0, false)
  };
  for (const k of ["pool","blob","halo","ao"]) { T[k].wrapS = T[k].wrapT = THREE.ClampToEdgeWrapping; }

  function fitText(g, text, maxW, size, weight, family){ let fs = size; g.font = `${weight} ${fs}px ${family}`; while (g.measureText(text).width > maxW && fs > 12) { fs -= 2; g.font = `${weight} ${fs}px ${family}`; } }
  /* ---------- materiais (poucos, compartilhados) ---------- */
  /* No modo Desempenho, materiais Lambert (bem mais leves no celular); nos outros, PBR. */
  const std = (o) => { o = Object.assign({vertexColors:true, roughness:.85, metalness:0}, o);
    if (!PERF) return new THREE.MeshStandardMaterial(o);
    const {roughness, metalness, envMapIntensity, ...rest} = o; return new THREE.MeshLambertMaterial(rest); };
  const MAT = {
    asphalt: std({map:T.asphalt, roughness:.92}),
    sidewalk: std({map:T.sidewalk, roughness:.88}),
    paving: std({map:T.paving, roughness:.85}),
    concrete: std({map:T.concrete, roughness:.9}),
    brick: std({map:T.brick, roughness:.92}),
    plaster: std({map:T.plaster, roughness:.88}),
    grass: std({map:T.grass, roughness:1}),
    matte: std({roughness:.9}),
    satin: std({roughness:.55}),
    metal: std({roughness:.38, metalness:.75}),
    glass: PERF ? new THREE.MeshLambertMaterial({color:0x2e3c4c}) : new THREE.MeshStandardMaterial({color:0x3a4a5a, roughness:.06, metalness:.85, envMapIntensity:1.2}),
    paint: std({roughness:.32, metalness:.45}),
    light: new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false}),   // interiores e lâmpadas (brilho controlado pela hora)
    lineWhite: new THREE.MeshStandardMaterial({color:0xe9e7e1, roughness:.7, polygonOffset:true, polygonOffsetFactor:-2}),
    lineYellow: new THREE.MeshStandardMaterial({color:0xe2b83a, roughness:.7, polygonOffset:true, polygonOffsetFactor:-2})
  };
  MAT.light.userData.base = 1;

  /* ---------- utilidades de geometria ---------- */
  const buckets = {};   // material → lista de geometrias para mesclar
  function prep(geo, color, uvScale){
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!["position","normal","uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count, c = new Float32Array(n * 3); col.set(color || "#ffffff");
    for (let i = 0; i < n; i++) { c[i*3] = col.r; c[i*3+1] = col.g; c[i*3+2] = col.b; }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return g;
  }
  /* UV em escala de mundo (textura não estica) */
  function worldUV(g, scale){
    const p = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (ny >= nx && ny >= nz) uv.setXY(i, x / scale, z / scale); else if (nx >= nz) uv.setXY(i, z / scale, y / scale); else uv.setXY(i, x / scale, y / scale); }
    uv.needsUpdate = true; return g;
  }
  function add(mat, geo, color, uvScale){ const g = prep(geo, color); if (uvScale) worldUV(g, uvScale); (buckets[mat] = buckets[mat] || []).push(g); return g; }
  function box(mat, x0, x1, y0, y1, z0, z1, color, uvScale){ const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1)/2, (y0 + y1)/2, (z0 + z1)/2); return add(mat, g, color, uvScale); }
  function placed(mat, geo, x, y, z, ry, color, uvScale){ const g = geo.clone(); g.rotateY(ry || 0); g.translate(x, y, z); return add(mat, g, color, uvScale); }
  function flush(){
    const meshes = [];
    for (const [k, list] of Object.entries(buckets)) {
      if (!list.length) continue;
      const g = U.mergeBufferGeometries(list, false);
      const m = new THREE.Mesh(g, MAT[k]);
      m.castShadow = !["asphalt","sidewalk","paving","grass","lineWhite","lineYellow","light"].includes(k);
      m.receiveShadow = k !== "light";
      scene.add(m); meshes.push(m); list.length = 0;
    }
    return meshes;
  }
  /* Instâncias (janelas, molduras, árvores, postes...) */
  function instanced(geo, mat, list, opts2){
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach((it, i) => { EU.set(it.rx || 0, it.ry || 0, it.rz || 0); Qt.setFromEuler(EU); M4.compose(V3.set(it.x, it.y, it.z), Qt, SC.set(it.sx || 1, it.sy || 1, it.sz || 1)); im.setMatrixAt(i, M4); if (it.c) im.setColorAt(i, col.set(it.c)); });
    if (!list.length) im.count = 0;
    im.castShadow = !!(opts2 && opts2.cast); im.receiveShadow = !(opts2 && opts2.noReceive);
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    scene.add(im); return im;
  }

  /* ---------- céu (gradiente + sol/lua + estrelas) ---------- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{top:{value:new THREE.Color()}, horizon:{value:new THREE.Color()}, ground:{value:new THREE.Color(0x25272c)}, sunDir:{value:new THREE.Vector3(0,1,0)}, sunCol:{value:new THREE.Color()}, stars:{value:0}, glow:{value:1}},
    vertexShader:"varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:`uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunCol; uniform float stars; uniform float glow; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){ vec3 d = normalize(vDir); float y = d.y;
        vec3 c = y > 0.0 ? mix(horizon, top, pow(clamp(y,0.0,1.0), 0.55)) : mix(horizon, ground, clamp(-y*6.0,0.0,1.0));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35 * glow + pow(s, 3.0) * 0.08 * glow);
        if (stars > 0.0 && y > 0.05) { vec3 q = floor(d * 380.0); float st = step(0.9975, h(q)); c += vec3(st) * stars * (0.5 + 0.5 * h(q + 1.0)); }
        gl_FragColor = vec4(c, 1.0); }`
  }));
  scene.add(sky);
  scene.fog = new THREE.Fog(0xcccccc, PERF ? 70 : 95, PERF ? 240 : 430);
  const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x4a4038, .6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2); scene.add(sun, sun.target);
  sun.castShadow = !PERF;
  if (!PERF) { const s = HIGH ? 2048 : 1024; sun.shadow.mapSize.set(s, s); const sc = sun.shadow.camera; sc.left = sc.bottom = -42; sc.right = sc.top = 42; sc.near = 1; sc.far = 260; sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; }
  /* reflexos do céu nos vidros e na pintura dos carros */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); const envSky = sky.clone(); envSky.material = sky.material; envSky.scale.setScalar(.1); envScene.add(envSky);   // dentro do alcance da câmera do PMREM
  let envRT = null;
  function refreshEnv(){ if (PERF) return; if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, .04); scene.environment = envRT.texture; }

  /* ---------- chão: ruas, calçadas, faixas ---------- */
  box("matte", -400, 400, -.3, -.02, -400, 400, "#4a4d52");                             // chão distante
  box("asphalt", AV.x0, AV.x1, -.02, 0, -140, 140, "#ffffff", 8);                        // avenida
  box("asphalt", -140, 140, -.021, 0, ST.z0, ST.z1, "#ffffff", 8);                       // rua transversal
  for (const q of QUADS) {
    box("sidewalk", q.x0, q.x1, 0, .16, q.z0, q.z1, "#c9c4bb", 2.4);                    // calçada elevada (meio-fio = lateral da caixa)
    const cx = q.x0 < 0 ? q.x1 : q.x0, cz = q.z0 < 0 ? q.z1 : q.z0;
    box("concrete", Math.min(cx, cx + (q.x0 < 0 ? -.25 : .25)), Math.max(cx, cx + (q.x0 < 0 ? -.25 : .25)), 0, .17, q.z0, q.z1, "#9c9a95", 1);
    box("concrete", q.x0, q.x1, 0, .17, Math.min(cz, cz + (q.z0 < 0 ? -.25 : .25)), Math.max(cz, cz + (q.z0 < 0 ? -.25 : .25)), "#9c9a95", 1);
  }
  /* calçadas além do cruzamento (ruas seguem para os bairros) */
  box("paving", PLAZA.x0, PLAZA.x1, .16, .19, PLAZA.z0, PLAZA.z1, "#d8d1c6", 3);
  box("grass", -46, -38, .16, .22, -38, -30, "#ffffff", 4); box("grass", -26, -18, .16, .22, -38, -30, "#ffffff", 4);
  /* faixas da pista */
  const dash = (x0, x1, z0, z1, along, len, gap, mat) => { if (along === "z") for (let z = z0; z < z1; z += len + gap) box(mat, x0, x1, 0, .012, z, Math.min(z1, z + len)); else for (let x = x0; x < x1; x += len + gap) box(mat, x, Math.min(x1, x + len), 0, .012, z0, z1); };
  for (const [a, b] of [[-140, -11.5], [11.5, 140]]) {
    dash(3.6, 3.75, a, b, "z", 3, 6, "lineWhite"); dash(-3.75, -3.6, a, b, "z", 3, 6, "lineWhite");
    box("lineWhite", 6.95, 7.07, 0, .012, a, b); box("lineWhite", -7.07, -6.95, 0, .012, a, b);
  }
  for (const [a, b] of [[-140, -11.5], [11.5, 140]]) { dash(a, b, -.08, .08, "x", 3, 5, "lineYellow"); box("lineWhite", a, b, 0, .012, 3.45, 3.57); box("lineWhite", a, b, 0, .012, -3.57, -3.45); }
  /* faixas de pedestre e linhas de retenção */
  for (let x = -8.6; x <= 8.2; x += 1.1) { box("lineWhite", x, x + .6, 0, .013, -9.6, -6.4); box("lineWhite", x, x + .6, 0, .013, 6.4, 9.6); }
  for (let z = -4.8; z <= 4.4; z += 1.1) { box("lineWhite", -13.6, -10.4, 0, .013, z, z + .6); box("lineWhite", 10.4, 13.6, 0, .013, z, z + .6); }
  box("lineWhite", .6, 7, 0, .013, 10.2, 10.6); box("lineWhite", -7, -.6, 0, .013, -10.6, -10.2); box("lineWhite", -14.6, -14.2, 0, .013, 0, 5); box("lineWhite", 14.2, 14.6, 0, .013, -5, 0);
  /* canteiro central com palmeiras */
  for (const [a, b] of [[-140, -12], [12, 140]]) { box("concrete", -.65, .65, 0, .22, a, b, "#a4a29c", 1); box("grass", -.5, .5, .22, .25, a, b, "#ffffff", 4); }
  /* vagas (pintura) */
  for (let z = -60; z <= 60; z += 5.5) if (Math.abs(z) > 12 && !(z > -36 && z < -24)) { box("lineWhite", 7, 9.4, 0, .012, z, z + .12); box("lineWhite", -9.4, -7, 0, .012, z, z + .12); }

  /* ---------- PRÉDIOS ---------- */
  const glassSlots = [], litSlots = [], frames = [], acUnits = [], balconies = [], rails = [];
  /* janelas de uma fachada: face n/s/e/w, retângulo do prédio, andares */
  function facade(b, face, y0, y1, floorH, opts2){
    const o = Object.assign({w:1.3, h:1.7, gap:1.6, sill:.9, frame:"#d9d4cb", lit:.5, ac:0, balcony:0, recess:0}, opts2);
    const horiz = face === "n" || face === "s";
    const a0 = horiz ? b.x0 : b.z0, a1 = horiz ? b.x1 : b.z1;
    const off = face === "n" ? b.z0 : face === "s" ? b.z1 : face === "w" ? b.x0 : b.x1;
    const out = face === "n" || face === "w" ? -1 : 1;
    const len = a1 - a0, n = Math.max(1, Math.floor((len - 1.2) / (o.w + o.gap)));
    const start = a0 + (len - (n * o.w + (n - 1) * o.gap)) / 2 + o.w / 2;
    const ry = face === "s" ? 0 : face === "n" ? Math.PI : face === "e" ? Math.PI/2 : -Math.PI/2;
    for (let y = y0; y + floorH <= y1 + .01; y += floorH) {
      const cy = y + o.sill + o.h / 2;
      for (let i = 0; i < n; i++) {
        const a = start + i * (o.w + o.gap);
        const pos = (d) => horiz ? {x:a, z: off + out * d} : {x: off + out * d, z:a};
        const p = pos(.02), slot = Object.assign(p, {y:cy, ry, sx:o.w, sy:o.h, floor: Math.round(y / floorH), seed:R()});
        (slot.seed < o.lit ? litSlots : glassSlots).push(slot);
        const fp = pos(.06);
        frames.push(Object.assign({}, fp, {y: cy - o.h/2 - .06, ry, sx:o.w + .3, sy:.12, sz:.22, c:o.frame}));
        frames.push(Object.assign({}, fp, {y: cy + o.h/2 + .05, ry, sx:o.w + .2, sy:.1, sz:.14, c:o.frame}));
        frames.push(Object.assign({}, pos(.04), {y: cy, ry, sx:.08, sy:o.h, sz:.1, c:o.frame}));
        if (o.ac && R() < o.ac) { const q = pos(.32); acUnits.push(Object.assign(q, {y: cy - o.h/2 - .45, ry, sx:.8, sy:.5, sz:.5, c:"#d8d6d0"})); }
        if (o.balcony && i % 2 === 0 && R() < o.balcony) { const q = pos(.65); balconies.push(Object.assign(q, {y: y + .02, ry, sx: o.w + o.gap * .9, sy:.16, sz:1.3, c:"#c9c5bd"})); const r = pos(1.28); rails.push(Object.assign(r, {y: y + .58, ry, sx: o.w + o.gap * .9, sy:1, sz:.04})); }
      }
    }
  }
  const shopInteriors = [];
  /* vitrine no térreo: vidro + interior iluminado + marquise */
  function storefront(b, face, color, signText, signColor){
    const horiz = face === "n" || face === "s", out = face === "n" || face === "w" ? -1 : 1;
    const off = face === "n" ? b.z0 : face === "s" ? b.z1 : face === "w" ? b.x0 : b.x1;
    const a0 = (horiz ? b.x0 : b.z0) + 1.2, a1 = (horiz ? b.x1 : b.z1) - 1.2;
    const P2 = (a, d) => horiz ? [a, off + out * d] : [off + out * d, a];
    const len = a1 - a0, mid = (a0 + a1) / 2;
    /* interior iluminado logo atrás do vidro */
    const [ix, iz] = P2(mid, -.35);
    const ig = new THREE.PlaneGeometry(len, 3.1); ig.rotateY(face === "s" ? 0 : face === "n" ? Math.PI : face === "e" ? Math.PI/2 : -Math.PI/2); ig.translate(ix, 1.75, iz);
    add("light", ig, color);
    /* prateleiras/mesas sugeridas no interior */
    for (let k = 0; k < Math.floor(len / 2.4); k++) { const [sx, sz] = P2(a0 + 1.2 + k * 2.4, -.2); box("satin", sx - .45, sx + .45, .16, 1 + R() * .8, sz - .12, sz + .12, R() < .5 ? "#3b2f28" : "#57483d"); }
    /* caixilhos da vitrine */
    for (let a = a0; a <= a1 + .01; a += len / Math.max(2, Math.round(len / 3))) { const [mx, mz] = P2(a, .05); box("metal", mx - (horiz ? .06 : .08), mx + (horiz ? .06 : .08), .16, 3.5, mz - (horiz ? .08 : .06), mz + (horiz ? .08 : .06), "#2c2f33"); }
    /* marquise */
    const [m0x, m0z] = P2(a0 - .6, 0), [m1x, m1z] = P2(a1 + .6, 1.8);
    box("metal", Math.min(m0x, m1x), Math.max(m0x, m1x), 3.6, 3.78, Math.min(m0z, m1z), Math.max(m0z, m1z), "#2a2d31");
    if (signText) signs.push({text:signText, color:signColor, face, x: P2(mid, 1.82)[0], z: P2(mid, 1.82)[1], y:4.15, w: Math.min(len * .7, 7)});
  }
  const signs = [];
  function aoStrip(b){ /* escurecimento na base dos prédios (oclusão simulada) */
    const s = 1.1, y = .175;
    for (const [x0, x1, z0, z1, rot] of [[b.x0, b.x1, b.z1, b.z1 + s, 0], [b.x0, b.x1, b.z0 - s, b.z0, Math.PI], [b.x1, b.x1 + s, b.z0, b.z1, Math.PI/2], [b.x0 - s, b.x0, b.z0, b.z1, -Math.PI/2]]) {
      const g = new THREE.PlaneGeometry(rot === 0 || rot === Math.PI ? x1 - x0 : z1 - z0, s); g.rotateX(-Math.PI/2); g.rotateY(rot); g.translate((x0 + x1)/2, y, (z0 + z1)/2);
      aoGeos.push(g); }
  }
  const aoGeos = [];
  for (const b of BUILDINGS) {
    aoStrip(b);
    if (b.style === "glass") {
      /* pódio de pedra com saguão envidraçado */
      box("concrete", b.x0, b.x1, .16, b.podium, b.z0, b.z1, "#8f8b84", 2);
      box("glass", b.x0 + 1, b.x1 - 1, .16, b.podium - .4, b.z1 - .6, b.z1 + .02);
      shopInteriors.push(box("light", b.x0 + 1.4, b.x1 - 1.4, .3, b.podium - .8, b.z1 - .75, b.z1 - .7, "#f3d6a4"));
      box("metal", b.x0 - .3, b.x1 + .3, b.podium, b.podium + .5, b.z0 - .3, b.z1 + .3, "#30343a");
      /* torre de vidro com montantes e faixas de piso */
      const tx0 = b.x0 + 1, tx1 = b.x1 - 1, tz0 = b.z0 + 1, tz1 = b.z1 - 1;
      box("glass", tx0, tx1, b.podium + .5, b.h, tz0, tz1);
      for (let y = b.podium + 4; y < b.h; y += 3.8) box("metal", tx0 - .06, tx1 + .06, y, y + .35, tz0 - .06, tz1 + .06, "#4b5058");
      for (let x = tx0; x <= tx1 + .01; x += 1.8) { box("metal", x - .07, x + .07, b.podium + .5, b.h, tz1 - .02, tz1 + .14, "#5a6068"); box("metal", x - .07, x + .07, b.podium + .5, b.h, tz0 - .14, tz0 + .02, "#5a6068"); }
      for (let z = tz0; z <= tz1 + .01; z += 1.8) { box("metal", tx1 - .02, tx1 + .14, b.podium + .5, b.h, z - .07, z + .07, "#5a6068"); box("metal", tx0 - .14, tx0 + .02, b.podium + .5, b.h, z - .07, z + .07, "#5a6068"); }
      /* andares iluminados à noite (faixas atrás do vidro) */
      for (let y = b.podium + 1.6; y < b.h - 2; y += 3.8) for (const face of ["s","n","e","w"]) {
        const horiz = face === "s" || face === "n"; const len = horiz ? tx1 - tx0 : tz1 - tz0;
        for (let a = 0; a < len - 1; a += 3.6) { const s2 = R(); const pos = horiz ? {x: tx0 + a + 1.8, z: face === "s" ? tz1 + .03 : tz0 - .03} : {x: face === "e" ? tx1 + .03 : tx0 - .03, z: tz0 + a + 1.8};
          (s2 < .55 ? litSlots : []).push(Object.assign(pos, {y: y + .4, ry: face === "s" ? 0 : face === "n" ? Math.PI : face === "e" ? Math.PI/2 : -Math.PI/2, sx:3.4, sy:2.4, seed:s2, floor:y, office:true})); }
      }
      /* topo: casa de máquinas e antena */
      box("concrete", tx0 + 3, tx1 - 3, b.h, b.h + 3.5, tz0 + 4, tz1 - 8, "#8a8780", 2);
      placed("metal", new THREE.CylinderGeometry(.08, .12, 9, 6), (b.x0 + b.x1)/2, b.h + 7.5, (b.z0 + b.z1)/2, 0, "#7a7f86");
      storefront({x0:b.x0, x1:b.x1, z0:b.z0, z1:b.z1}, "s", "#f6e2bc", "NÓ CENTRAL · COWORKING", "#cfe9ff");
    }
    if (b.style === "brick") {
      box("brick", b.x0, b.x1, .16, b.h, b.z0, b.z1, "#ffffff", 3.2);
      box("concrete", b.x0, b.x1, .16, 4.2, b.z0, b.z1, "#6e6a64", 2);              // térreo
      for (let y = 4.2; y < b.h; y += 3.1) box("concrete", b.x0 - .05, b.x1 + .05, y - .12, y, b.z0 - .05, b.z1 + .05, "#b8b2a6", 1.5);
      box("concrete", b.x0 - .35, b.x1 + .35, b.h - .6, b.h + .3, b.z0 - .35, b.z1 + .35, "#c9c3b7", 1.5);   // cornija
      for (const f of ["s","w","e","n"]) facade(b, f, 4.2, b.h - 1, 3.1, {w:1.2, h:1.75, gap:1.5, frame:"#e2ddd2", lit:.42, ac:.25});
      storefront(b, "s", "#ffd7a1", "CAFÉ BYTE", "#ff9c4a");
      /* caixas d'água e escada de incêndio */
      for (const [x, z] of [[b.x0 + 4, b.z0 + 5], [b.x1 - 5, b.z0 + 6]]) { placed("metal", new THREE.CylinderGeometry(1.2, 1.2, 2.2, 14), x, b.h + 2.1, z, 0, "#7b7f84"); for (const d of [[-.8,-.8],[.8,-.8],[-.8,.8],[.8,.8]]) box("metal", x + d[0] - .06, x + d[0] + .06, b.h, b.h + 1, z + d[1] - .06, z + d[1] + .06, "#4a4e53"); }
      for (let y = 7.3; y < b.h - 2; y += 3.1) { box("metal", b.x1 + .05, b.x1 + 1.4, y, y + .08, b.z0 + 3, b.z0 + 8, "#2c2f33"); box("metal", b.x1 + 1.35, b.x1 + 1.42, y, y + 1, b.z0 + 3, b.z0 + 8, "#2c2f33"); }
      /* terraço do café: mesas e guarda-sóis */
      for (let x = 44; x <= 52; x += 3.6) { placed("satin", new THREE.CylinderGeometry(.42, .42, .05, 14), x, .92, -8.4, 0, "#e8e4dc"); placed("metal", new THREE.CylinderGeometry(.04, .04, .76, 6), x, .54, -8.4, 0, "#3a3d42");
        placed("satin", new THREE.ConeGeometry(1.5, .45, 10, 1, true), x, 2.55, -8.4, 0, "#2f4a43"); placed("metal", new THREE.CylinderGeometry(.03, .03, 2.4, 6), x, 1.3, -8.4, 0, "#3a3d42"); }
    }
    if (b.style === "deco") {
      box("concrete", b.x0, b.x1, .16, b.h, b.z0, b.z1, "#e3d6bf", 3);
      box("concrete", b.x0 - .2, b.x1 + .2, .16, 5, b.z0 - .2, b.z1 + .2, "#a99a83", 2);
      for (let x = b.x0 + 1; x < b.x1; x += 3.2) box("concrete", x - .35, x + .35, 5, b.h - 2, b.z1, b.z1 + .45, "#efe4cf", 2);
      for (let y = 8; y < b.h; y += 9) box("concrete", b.x0 - .3, b.x1 + .3, y, y + .5, b.z0 - .3, b.z1 + .3, "#cfc0a5", 2);
      box("concrete", b.x0 + 4, b.x1 - 4, b.h, b.h + 5, b.z0 + 3, b.z1 - 3, "#e6dac4", 3); box("concrete", b.x0 + 9, b.x1 - 9, b.h + 5, b.h + 9, b.z0 + 5, b.z1 - 5, "#ece1cc", 3);
      placed("metal", new THREE.CylinderGeometry(.1, .25, 8, 8), (b.x0 + b.x1)/2, b.h + 13, (b.z0 + b.z1)/2, 0, "#8d8a83");
      facade(b, "s", 5, b.h - 1, 3.2, {w:1.3, h:2, gap:1.9, frame:"#5b5348", lit:.4});
      facade(b, "e", 5, b.h - 1, 3.2, {w:1.3, h:2, gap:1.9, frame:"#5b5348", lit:.4});
      facade(b, "w", 5, b.h - 1, 3.2, {w:1.3, h:2, gap:1.9, frame:"#5b5348", lit:.4});
      storefront({x0:b.x0 + 8, x1:b.x1 - 8, z0:b.z0, z1:b.z1}, "s", "#efe1c6", null);
    }
    if (b.style === "resid") {
      box("plaster", b.x0, b.x1, .16, b.h, b.z0, b.z1, "#d9a787", 3);
      box("concrete", b.x0, b.x1, .16, 3.6, b.z0, b.z1, "#7b746b", 2);
      box("concrete", b.x0 - .3, b.x1 + .3, b.h - .3, b.h + .2, b.z0 - .3, b.z1 + .3, "#e9e3d9", 2);
      for (const f of ["w","s","n"]) facade(b, f, 3.6, b.h - .5, 2.8, {w:1.4, h:1.5, gap:1.4, frame:"#f1ece3", lit:.5, ac:.45, balcony:f === "w" ? .9 : 0});
      for (const [x, z] of [[b.x0 + 4, b.z0 + 6], [b.x0 + 4, b.z1 - 6], [b.x1 - 4, b.z0 + 14]]) placed("satin", new THREE.CylinderGeometry(1, 1, 1.8, 12), x, b.h + 1.1, z, 0, "#3f68a8");
      for (const [x, z] of [[b.x1 - 3, b.z0 + 4], [b.x1 - 6, b.z1 - 5]]) placed("metal", new THREE.CylinderGeometry(.03, .03, 3, 4), x, b.h + 1.7, z, 0, "#9a9ea5");
      storefront({x0:b.x0, x1:b.x1, z0:b.z0 + 6, z1:b.z1 - 6}, "w", "#f2e3c9", "MERCADINHO DA ESQUINA", "#9fe0a5");
    }
    if (b.style === "store") {
      box("plaster", b.x0, b.x1, .16, b.h, b.z0, b.z1, "#cfd3cf", 2.5);
      box("concrete", b.x0 - .2, b.x1 + .2, b.h - .5, b.h, b.z0 - .2, b.z1 + .2, "#efede7", 2);
      storefront(b, "n", "#ffe0b0", "LIVRARIA PÁGINA VIVA", "#ffd166");
      storefront(b, "e", "#ffe0b0", null);
      facade(b, "n", 4.4, b.h - .6, 4.4, {w:2.6, h:2.4, gap:1, sill:.8, frame:"#3c3f44", lit:.6});
      facade(b, "e", 4.4, b.h - .6, 4.4, {w:2.6, h:2.4, gap:1, sill:.8, frame:"#3c3f44", lit:.6});
    }
    if (b.style === "modern") {
      box("concrete", b.x0, b.x1, .16, b.h, b.z0, b.z1, "#a6a39e", 3);
      for (let y = 4.4; y < b.h; y += 3.3) { box("concrete", b.x0 - .9, b.x1 + .9, y, y + .28, b.z0 - .9, b.z1 + .9, "#cfccc6", 2); box("glass", b.x0 + .4, b.x1 - .4, y + .4, y + 3.1, b.z0 - .02, b.z1 + .02); }
      for (let y = 4.4; y < b.h - 2; y += 3.3) for (const f of ["e","s"]) {
        const horiz = f === "s"; const len = horiz ? b.x1 - b.x0 : b.z1 - b.z0;
        for (let a = 1.5; a < len - 1; a += 3) { const s2 = R(); if (s2 < .5) litSlots.push(Object.assign(horiz ? {x: b.x0 + a, z: b.z1 + .05} : {x: b.x1 + .05, z: b.z0 + a}, {y: y + 1.75, ry: horiz ? 0 : Math.PI/2, sx:2.6, sy:2.3, seed:s2, floor:y})); }
      }
      box("concrete", b.x0, b.x1, .16, 4.4, b.z0, b.z1, "#6f6c67", 2);
      box("metal", b.x0 + 3, b.x0 + 9, b.h, b.h + 2.2, b.z0 + 4, b.z0 + 10, "#7d8187");
      storefront(b, "e", "#e8eef6", null);
    }
    if (b.style === "station") {
      box("concrete", b.x0, b.x1, .16, b.h, b.z0, b.z1, "#c4c1ba", 2.5);
      box("glass", b.x0 + 1.5, b.x1 - 1.5, .3, b.h - 1.2, b.z0 - .05, b.z0 + .2);
      shopInteriors.push(box("light", b.x0 + 2, b.x1 - 2, .4, b.h - 1.6, b.z0 + .3, b.z0 + .35, "#e8f2ff"));
      /* marquise metálica sobre colunas */
      box("metal", b.x0 - 1, b.x1 + 1, b.h + .2, b.h + .55, b.z0 - 4.5, b.z0 + 1, "#3b4047");
      for (let x = b.x0; x <= b.x1 + .01; x += 6) box("metal", x - .15, x + .15, .16, b.h + .2, b.z0 - 4.3, b.z0 - 4, "#3b4047");
      signs.push({text:"METRÔ CENTRAL", color:"#bfe8ff", face:"n", x:(b.x0 + b.x1)/2, z: b.z0 - 4.6, y: b.h + .38, w:9});
      /* escadas descendo para a plataforma (com guarda-corpo) */
      const S2 = SUBWAY_STAIRS;
      box("matte", S2.x0, S2.x1, .165, .17, S2.z0, S2.z1, "#1b1d21");
      for (let k = 0; k < 8; k++) box("concrete", S2.x0 + .2, S2.x1 - .2, .17 - .02 * k, .19 - .02 * k, S2.z0 + .3 + k * .4, S2.z0 + .3 + k * .4 + .38, k % 2 ? "#5a5c60" : "#4c4e52");
      for (const x of [S2.x0, S2.x1]) box("metal", x - .05, x + .05, .16, 1.1, S2.z0 + .4, S2.z1, "#9aa0a8");
      box("metal", S2.x0, S2.x1, 1.05, 1.1, S2.z0 + .4, S2.z0 + .5, "#9aa0a8");
    }
  }
  /* ---------- prédios de fundo (silhuetas instanciadas, sem colisão) ---------- */
  const far = [];
  const R2 = rng(7);
  for (let k = 0; k < (PERF ? 40 : 80); k++) {
    const a = R2() * Math.PI * 2, d = 95 + R2() * 120, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) < 14 || Math.abs(z) < 10) continue;
    const w = 10 + R2() * 16, h = 14 + R2() * (Math.abs(x) < 80 && z < 0 ? 70 : 40);
    far.push({x, y:h/2, z, sx:w, sy:h, sz:w * (.7 + R2() * .6), c:["#6c7078","#8a8276","#565d68","#958f86","#6a6157","#7b8088"][k % 6], ry: Math.round(R2()) * .2});
  }
  const farTex = tex(128, (g, s) => { g.fillStyle = "#ffffff"; g.fillRect(0,0,s,s); for (let y = 4; y < s; y += 10) for (let x = 3; x < s; x += 9) { g.fillStyle = R() < .55 ? "#2f3540" : "#d9c79a"; g.fillRect(x, y, 5, 6); } });
  const farMat = new THREE.MeshStandardMaterial({map:farTex, roughness:.85, emissive:0xffd9a0, emissiveMap:farTex, emissiveIntensity:0});
  farTex.repeat.set(2, 4);
  const farMesh = instanced(new THREE.BoxGeometry(1, 1, 1), farMat, far, {});

  /* ---------- janelas, molduras, sacadas, ar-condicionado (instanciados) ---------- */
  const paneGeo = new THREE.PlaneGeometry(1, 1);
  const glassIM = instanced(paneGeo, MAT.glass, glassSlots, {});
  const litMat = new THREE.MeshBasicMaterial({color:0xffffff, toneMapped:false});
  const LIT_COLORS = ["#ffd9a0","#ffcf8a","#ffe6c4","#cfe2ff","#f5e3c8","#ffc27a","#b9d4ff"];
  litSlots.forEach(s => s.c = s.office ? (s.seed < .3 ? "#e6f0ff" : "#fff3dc") : LIT_COLORS[Math.floor(s.seed * 97) % LIT_COLORS.length]);
  const litIM = instanced(paneGeo, litMat, litSlots, {noReceive:true});
  const frameMat = new THREE.MeshStandardMaterial({roughness:.7});
  const frameIM = instanced(new THREE.BoxGeometry(1, 1, 1), frameMat, frames, {cast:!PERF});
  const acIM = instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({roughness:.6, metalness:.3}), acUnits, {cast:!PERF});
  const balIM = instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({roughness:.8}), balconies, {cast:!PERF});
  const railIM = instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color:0x9fb3c2, roughness:.1, metalness:.3, transparent:true, opacity:.45}), rails, {});
  const aoMesh = new THREE.Mesh(U.mergeBufferGeometries(aoGeos, false), new THREE.MeshBasicMaterial({map:T.ao, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-3})); scene.add(aoMesh);

  /* ---------- letreiros (canvas, iluminados à noite; neon só aqui) ---------- */
  const signMats = [];
  for (const s of signs) {
    const t = tex(512, (g, S) => { g.clearRect(0,0,S,S); g.fillStyle = "#16181c"; g.fillRect(0, S*.38, S, S*.24); g.fillStyle = s.color; fitText(g, s.text, 480, 64, "600", "Sora, Inter, sans-serif"); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s.text, S/2, S/2 + 2); }, 0);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.MeshBasicMaterial({map:t, transparent:true, toneMapped:false}); signMats.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.w), m); mesh.position.set(s.x, s.y, s.z);
    mesh.rotation.y = s.face === "s" ? 0 : s.face === "n" ? Math.PI : s.face === "e" ? Math.PI/2 : -Math.PI/2; scene.add(mesh);
    if (!PERF) { const h = new THREE.Sprite(new THREE.SpriteMaterial({map:T.halo, color:new THREE.Color(s.color), transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending})); h.scale.set(s.w * 1.3, 2.4, 1); h.position.set(s.x, s.y, s.z); scene.add(h); m.userData.halo = h; }
  }
  /* placas de rua e totem de anúncio */
  function plate(text, x, y, z, ry, w, bg, fg){ const t = tex(256, (g, S) => { g.fillStyle = bg; g.fillRect(0, S*.36, S, S*.28); g.fillStyle = fg; fitText(g, text, 240, 34, "600", "Inter, sans-serif"); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, S/2, S/2 + 2); }, 0);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshStandardMaterial({map:t, transparent:true, roughness:.5, side:THREE.DoubleSide})); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); }
  plate("Av. Horizonte", 11.2, 3.3, -7.2, Math.PI/2, 2.4, "#1f5c3f", "#ffffff"); plate("R. das Marés", -11.2, 3.3, 7.2, 0, 2.4, "#1f5c3f", "#ffffff");
  box("metal", 11.15, 11.25, .16, 3.6, -7.25, -7.15, "#3a3d42"); box("metal", -11.25, -11.15, .16, 3.6, 7.15, 7.25, "#3a3d42");
  plate("ÁREA EM OBRAS · ORLA AZUL EM BREVE →", 58, 1.4, -8.8, -Math.PI/2, 4.2, "#e8a33b", "#1b1b1b");
  plate("← BARRIO CARIBE EM BREVE · ÁREA EM OBRAS", -58, 1.4, 8.8, Math.PI/2, 4.2, "#e8a33b", "#1b1b1b");
  /* barreiras de obra nos limites da área */
  for (const [x0, x1, z0, z1] of [[57.5, 58, -14, -5.6], [57.5, 58, 5.6, 14], [-58, -57.5, -14, -5.6], [-58, -57.5, 5.6, 14], [9.5, 14, -58, -57.5], [-14, -9.5, -58, -57.5], [9.5, 14, 57.5, 58], [-14, -9.5, 57.5, 58]]) {
    box("satin", x0, x1, .16, 1.1, z0, z1, "#e8e3d9"); for (let k = 0; k < 4; k++) { const f = k / 4; const ax = x1 - x0 > .6; box("satin", ax ? x0 + (x1 - x0) * f : x0 - .01, ax ? x0 + (x1 - x0) * (f + .12) : x1 + .01, .5, .8, ax ? z0 - .01 : z0 + (z1 - z0) * f, ax ? z1 + .01 : z0 + (z1 - z0) * (f + .12), "#d9502f"); } }

  /* ---------- mobiliário urbano ---------- */
  /* postes: haste + braço + luminária (instanciados) */
  const poleG = (() => { const parts = [new THREE.CylinderGeometry(.07, .11, 6.5, 8).translate(0, 3.25, 0), new THREE.BoxGeometry(1.5, .08, .08).translate(.72, 6.35, 0), new THREE.BoxGeometry(.6, .12, .26).translate(1.35, 6.28, 0)].map(g => g.index ? g.toNonIndexed() : g); return U.mergeBufferGeometries(parts.map(g => { for (const k of Object.keys(g.attributes)) if (!["position","normal"].includes(k)) g.deleteAttribute(k); return g; }), false); })();
  const lampItems = LAMPS.map(l => ({x:l.x, y:.16, z:l.z, ry:l.r}));
  instanced(poleG, new THREE.MeshStandardMaterial({color:0x2f3236, roughness:.45, metalness:.7}), lampItems, {cast:!PERF});
  const bulbPos = LAMPS.map(l => ({x: l.x + Math.cos(l.r) * 1.35 * (1), y:6.18, z: l.z - Math.sin(l.r) * 1.35, sx:.5, sy:.05, sz:.2, ry:l.r}));
  const bulbMat = new THREE.MeshBasicMaterial({color:0xfff1d6, toneMapped:false});
  instanced(new THREE.BoxGeometry(1, 1, 1), bulbMat, bulbPos, {noReceive:true});
  const poolMat = new THREE.MeshBasicMaterial({map:T.pool, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0, polygonOffset:true, polygonOffsetFactor:-4});
  const poolG = new THREE.PlaneGeometry(1, 1); poolG.rotateX(-Math.PI/2);
  instanced(poolG, poolMat, bulbPos.map(b => ({x:b.x, y:.2, z:b.z, sx:9, sz:9})), {noReceive:true});
  const coneMat = new THREE.MeshBasicMaterial({color:0xffe2b0, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide});
  const coneG = new THREE.ConeGeometry(2.2, 6, 16, 1, true); coneG.translate(0, -3, 0);
  const cones = HIGH && opts.effects !== false ? instanced(coneG, coneMat, bulbPos.map(b => ({x:b.x, y:6.1, z:b.z})), {noReceive:true}) : null;
  /* luzes reais perto do jogador (só na qualidade alta) */
  const pls = [];
  if (HIGH) for (let k = 0; k < 4; k++) { const pl = new THREE.PointLight(0xffd6a0, 0, 16, 2); scene.add(pl); pls.push(pl); }
  /* árvores: tronco + copa de várias esferas (instanciadas) */
  function treeGeo(big){ const parts = []; const tr = new THREE.CylinderGeometry(.12, .2, big ? 3.2 : 2.6, 7).translate(0, big ? 1.6 : 1.3, 0); parts.push(prep(tr, "#5a4636"));
    const rr = rng(big ? 3 : 5); for (let k = 0; k < (big ? 9 : 6); k++) { const s = new THREE.IcosahedronGeometry((big ? 1.4 : 1.05) * (.7 + rr() * .5), 1); s.translate((rr() - .5) * (big ? 2.2 : 1.4), (big ? 4 : 3.2) + rr() * 1.4, (rr() - .5) * (big ? 2.2 : 1.4)); parts.push(prep(s, ["#3b5f31","#476f38","#32552b","#52793f","#2f4d29"][k % 5])); }
    return U.mergeBufferGeometries(parts, false); }
  const leafMat = std({roughness:.95});
  instanced(treeGeo(false), leafMat, TREES.filter(t => !t.big).map(t => ({x:t.x, y:.16, z:t.z, ry: t.x * 1.7, sx:1, sy:.9 + (t.z % 3) * .05, sz:1})), {cast:!PERF});
  instanced(treeGeo(true), leafMat, TREES.filter(t => t.big).map(t => ({x:t.x, y:.18, z:t.z, ry: t.z})), {cast:!PERF});
  /* canteiros com grade ao redor das árvores de calçada */
  for (const t of TREES) if (!t.big) box("concrete", t.x - .7, t.x + .7, .16, .24, t.z - .7, t.z + .7, "#5b5146", 1);
  /* palmeiras: tronco curvo em segmentos + folhas arqueadas */
  const palmG = (() => { const parts = []; let x = 0, y = .22;
    for (let k = 0; k < 7; k++) { const seg = new THREE.CylinderGeometry(.16 - k * .012, .2 - k * .012, 1.15, 7); seg.translate(x, y + .57, 0); parts.push(prep(seg, k % 2 ? "#8a7356" : "#7c6649")); y += 1.1; x += .06 * k; }
    for (let k = 0; k < 8; k++) { const leaf = new THREE.PlaneGeometry(3.2, .6, 6, 1); const p = leaf.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) + 1.6; p.setY(i, p.getY(i) * (1 - u / 3.6)); p.setZ(i, -Math.pow(u / 3.2, 2) * 1.4); }
      leaf.rotateX(-Math.PI/2); leaf.translate(1.6, 0, 0); leaf.rotateY(k / 8 * Math.PI * 2); leaf.translate(x, y, 0); leaf.computeVertexNormals(); parts.push(prep(leaf, k % 2 ? "#4c7a3a" : "#3f6b33")); }
    return U.mergeBufferGeometries(parts, false); })();
  const palmMat = std({roughness:.9, side:THREE.DoubleSide});
  instanced(palmG, palmMat, PALMS.map((p, k) => ({x:p.x, y:0, z:p.z, ry: k * 1.3})), {cast:!PERF});
  /* bancos, lixeiras, hidrantes, balizadores */
  for (const b of BENCHES) { const g = new THREE.BoxGeometry(2, .08, .5); placed("satin", g, b.x, .62, b.z, b.r, "#7a5a3e"); placed("satin", new THREE.BoxGeometry(2, .5, .06), b.x - Math.sin(b.r) * .24, .9, b.z - Math.cos(b.r) * .24, b.r, "#7a5a3e");
    for (const s of [-.8, .8]) placed("metal", new THREE.BoxGeometry(.06, .46, .45), b.x + Math.cos(b.r) * s, .39, b.z - Math.sin(b.r) * s, b.r, "#30343a"); }
  for (const [x, z] of [[12.6, -14], [-12.6, 14], [12.6, 22], [-12.6, -26], [30, -8.6], [-30, 8.6]]) placed("metal", new THREE.CylinderGeometry(.26, .22, .9, 10), x, .61, z, 0, "#3e4a44");
  for (const [x, z] of [[13.2, -40], [-13.2, 40]]) placed("satin", new THREE.CylinderGeometry(.14, .16, .7, 10), x, .51, z, 0, "#b23a2e");
  for (let x = -13.4; x <= -10.2; x += 1.6) for (const z of [-5.9, 5.9]) placed("metal", new THREE.CylinderGeometry(.08, .08, .9, 8), x, .6, z, 0, "#4b5058");
  /* fonte da praça */
  const F = PLAZA.fountain;
  placed("concrete", new THREE.CylinderGeometry(3.4, 3.6, .7, 32), F[0], .52, F[1], 0, "#bdb6a8", 2);
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.1, 32), new THREE.MeshStandardMaterial({color:0x2d5a6e, roughness:.05, metalness:.4, envMapIntensity:1.5})); water.rotation.x = -Math.PI/2; water.position.set(F[0], .82, F[1]); scene.add(water);
  placed("concrete", new THREE.CylinderGeometry(.5, .7, 1.6, 16), F[0], 1.4, F[1], 0, "#cfc7b8", 2);
  /* terminal do Desafio do Dia (totem com tela) */
  box("metal", KIOSK.x - .45, KIOSK.x + .45, .16, 2.3, KIOSK.z - .25, KIOSK.z + .25, "#2b2f35");
  const kioskScreen = box("light", KIOSK.x - .36, KIOSK.x + .36, .9, 2.05, KIOSK.z + .26, KIOSK.z + .27, "#7fd8e6");
  /* ponto de ônibus */
  const B2 = BUS_STOP;
  box("metal", B2.x - .05, B2.x + .05, .16, 2.6, B2.z - 2.5, B2.z + 2.5, "#2c3035");
  box("glass", B2.x + .55, B2.x + .6, .4, 2.4, B2.z - 2.4, B2.z + 2.4);
  box("metal", B2.x - .3, B2.x + .9, 2.6, 2.72, B2.z - 2.7, B2.z + 2.7, "#2c3035");
  box("satin", B2.x + .1, B2.x + .5, .55, .62, B2.z - 1.8, B2.z + 1.8, "#7a5a3e");
  const adPanel = box("light", B2.x + .62, B2.x + .64, .5, 2.2, B2.z + 1.1, B2.z + 2.3, "#f4f1ea");
  /* ---------- semáforos ---------- */
  const sigHeads = [];
  const lampOff = {red:"#3a1612", yellow:"#3a2e10", green:"#123222"}, lampOn = {red:"#ff3b30", yellow:"#ffb020", green:"#3dff8a"};
  for (const s of SIGNALS) {
    box("metal", s.x - .09, s.x + .09, .16, 5.6, s.z - .09, s.z + .09, "#2a2d31");
    /* cabeça voltada para a avenida (carros vindo do sul/norte) e para a rua (leste/oeste) */
    const faces = [{axis:"ns", ry: s.z > 0 ? 0 : Math.PI, dx: s.x > 0 ? -3 : 3, dz:0}, {axis:"ew", ry: s.x > 0 ? Math.PI/2 : -Math.PI/2, dx:0, dz: s.z > 0 ? -2 : 2}];
    for (const f of faces) {
      const hx = s.x + f.dx, hz = s.z + f.dz;
      box("metal", Math.min(s.x, hx) - .05, Math.max(s.x, hx) + .05, 5.4, 5.5, Math.min(s.z, hz) - .05, Math.max(s.z, hz) + .05, "#2a2d31");
      box("metal", hx - .2, hx + .2, 4.3, 5.4, hz - .2, hz + .2, "#1d1f22");
      const head = {axis:f.axis, lamps:{}};
      ["red","yellow","green"].forEach((c, i) => { const m = new THREE.MeshBasicMaterial({color:new THREE.Color(lampOff[c]), toneMapped:false}); const l = new THREE.Mesh(new THREE.CircleGeometry(.12, 14), m);
        l.position.set(hx + Math.sin(f.ry) * .21, 5.15 - i * .33, hz + Math.cos(f.ry) * .21); l.rotation.y = f.ry; scene.add(l); head.lamps[c] = m; });
      sigHeads.push(head);
    }
  }

  /* ---------- PESSOAS (humanos estilizados, articulados) ---------- */
  const humanMat = std({roughness:.8});
  function part(list, geo, color, m){ const g = prep(geo, color); if (m) g.applyMatrix4(m); list.push(g); }
  const T4 = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  /* Cria um humano. look = cores; options.backpack, cap. Retorna grupo + juntas para animar. */
  function makeHuman(look, o){
    o = o || {};
    const g = new THREE.Group(), hips = new THREE.Group(); hips.position.y = .93; g.add(hips);
    const torso = new THREE.Group(); hips.add(torso);
    const tp = [];
    part(tp, new THREE.CapsuleGeometry(.17, .3, 3, 10), look.top, new THREE.Matrix4().makeScale(1.12, 1, .72).premultiply(T4(0, .28, 0)));      // tronco
    part(tp, new THREE.CapsuleGeometry(.155, .12, 3, 8), look.bottom, new THREE.Matrix4().makeScale(1.1, 1, .78).premultiply(T4(0, -.02, 0)));   // quadril
    part(tp, new THREE.CylinderGeometry(.055, .06, .1, 8), look.skin, T4(0, .58, 0));                                                          // pescoço
    part(tp, new THREE.SphereGeometry(.118, 12, 9), look.skin, new THREE.Matrix4().makeScale(.95, 1.12, 1.02).premultiply(T4(0, .74, .005)));     // cabeça
    part(tp, new THREE.SphereGeometry(.125, 12, 7, 0, Math.PI * 2, 0, Math.PI * .55), look.hair, new THREE.Matrix4().makeScale(.98, 1.08, 1.06).premultiply(T4(0, .77, -.012)));
    part(tp, new THREE.TorusGeometry(.085, .028, 6, 14), look.top, new THREE.Matrix4().makeRotationX(Math.PI/2).premultiply(T4(0, .54, 0)));   // gola
    if (o.trim) part(tp, new THREE.BoxGeometry(.012, .42, .02), o.trim, T4(0, .28, .125));                                                    // zíper / detalhe
    if (o.backpack) { part(tp, new THREE.CapsuleGeometry(.12, .16, 4, 10), o.backpack, new THREE.Matrix4().makeScale(1.2, 1, .65).premultiply(T4(0, .3, -.17)));
      for (const sx of [-.1, .1]) part(tp, new THREE.BoxGeometry(.035, .38, .02), "#1b1d21", T4(sx, .33, .125)); }
    if (o.cap) { part(tp, new THREE.SphereGeometry(.128, 14, 8, 0, Math.PI * 2, 0, Math.PI * .5), o.cap, T4(0, .78, 0)); part(tp, new THREE.CylinderGeometry(.11, .11, .015, 14, 1, false, -Math.PI/2, Math.PI), o.cap, T4(0, .785, .07)); }
    const torsoMesh = new THREE.Mesh(U.mergeBufferGeometries(tp, false), humanMat); torso.add(torsoMesh);
    const limb = (parent, x, y, len, r, color, endColor, endGeo) => {
      const pivot = new THREE.Group(); pivot.position.set(x, y, 0); parent.add(pivot);
      const pp = []; part(pp, new THREE.CapsuleGeometry(r, len - r * 2, 2, 7), color, T4(0, -len / 2, 0));
      const upper = new THREE.Mesh(U.mergeBufferGeometries(pp, false), humanMat); pivot.add(upper);
      const joint = new THREE.Group(); joint.position.y = -len; pivot.add(joint);
      const lp = []; part(lp, new THREE.CapsuleGeometry(r * .88, len - r * 1.8, 2, 7), color, T4(0, -len / 2, 0));
      if (endGeo) part(lp, endGeo, endColor, null);
      const lower = new THREE.Mesh(U.mergeBufferGeometries(lp, false), humanMat); joint.add(lower);
      return {pivot, joint, meshes:[upper, lower]};
    };
    const shoe = new THREE.CapsuleGeometry(.055, .14, 3, 8); shoe.rotateX(Math.PI/2); shoe.scale(1, .72, 1); shoe.translate(0, -.44, .045);
    const hand = new THREE.SphereGeometry(.045, 10, 8); hand.translate(0, -.29, 0);
    const legL = limb(hips, -.1, -.06, .43, .086, look.bottom, look.shoes, shoe), legR = limb(hips, .1, -.06, .43, .086, look.bottom, look.shoes, shoe.clone());
    const armL = limb(torso, -.225, .5, .29, .06, look.top, look.skin, hand), armR = limb(torso, .225, .5, .29, .06, look.top, look.skin, hand.clone());
    armL.pivot.rotation.z = .08; armR.pivot.rotation.z = -.08;
    const meshes = [torsoMesh, ...legL.meshes, ...legR.meshes, ...armL.meshes, ...armR.meshes];
    meshes.forEach(m => { m.castShadow = !PERF; });
    /* sombra de contato (sempre, barata) */
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), new THREE.MeshBasicMaterial({map:T.blob, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4})); blob.rotation.x = -Math.PI/2; blob.position.y = .18; g.add(blob);
    const h = {group:g, hips, torso, legL, legR, armL, armR, ph:Math.random() * 6, blend:0};
    /* animação: parado / andando / correndo (procedural) */
    h.animate = function(dt, speed, pose, t){
      if (pose === "sit") { hips.position.y = .58; legL.pivot.rotation.x = legR.pivot.rotation.x = -1.45; legL.joint.rotation.x = legR.joint.rotation.x = 1.45; armL.pivot.rotation.x = armR.pivot.rotation.x = -.5; armL.joint.rotation.x = armR.joint.rotation.x = -.7; torso.rotation.x = .05; torso.scale.y = 1 + Math.sin(t * 1.4 + h.ph) * .008; return; }
      const run = Math.min(1, Math.max(0, (speed - 3) / 4)), walk = Math.min(1, speed / 1.4);
      h.blend += (walk - h.blend) * Math.min(1, dt * 8);
      const b = opts.reduce ? h.blend * .6 : h.blend;
      h.ph += dt * (speed > .05 ? (4.2 + run * 3.2) * Math.max(.7, Math.min(1.5, speed / 1.5)) : 0);
      const s = Math.sin(h.ph), c = Math.cos(h.ph);
      const amp = .5 + run * .45;
      legL.pivot.rotation.x = s * amp * b; legR.pivot.rotation.x = -s * amp * b;
      legL.joint.rotation.x = Math.max(0, -Math.sin(h.ph - .9)) * (.9 + run * .7) * b + .04;
      legR.joint.rotation.x = Math.max(0, Math.sin(h.ph - .9 + Math.PI)) * (.9 + run * .7) * b + .04;
      armL.pivot.rotation.x = -s * (.42 + run * .5) * b; armR.pivot.rotation.x = s * (.42 + run * .5) * b;
      armL.joint.rotation.x = armR.joint.rotation.x = -(.18 + run * .9) * b - .08;
      hips.position.y = .93 + Math.abs(c) * (.025 + run * .03) * b - run * .03;
      torso.rotation.x = run * .22 * b; torso.rotation.y = s * .07 * b;
      /* respiração quando parado */
      const idle = 1 - b; torso.scale.y = 1 + Math.sin(t * 1.6 + h.ph) * .012 * idle;
      armL.pivot.rotation.z = .08 + Math.sin(t * .8) * .02 * idle; armR.pivot.rotation.z = -.08 - Math.sin(t * .8) * .02 * idle;
    };
    return h;
  }
  /* versão sem articulação (estática): 1 chamada de desenho */
  function makeStatic(look, pose, o){
    const h = makeHuman(look, o); h.animate(0, 0, pose, 0); h.group.updateMatrixWorld(true);
    const gs = [];
    h.group.traverse(m => { if (m.isMesh && m.material === humanMat) { const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); gs.push(g); } });
    const mesh = new THREE.Mesh(U.mergeBufferGeometries(gs, false), humanMat); mesh.castShadow = !PERF;
    const grp = new THREE.Group(); grp.add(mesh); const blob = h.group.children.find(c => c.isMesh); if (blob) { blob.parent.remove(blob); grp.add(blob); }
    return grp;
  }
  /* jogador: jaqueta azul-marinho com vivo ciano, mochila amarela, tênis brancos */
  const player = makeHuman({top:"#1f2c44", bottom:"#3a4658", skin:"#b98260", hair:"#1a120d", shoes:"#f1f1ee"}, {backpack:"#d9a62e", trim:"#5fe6f0"});
  scene.add(player.group);
  const nearRing = new THREE.Mesh(new THREE.RingGeometry(.55, .62, 40), new THREE.MeshBasicMaterial({color:0xffd23f, transparent:true, opacity:0, depthWrite:false, toneMapped:false}));
  nearRing.rotation.x = -Math.PI/2; nearRing.position.y = .2; player.group.add(nearRing);
  /* pedestres articulados */
  const pedH = sim.peds.map(p => { const h = makeHuman(p.look, {backpack: R() < .3 ? "#3b3f46" : null}); scene.add(h.group); return h; });
  for (const s of sim.still) if (s.pose === "sit") { const bx = s.x - Math.sin(s.rot) * .12, bz = s.z - Math.cos(s.rot) * .12;
    box("satin", bx - .24, bx + .24, .58, .63, bz - .24, bz + .24, "#3a3d42"); for (const [dx, dz] of [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]) box("metal", bx + dx - .02, bx + dx + .02, .16, .58, bz + dz - .02, bz + dz + .02, "#2a2d31");
    box("satin", bx - Math.sin(s.rot) * -.0 - .24 * Math.abs(Math.cos(s.rot)) - .02 * Math.abs(Math.sin(s.rot)), bx + .24 * Math.abs(Math.cos(s.rot)) + .02 * Math.abs(Math.sin(s.rot)), .63, 1.05, bz - .02 * Math.abs(Math.cos(s.rot)) - .24 * Math.abs(Math.sin(s.rot)) - Math.cos(s.rot) * .22, bz + .02 * Math.abs(Math.cos(s.rot)) + .24 * Math.abs(Math.sin(s.rot)) - Math.cos(s.rot) * .22, "#3a3d42"); }
  const stillMeshes = sim.still.map(s => { const g = makeStatic(s.look, s.pose); g.position.set(s.x, s.pose === "sit" ? .1 : .16, s.z); g.rotation.y = s.rot; scene.add(g); return g; });
  /* personagens que iniciam missões */
  const npcLooks = {
    intro:{top:"#2b5e8a", bottom:"#2a2f38", skin:"#7a4b33", hair:"#120d0a", shoes:"#e9e9e6"}, expediente:{top:"#6b4e7a", bottom:"#2b2f38", skin:"#d8a57f", hair:"#9a9a9a", shoes:"#2d2d2d"},
    commit:{top:"#1d3557", bottom:"#1d3557", skin:"#a8714f", hair:"#1a120c", shoes:"#111"}, carreira:{top:"#e6dfd3", bottom:"#3c4a5c", skin:"#c88f6b", hair:"#2b1c12", shoes:"#f4f4f2"}
  };
  const npcs = {};
  for (const [id, lk] of Object.entries(npcLooks)) { const s = SPOTS[id]; const h = makeHuman(lk, {cap: id === "commit" ? "#1d3557" : null}); h.group.position.set(s.x, .16, s.z); h.group.rotation.y = s.face; scene.add(h.group); npcs[id] = h; }

  /* ---------- VEÍCULOS ---------- */
  function carGeo(type, paint){
    const dims = {sedan:[1.8, 4.5, 1.42], hatch:[1.74, 3.95, 1.48], suv:[1.9, 4.7, 1.7], taxi:[1.8, 4.5, 1.42], bus:[2.55, 11.5, 3.1]}[type];
    const [W, L, H] = dims, parts = [];
    /* perfil lateral (y × z) extrudado na largura */
    const s = new THREE.Shape();
    if (type === "bus") { s.moveTo(-L/2, .35); s.lineTo(L/2, .35); s.lineTo(L/2, H - .2); s.quadraticCurveTo(L/2, H, L/2 - .3, H); s.lineTo(-L/2 + .3, H); s.quadraticCurveTo(-L/2, H, -L/2, H - .25); s.lineTo(-L/2, .35); }
    else { const hood = type === "hatch" ? .2 : .26, trunk = type === "hatch" ? .06 : .2;
      s.moveTo(-L/2, .32); s.lineTo(L/2, .32); s.lineTo(L/2, .68); s.quadraticCurveTo(L/2 - .05, .86, L/2 - L * hood * .6, .9);
      s.lineTo(L/2 - L * hood, H * .66); s.lineTo(L * .02, H); s.lineTo(-L/2 + L * (trunk + .14), H); s.lineTo(-L/2 + L * trunk * .7, H * .66);
      s.lineTo(-L/2 + .08, H * .62); s.quadraticCurveTo(-L/2, H * .58, -L/2, .5); s.lineTo(-L/2, .32); }
    const body = new THREE.ExtrudeGeometry(s, {depth: W - .16, bevelEnabled:true, bevelThickness:.08, bevelSize:.06, bevelSegments:2, steps:1, curveSegments:6});
    body.translate(0, 0, -(W - .16)/2); body.rotateY(-Math.PI/2);
    parts.push(prep(body, paint));
    /* vidros (faixa mais escura levemente para fora) */
    if (type === "bus") { const g = new THREE.BoxGeometry(W + .02, 1.1, L - 2.4); g.translate(0, H - 1.05, -.3); parts.push(prep(g, "#1c2733")); const f = new THREE.BoxGeometry(W - .3, 1.4, .05); f.translate(0, H - 1.2, L/2 + .01); parts.push(prep(f, "#1c2733"));
      const st = new THREE.BoxGeometry(W + .03, .18, L - .4); st.translate(0, 1.25, 0); parts.push(prep(st, "#1aa6b7")); }
    else { const gw = new THREE.ExtrudeGeometry((() => { const g = new THREE.Shape(); const hood = type === "hatch" ? .2 : .26, trunk = type === "hatch" ? .06 : .2;
        g.moveTo(L/2 - L * hood + .1, H * .67); g.lineTo(L * .02, H - .05); g.lineTo(-L/2 + L * (trunk + .14) + .05, H - .05); g.lineTo(-L/2 + L * trunk * .7 + .12, H * .67); g.lineTo(L/2 - L * hood + .1, H * .67); return g; })(), {depth: W - .02, bevelEnabled:false});
      gw.translate(0, 0, -(W - .02)/2); gw.rotateY(-Math.PI/2); parts.push(prep(gw, "#18202a")); }
    if (type === "taxi") { const sign = new THREE.BoxGeometry(.7, .2, .3); sign.translate(0, H + .1, -.2); parts.push(prep(sign, "#1fb5c4")); const st = new THREE.BoxGeometry(W + .02, .12, L * .6); st.translate(0, .72, 0); parts.push(prep(st, "#1fb5c4")); }
    /* rodas */
    const wy = .34, wr = type === "bus" ? .5 : .33;
    const wz = type === "bus" ? [L/2 - 2.2, -L/2 + 2.6] : [L/2 - .82, -L/2 + .8];
    for (const z of wz) for (const x of [-W/2 + .12, W/2 - .12]) { const w = new THREE.CylinderGeometry(wr, wr, .24, 16); w.rotateZ(Math.PI/2); w.translate(x, wy + (wr - .34), z); parts.push(prep(w, "#17181a"));
      const rim = new THREE.CylinderGeometry(wr * .55, wr * .55, .26, 12); rim.rotateZ(Math.PI/2); rim.translate(x, wy + (wr - .34), z); parts.push(prep(rim, "#9ea3aa")); }
    return {geo: U.mergeBufferGeometries(parts, false), L, W, H};
  }
  const carPaint = std({roughness:.3, metalness:.5, envMapIntensity:1});
  const lightOn = new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false});
  function makeCar(type, color){
    const {geo, L, W, H} = carGeo(type, color);
    const g = new THREE.Group(); const m = new THREE.Mesh(geo, carPaint); m.castShadow = !PERF; m.receiveShadow = true; g.add(m);
    const lights = [];
    const fy = type === "bus" ? .9 : .62;
    for (const x of [-W/2 + .3, W/2 - .3]) { const f = new THREE.BoxGeometry(.32, .12, .04); f.translate(x, fy, L/2 + .04); lights.push(prep(f, "#fff6e0")); const r = new THREE.BoxGeometry(.32, .12, .04); r.translate(x, fy + .05, -L/2 - .04); lights.push(prep(r, "#ff2a1a")); }
    const lm = new THREE.Mesh(U.mergeBufferGeometries(lights, false), lightOn); g.add(lm);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.3, L * 1.12), new THREE.MeshBasicMaterial({map:T.blob, transparent:true, depthWrite:false, opacity:.9, polygonOffset:true, polygonOffsetFactor:-4})); blob.rotation.x = -Math.PI/2; blob.position.y = .015; g.add(blob);
    scene.add(g); return {group:g, L};
  }
  const PAINT = ["#c9ccd1","#2b2f36","#1d2f4f","#7d1f2b","#d9d6cf","#4a5160","#5b6a58"];
  PARKED.forEach((p, k) => { const c = makeCar(p.t, PAINT[k % PAINT.length]); c.group.position.set(p.x, 0, p.z); c.group.rotation.y = p.r; });
  const carObjs = sim.cars.map(c => makeCar(c.type, c.color));

  /* ---------- fusão final dos estáticos ---------- */
  const staticMeshes = flush();
  const lightMeshes = staticMeshes.filter(m => m.material === MAT.light);

  /* -------------------------------------------------------------------------
     HORÁRIO · iluminação cinematográfica (manhã, tarde, pôr do sol, noite)
     ------------------------------------------------------------------------- */
  const KEYS = [   // hora, céu topo, horizonte, cor do sol, intensidade, hemisfério (céu, chão, int.), exposição, neblina, noite(0–1)
    [0,  "#05081a","#151d38","#9fb4ff", .32, "#2a3a66","#15161c", .32, .95, "#141b33", 1],
    [5,  "#0b1230","#2a2c4a","#9fb4ff", .25, "#33416b","#1c1c22", .32, .95, "#232a44", 1],
    [6.3,"#3a4d7a","#f0a274","#ffb27a", .9,  "#90a4cc","#4a3c30", .45, .95, "#b99a8a", .45],
    [8.5,"#4a86cf","#bcd8ec","#fff0d8", 1.6, "#a9c2e6","#4a4238", .48, .84, "#bcd0e2", 0],
    [14, "#2f6fc4","#c4dcef","#fff8ee", 1.8, "#b2c9e8","#4e463c", .5, .8, "#c4d6e6", 0],
    [17, "#3a64a8","#f1c08a","#ffd09a", 1.6, "#a9b6d0","#54443a", .5,  .95, "#d9b99a", .05],
    [18.2,"#2b3f75","#ff9358","#ff8a48", 1.15,"#a99bc0","#5a4232", .5,  1.05,"#d99470", .2],
    [19, "#1b2450","#8d5a7a","#ff6a3a", .45, "#6d6a9a","#3a2e2c", .42, 1,  "#7a5a72", .55],
    [20, "#0b1230","#2c3458","#9fb4ff", .3,  "#3d4a78","#1c1c22", .36, .95, "#2a3050", .9],
    [24, "#05081a","#151d38","#9fb4ff", .32, "#2a3a66","#15161c", .32, .95, "#141b33", 1]
  ];
  const cA = new THREE.Color(), cB = new THREE.Color();
  function lerpCol(a, b, f){ return cA.set(a).lerp(cB.set(b), f).clone(); }
  let lastEnvHour = -10, env = {night:0};
  function setTime(h){
    let k = 0; while (k < KEYS.length - 2 && h > KEYS[k + 1][0]) k++;
    const A = KEYS[k], B = KEYS[k + 1], f = Math.min(1, Math.max(0, (h - A[0]) / (B[0] - A[0])));
    const top = lerpCol(A[1], B[1], f), hor = lerpCol(A[2], B[2], f);
    sky.material.uniforms.top.value.copy(top); sky.material.uniforms.horizon.value.copy(hor);
    const night = A[10] + (B[10] - A[10]) * f; env.night = night;
    /* sol de leste para oeste; à noite a lua assume com luz azulada */
    const ang = (h - 6) / 12 * Math.PI, isDay = h > 5.6 && h < 19.6;
    const dir = isDay ? new THREE.Vector3(Math.cos(ang), Math.max(.06, Math.sin(ang)), -.35).normalize() : new THREE.Vector3(-.4, .75, .5).normalize();
    sky.material.uniforms.sunDir.value.copy(dir);
    sky.material.uniforms.sunCol.value.copy(lerpCol(A[3], B[3], f)).multiplyScalar(isDay ? 1 : .15);
    sky.material.uniforms.stars.value = Math.max(0, night - .4) * 1.4;
    sky.material.uniforms.glow.value = isDay ? 1 : .2;
    sun.color.copy(lerpCol(A[3], B[3], f)); sun.intensity = A[4] + (B[4] - A[4]) * f;
    sun.userData.dir = dir;
    hemi.color.copy(lerpCol(A[5], B[5], f)); hemi.groundColor.copy(lerpCol(A[6], B[6], f)); hemi.intensity = A[7] + (B[7] - A[7]) * f;
    renderer.toneMappingExposure = A[8] + (B[8] - A[8]) * f;
    scene.fog.color.copy(lerpCol(A[9], B[9], f));
    /* janelas e luzes: acesas à medida que escurece; tarde da noite apagam algumas */
    const late = h >= 0 && h < 5 ? .55 : 1;
    const lit = Math.min(1, .12 + night * 1.15);
    litMat.color.setRGB(lit, lit * .96, lit * .9);
    litIM.count = Math.round(litSlots.length * (night > .2 ? late : 1));
    MAT.light.color.setScalar(.35 + night * .9);
    farMat.emissiveIntensity = night * .9;
    bulbMat.color.setRGB(.25 + night * .9, .24 + night * .84, .22 + night * .7);
    poolMat.opacity = night * .55; coneMat.opacity = night * .028;
    for (const m of signMats) { m.color.setScalar(.55 + night * .6); if (m.userData.halo) m.userData.halo.material.opacity = night * .35; }
    lightOn.color.setScalar(.5 + night * 1.2);
    for (const pl of pls) pl.intensity = night * 6;
    if (Math.abs(h - lastEnvHour) > .75) { lastEnvHour = h; refreshEnv(); }
  }

  /* -------------------------------------------------------------------------
     LAÇO · atualização por quadro
     ------------------------------------------------------------------------- */
  function update(dt, t, ctx){
    const P = ctx.player;
    /* sombra acompanha o jogador (com encaixe em texels para não tremer) */
    const d = sun.userData.dir || new THREE.Vector3(0, 1, 0);
    const snap = 84 / (HIGH ? 2048 : 1024);
    const px = Math.round(P.x / snap) * snap, pz = Math.round(P.z / snap) * snap;
    sun.target.position.set(px, 0, pz); sun.position.set(px + d.x * 120, d.y * 120, pz + d.z * 120);
    /* jogador */
    const py = .16 * onSidewalk(P.x, P.z); player.group.position.set(P.x, player.group.position.y + (py - player.group.position.y) * Math.min(1, dt * 14), P.z);
    let dr = P.rot - player.group.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    player.group.rotation.y += dr * Math.min(1, dt * 10);
    player.animate(dt, P.speed, "stand", t);
    nearRing.material.opacity += ((ctx.near ? .85 : 0) - nearRing.material.opacity) * Math.min(1, dt * 6);
    nearRing.scale.setScalar(1 + (ctx.near && !opts.reduce ? Math.sin(t * 3) * .06 : 0));
    /* pedestres */
    sim.peds.forEach((p, k) => { const h = pedH[k]; h.group.visible = !!p.visible; if (!p.visible) return;
      h.group.position.set(p.x, .16 * onSidewalk(p.x, p.z), p.z);
      let r = p.rot - h.group.rotation.y; r = Math.atan2(Math.sin(r), Math.cos(r)); h.group.rotation.y += r * Math.min(1, dt * 8);
      h.animate(dt, p.moving ? p.sp : 0, "stand", t); });
    sim.still.forEach((s, k) => stillMeshes[k].visible = !s.night || sim.night > .5);
    /* personagens das missões olham para o jogador quando ele chega perto */
    for (const [id, h] of Object.entries(npcs)) { const s = SPOTS[id], dd = Math.hypot(P.x - s.x, P.z - s.z);
      const want = dd < 7 ? Math.atan2(P.x - s.x, P.z - s.z) : s.face; let r = want - h.group.rotation.y; r = Math.atan2(Math.sin(r), Math.cos(r)); h.group.rotation.y += r * Math.min(1, dt * 3);
      h.animate(dt, 0, "stand", t); }
    /* veículos e semáforos */
    sim.cars.forEach((c, k) => { const o = carObjs[k]; o.group.position.set(c.x, 0, c.z); o.group.rotation.y = c.rot; });
    for (const h of sigHeads) { const st = sim.light[h.axis]; for (const c of ["red","yellow","green"]) h.lamps[c].color.set(c === st ? lampOn[c] : lampOff[c]); }
    /* luzes reais dos 4 postes mais próximos (alta qualidade) */
    if (pls.length && env.night > .3) { const near = bulbPos.map(b => [b, Math.hypot(b.x - P.x, b.z - P.z)]).sort((a, b) => a[1] - b[1]).slice(0, pls.length); near.forEach(([b], i) => pls[i].position.set(b.x, 5.8, b.z)); }
    water.material.roughness = .05 + Math.sin(t * 2) * .02;
    renderer.render(scene, camera);
  }
  function onSidewalk(x, z){ return (Math.abs(x) > AV.x1 && Math.abs(z) > ST.z1) || (Math.abs(x) > AV.x1 + .1 && Math.abs(z) > ST.z1 + .1) ? 1 : 0; }
  function resize(w, h){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(HIGH ? Math.min(dpr, 1.75) : Q === "equilibrada" ? Math.min(dpr, 1.25) : Math.min(dpr, 1) * .75);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const V = new THREE.Vector3();
  function project(x, y, z, w, h){ V.set(x, y, z).project(camera); return {x:(V.x + 1) / 2 * w, y:(1 - V.y) / 2 * h, front: V.z < 1 && V.z > -1}; }
  return {renderer, scene, camera, update, setTime, resize, project, env, stats: () => renderer.info.render};
}

window.CityWorld = {LAYOUT, createSim, createRenderer, rng};
})();

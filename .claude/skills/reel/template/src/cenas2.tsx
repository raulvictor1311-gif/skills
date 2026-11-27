/* Cenas "de interface": celular, terminal, cartões, checklist e o CTA em forma de
   caixa de comentário. Mostram o assunto em vez de só escrever sobre ele. */
import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CenaCartoes, CenaCelular, CenaChecklist, CenaComentario, CenaTerminal, Cores } from './tipos';
import { pilhaSans, pilhaSerif } from './fontes';

type Props<C> = { cena: C; cores: Cores; fonte: string; fonteItalica: string; duracao: number };

const mono = '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace';
const mistura = (a: string, b: string, p: number) => `color-mix(in srgb, ${a} ${p}%, ${b})`;

const useMola = (atrasoSeg = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - Math.round(atrasoSeg * fps), fps, config: { damping: 15, stiffness: 150, mass: 0.7 } });
};

/** área das cenas (deixa espaço para a legenda embaixo) com um zoom lento */
const Palco: React.FC<{ duracao: number; children: React.ReactNode; topo?: number; fim?: number }> = ({
  duracao, children, topo = 200, fim = 1200,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = interpolate(frame, [0, Math.max(1, duracao * fps)], [1, 1.035]);
  return (
    <AbsoluteFill style={{ top: topo, height: fim - topo, padding: '0 80px', justifyContent: 'center', alignItems: 'center', transform: `scale(${s})` }}>
      {children}
    </AbsoluteFill>
  );
};

const TituloTopo: React.FC<{ texto?: string; cores: Cores; fonte: string; e: number }> = ({ texto, cores, fonte, e }) =>
  texto ? (
    <div
      style={{
        fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 70, lineHeight: 1.05, letterSpacing: '-0.03em',
        color: cores.texto, textAlign: 'center', textWrap: 'balance', marginBottom: 40,
        opacity: e, transform: `translateY(${(1 - e) * 40}px)`,
      }}
    >
      {texto}
    </div>
  ) : null;

/* ---------------- celular ---------------- */

const Celular: React.FC<Props<CenaCelular>> = ({ cena, cores, fonte, duracao }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const eTitulo = useMola();
  const eTel = useMola(0.15);
  const t = frame / fps;
  const tela = mistura(cores.texto, cores.fundo, 6);
  const linha = mistura(cores.texto, cores.fundo, 14);
  const W = 470;
  const H = cena.titulo ? 820 : 900;

  const conteudo = (() => {
    if (cena.tela === 'chat') {
      const msgs = cena.mensagens ?? [];
      const passo = Math.max(0.5, Math.min(1.1, (duracao - 0.8) / Math.max(1, msgs.length)));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '30px 24px' }}>
          {msgs.map((m, i) => {
            const de = i % 2 === 0; // par: cliente; ímpar: você
            const e = spring({ frame: frame - Math.round((0.4 + i * passo) * fps), fps, config: { damping: 14, stiffness: 160 } });
            return (
              <div
                key={i}
                style={{
                  alignSelf: de ? 'flex-start' : 'flex-end', maxWidth: '82%', padding: '18px 22px', borderRadius: 26,
                  borderBottomLeftRadius: de ? 6 : 26, borderBottomRightRadius: de ? 26 : 6,
                  background: de ? linha : cores.destaque, color: de ? cores.texto : cores.sobreDestaque,
                  fontFamily: pilhaSans(fonte), fontWeight: 600, fontSize: 30, lineHeight: 1.25,
                  opacity: e, transform: `translateY(${(1 - e) * 24}px) scale(${0.9 + 0.1 * e})`,
                }}
              >
                {m}
              </div>
            );
          })}
        </div>
      );
    }
    if (cena.tela === 'dashboard') {
      const dados = cena.barras ?? [40, 55, 48, 70, 85, 100];
      return (
        <div style={{ padding: '34px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {cena.textoTela && (
            <div style={{ fontFamily: pilhaSans(fonte), fontWeight: 800, fontSize: 34, color: cores.texto }}>{cena.textoTela}</div>
          )}
          <div style={{ display: 'flex', gap: 14 }}>
            {[0, 1].map((k) => (
              <div key={k} style={{ flex: 1, height: 120, borderRadius: 22, background: linha, padding: 18 }}>
                <div style={{ width: '50%', height: 12, borderRadius: 6, background: mistura(cores.texto, cores.fundo, 30) }} />
                <div style={{ marginTop: 22, width: `${60 + 20 * k}%`, height: 30, borderRadius: 8, background: k ? cores.destaque : mistura(cores.texto, cores.fundo, 60) }} />
              </div>
            ))}
          </div>
          <div style={{ height: 330, borderRadius: 22, background: linha, padding: '24px 20px', display: 'flex', alignItems: 'flex-end', gap: 14 }}>
            {dados.map((v, i) => {
              const e = spring({ frame: frame - Math.round((0.4 + i * 0.12) * fps), fps, config: { damping: 18, stiffness: 120 } });
              return <div key={i} style={{ flex: 1, height: `${v * e}%`, borderRadius: 10, background: i === dados.length - 1 ? cores.destaque : mistura(cores.destaque, cores.fundo, 45) }} />;
            })}
          </div>
        </div>
      );
    }
    // site (padrão)
    const eBotao = useMolaPura(frame, fps, 0.7);
    const pulso = 1 + 0.04 * Math.sin(t * Math.PI * 2 * 0.9);
    return (
      <div style={{ padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: 90, height: 22, borderRadius: 8, background: cores.destaque }} />
          <div style={{ display: 'flex', gap: 10 }}>{[0, 1, 2].map((k) => <div key={k} style={{ width: 40, height: 10, borderRadius: 5, background: linha }} />)}</div>
        </div>
        <div style={{ borderRadius: 26, background: linha, padding: '34px 26px' }}>
          <div style={{ fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 40, lineHeight: 1.1, color: cores.texto, letterSpacing: '-0.02em' }}>
            {cena.textoTela ?? 'Seu negócio no digital'}
          </div>
          <div style={{ marginTop: 18, width: '85%', height: 12, borderRadius: 6, background: mistura(cores.texto, cores.fundo, 25) }} />
          <div style={{ marginTop: 10, width: '65%', height: 12, borderRadius: 6, background: mistura(cores.texto, cores.fundo, 25) }} />
          {cena.botao && (
            <div
              style={{
                marginTop: 28, display: 'inline-block', padding: '18px 30px', borderRadius: 18, background: cores.destaque,
                color: cores.sobreDestaque, fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 30,
                opacity: eBotao, transform: `scale(${(0.7 + 0.3 * eBotao) * pulso})`,
              }}
            >
              {cena.botao}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {[0, 1].map((k) => <div key={k} style={{ flex: 1, height: 150, borderRadius: 22, background: linha }} />)}
        </div>
      </div>
    );
  })();

  return (
    <Palco duracao={duracao} topo={170}>
      <TituloTopo texto={cena.titulo} cores={cores} fonte={fonte} e={eTitulo} />
      <div
        style={{
          width: W, height: H, borderRadius: 70, padding: 16, background: '#0a0a0c',
          boxShadow: `0 40px 120px ${mistura(cores.destaque, 'transparent', 25)}, inset 0 0 0 3px #2a2a30`,
          opacity: eTel, transform: `translateY(${(1 - eTel) * 120}px) rotate(${(1 - eTel) * -6}deg)`,
        }}
      >
        <div style={{ width: '100%', height: '100%', borderRadius: 56, background: tela, overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: 54, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: 130, height: 30, borderRadius: 20, background: '#0a0a0c' }} />
          </div>
          {conteudo}
        </div>
      </div>
      {cena.rotulo && (
        <div
          style={{
            marginTop: 28, padding: '12px 26px', borderRadius: 40, background: mistura(cores.destaque, cores.fundo, 18),
            border: `2px solid ${cores.destaque}`, color: cores.texto, fontFamily: pilhaSans(fonte), fontWeight: 700, fontSize: 34,
            opacity: eTel,
          }}
        >
          {cena.rotulo}
        </div>
      )}
    </Palco>
  );
};

/** spring sem hook (para usar dentro de expressão) */
const useMolaPura = (frame: number, fps: number, atrasoSeg: number) =>
  spring({ frame: frame - Math.round(atrasoSeg * fps), fps, config: { damping: 15, stiffness: 150, mass: 0.7 } });

/* ---------------- terminal ---------------- */

const Terminal: React.FC<Props<CenaTerminal>> = ({ cena, cores, fonte, duracao }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const eTitulo = useMola();
  const eJanela = useMola(0.1);
  const t = frame / fps;
  const cmd = cena.comando;
  const digitado = cmd.slice(0, Math.floor(Math.max(0, t - 0.4) * 28));
  const fimDigitar = 0.4 + cmd.length / 28;
  const linhas = cena.linhas ?? [];
  const passo = Math.max(0.35, Math.min(0.8, (duracao - fimDigitar - 0.4) / Math.max(1, linhas.length)));
  const cursor = Math.floor(t * 2) % 2 === 0;
  return (
    <Palco duracao={duracao}>
      <TituloTopo texto={cena.titulo} cores={cores} fonte={fonte} e={eTitulo} />
      <div
        style={{
          width: 900, borderRadius: 28, overflow: 'hidden', background: '#0b0b10', border: '2px solid #26262e',
          boxShadow: `0 40px 120px ${mistura(cores.destaque, 'transparent', 22)}`,
          opacity: eJanela, transform: `translateY(${(1 - eJanela) * 80}px)`,
        }}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', gap: 14, padding: '0 26px', borderBottom: '2px solid #1d1d24' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: 20, height: 20, borderRadius: 10, background: c }} />)}
          <div style={{ marginLeft: 18, fontFamily: mono, fontSize: 24, color: '#8a8a96' }}>{cena.janela ?? 'claude — projeto'}</div>
        </div>
        <div style={{ padding: '34px 36px 40px', fontFamily: mono, fontSize: 34, lineHeight: 1.55, color: '#e8e8ee', minHeight: 360 }}>
          <div>
            <span style={{ color: cores.destaque }}>&gt; </span>
            {digitado}
            {t < fimDigitar + 0.3 && <span style={{ opacity: cursor ? 1 : 0, color: cores.destaque }}>▍</span>}
          </div>
          {linhas.map((l, i) => {
            const e = useMolaPura(frame, fps, fimDigitar + 0.3 + i * passo);
            return (
              <div key={i} style={{ opacity: e, transform: `translateX(${(1 - e) * 30}px)`, marginTop: 10 }}>
                <span style={{ color: '#3ddc84' }}>✓ </span>
                {l}
              </div>
            );
          })}
        </div>
      </div>
    </Palco>
  );
};

/* ---------------- cartões ---------------- */

const Cartoes: React.FC<Props<CenaCartoes>> = ({ cena, cores, fonte, duracao }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const eTitulo = useMola();
  const itens = cena.itens.slice(0, 4);
  const passo = Math.max(0.35, Math.min(0.9, (duracao - 0.6) / Math.max(1, itens.length)));
  return (
    <Palco duracao={duracao}>
      <TituloTopo texto={cena.titulo} cores={cores} fonte={fonte} e={eTitulo} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        {itens.map((it, i) => {
          const e = useMolaPura(frame, fps, 0.3 + i * passo);
          const ativo = frame / fps >= 0.3 + i * passo;
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 30, padding: '30px 36px', borderRadius: 30,
                background: mistura(cores.texto, cores.fundo, ativo ? 9 : 5),
                border: `3px solid ${i === itens.length - 1 && ativo ? cores.destaque : mistura(cores.texto, 'transparent', 12)}`,
                opacity: e, transform: `translateX(${(1 - e) * (i % 2 ? 160 : -160)}px)`,
              }}
            >
              <div
                style={{
                  flex: '0 0 110px', height: 110, borderRadius: 28, display: 'grid', placeItems: 'center', fontSize: 62,
                  background: mistura(cores.destaque, cores.fundo, 22),
                }}
              >
                {it.icone}
              </div>
              <div>
                <div style={{ fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 48, color: cores.texto, lineHeight: 1.1 }}>{it.titulo}</div>
                {it.texto && <div style={{ marginTop: 8, fontFamily: pilhaSans(fonte), fontWeight: 600, fontSize: 34, color: cores.suave, lineHeight: 1.25 }}>{it.texto}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Palco>
  );
};

/* ---------------- checklist (✕ / ✓) ---------------- */

const Checklist: React.FC<Props<CenaChecklist>> = ({ cena, cores, fonte, duracao }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const eTitulo = useMola();
  const itens = cena.itens.slice(0, 6);
  const passo = Math.max(0.3, Math.min(0.8, (duracao - 0.6) / Math.max(1, itens.length)));
  return (
    <Palco duracao={duracao}>
      <div
        style={{
          width: 860, borderRadius: 34, padding: '40px 44px', background: mistura(cores.texto, cores.fundo, 7),
          border: `2px solid ${mistura(cores.texto, 'transparent', 12)}`, opacity: eTitulo, transform: `scale(${0.92 + 0.08 * eTitulo})`,
        }}
      >
        {cena.titulo && (
          <div style={{ fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 54, color: cores.texto, marginBottom: 26 }}>{cena.titulo}</div>
        )}
        {itens.map((it, i) => {
          const e = useMolaPura(frame, fps, 0.35 + i * passo);
          return (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0',
                borderTop: i ? `2px solid ${mistura(cores.texto, 'transparent', 10)}` : 'none',
                opacity: Math.max(0.25, e),
              }}
            >
              <div style={{ fontFamily: pilhaSans(fonte), fontWeight: 700, fontSize: 42, color: it.ok ? cores.texto : cores.suave, textDecoration: it.ok ? 'none' : 'line-through' }}>
                {it.texto}
              </div>
              <div
                style={{
                  flex: '0 0 70px', height: 70, borderRadius: 20, display: 'grid', placeItems: 'center', fontSize: 42, fontWeight: 900,
                  fontFamily: pilhaSans(fonte), color: '#fff', background: it.ok ? '#22b36b' : '#e5484d',
                  transform: `scale(${e})`,
                }}
              >
                {it.ok ? '✓' : '✕'}
              </div>
            </div>
          );
        })}
      </div>
    </Palco>
  );
};

/* ---------------- CTA: caixa de comentário ---------------- */

const Comentario: React.FC<Props<CenaComentario>> = ({ cena, cores, fonte, fonteItalica }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const eCard = useMola();
  const palavra = cena.palavra.toUpperCase();
  const tDig = 0.6;
  const digitado = palavra.slice(0, Math.floor(Math.max(0, t - tDig) * 9));
  const fimDig = tDig + palavra.length / 9;
  const clicou = t > fimDig + 0.35;
  const eToast = useMolaPura(frame, fps, fimDig + 0.8);
  const cursor = Math.floor(t * 2) % 2 === 0;
  const card = mistura(cores.texto, cores.fundo, 8);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 80px', top: -40 }}>
      <div style={{ textAlign: 'center', marginBottom: 46, opacity: eCard }}>
        <span style={{ fontFamily: pilhaSerif(fonteItalica), fontStyle: 'italic', fontSize: 96, color: cores.texto }}>{cena.chamada ?? 'Comenta'}</span>
      </div>
      <div
        style={{
          width: 900, borderRadius: 34, background: card, border: `2px solid ${mistura(cores.texto, 'transparent', 12)}`,
          padding: '34px 36px', opacity: eCard, transform: `translateY(${(1 - eCard) * 80}px)`,
        }}
      >
        {cena.perfil && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 26 }}>
            <div style={{ width: 74, height: 74, borderRadius: 37, background: `linear-gradient(135deg, ${cores.destaque}, ${mistura(cores.destaque, cores.fundo, 40)})` }} />
            <div style={{ fontFamily: pilhaSans(fonte), fontWeight: 800, fontSize: 36, color: cores.texto }}>{cena.perfil}</div>
          </div>
        )}
        <div style={{ fontFamily: pilhaSans(fonte), fontWeight: 600, fontSize: 28, color: cores.suave, marginBottom: 14 }}>Adicione um comentário…</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              flex: 1, height: 110, borderRadius: 22, background: cores.fundo, border: `3px solid ${clicou ? cores.destaque : mistura(cores.texto, 'transparent', 18)}`,
              display: 'flex', alignItems: 'center', padding: '0 30px', fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 64,
              color: cores.texto, letterSpacing: '0.02em',
            }}
          >
            {digitado}
            {!clicou && <span style={{ opacity: cursor ? 1 : 0, color: cores.destaque }}>|</span>}
          </div>
          <div
            style={{
              padding: '30px 34px', borderRadius: 22, background: clicou ? cores.destaque : mistura(cores.destaque, cores.fundo, 35),
              color: cores.sobreDestaque, fontFamily: pilhaSans(fonte), fontWeight: 900, fontSize: 34,
              transform: `scale(${clicou ? 1 : 0.96})`,
            }}
          >
            {clicou ? 'Publicado ✓' : 'Publicar'}
          </div>
        </div>
      </div>
      {cena.promessa && (
        <div
          style={{
            marginTop: 40, width: 900, borderRadius: 26, padding: '28px 34px', background: cores.destaque, color: cores.sobreDestaque,
            fontFamily: pilhaSans(fonte), fontWeight: 800, fontSize: 40, lineHeight: 1.2,
            opacity: eToast, transform: `translateY(${(1 - eToast) * 60}px)`, boxShadow: `0 24px 80px ${mistura(cores.destaque, 'transparent', 35)}`,
          }}
        >
          📩 {cena.promessa}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const CenaInterface: React.FC<Props<CenaCelular | CenaTerminal | CenaCartoes | CenaChecklist | CenaComentario>> = (p) => {
  switch (p.cena.tipo) {
    case 'celular': return <Celular {...(p as Props<CenaCelular>)} />;
    case 'terminal': return <Terminal {...(p as Props<CenaTerminal>)} />;
    case 'cartoes': return <Cartoes {...(p as Props<CenaCartoes>)} />;
    case 'checklist': return <Checklist {...(p as Props<CenaChecklist>)} />;
    case 'comentario': return <Comentario {...(p as Props<CenaComentario>)} />;
    default: return null;
  }
};

/** barra fina de progresso no topo e rótulo da seção: dá a sensação de "falta pouco" */
export const Progresso: React.FC<{ cores: Cores; secao?: string }> = ({ cores, secao }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, height: 10, width: `${p * 100}%`, background: cores.destaque }} />
      {secao && (
        <div style={{ position: 'absolute', top: 70, left: 80, fontFamily: mono, fontSize: 28, color: cores.suave, letterSpacing: '0.04em' }}>
          {secao}
        </div>
      )}
    </AbsoluteFill>
  );
};

// Diário do dia: cada agente registra o que andou e o que travou.
//   registrar --agente caixa-do-dia --andou "caixa conferido, 48 lançamentos" [--travou "..."]
//   ver [--data 2026-11-25]
import fs from 'node:fs';
import { caminho, hoje, args, lerJSON } from './_base.mjs';

const a = args();
const data = a.data || hoje();
const f = caminho('diario', `${data}.md`);
if (a._[0] === 'registrar') {
  if (!a.agente || (!a.andou && !a.travou)) { console.error('✖ precisa de --agente e --andou ou --travou'); process.exit(1); }
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: lerJSON(caminho('empresa.json'), {})?.fusoHorario || 'America/Sao_Paulo' });
  let linha = '';
  if (a.andou) linha += `- ${hora} · **${a.agente}** · andou: ${a.andou}\n`;
  if (a.travou) linha += `- ${hora} · **${a.agente}** · travou: ${a.travou}\n`;
  if (!fs.existsSync(f)) { fs.mkdirSync(caminho('diario'), { recursive: true }); fs.writeFileSync(f, `# Diário ${data}\n\n`); }
  fs.appendFileSync(f, linha);
  console.log('✔ registrado');
} else if (a._[0] === 'ver') {
  console.log(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : `Nada registrado em ${data}.`);
} else { console.log('uso: diario.mjs registrar|ver'); process.exit(1); }

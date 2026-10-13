#!/usr/bin/env node
/**
 * Sincroniza a base oficial Agrofit/MAPA (dados abertos, CC-BY) com o
 * Supabase: baixa o CSV diário do portal, recarrega o staging e chama
 * `agrofit_apply_sync` (diff por hash + histórico de atualizações).
 *
 * Fonte: https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit
 * (separador ";", UTF-8, uma linha por combinação registro × cultura × praga).
 *
 * Uso:
 *   node scripts/agrofit-sync.mjs [--force] [--file caminho/do/agrofit.csv]
 *
 *   --force  ignora o atalho da fonte inalterada e baixa o CSV mesmo assim;
 *   --file   usa um CSV já baixado (não baixa nem checa a fonte).
 *
 * Transporte (automático):
 *   - SUPABASE_SERVICE_ROLE_KEY (+ SUPABASE_URL)  → PostgREST  [CI/GitHub Actions]
 *   - senão: Management API (SUPABASE_ACCESS_TOKEN + project ref) [local]
 *
 * Automação diária: .github/workflows/agrofit-sync.yml
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const REFERER = "https://dados.agricultura.gov.br/";
const CKAN_API = "https://dados.agricultura.gov.br/api/3/action/package_show?id=sistema-de-agrotoxicos-fitossanitarios-agrofit";
const DATASET = "sistema-de-agrotoxicos-fitossanitarios-agrofit";
const RESOURCE_ID = "d30b30d7-e256-484e-9ab8-cd40974e1238";

const COLS = [
  "nr_registro",
  "marca_comercial",
  "formulacao",
  "ingrediente_ativo",
  "titular",
  "classe",
  "modo_de_acao",
  "cultura",
  "praga_cientifico",
  "praga_comum",
  "classe_toxicologica",
  "classe_ambiental",
  "organicos",
  "situacao",
];
const COL_INDEX = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14];
const BATCH_PG = 1000;
const BATCH_SQL = 2500;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const FILE_IDX = args.indexOf("--file");
const FILE_ARG = FILE_IDX >= 0 ? args[FILE_IDX + 1] : null;

// ---------------------------------------------------------------------------
// Ambiente / transporte
// ---------------------------------------------------------------------------
function lerEnv(name) {
  if (process.env[name]) return process.env[name].trim();
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const m = fs.readFileSync(envPath, "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

function lerToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  const candidatos = [
    path.join(os.homedir(), ".supabase", "access-token"),
    path.join(process.env.APPDATA || "", "supabase", "access-token"),
  ];
  for (const c of candidatos) {
    if (c && fs.existsSync(c)) return fs.readFileSync(c, "utf8").trim();
  }
  throw new Error("Access token do Supabase não encontrado (SUPABASE_ACCESS_TOKEN)");
}

function lerRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const url = lerEnv("SUPABASE_URL") || lerEnv("VITE_SUPABASE_URL");
  const m = url.match(/^https:\/\/([a-z0-9]+)\./);
  if (m) return m[1];
  throw new Error("Project ref não encontrado (SUPABASE_PROJECT_REF / VITE_SUPABASE_URL)");
}

const SUPABASE_URL = lerEnv("SUPABASE_URL") || lerEnv("VITE_SUPABASE_URL");
const SERVICE_KEY = lerEnv("SUPABASE_SERVICE_ROLE_KEY");
const TRANSPORTE = SERVICE_KEY ? "postgrest" : "management";
const TOKEN_MGMT = TRANSPORTE === "management" ? lerToken() : null;
const REF = TRANSPORTE === "management" ? lerRef() : null;

async function runSql(sql) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN_MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!resp.ok) {
    const texto = await resp.text();
    throw new Error(`SQL: HTTP ${resp.status} — ${texto.slice(0, 400)}`);
  }
  return resp.json();
}

async function pgRest(metodo, caminho, corpo) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    method: metodo,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!resp.ok) {
    const texto = await resp.text();
    throw new Error(`PostgREST ${metodo} ${caminho}: HTTP ${resp.status} — ${texto.slice(0, 400)}`);
  }
  const texto = (await resp.text()).trim();
  return texto ? JSON.parse(texto) : null;
}

const esc = (v) => (v == null ? "''" : `'${String(v).replace(/'/g, "''")}'`);

// ---------------------------------------------------------------------------
// Estado da fonte + histórico (leituras/escritas pontuais)
// ---------------------------------------------------------------------------
async function lerEstado() {
  if (TRANSPORTE === "postgrest") {
    const rows = await pgRest(
      "GET",
      "agrofit_sync_state?select=fonte_modified,ultima_execucao&id=eq.true",
    );
    return rows?.[0] || { fonte_modified: "", ultima_execucao: null };
  }
  const r = await runSql(
    "SELECT fonte_modified, ultima_execucao FROM public.agrofit_sync_state WHERE id",
  );
  return r?.[0] || { fonte_modified: "", ultima_execucao: null };
}

async function gravarEstado(fonteModified) {
  const agora = new Date().toISOString();
  if (TRANSPORTE === "postgrest") {
    await pgRest("PATCH", "agrofit_sync_state?id=eq.true", {
      fonte_modified: fonteModified,
      ultima_execucao: agora,
      atualizado_em: agora,
    });
    return;
  }
  await runSql(
    `UPDATE public.agrofit_sync_state SET fonte_modified = ${esc(fonteModified)}, ` +
      `ultima_execucao = now(), atualizado_em = now() WHERE id`,
  );
}

async function totalBase() {
  if (TRANSPORTE === "postgrest") {
    const r = await pgRest("GET", "agrofit_produtos?select=id&limit=-1");
    return Array.isArray(r) ? r.length : 0;
  }
  const r = await runSql("SELECT count(*) AS n FROM public.agrofit_produtos");
  return Number(r?.[0]?.n ?? 0);
}

async function inserirHistoricoSkip(mensagem, total, fonteModified) {
  const linha = {
    origem: "rotina_diaria",
    status: "sem_alteracoes",
    fonte_alterada: false,
    total_final: total,
    mensagem,
    detalhes: { fonte_modified: fonteModified, sem_download: true },
  };
  if (TRANSPORTE === "postgrest") {
    await pgRest("POST", "agrofit_sync_history", linha);
    return;
  }
  await runSql(
    `INSERT INTO public.agrofit_sync_history (origem, status, fonte_alterada, total_final, mensagem, detalhes) ` +
      `VALUES (${esc(linha.origem)}, ${esc(linha.status)}, false, ${total}, ${esc(mensagem)}, ` +
      `'${JSON.stringify(linha.detalhes).replace(/'/g, "''")}'::jsonb)`,
  );
}

async function inserirHistoricoFalha(mensagem) {
  try {
    const total = await totalBase();
    if (TRANSPORTE === "postgrest") {
      await pgRest("POST", "agrofit_sync_history", {
        origem: "rotina_diaria",
        status: "falha",
        fonte_alterada: false,
        total_final: total,
        mensagem: String(mensagem).slice(0, 2000),
        detalhes: {},
      });
      return;
    }
    await runSql(
      `INSERT INTO public.agrofit_sync_history (origem, status, fonte_alterada, total_final, mensagem) ` +
        `VALUES ('rotina_diaria', 'falha', false, ${total}, ${esc(String(mensagem).slice(0, 2000))})`,
    );
  } catch {
    // melhor esforço: não mascarar o erro original
  }
}

// ---------------------------------------------------------------------------
// Fonte CKAN (metadado do recurso oficial)
// ---------------------------------------------------------------------------
async function lerFonte() {
  const resp = await fetch(CKAN_API, { headers: { "User-Agent": UA, Referer: REFERER } });
  if (!resp.ok) throw new Error(`CKAN: HTTP ${resp.status}`);
  const pkg = await resp.json();
  if (!pkg?.success) throw new Error("CKAN: package_show sem sucesso");
  const recursos = pkg.result.resources || [];
  const recurso =
    recursos.find((r) => r.id === RESOURCE_ID) ||
    recursos.find((r) => /produto formulado/i.test(r.name || "")) ||
    recursos.find((r) => (r.format || "").toUpperCase() === "CSV");
  const fonteModified =
    (recurso && recurso.metadata_modified) || pkg.result.metadata_modified || "";
  const url =
    recurso?.url && /^https?:/i.test(recurso.url)
      ? recurso.url
      : `https://dados.agricultura.gov.br/dataset/${DATASET}/resource/${RESOURCE_ID}/download/produtos-formulados.csv`;
  return { fonteModified, url };
}

// ---------------------------------------------------------------------------
// Download do CSV (portal exige User-Agent de navegador)
// ---------------------------------------------------------------------------
async function baixarCsv(destino, url) {
  const tentar = async (alvo) => {
    const resp = await fetch(alvo, {
      headers: { "User-Agent": UA, Referer: REFERER, "Accept": "text/csv,*/*" },
      redirect: "follow",
    });
    if (!resp.ok) throw new Error(`download: HTTP ${resp.status}`);
    const tipo = resp.headers.get("content-type") || "";
    if (/text\/html/i.test(tipo)) throw new Error("download: resposta HTML (página, não CSV)");
    return resp;
  };

  let resp;
  try {
    resp = await tentar(url);
  } catch {
    const fallback = `https://dados.agricultura.gov.br/dataset/${DATASET}/resource/${RESOURCE_ID}/download/produtos-formulados.csv`;
    console.log(`  URL da fonte falhou, tentando rota de download do CKAN...`);
    resp = await tentar(fallback);
  }

  const total = Number(resp.headers.get("content-length") || 0);
  let recebido = 0;
  let ultimoLog = 0;
  const saida = fs.createWriteStream(destino);
  const corpo = Readable.fromWeb(resp.body);
  corpo.on("data", (c) => {
    recebido += c.length;
    if (recebido - ultimoLog >= 64 * 1024 * 1024) {
      ultimoLog = recebido;
      const mb = (recebido / 1024 / 1024).toFixed(0);
      const mbTotal = total ? `/${(total / 1024 / 1024).toFixed(0)}` : "";
      console.log(`  ... ${mb} MB${mbTotal} baixados`);
    }
  });
  await pipeline(corpo, saida);
  console.log(`  CSV salvo em ${destino} (${(recebido / 1024 / 1024).toFixed(1)} MB)`);
}

// ---------------------------------------------------------------------------
// Parser CSV streaming (RFC4180 com ';', aspas, UTF-8 e quebras internas)
// ---------------------------------------------------------------------------
function* csvRows(filePath) {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(1 << 20);
  const dec = new TextDecoder("utf-8");
  let campo = "";
  let linha = [];
  let emAspas = false;
  let bytesLidos = 0;

  const finalizarLinha = function* () {
    linha.push(campo);
    campo = "";
    if (linha.length > 1 || linha[0]) yield linha;
    linha = [];
  };

  try {
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, bytesLidos)) > 0) {
      bytesLidos += n;
      const texto = dec.decode(buf.subarray(0, n), { stream: true });
      for (let i = 0; i < texto.length; i++) {
        const ch = texto[i];
        if (emAspas) {
          if (ch === '"') {
            if (texto[i + 1] === '"') {
              campo += '"';
              i++;
            } else {
              emAspas = false;
            }
          } else {
            campo += ch;
          }
          continue;
        }
        if (ch === '"' && campo.length === 0) {
          emAspas = true;
        } else if (ch === ";") {
          linha.push(campo);
          campo = "";
        } else if (ch === "\n") {
          yield* finalizarLinha();
        } else if (ch !== "\r") {
          campo += ch;
        }
      }
    }
    dec.decode();
    if (campo.length || linha.length) yield* finalizarLinha();
  } finally {
    fs.closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Carga do staging
// ---------------------------------------------------------------------------
async function limparStaging() {
  if (TRANSPORTE === "postgrest") {
    await pgRest("POST", "rpc/agrofit_clear_staging", {});
    return;
  }
  await runSql("DELETE FROM public.agrofit_staging;");
}

async function inserirLoteStaging(lote) {
  if (TRANSPORTE === "postgrest") {
    await pgRest(
      "POST",
      "agrofit_staging",
      lote.map((cols) => Object.fromEntries(COLS.map((c, i) => [c, cols[i]]))),
    );
    return;
  }
  const tuples = lote.map((cols) => `(${cols.map(esc).join(",")})`).join(",");
  await runSql(`INSERT INTO public.agrofit_staging (${COLS.join(",")}) VALUES ${tuples};`);
}

// ---------------------------------------------------------------------------
// Aplicação (RPC)
// ---------------------------------------------------------------------------
async function aplicarSync(fonteAlterada, mensagem) {
  if (TRANSPORTE === "postgrest") {
    const r = await pgRest("POST", "rpc/agrofit_apply_sync", {
      p_origem: "rotina_diaria",
      p_fonte_alterada: fonteAlterada,
      p_mensagem: mensagem,
    });
    return r;
  }
  const r = await runSql(
    `SELECT public.agrofit_apply_sync('rotina_diaria', ${fonteAlterada}, ${esc(mensagem)}) AS r`,
  );
  return r?.[0]?.r ?? r?.[0]?.agrofit_apply_sync ?? null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Agrofit sync — transporte: ${TRANSPORTE}${FORCE ? " (--force)" : ""}`);

  const estado = await lerEstado();
  const fonte = await lerFonte();
  console.log(`  fonte oficial metadata_modified: ${fonte.fonteModified || "(desconhecido)"}`);
  console.log(`  última execução com fonte:       ${estado.fonte_modified || "(primeira)"}`);

  let arquivo = FILE_ARG;
  let baixado = false;

  if (!arquivo && !FORCE && estado.fonte_modified && estado.fonte_modified === fonte.fonteModified) {
    const total = await totalBase();
    const msg = `Fonte oficial inalterada desde ${fonte.fonteModified} — verificação diária sem download.`;
    await inserirHistoricoSkip(msg, total, fonte.fonteModified);
    console.log(`  ${msg}`);
    console.log(`Sem alterações — nada para aplicar (${total} linhas na base).`);
    return;
  }

  // Download (ou CSV local já existente)
  if (arquivo) {
    if (!fs.existsSync(arquivo)) {
      console.error(`Arquivo não encontrado: ${arquivo}`);
      process.exit(1);
    }
    console.log(`Usando CSV local: ${arquivo}`);
  } else {
    arquivo = path.join(os.tmpdir(), "opencode", `agrofit_sync_${Date.now()}.csv`);
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    console.log(`Baixando CSV oficial (${fonte.url})...`);
    await baixarCsv(arquivo, fonte.url);
    baixado = true;
  }

  // Parse → staging
  console.log("Carregando staging...");
  await limparStaging();
  let lidos = 0;
  let inseridos = 0;
  let lote = [];
  let loteIdx = 0;
  const loteMax = TRANSPORTE === "postgrest" ? BATCH_PG : BATCH_SQL;

  for (const cols of csvRows(arquivo)) {
    if (lidos === 0 && cols[0] && cols[0].includes("NR_REGISTRO")) {
      lidos++;
      continue;
    }
    lidos++;
    if (cols.length < 15) continue;
    lote.push(COL_INDEX.map((i) => cols[i] ?? ""));
    if (lote.length >= loteMax) {
      loteIdx++;
      await inserirLoteStaging(lote);
      inseridos += lote.length;
      lote = [];
      if (loteIdx % 20 === 0) console.log(`  ... ${inseridos} linhas no staging`);
    }
  }
  if (lote.length) {
    loteIdx++;
    await inserirLoteStaging(lote);
    inseridos += lote.length;
  }
  console.log(`  staging com ${inseridos} linhas (${lidos} lidas, ${loteIdx} lotes)`);

  if (inseridos === 0) {
    throw new Error("Nenhuma linha válida no CSV");
  }

  // Aplica (diff + cadastro + histórico)
  const mensagem = `Fonte ${fonte.fonteModified || "sem metadado"} — ${inseridos} linhas carregadas.`;
  console.log("Aplicando diff (agrofit_apply_sync)...");
  const r = await aplicarSync(!estado.fonte_modified || estado.fonte_modified !== fonte.fonteModified, mensagem);

  if (r) {
    console.log(
      `  status=${r.status} total=${r.total_final} +${r.adicionados} ~${r.modificados} -${r.removidos} ` +
        `cadastro=${r.cadastro_atualizados}`,
    );
  }

  await gravarEstado(fonte.fonteModified);

  if (baixado) {
    try {
      fs.unlinkSync(arquivo);
    } catch {
      /* melhor esforço */
    }
  }

  console.log("Concluído.");
}

main().catch(async (e) => {
  console.error("ERRO:", e.message);
  await inserirHistoricoFalha(e.message);
  process.exit(1);
});

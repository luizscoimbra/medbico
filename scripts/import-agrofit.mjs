#!/usr/bin/env node
/**
 * Importa a base oficial Agrofit/MAPA (dados abertos) para a tabela
 * `agrofit_produtos` do Supabase.
 *
 * Fonte: https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit
 * (CC-BY, atualização diária) — CSV de Produto Formulado, separado por ";",
 * uma linha por combinação registro × cultura × praga.
 *
 * Uso:
 *   node scripts/import-agrofit.mjs [caminho/do/agrofitprodutosformulados.csv]
 *
 * Autenticação: Management API do Supabase com o access token do CLI
 * (C:\Users\...\.supabase\access-token ou $SUPABASE_ACCESS_TOKEN) e o ref do
 * projeto (SUPABASE_PROJECT_REF ou .env VITE_SUPABASE_URL).
 *
 * Coluna EMPRESA_PAIS_TIPO é ignorada (descrição longa de fabricantes, sem
 * valor para prescrição).
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

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
  // 10 = EMPRESA_PAIS_TIPO (ignorada)
  "classe_toxicologica",
  "classe_ambiental",
  "organicos",
  "situacao",
];
const COL_INDEX = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14];
const BATCH = 2500;

function lerToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  const candidatos = [
    path.join(os.homedir(), ".supabase", "access-token"),
    path.join(process.env.APPDATA || "", "supabase", "access-token"),
  ];
  for (const c of candidatos) {
    if (c && fs.existsSync(c)) return fs.readFileSync(c, "utf8").trim();
  }
  throw new Error("Access token do Supabase não encontrado (defina SUPABASE_ACCESS_TOKEN)");
}

function lerRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const env = path.join(process.cwd(), ".env");
  if (fs.existsSync(env)) {
    const m = fs.readFileSync(env, "utf8").match(/VITE_SUPABASE_URL=https:\/\/([a-z0-9]+)\./);
    if (m) return m[1];
  }
  throw new Error("Project ref não encontrado (defina SUPABASE_PROJECT_REF ou .env)");
}

/** Parser CSV streaming (RFC4180 com ';', aspas, UTF-8 e quebras internas). */
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

const esc = (v) => (v == null ? "''" : `'${String(v).replace(/'/g, "''")}'`);

async function inserirLote(token, ref, lote, indice) {
  const tuples = lote
    .map((cols) => `(${cols.map(esc).join(",")})`)
    .join(",");
  const sql =
    `INSERT INTO public.agrofit_produtos (${COLS.join(",")}) VALUES ${tuples};`;
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!resp.ok) {
    const texto = await resp.text();
    throw new Error(`lote ${indice}: HTTP ${resp.status} — ${texto.slice(0, 300)}`);
  }
}

async function main() {
  const arquivo = process.argv[2] || path.join(os.tmpdir(), "opencode", "agrofit_produtos_formulados.csv");
  if (!fs.existsSync(arquivo)) {
    console.error(`Arquivo não encontrado: ${arquivo}`);
    process.exit(1);
  }
  const token = lerToken();
  const ref = lerRef();

  console.log(`Base: ${arquivo}`);
  console.log(`Projeto: ${ref}`);

  let total = 0;
  let inseridos = 0;
  let lote = [];
  let loteIdx = 0;

  for (const cols of csvRows(arquivo)) {
    if (total === 0 && cols[0].includes("NR_REGISTRO")) {
      console.log("Cabeçalho detectado, pulando...");
      total++; // só para não contar como dado
      continue;
    }
    total++;
    if (cols.length < 15) continue; // linha malformada
    lote.push(COL_INDEX.map((i) => cols[i] ?? ""));
    if (lote.length >= BATCH) {
      loteIdx++;
      await inserirLote(token, ref, lote, loteIdx);
      inseridos += lote.length;
      lote = [];
      if (loteIdx % 10 === 0) {
        console.log(`  ... ${inseridos} linhas inseridas (${total} lidas)`);
      }
    }
  }

  if (lote.length) {
    loteIdx++;
    await inserirLote(token, ref, lote, loteIdx);
    inseridos += lote.length;
  }

  console.log(`Concluído: ${inseridos} linhas inseridas em ${loteIdx} lotes (${total} lidas).`);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});

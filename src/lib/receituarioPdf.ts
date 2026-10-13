import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import type { Receituario } from "@/lib/fieldVisitStorage";

/**
 * Receituário Agronômico em PDF (Lei 7.802/1989 e Lei 14.785/2023).
 *
 * O documento é montado a partir do snapshot `dados` gravado no momento da
 * emissão (produtor, propriedade, responsável técnico com CREA/ART e itens
 * com registro MAPA) — assim ele continua íntegro mesmo que o cadastro mude
 * depois. O cabeçalho com a razão social/endereço vem da empresa atual.
 */

interface EmpresaEmitente {
  name: string;
  razao_social: string;
  nome_fantasia: string;
  document: string | null;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
}

export async function gerarReceituarioPdf(receituario: Receituario): Promise<void> {
  const { data: empresa } = await supabase
    .from("companies")
    .select("*")
    .maybeSingle<EmpresaEmitente>();

  const { dados, numero } = receituario;
  const emitente = empresa?.razao_social || empresa?.name || "Empresa";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 14;
  const W = 210 - L * 2;
  let y = 14;

  const secao = (titulo: string) => {
    if (y > 250) {
      doc.addPage();
      y = 16;
    }
    y += 3;
    doc.setFillColor(240, 244, 240);
    doc.rect(L, y - 4, W, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(titulo, L + 1.5, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  };

  const paragrafo = (texto: string, tamanho = 8.5) => {
    if (!texto) return;
    doc.setFontSize(tamanho);
    const linhas = doc.splitTextToSize(texto, W) as string[];
    for (const linha of linhas) {
      if (y > 275) {
        doc.addPage();
        y = 16;
      }
      doc.text(linha, L, y);
      y += 4.2;
    }
  };

  const par = (rotulo: string, valor?: string | null) => {
    if (!valor) return;
    if (y > 275) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(rotulo, L, y);
    const larguraRotulo = doc.getTextWidth(rotulo) + 2;
    doc.setFont("helvetica", "normal");
    doc.text(valor, L + larguraRotulo, y);
    y += 4.6;
  };

  // ── Cabeçalho do emitente ────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(emitente, L, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const linhaDoc = [
    empresa?.razao_social && empresa.razao_social !== emitente ? `Razão social: ${empresa.razao_social}` : null,
    empresa?.document ? `CNPJ: ${empresa.document}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (linhaDoc) {
    doc.text(linhaDoc, L, y);
    y += 4;
  }
  const endereco = empresa
    ? [empresa.logradouro, empresa.numero, empresa.bairro,
        empresa.municipio && empresa.uf ? `${empresa.municipio}/${empresa.uf}` : empresa.municipio,
        empresa.cep].filter(Boolean).join(", ")
    : "";
  if (endereco) {
    doc.text(endereco, L, y);
    y += 4;
  }

  y += 2;
  doc.setDrawColor(60, 60, 60);
  doc.line(L, y, L + W, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("RECEITUÁRIO AGRONÔMICO", L, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº ${numero}`, L, y);
  doc.text(
    `Emissão: ${new Date(receituario.criadoEm).toLocaleDateString("pt-BR")}`,
    L + W,
    y,
    { align: "right" }
  );
  y += 4;
  doc.text(
    `Situação: ${receituario.status === "emitida" ? "EMITIDO" : "RASCUNHO"}`,
    L,
    y
  );
  y += 7;

  // ── I. Produtor ──────────────────────────────────────────────────
  secao("I — PRODUTOR / RESPONSÁVEL PELA APLICAÇÃO");
  par("Nome:", dados.produtor?.nome);
  par("Documento:", dados.produtor?.documento);
  par(
    "Município/UF:",
    dados.produtor?.municipio
      ? `${dados.produtor.municipio}${dados.produtor.uf ? `/${dados.produtor.uf}` : ""}`
      : undefined
  );

  // ── II. Propriedade ──────────────────────────────────────────────
  secao("II — PROPRIEDADE / ÁREA DE APLICAÇÃO");
  par("Propriedade:", dados.propriedade?.nome);
  par(
    "Município/UF:",
    dados.propriedade?.municipio
      ? `${dados.propriedade.municipio}${dados.propriedade.uf ? `/${dados.propriedade.uf}` : ""}`
      : undefined
  );
  par("Área (ha):", dados.propriedade?.areaHa);
  par("CAR:", dados.propriedade?.car);

  // ── III. Responsável técnico ─────────────────────────────────────
  secao("III — RESPONSÁVEL TÉCNICO (ART/CREA)");
  par("Nome:", dados.tecnico?.nome);
  par("Título:", dados.tecnico?.titulo);
  par("CREA:", dados.tecnico?.crea);
  par("ART:", dados.tecnico?.art);

  // ── IV. Diagnóstico ──────────────────────────────────────────────
  secao("IV — DIAGNÓSTICO FITOSSANITÁRIO");
  paragrafo(dados.diagnostico || "—");

  // ── V. Produtos ──────────────────────────────────────────────────
  secao("V — PRODUTOS E RECOMENDAÇÕES");
  if (dados.itens.length === 0) {
    paragrafo("Nenhum produto registrado para este receituário.");
  } else {
    const cols = [
      { t: "Reg. MAPA", w: 20 },
      { t: "Produto", w: 40 },
      { t: "Ingrediente ativo", w: 42 },
      { t: "Dose", w: 24, r: true },
      { t: "Qtd. total", w: 22, r: true },
      { t: "Int. seg. / Reentrada", w: 34, r: true },
    ];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setFillColor(230, 236, 230);
    doc.rect(L, y - 4, W, 6, "F");
    let cx = L;
    for (const c of cols) {
      doc.text(c.t, c.r ? cx + c.w - 2 : cx + 1, y, { align: c.r ? "right" : "left" });
      cx += c.w;
    }
    y += 5;
    doc.setFont("helvetica", "normal");

    for (const item of dados.itens) {
      if (y > 262) {
        doc.addPage();
        y = 16;
      }
      const linha = [
        item.nrRegistro || "—",
        (item.marca || "—").slice(0, 30),
        (item.ingrediente || "—").slice(0, 30),
        `${item.dose} ${item.unidade}`,
        item.quantidade,
        [item.intervaloSeguranca, item.reentrada].filter(Boolean).join(" / ") || "—",
      ];
      cx = L;
      cols.forEach((c, i) => {
        doc.text(linha[i], c.r ? cx + c.w - 2 : cx + 1, y, { align: c.r ? "right" : "left" });
        cx += c.w;
      });
      y += 4.6;

      const detalhes = [
        item.cultura && `Cultura: ${item.cultura}`,
        item.alvo && `Alvo: ${item.alvo}`,
        item.modoAplicacao && `Aplicação: ${item.modoAplicacao}`,
        item.volumeCalda && `Volume de calda: ${item.volumeCalda}`,
        item.empresa && `Titular: ${item.empresa}`,
        item.forma && `Formulação: ${item.forma}`,
      ]
        .filter(Boolean)
        .join(" · ");
      if (detalhes) {
        doc.setFontSize(7);
        doc.setTextColor(90, 90, 90);
        const sub = doc.splitTextToSize(detalhes, W - 6) as string[];
        for (const linhaSub of sub) {
          if (y > 275) {
            doc.addPage();
            y = 16;
          }
          doc.text(linhaSub, L + 3, y);
          y += 3.6;
        }
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
      }
    }
  }

  // ── VI. Condições ────────────────────────────────────────────────
  secao("VI — CONDIÇÕES DE APLICAÇÃO, EPI E DESCARTE");
  paragrafo(
    dados.condicoes ||
      "Seguir integralmente a bula do produto. Utilizar EPI adequado. Descartar as embalagens vazias no ponto de recebimento autorizado."
  );

  // ── VII. Assinaturas ─────────────────────────────────────────────
  secao("VII — ASSINATURAS");
  if (y > 210) {
    doc.addPage();
    y = 16;
  }

  const larguraAssinatura = 70;
  if (receituario.assinaturaBase64) {
    try {
      doc.addImage(receituario.assinaturaBase64, "PNG", L, y - 2, larguraAssinatura, 24);
    } catch {
      // imagem inválida — segue só com as linhas de assinatura
    }
  }

  const lx = L + larguraAssinatura + 16;
  doc.setDrawColor(90, 90, 90);
  doc.line(lx, y + 16, L + W, y + 16);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (receituario.assinadoPorNome) {
    doc.text(receituario.assinadoPorNome, lx, y + 20);
  }
  doc.text("Produtor / responsável pela aplicação", lx, y + 24);
  if (receituario.assinadoEm) {
    doc.text(
      `Assinado em ${new Date(receituario.assinadoEm).toLocaleString("pt-BR")}` +
        (receituario.assinaturaMetodo
          ? ` — ${receituario.assinaturaMetodo === "biometrica" ? "assinatura biométrica" : "assinatura por toque"}`
          : ""),
      lx,
      y + 28
    );
  }
  y += 36;

  if (y > 250) {
    doc.addPage();
    y = 16;
  }
  doc.line(L, y + 16, L + W / 2 - 6, y + 16);
  doc.text("Responsável técnico — CREA/ART", L, y + 20);
  if (dados.tecnico?.nome) {
    doc.text(
      [dados.tecnico.nome, dados.tecnico.crea && `CREA ${dados.tecnico.crea}`, dados.tecnico.art && `ART ${dados.tecnico.art}`]
        .filter(Boolean)
        .join(" · "),
      L,
      y + 24
    );
  }
  doc.line(L + W / 2 + 6, y + 16, L + W, y + 16);
  doc.text("Data da aplicação", L + W / 2 + 6, y + 20);
  y += 34;

  // ── Rodapé legal ─────────────────────────────────────────────────
  doc.setDrawColor(60, 60, 60);
  doc.line(L, y, L + W, y);
  y += 5;
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  const legal = doc.splitTextToSize(
    "Documento emitido conforme a Lei nº 7.802/1989 e a Lei nº 14.785/2023. " +
      "Produtos constantes deste receituário devem estar registrados no MAPA (base Agrofit) " +
      "para a cultura e o alvo indicados. O acompanhamento técnico é obrigatório e a ART deve " +
      "ser mantida pelo responsável técnico. Sistema HerbiLog/MedBico — " +
      "não substitui a bula do produto.",
    W
  ) as string[];
  for (const linha of legal) {
    if (y > 285) break;
    doc.text(linha, L, y);
    y += 3.4;
  }

  doc.save(`receituario-${numero}.pdf`);
}

import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { fetchTaxProfiles, type TaxProfile } from "@/lib/taxProfilesStorage";
import type { OrdemServico, ProdutoDose, TalhaoData } from "@/lib/osStorage";

/**
 * Documento Fiscal Auxiliar de uma Ordem de Serviço.
 *
 * Gera um PDF com os dados cadastrais fiscais da empresa (Matriz), os itens da
 * OS e a tributação de cada item vinda da Central de Tributação — NCM, CFOP,
 * CST/CSOSN e, desde a reforma de 2027, CST IBS/CBS e cClassTrib, com os
 * valores estimados de PIS/COFINS/IPI (regime anterior) e CBS/IBS (regime
 * novo). O documento é um auxiliar comercial/contábil: a transmissão da NF-e
 * à SEFAZ depende de certificado digital e provedor autorizador.
 */

interface Emitente {
  razao_social: string;
  nome_fantasia: string;
  document: string | null;
  ie: string;
  im: string;
  regime_tributario: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
}

interface ItemFiscal {
  descricao: string;
  qtd: number;
  unidade: string;
  valorUnit: number;
  valorTotal: number;
  perfil?: TaxProfile;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Agrega os produtos dos talhões em itens com valor total (dose × área × preço). */
function itensDeTalhoes(talhoes: TalhaoData[]): ItemFiscal[] {
  const mapa = new Map<string, { qtd: number; unit: string; valor: number }>();
  for (const t of talhoes) {
    const areaTotal = parseFloat(t.area) || 0;
    let areaAplicada = areaTotal;
    if (t.testemunho) {
      areaAplicada = t.testemunhoArea
        ? Math.max(0, areaTotal - parseFloat(t.testemunhoArea) / 10000)
        : 0;
    }
    for (const p of t.produtos as ProdutoDose[]) {
      if (!p.produto || !p.dose) continue;
      const dose = parseFloat(p.dose) || 0;
      const preco = p.preco_unitario || 0;
      const atual = mapa.get(p.produto) ?? { qtd: 0, unit: p.unit || "L", valor: 0 };
      atual.qtd += dose * areaAplicada;
      atual.valor += dose * areaAplicada * preco;
      mapa.set(p.produto, atual);
    }
  }
  return [...mapa.entries()]
    .filter(([, v]) => v.valor > 0 || v.qtd > 0)
    .map(([nome, v]) => ({
      descricao: nome,
      qtd: v.qtd,
      unidade: v.unit,
      valorUnit: v.qtd > 0 ? v.valor / v.qtd : 0,
      valorTotal: v.valor,
    }));
}

/** Gera e dispara o download do Documento Fiscal Auxiliar da OS. */
export async function gerarDocumentoFiscalOS(os: OrdemServico): Promise<void> {
  const [{ data: empresa }, perfis, produtos] = await Promise.all([
    supabase.from("companies").select("*").maybeSingle<Emitente>(),
    fetchTaxProfiles().catch(() => [] as TaxProfile[]),
    supabase
      .from("registered_products")
      .select("commercial_name, tax_profile_saida_id")
      .then(({ data }) => data ?? []),
  ]);

  if (!empresa?.razao_social) {
    throw new Error(
      "Cadastre os dados fiscais da empresa (menu Empresa) antes de emitir o documento."
    );
  }

  const perfilPorProduto = new Map<string, TaxProfile>();
  for (const p of produtos as { commercial_name: string; tax_profile_saida_id: string | null }[]) {
    if (!p.tax_profile_saida_id) continue;
    const perfil = perfis.find((tp) => tp.id === p.tax_profile_saida_id);
    if (perfil) {
      perfilPorProduto.set(p.commercial_name.trim().toLowerCase(), perfil);
    }
  }

  const itens: ItemFiscal[] = [
    ...itensDeTalhoes(os.talhoes),
    ...(os.servicos ?? []).map((s) => ({
      descricao: `${s.codigo} — ${s.descricao}`,
      qtd: s.quantidade,
      unidade: s.unidade,
      valorUnit: s.valorUnitario,
      valorTotal: s.valorTotal,
    })),
  ].map((item) => ({
    ...item,
    perfil: perfilPorProduto.get(item.descricao.trim().toLowerCase().split(" — ")[0]),
  }));

  const totalOperacao = itens.reduce((s, i) => s + i.valorTotal, 0);
  if (totalOperacao <= 0) {
    throw new Error("Esta OS não tem valores lançados para emissão do documento.");
  }

  // ── Montagem do PDF ───────────────────────────────────────────────
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 14;
  const W = 210 - L * 2;
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(empresa.razao_social, L, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  if (empresa.nome_fantasia) {
    doc.text(`Fantasia: ${empresa.nome_fantasia}`, L, y);
    y += 4;
  }
  const linhaDoc = [
    empresa.document ? `CNPJ: ${empresa.document}` : null,
    empresa.ie ? `IE: ${empresa.ie}` : null,
    empresa.im ? `IM: ${empresa.im}` : null,
    empresa.regime_tributario ? `Regime: ${empresa.regime_tributario}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(linhaDoc, L, y);
  y += 4;
  const endereco = [empresa.logradouro, empresa.numero, empresa.bairro,
    empresa.municipio && empresa.uf ? `${empresa.municipio}/${empresa.uf}` : empresa.municipio,
    empresa.cep].filter(Boolean).join(", ");
  if (endereco) {
    doc.text(endereco, L, y);
    y += 4;
  }
  if (empresa.telefone) {
    doc.text(`Telefone: ${empresa.telefone}`, L, y);
    y += 4;
  }

  y += 2;
  doc.setDrawColor(60, 60, 60);
  doc.line(L, y, L + W, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DOCUMENTO AUXILIAR DA ORDEM DE SERVIÇO", L, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`OS nº ${os.id}`, L, y);
  doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, L + W, y, { align: "right" });
  y += 4;
  doc.text(`Cliente: ${os.clienteNome || os.propriedade}`, L, y);
  y += 4;
  doc.text(`Propriedade: ${os.propriedade}`, L, y);
  if (os.responsavelTecnico) {
    doc.text(`Resp. técnico: ${os.responsavelTecnico}`, L + W, y, { align: "right" });
  }
  y += 8;

  // Tabela de itens
  const cols = [
    { t: "Descrição", w: 62 },
    { t: "Qtd", w: 18, r: true },
    { t: "Un.", w: 12, r: true },
    { t: "Vlr. unit.", w: 22, r: true },
    { t: "Valor", w: 24, r: true },
    { t: "CST/CSOSN", w: 20, r: true },
    { t: "CFOP", w: 14, r: true },
    { t: "CBS/IBS", w: 16, r: true },
  ];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setFillColor(240, 244, 240);
  doc.rect(L, y - 4, W, 6, "F");
  let cx = L;
  for (const c of cols) {
    doc.text(c.t, c.r ? cx + c.w - 2 : cx + 1, y, { align: c.r ? "right" : "left" });
    cx += c.w;
  }
  y += 5;
  doc.setFont("helvetica", "normal");

  for (const item of itens) {
    if (y > 270) {
      doc.addPage();
      y = 16;
    }
    const p = item.perfil;
    const linha = [
      item.descricao.slice(0, 48),
      brl(item.qtd),
      item.unidade,
      brl(item.valorUnit),
      brl(item.valorTotal),
      p?.cst_csosn || "—",
      p?.cfop || "—",
      p ? `CBS ${p.aliquota_cbs}% / IBS ${p.aliquota_ibs}%` : "—",
    ];
    cx = L;
    cols.forEach((c, i) => {
      doc.text(linha[i], c.r ? cx + c.w - 2 : cx + 1, y, { align: c.r ? "right" : "left" });
      cx += c.w;
    });
    y += 4.5;
    if (p) {
      doc.setFontSize(6.5);
      doc.setTextColor(90, 90, 90);
      const extra = `NCM ${p.ncm || "—"} · CST IBS/CBS ${p.cst_ibs_cbs || "—"} · cClassTrib ${p.cclasstrib || "—"} · PIS ${p.aliquota_pis}% · COFINS ${p.aliquota_cofins}%${p.aliquota_ipi ? ` · IPI ${p.aliquota_ipi}%` : ""}`;
      doc.text(extra, L + 1, y);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8.5);
      y += 3.5;
    }
  }

  y += 2;
  doc.setDrawColor(180, 180, 180);
  doc.line(L + W - 50, y, L + W, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`TOTAL DA OPERAÇÃO: R$ ${brl(totalOperacao)}`, L + W, y, { align: "right" });
  y += 8;

  // Tributos estimados por perfil
  const soma = (f: (p: TaxProfile) => number) =>
    itens.reduce((s, i) => s + (i.perfil ? (i.valorTotal * f(i.perfil)) / 100 : 0), 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const tributos: [string, number][] = [
    ["PIS (estimado)", soma((p) => p.aliquota_pis)],
    ["COFINS (estimado)", soma((p) => p.aliquota_cofins)],
    ["IPI (estimado)", soma((p) => p.aliquota_ipi)],
    ["CBS (estimado, a partir de 2027)", soma((p) => p.aliquota_cbs)],
    ["IBS (estimado, a partir de 2027)", soma((p) => p.aliquota_ibs)],
  ];
  for (const [rotulo, valor] of tributos) {
    doc.text(`${rotulo}:`, L + W - 60, y, { align: "right" });
    doc.text(`R$ ${brl(valor)}`, L + W, y, { align: "right" });
    y += 4;
  }

  // Assinatura
  if (os.assinaturaBase64) {
    try {
      doc.addImage(os.assinaturaBase64, "PNG", L + W - 60, y + 2, 56, 18);
      y += 22;
      doc.setFontSize(8);
      doc.text(os.assinadoPorNome ?? "", L + W - 32, y, { align: "center" });
      if (os.assinadoEm) {
        doc.text(
          `Encerrada em ${new Date(os.assinadoEm).toLocaleString("pt-BR")}`,
          L + W - 32,
          y + 4,
          { align: "center" }
        );
      }
      y += 8;
    } catch {
      // Assinatura corrompida não impede a emissão do documento.
    }
  }

  y += 4;
  if (y > 265) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text(
    "Documento auxiliar gerado pelo HerbiLog a partir dos cadastros fiscais da empresa e da Central de Tributação.",
    L,
    y
  );
  y += 3.5;
  doc.text(
    "Não substitui a NF-e/NFS-e: a transmissão à SEFAZ exige certificado digital e provedor autorizador. Valores de PIS/COFINS/IPI e CBS/IBS são estimativas conforme alíquotas cadastradas.",
    L,
    y
  );

  doc.save(`DAF-OS-${os.id}.pdf`);
}

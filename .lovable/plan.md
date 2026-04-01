

# Plano Revisado: Embalagens + Apontamento + Relatório de Apontamento

## Parte 1 — Fix Build e Cálculo de Embalagens

### 1.1 Instalar dependências faltantes
- `jspdf` e `html2canvas` (causando o erro de build atual)

### 1.2 Fix CSS
- Mover `@import url(...)` da linha 9 para antes das diretivas `@tailwind` (linha 5)

### 1.3 Enriquecer `ProdutoDose`
- Adicionar `unit` e `packageSize` à interface em `osStorage.ts`
- No `OSForm.tsx`, ao selecionar produto via datalist, buscar `unit` e `package_size` do banco e preencher automaticamente

### 1.4 Seção "Resumo de Insumos" no `OSPreview.tsx`
- Agrupar produtos iguais, calcular `total = dose x area` e `embalagens = ceil(total / packageSize)`
- Exibir tabela com: Produto, Total necessário, Unidade, Embalagem, Qtd embalagens

---

## Parte 2 — Apontamento Pós-Aplicação

### 2.1 Modelo de dados — `osStorage.ts`
```typescript
interface ApontamentoTalhao {
  talhaoIndex: number;
  areaAplicada: string;
  caldaRestante: string;
  dataApontamento: string;
  observacoes: string;
}
// OrdemServico ganha: volumeCaldaHa?, apontamentos?, status?
```

### 2.2 Campo "Volume de calda (L/ha)" no `OSForm.tsx`
- Necessário para calcular concentração de produto na calda restante

### 2.3 Componente `OSApontamento.tsx`
- Lista talhões com campos: área aplicada (ha), calda restante (L), observações
- Cálculos automáticos por talhão:
  - Área faltante = área total - área aplicada
  - Produto restante na bomba = calda restante x (dose / volumeCaldaHa)
  - Produto necessário para finalizar = dose x área faltante
- Totais gerais

### 2.4 Integrar na página `OrdemServico.tsx`
- Novo botão "Apontamento" no preview, nova view `"apontamento"`

---

## Parte 3 — Relatório de Apontamento (PDF/Impressão)

### 3.1 Componente `OSApontamentoPreview.tsx`
- Layout A4 formatado para impressão, similar ao `OSPreview`, contendo:
  - Cabeçalho: logo, número da OS, data do apontamento, status
  - Dados da propriedade e responsáveis (mesmo bloco do OSPreview)
  - Tabela de apontamento por talhão:
    - Talhão, Área planejada, Área aplicada, Área faltante, Calda restante, Observações
  - Tabela de produtos:
    - Produto, Dose, Total planejado, Produto restante na bomba, Produto necessário para finalizar
  - Totais gerais: área total planejada, área aplicada, área faltante
  - Área de assinatura (responsável técnico + aplicador)
- Textos com tamanho adequado e tabelas sem truncamento (usar `break-inside: avoid` e margens generosas)
- CSS `@media print` reutilizando a classe `.print-area` já existente

### 3.2 Botões de exportação no apontamento
- Imprimir (`window.print()`)
- Exportar PDF (`html2canvas` + `jspdf`, mesmo padrão do OSPreview)
- Compartilhar (Web Share API)

### 3.3 View "apontamento-preview" em `OrdemServico.tsx`
- Após salvar o apontamento, botão "Visualizar Relatório" abre o preview formatado
- Mesma lógica de ref + exportação já usada para a OS

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/lib/osStorage.ts` | Atualizar interfaces |
| `src/components/os/OSForm.tsx` | Campo volume calda, enriquecimento produto |
| `src/components/os/OSPreview.tsx` | Seção resumo de insumos |
| `src/components/os/OSApontamento.tsx` | **Criar** — formulário de apontamento |
| `src/components/os/OSApontamentoPreview.tsx` | **Criar** — relatório A4 do apontamento |
| `src/pages/OrdemServico.tsx` | Novas views, botões, fix imports |
| `src/index.css` | Fix @import, estilos print |


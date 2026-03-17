

# Plano: Tela de Ordem de Serviço (OS) para Aplicação

## Visão Geral
Criar uma nova página `/ordem-servico` com formulário inteligente de coleta, persistência via IndexedDB, geração de documento A4, exportação PDF e compartilhamento.

## 1. Nova Página — `src/pages/OrdemServico.tsx`

### Formulário de Coleta (Etapa 1)
- **Cabeçalho:** Nome da propriedade, código da área, data, responsável técnico, aplicador
- **Talhões dinâmicos:** Campo numérico "Quantidade de talhões" que gera N blocos com:
  - Nome/número do talhão
  - Área (ha)
  - Produto(s) e dose (busca de `registered_products`)
  - Checkbox "Testemunho" (zera dose, marca como sem aplicação)
  - Checkbox "Teste de Produto" (exibe campo condicional para nome do produto em teste)
- **Botão "Replicar dosagem do Talhão 1"** para preencher todos os demais com mesmos produtos/doses
- Busca de produtos do banco `registered_products` (já compartilhado ou do próprio usuário)

### ID Sequencial (Etapa 2)
- Formato: `YYYYMMDD-NNN` (ex: `20260317-001`)
- Usar IndexedDB (via `idb-keyval` ou API nativa) para:
  - Persistir todas as OS geradas
  - Manter contador sequencial por dia
  - Consultar histórico de OS anteriores

### Visualização A4 / Relatório (Etapa 3)
- Layout formatado para impressão com:
  - Cabeçalho com logo, número da OS, data
  - Quadros organizados: dados da propriedade, responsáveis
  - Tabela de talhões: nome, área, dose, observações (testemunho/teste)
  - Totais: área total, volume total de calda
  - Área de assinatura: Responsável Técnico e Aplicador
- CSS `@media print` para ajuste A4 sem cortes

### Distribuição (Etapa 4)
- **Botão Imprimir:** `window.print()` com CSS print otimizado
- **Botão Exportar PDF:** Usar `html2canvas` + `jspdf` (ou `react-to-print`)
- **Botão Compartilhar:** Web Share API (`navigator.share`) para envio direto via WhatsApp/email

## 2. Dependências NPM
- `idb-keyval` — wrapper leve para IndexedDB
- `jspdf` + `html2canvas` — geração de PDF client-side

## 3. Integração no App
- Adicionar rota `/ordem-servico` em `App.tsx`
- Adicionar card na página `Index.tsx` (ícone `ClipboardList`, "Ordem de Serviço")
- Adicionar link no `Header.tsx` no menu de navegação

## 4. Banco de Dados
- Nenhuma migration necessária — dados persistidos localmente via IndexedDB
- Leitura de `registered_products` para busca de produtos (já existente)

## Arquivos a criar/editar
- **Criar:** `src/pages/OrdemServico.tsx` (componente principal ~600-800 linhas)
- **Editar:** `src/App.tsx` (nova rota)
- **Editar:** `src/pages/Index.tsx` (card de acesso)
- **Editar:** `src/components/Header.tsx` (link de navegação)




# Plano: Cadastro de Equipamentos e Novo Cadastro de Produtos

## Resumo

Criar duas novas tabelas no banco de dados e duas áreas de cadastro:
1. **Cadastro de Equipamentos** — armazena Modelo do Pulverizador, Modelo do Trator, Numero da Frota, Quantidade de Bicos. Usado na tela "Nova Medição" com busca por frota e preenchimento automático.
2. **Novo Cadastro de Produtos** — com campos Nome Comercial, Formulação (WP/WG/SC/EC/SL/ADJ), Unidade (L ou KG), Peso/Litros da embalagem. Usado na "Calculadora de Calda" com autocomplete que preenche formulação e nome automaticamente.

## Banco de Dados

### Tabela `equipment`
```sql
CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  equipment_model text NOT NULL,
  tractor_model text DEFAULT '',
  fleet_number text NOT NULL,
  total_nozzles integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, fleet_number)
);
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
-- RLS: users CRUD own rows
```

### Tabela `registered_products`
Nova tabela separada da `products` existente (que tem campos diferentes como culture, manufacturer, withholding_period):
```sql
CREATE TABLE public.registered_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  commercial_name text NOT NULL,
  formulation text NOT NULL, -- WP, WG, SC, EC, SL, ADJ
  unit text NOT NULL, -- L ou KG
  package_size numeric NOT NULL, -- peso ou litros da embalagem
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.registered_products ENABLE ROW LEVEL SECURITY;
-- RLS: users CRUD own rows
```

Triggers `update_updated_at_column` para ambas.

## Páginas e Componentes

### 1. Nova página `src/pages/Cadastros.tsx`
Página unificada com **Tabs** (Equipamentos | Produtos):
- **Aba Equipamentos**: Formulário com 4 campos + tabela listando os cadastrados + botão excluir
- **Aba Produtos**: Formulário com Nome Comercial, Formulação (Select com WP/WG/SC/EC/SL/ADJ), Unidade (L/KG), Tamanho Embalagem + tabela + excluir

### 2. Atualizar `src/pages/NovaMedicao.tsx`
- Adicionar campo de busca "Numero da Frota" com autocomplete que consulta a tabela `equipment`
- Ao selecionar uma frota, preencher automaticamente: Modelo do Pulverizador, Modelo do Trator, Quantidade de Bicos

### 3. Atualizar `src/pages/CalculadoraCalda.tsx`
- Substituir o autocomplete atual (que busca da tabela `products`) para buscar da tabela `registered_products`
- Ao selecionar um produto, preencher automaticamente: Nome Comercial, Formulação, Unidade

### 4. Atualizar roteamento
- Adicionar rota `/cadastros` em `App.tsx`
- Adicionar card "Cadastros" na tela Index na seção "O que deseja fazer?"
- Remover ou redirecionar a rota `/cadastro-produtos` antiga

## Autenticação
As tabelas exigem autenticação. O sistema já usa `supabase.auth.getUser()` em `CadastroProdutos`. O mesmo padrão será aplicado. Se o usuário não estiver autenticado, será redirecionado.


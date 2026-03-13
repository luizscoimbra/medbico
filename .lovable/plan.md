

# Plano: Melhorias na Calculadora de Calda e Aferir Vazão

## 1. Calculadora de Calda — Formulação automática e galões

### Formulação automática
O `handleSelectProduct` já preenche a formulação ao selecionar um produto. Porém, o tipo `Formulacao` é restrito a `"WP" | "WG" | "SC" | "EC" | "SL" | "ADJ"`, enquanto o banco aceita qualquer texto (ex: "CS"). Ajustar para aceitar qualquer string de formulação vinda do cadastro, exibindo corretamente.

### Galões necessários por produto
- Na interface `Produto`, adicionar campo opcional `packageSize` (litros/kg por galão, vindo de `registered_products.package_size`)
- No `handleSelectProduct`, passar o `package_size` do produto selecionado
- No relatório (tanque cheio e parcial), exibir para cada produto a quantidade de galões necessários:
  - `galões = dosagem / packageSize` (ex: "2,5 galões de 20L")
- Na lista de produtos adicionados, exibir também o tamanho da embalagem

### Arquivos alterados
- `src/pages/CalculadoraCalda.tsx`

## 2. Aferir Vazão — Busca por frota com preenchimento automático

### Implementação
- Adicionar `useEffect` para buscar equipamentos da tabela `equipment` ao montar o componente
- Transformar o campo "Frota" em campo de busca com autocomplete (similar ao da Calculadora de Calda)
- Ao selecionar uma frota:
  - Preencher automaticamente: Modelo do Trator (`tractor_model`), Tipo de Implemento (`equipment_model`), Número de Bicos (`total_nozzles`)
- Se digitar uma frota que não existe no cadastro, exibir mensagem: "Veículo não cadastrado" abaixo do campo
- Manter a possibilidade de preenchimento manual caso a frota não esteja cadastrada

### Arquivos alterados
- `src/pages/AferirVazao.tsx`

## Detalhes Técnicos
- Ambas as telas já importam `supabase` e já fazem queries similares
- Não é necessário criar tabelas nem migrations — tudo usa dados existentes de `equipment` e `registered_products`
- O tipo `Formulacao` será flexibilizado para `string` para aceitar formulações customizadas do cadastro


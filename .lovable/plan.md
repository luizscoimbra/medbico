

# Plano: Compartilhar Cadastro de Equipamentos entre Usuários

## Problema
Atualmente, a política RLS da tabela `equipment` restringe a leitura (`SELECT`) apenas ao próprio usuário. Isso impede que um operador veja equipamentos cadastrados por outro usuário.

## Solução

### 1. Migração SQL — Política de leitura compartilhada
- Remover a política `Users can view their own equipment` (SELECT restrito ao dono)
- Criar nova política `All authenticated users can view equipment` permitindo SELECT para qualquer usuário autenticado
- Manter as políticas de INSERT/UPDATE/DELETE restritas ao dono

```sql
DROP POLICY "Users can view their own equipment" ON public.equipment;
CREATE POLICY "All authenticated users can view equipment"
  ON public.equipment FOR SELECT TO authenticated USING (true);
```

### 2. Código — Nenhuma alteração necessária
As telas `AferirVazao.tsx` e `NovaMedicao.tsx` já fazem `supabase.from("equipment").select(...)` sem filtro por `user_id`. Com a nova política RLS, os dados de todos os usuários serão retornados automaticamente.


import { get, set, keys, del } from "idb-keyval";

export interface Fornecedor {
  id: string;
  nome: string;
  documento?: string; // CNPJ/CPF
  telefone?: string;
  email?: string;
  createdAt: string;
}

const STORAGE_KEY = "medbico_fornecedores";

export const saveFornecedor = async (
  fornecedor: Omit<Fornecedor, "id" | "createdAt"> & { id?: string }
): Promise<Fornecedor> => {
  const fornecedores = await getAllFornecedores();
  const existingIndex = fornecedor.id
    ? fornecedores.findIndex((f) => f.id === fornecedor.id)
    : -1;

  if (existingIndex >= 0) {
    const updated = {
      ...fornecedores[existingIndex],
      ...fornecedor,
      id: fornecedores[existingIndex].id,
    } as Fornecedor;
    fornecedores[existingIndex] = updated;
    await set(STORAGE_KEY, fornecedores);
    return updated;
  }

  const novo: Fornecedor = {
    id: `for-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    nome: fornecedor.nome,
    documento: fornecedor.documento || undefined,
    telefone: fornecedor.telefone || undefined,
    email: fornecedor.email || undefined,
    createdAt: new Date().toISOString(),
  };
  fornecedores.push(novo);
  await set(STORAGE_KEY, fornecedores);
  return novo;
};

export const getAllFornecedores = async (): Promise<Fornecedor[]> => {
  const fromSet = await get<Fornecedor[]>(STORAGE_KEY);
  if (fromSet && fromSet.length >= 0) return [...fromSet].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  // Compatibilidade: lista também chaves soltas (mesmo padrão dos demais cadastros)
  const allKeys = await keys();
  const avulsos: Fornecedor[] = [];
  for (const k of allKeys) {
    if (typeof k === "string" && k.startsWith("fornecedor-")) {
      const val = await get<Fornecedor>(k);
      if (val && typeof val === "object" && "nome" in val) avulsos.push(val);
    }
  }
  return avulsos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

export const getFornecedorById = async (id: string): Promise<Fornecedor | undefined> => {
  const fornecedores = await getAllFornecedores();
  return fornecedores.find((f) => f.id === id);
};

export const deleteFornecedor = async (id: string): Promise<void> => {
  const fornecedores = await getAllFornecedores();
  const updated = fornecedores.filter((f) => f.id !== id);
  await set(STORAGE_KEY, updated);
  await del(`fornecedor-${id}`);
};

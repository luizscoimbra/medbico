import { get, set } from 'idb-keyval';

export interface Cliente {
  id: string;
  tipo: "pessoa_fisica" | "pessoa_juridica";
  // Pessoa Física
  nomeCompleto?: string;
  cpf?: string;
  // Pessoa Jurídica
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  // Comuns
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  observacoes?: string;
  createdAt: string;
}

const STORAGE_KEY = 'medbico_clientes';

export const saveCliente = async (cliente: Cliente): Promise<void> => {
  const clientes = await getAllClientes();
  const index = clientes.findIndex(item => item.id === cliente.id);
  
  if (index !== -1) {
    clientes[index] = cliente;
  } else {
    clientes.push(cliente);
  }
  
  await set(STORAGE_KEY, clientes);
};

export const getAllClientes = async (): Promise<Cliente[]> => {
  return (await get<Cliente[]>(STORAGE_KEY)) || [];
};

export const getClienteById = async (id: string): Promise<Cliente | undefined> => {
  const clientes = await getAllClientes();
  return clientes.find(c => c.id === id);
};

export const deleteCliente = async (id: string): Promise<void> => {
  const clientes = await getAllClientes();
  const updated = clientes.filter(item => item.id !== id);
  await set(STORAGE_KEY, updated);
};

export const deleteAllClientes = async (): Promise<void> => {
  await set(STORAGE_KEY, []);
};

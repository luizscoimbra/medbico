import { get, set } from 'idb-keyval';

export interface Operador {
  id: string;
  nome: string;
  cracha: string;
  funcao: 'Operador' | 'Motorista';
  setor: string;
  createdAt: string;
}

const STORAGE_KEY = 'medbico_operadores';

export const saveOperador = async (operador: Operador): Promise<void> => {
  const operadores = await getAllOperadores();
  const index = operadores.findIndex(item => item.id === operador.id);
  
  if (index !== -1) {
    operadores[index] = operador;
  } else {
    operadores.push(operador);
  }
  
  await set(STORAGE_KEY, operadores);
};

export const getAllOperadores = async (): Promise<Operador[]> => {
  return (await get<Operador[]>(STORAGE_KEY)) || [];
};

export const deleteOperador = async (id: string): Promise<void> => {
  const operadores = await getAllOperadores();
  const updated = operadores.filter(item => item.id !== id);
  await set(STORAGE_KEY, updated);
};

import { get, set } from "idb-keyval";

export interface ComponenteCatalogo {
  id: string;
  nome: string;
  numero_serie: string;
  marca: string;
  modelo: string;
  custo: number;
  createdAt: string;
}

const STORAGE_KEY = "medbico_componentes_catalogo";

export const saveComponente = async (componente: ComponenteCatalogo): Promise<void> => {
  const componentes = await getAllComponentes();
  const index = componentes.findIndex((item) => item.id === componente.id);

  if (index !== -1) {
    componentes[index] = componente;
  } else {
    componentes.push(componente);
  }

  await set(STORAGE_KEY, componentes);
};

export const getAllComponentes = async (): Promise<ComponenteCatalogo[]> => {
  const componentes = (await get<ComponenteCatalogo[]>(STORAGE_KEY)) || [];
  return componentes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

export const deleteComponente = async (id: string): Promise<void> => {
  const componentes = await getAllComponentes();
  await set(
    STORAGE_KEY,
    componentes.filter((item) => item.id !== id)
  );
};

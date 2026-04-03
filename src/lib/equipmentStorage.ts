import { get, set } from 'idb-keyval';

export interface Equipment {
  id: string;
  equipment_model: string;
  tractor_model: string;
  fleet_number: string;
  total_nozzles: number;
  tank_capacity: number;
  createdAt: string;
}

const STORAGE_KEY = 'medbico_equipamentos';

export const saveEquipment = async (equipment: Equipment): Promise<void> => {
  const equipments = await getAllEquipments();
  const index = equipments.findIndex(item => item.id === equipment.id);
  
  if (index !== -1) {
    equipments[index] = equipment;
  } else {
    equipments.push(equipment);
  }
  
  await set(STORAGE_KEY, equipments);
};

export const getAllEquipments = async (): Promise<Equipment[]> => {
  return (await get<Equipment[]>(STORAGE_KEY)) || [];
};

export const deleteEquipment = async (id: string): Promise<void> => {
  const equipments = await getAllEquipments();
  const updated = equipments.filter(item => item.id !== id);
  await set(STORAGE_KEY, updated);
};

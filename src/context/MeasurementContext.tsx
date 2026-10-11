import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { MeasurementData, NozzleReading } from "@/lib/nozzleData";
import { getAllMeasurements, saveMeasurement as persistMeasurement } from "@/lib/measurementStorage";

interface MeasurementContextType {
  currentMeasurement: MeasurementData | null;
  setCurrentMeasurement: (data: MeasurementData | null) => void;
  updateEquipmentInfo: (info: Partial<MeasurementData>) => void;
  updateReadings: (readings: NozzleReading[]) => void;
  resetMeasurement: () => void;
  savedMeasurements: MeasurementData[];
  saveMeasurement: (measurement: MeasurementData) => Promise<void>;
}

const MeasurementContext = createContext<MeasurementContextType | undefined>(undefined);

export function MeasurementProvider({ children }: { children: ReactNode }) {
  const [currentMeasurement, setCurrentMeasurement] = useState<MeasurementData | null>(null);
  const [savedMeasurements, setSavedMeasurements] = useState<MeasurementData[]>([]);

  useEffect(() => {
    let active = true;
    getAllMeasurements()
      .then((list) => {
        if (active) setSavedMeasurements(list);
      })
      .catch(() => {
        if (active) toast.error("Não foi possível carregar o histórico de medições.");
      });
    return () => {
      active = false;
    };
  }, []);

  const updateEquipmentInfo = (info: Partial<MeasurementData>) => {
    setCurrentMeasurement((prev) => {
      if (!prev) {
        return {
          equipmentModel: "",
          tractorModel: "",
          fleetNumber: "",
          totalNozzles: 0,
          workingPressure: 3,
          measurementDate: new Date(),
          readings: [],
          ...info,
        };
      }
      return { ...prev, ...info };
    });
  };

  const updateReadings = (readings: NozzleReading[]) => {
    setCurrentMeasurement((prev) => {
      if (!prev) return null;
      return { ...prev, readings };
    });
  };

  const resetMeasurement = () => {
    setCurrentMeasurement(null);
  };

  const saveMeasurement = useCallback(async (measurement: MeasurementData) => {
    try {
      const saved = await persistMeasurement({ ...measurement, id: crypto.randomUUID() });
      setSavedMeasurements((prev) => [saved, ...prev.filter((m) => m.id !== saved.id)]);
      toast.success("Medição salva!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar a medição.");
      throw e;
    }
  }, []);

  return (
    <MeasurementContext.Provider
      value={{
        currentMeasurement,
        setCurrentMeasurement,
        updateEquipmentInfo,
        updateReadings,
        resetMeasurement,
        savedMeasurements,
        saveMeasurement,
      }}
    >
      {children}
    </MeasurementContext.Provider>
  );
}

export function useMeasurement() {
  const context = useContext(MeasurementContext);
  if (context === undefined) {
    throw new Error("useMeasurement must be used within a MeasurementProvider");
  }
  return context;
}
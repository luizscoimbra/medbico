import { createContext, useContext, useState, ReactNode } from "react";
import { MeasurementData, NozzleReading } from "@/lib/nozzleData";

interface MeasurementContextType {
  currentMeasurement: MeasurementData | null;
  setCurrentMeasurement: (data: MeasurementData | null) => void;
  updateEquipmentInfo: (info: Partial<MeasurementData>) => void;
  updateReadings: (readings: NozzleReading[]) => void;
  resetMeasurement: () => void;
  savedMeasurements: MeasurementData[];
  saveMeasurement: (measurement: MeasurementData) => void;
}

const MeasurementContext = createContext<MeasurementContextType | undefined>(undefined);

export function MeasurementProvider({ children }: { children: ReactNode }) {
  const [currentMeasurement, setCurrentMeasurement] = useState<MeasurementData | null>(null);
  const [savedMeasurements, setSavedMeasurements] = useState<MeasurementData[]>(() => {
    const saved = localStorage.getItem("measurements");
    return saved ? JSON.parse(saved) : [];
  });

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

  const saveMeasurement = (measurement: MeasurementData) => {
    const newMeasurement = {
      ...measurement,
      id: crypto.randomUUID(),
    };
    const updated = [newMeasurement, ...savedMeasurements];
    setSavedMeasurements(updated);
    localStorage.setItem("measurements", JSON.stringify(updated));
  };

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

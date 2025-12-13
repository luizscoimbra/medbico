export interface NozzleType {
  id: string;
  color: string;
  colorName: string;
  colorNamePt: string;
  gallonsPerMin: number;
  litersPerMin: number;
  tailwindClass: string;
  hexColor: string;
}

export const NOZZLE_TYPES: NozzleType[] = [
  {
    id: "orange",
    color: "orange",
    colorName: "Orange",
    colorNamePt: "Laranja",
    gallonsPerMin: 0.10,
    litersPerMin: 0.379,
    tailwindClass: "bg-nozzle-orange",
    hexColor: "#f97316",
  },
  {
    id: "green",
    color: "green",
    colorName: "Green",
    colorNamePt: "Verde",
    gallonsPerMin: 0.15,
    litersPerMin: 0.568,
    tailwindClass: "bg-nozzle-green",
    hexColor: "#22c55e",
  },
  {
    id: "yellow",
    color: "yellow",
    colorName: "Yellow",
    colorNamePt: "Amarela",
    gallonsPerMin: 0.20,
    litersPerMin: 0.757,
    tailwindClass: "bg-nozzle-yellow",
    hexColor: "#eab308",
  },
  {
    id: "lilac",
    color: "lilac",
    colorName: "Lilac",
    colorNamePt: "Lilás",
    gallonsPerMin: 0.25,
    litersPerMin: 0.946,
    tailwindClass: "bg-nozzle-lilac",
    hexColor: "#a855f7",
  },
  {
    id: "blue",
    color: "blue",
    colorName: "Blue",
    colorNamePt: "Azul",
    gallonsPerMin: 0.30,
    litersPerMin: 1.136,
    tailwindClass: "bg-nozzle-blue",
    hexColor: "#3b82f6",
  },
  {
    id: "red",
    color: "red",
    colorName: "Red",
    colorNamePt: "Vermelha",
    gallonsPerMin: 0.40,
    litersPerMin: 1.514,
    tailwindClass: "bg-nozzle-red",
    hexColor: "#ef4444",
  },
  {
    id: "brown",
    color: "brown",
    colorName: "Brown",
    colorNamePt: "Marrom",
    gallonsPerMin: 0.50,
    litersPerMin: 1.893,
    tailwindClass: "bg-nozzle-brown",
    hexColor: "#92400e",
  },
  {
    id: "gray",
    color: "gray",
    colorName: "Gray",
    colorNamePt: "Cinza",
    gallonsPerMin: 0.60,
    litersPerMin: 2.271,
    tailwindClass: "bg-nozzle-gray",
    hexColor: "#737373",
  },
  {
    id: "white",
    color: "white",
    colorName: "White",
    colorNamePt: "Branca",
    gallonsPerMin: 0.80,
    litersPerMin: 3.028,
    tailwindClass: "bg-nozzle-white border border-border",
    hexColor: "#f5f5f5",
  },
];

export interface NozzleReading {
  nozzleNumber: number;
  nozzleTypeId: string;
  measuredValue: number;
  status: "ok" | "cleaning" | "replacement";
  action: string;
}

export interface MeasurementData {
  id?: string;
  equipmentModel: string;
  tractorModel: string;
  fleetNumber: string;
  totalNozzles: number;
  workingPressure: number;
  measurementDate: Date;
  technicianName?: string;
  readings: NozzleReading[];
}

export function getNozzleById(id: string): NozzleType | undefined {
  return NOZZLE_TYPES.find((n) => n.id === id);
}

export function calculateNozzleStatus(
  nozzleTypeId: string,
  measuredValue: number
): { status: "ok" | "cleaning" | "replacement"; action: string; min: number; max: number } {
  const nozzle = getNozzleById(nozzleTypeId);
  if (!nozzle) {
    return { status: "ok", action: "Tipo de bico desconhecido", min: 0, max: 0 };
  }

  const standardValue = nozzle.litersPerMin;
  const tolerance = 0.10; // 10%
  const min = standardValue * (1 - tolerance);
  const max = standardValue * (1 + tolerance);

  if (measuredValue < min) {
    return { status: "cleaning", action: "Limpeza necessária", min, max };
  } else if (measuredValue > max) {
    return { status: "replacement", action: "Substituição necessária", min, max };
  } else {
    return { status: "ok", action: "OK", min, max };
  }
}

export function calculateOverallDiagnosis(readings: NozzleReading[]): {
  totalOk: number;
  totalCleaning: number;
  totalReplacement: number;
  percentageAbove: number;
  needsFullReplacement: boolean;
} {
  const totalOk = readings.filter((r) => r.status === "ok").length;
  const totalCleaning = readings.filter((r) => r.status === "cleaning").length;
  const totalReplacement = readings.filter((r) => r.status === "replacement").length;
  const percentageAbove = (totalReplacement / readings.length) * 100;
  const needsFullReplacement = percentageAbove > 10;

  return {
    totalOk,
    totalCleaning,
    totalReplacement,
    percentageAbove,
    needsFullReplacement,
  };
}

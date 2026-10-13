import type { ClimaRegistro } from "@/lib/osStorage";

/**
 * Condições meteorológicas para o registro de aplicação.
 *
 * Open-Meteo é gratuito e não exige chave de API — ideal para captura em
 * campo. Os valores ficam gravados na OS para rastrear se a pulverização
 * ocorreu dentro de condições seguras (vento, umidade, temperatura).
 */
const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    time?: string;
  };
}

/** Busca as condições atuais em (lat, lon). Lança Error com mensagem amigável. */
export async function buscarClimaAtual(lat: number, lon: number): Promise<ClimaRegistro> {
  const url =
    `${ENDPOINT}?latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}` +
    "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m" +
    "&timezone=auto";

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Serviço de clima indisponível (HTTP ${resp.status})`);
  }
  const data = (await resp.json()) as OpenMeteoResponse;
  const cur = data.current;
  if (!cur) {
    throw new Error("Serviço de clima não retornou dados para esta localização");
  }

  return {
    temperaturaC: cur.temperature_2m,
    umidadeRelativa: cur.relative_humidity_2m,
    precipitacaoMm: cur.precipitation,
    ventoKmh: cur.wind_speed_10m,
    ventoDirecaoGraus: cur.wind_direction_10m,
    latitude: lat,
    longitude: lon,
    fonte: "Open-Meteo",
    capturadoEm: new Date().toISOString(),
  };
}

/** Obtém a posição atual do dispositivo e busca o clima ali. */
export async function capturarClimaGPS(timeoutMs = 12000): Promise<ClimaRegistro> {
  if (!("geolocation" in navigator)) {
    throw new Error("Este dispositivo não possui GPS disponível");
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 60_000,
    });
  });
  return buscarClimaAtual(pos.coords.latitude, pos.coords.longitude);
}

/** Converte direção do vento em graus para texto (graus → rosa dos ventos). */
export function direcaoVentoTexto(graus?: number): string {
  if (graus == null || isNaN(graus)) return "—";
  const setores = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  const idx = Math.round(((graus % 360) + 360) % 360 / 45) % 8;
  return `${setores[idx]} (${Math.round(graus)}°)`;
}

export type WeatherKind = 'sun' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';

export interface DestinationWeather {
  locationLabel: string;
  countryLabel: string;
  temperatureC: number;
  apparentTempC: number;
  humidity: number;
  windKmh: number;
  isDay: boolean;
  condition: string;
  kind: WeatherKind;
  timezone: string;
  observedAt: string;
}

interface GeocodeResult {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
}

function describeWmoCode(code: number): { condition: string; kind: WeatherKind } {
  if (code === 0) return { condition: 'Clear sky', kind: 'sun' };
  if (code === 1 || code === 2) return { condition: 'Partly cloudy', kind: 'partly' };
  if (code === 3) return { condition: 'Overcast', kind: 'cloud' };
  if (code === 45 || code === 48) return { condition: 'Foggy', kind: 'fog' };
  if (code >= 51 && code <= 57) return { condition: 'Light drizzle', kind: 'rain' };
  if (code >= 61 && code <= 67) return { condition: 'Rainy', kind: 'rain' };
  if (code >= 71 && code <= 77) return { condition: 'Snowfall', kind: 'snow' };
  if (code >= 80 && code <= 82) return { condition: 'Rain showers', kind: 'rain' };
  if (code === 85 || code === 86) return { condition: 'Snow showers', kind: 'snow' };
  if (code >= 95) return { condition: 'Thunderstorm', kind: 'storm' };
  return { condition: 'Mild skies', kind: 'partly' };
}

async function geocodePlace(
  query: string,
  preferredCountry: string,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  const cleanQuery = query.split('·')[0].trim();
  if (!cleanQuery) return null;

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    cleanQuery
  )}&count=5&language=en&format=json`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Geocoding lookup failed (${res.status})`);
  }

  const data = (await res.json()) as { results?: GeocodeResult[] };
  if (!data.results || data.results.length === 0) return null;

  const lowerCountry = preferredCountry.toLowerCase();
  const matched =
    data.results.find((r) => (r.country || '').toLowerCase() === lowerCountry) ||
    data.results.find((r) => (r.country || '').toLowerCase().includes(lowerCountry)) ||
    data.results[0];

  return matched;
}

export async function fetchDestinationWeather(
  destination: string,
  countryName: string,
  fallbackCapital: string,
  signal?: AbortSignal
): Promise<DestinationWeather> {
  // Try exact destination, then capital, then country name
  let geo = await geocodePlace(destination, countryName, signal);
  if (!geo && fallbackCapital) {
    geo = await geocodePlace(fallbackCapital, countryName, signal);
  }
  if (!geo) {
    geo = await geocodePlace(countryName, countryName, signal);
  }
  if (!geo) {
    throw new Error(`Could not find weather coordinates for "${destination}".`);
  }

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=auto`;

  const forecastRes = await fetch(forecastUrl, { signal });
  if (!forecastRes.ok) {
    throw new Error(`Weather service returned ${forecastRes.status}`);
  }

  const forecastData = (await forecastRes.json()) as {
    timezone?: string;
    current?: {
      time: string;
      temperature_2m: number;
      relative_humidity_2m: number;
      apparent_temperature: number;
      is_day: number;
      weather_code: number;
      wind_speed_10m: number;
    };
  };

  if (!forecastData.current) {
    throw new Error('Current weather data was unavailable for this location.');
  }

  const { condition, kind } = describeWmoCode(forecastData.current.weather_code);

  return {
    locationLabel: geo.name,
    countryLabel: geo.country || countryName,
    temperatureC: Math.round(forecastData.current.temperature_2m),
    apparentTempC: Math.round(forecastData.current.apparent_temperature),
    humidity: Math.round(forecastData.current.relative_humidity_2m),
    windKmh: Math.round(forecastData.current.wind_speed_10m),
    isDay: forecastData.current.is_day === 1,
    condition,
    kind,
    timezone: forecastData.timezone || 'Local',
    observedAt: forecastData.current.time,
  };
}

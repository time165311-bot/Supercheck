export interface LiveWeatherData {
  temp: number;
  humidity: number;
  conditionCode: number;
  conditionType: 'sunny' | 'partly_cloudy' | 'rain' | 'thunderstorm' | 'fog' | 'night_clear';
  label: string;
  icon3D: string;
  isDay: boolean;
  locationName: string;
  updatedAt: string;
}

const DEFAULT_BANGKOK = { lat: 13.7563, lon: 100.5018, name: 'กรุงเทพมหานคร' };

/**
 * Maps WMO Weather Code from Open-Meteo to UI label and condition type
 */
function mapWMOToWeather(code: number, isDay: boolean): { conditionType: LiveWeatherData['conditionType']; label: string; icon3D: string } {
  if (!isDay && (code === 0 || code === 1)) {
    return {
      conditionType: 'night_clear',
      label: 'คืนฟ้าโปร่ง',
      icon3D: '🌙'
    };
  }

  switch (code) {
    case 0: // Clear sky
      return { conditionType: 'sunny', label: 'ท้องฟ้าแจ่มใส', icon3D: '☀️' };
    case 1: // Mainly clear
      return { conditionType: 'sunny', label: 'ท้องฟ้าโปร่ง', icon3D: '☀️' };
    case 2: // Partly cloudy
      return { conditionType: 'partly_cloudy', label: 'มีเมฆบางส่วน', icon3D: '🌤️' };
    case 3: // Overcast
      return { conditionType: 'partly_cloudy', label: 'ท้องฟ้ามืดครึ้ม', icon3D: '☁️' };
    case 45:
    case 48: // Fog
      return { conditionType: 'fog', label: 'หมอก/สลัว', icon3D: '🌫️' };
    case 51:
    case 53:
    case 55:
    case 56:
    case 57: // Drizzle
      return { conditionType: 'rain', label: 'ฝนปรอยๆ', icon3D: '🌦️' };
    case 61:
    case 63:
    case 65: // Rain
      return { conditionType: 'rain', label: 'ฝนตกปานกลาง', icon3D: '🌧️' };
    case 66:
    case 67:
    case 80:
    case 81:
    case 82: // Heavy rain
      return { conditionType: 'rain', label: 'ฝนตกหนัก', icon3D: '🌧️' };
    case 95:
    case 96:
    case 99: // Thunderstorm
      return { conditionType: 'thunderstorm', label: 'ฝนฟ้าคะนอง', icon3D: '⛈️' };
    default:
      return isDay 
        ? { conditionType: 'sunny', label: 'แดดออก', icon3D: '☀️' }
        : { conditionType: 'night_clear', label: 'คืนฟ้าโปร่ง', icon3D: '🌙' };
  }
}

/**
 * Get user location from navigator or default to Bangkok
 */
async function getUserCoords(): Promise<{ lat: number; lon: number; name: string }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(DEFAULT_BANGKOK);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          name: 'ตำแหน่งปัจจุบัน'
        });
      },
      (err) => {
        console.warn('Geolocation failed or denied, fallback to Bangkok:', err.message);
        resolve(DEFAULT_BANGKOK);
      },
      { timeout: 6000, maximumAge: 600000 }
    );
  });
}

/**
 * Fetches real live weather data from Open-Meteo API
 */
export async function fetchLiveWeather(): Promise<LiveWeatherData> {
  const coords = await getUserCoords();
  const url = `/api/weather?latitude=${coords.lat}&longitude=${coords.lon}`;

  const currentHour = new Date().getHours();
  const defaultIsDay = currentHour >= 6 && currentHour < 18;
  const fallbackResult: LiveWeatherData = {
    temp: 31.5,
    humidity: 65,
    conditionCode: 0,
    conditionType: defaultIsDay ? 'sunny' : 'night_clear',
    label: defaultIsDay ? 'ท้องฟ้าโปร่ง' : 'คืนฟ้าโปร่ง',
    icon3D: defaultIsDay ? '☀️' : '🌙',
    isDay: defaultIsDay,
    locationName: coords.name || 'กรุงเทพมหานคร',
    updatedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  };

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return fallbackResult;
    }
    const data = await res.json();
    const current = data.current || {};

    const temp = typeof current.temperature_2m === 'number' ? Math.round(current.temperature_2m * 10) / 10 : 31.5;
    const humidity = typeof current.relative_humidity_2m === 'number' ? Math.round(current.relative_humidity_2m) : 65;
    const weatherCode = typeof current.weather_code === 'number' ? current.weather_code : 0;

    const isDay = typeof current.is_day === 'number' ? current.is_day === 1 : defaultIsDay;

    const mapped = mapWMOToWeather(weatherCode, isDay);
    const nowStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    return {
      temp,
      humidity,
      conditionCode: weatherCode,
      conditionType: mapped.conditionType,
      label: mapped.label,
      icon3D: mapped.icon3D,
      isDay,
      locationName: coords.name || 'กรุงเทพมหานคร',
      updatedAt: nowStr
    };
  } catch (error) {
    console.warn('Live weather service notice:', error);
    return fallbackResult;
  }
}

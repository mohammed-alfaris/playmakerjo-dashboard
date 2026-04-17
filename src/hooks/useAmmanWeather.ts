import { useQuery } from "@tanstack/react-query"

const AMMAN_LAT = 31.9539
const AMMAN_LNG = 35.9106
const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${AMMAN_LAT}&longitude=${AMMAN_LNG}` +
  `&current_weather=true&timezone=Asia%2FAmman`

export interface AmmanWeather {
  temperature: number
  code: number
  description: "clear" | "cloudy" | "rain" | "snow" | "storm" | "fog" | "unknown"
  emoji: string
}

function describe(code: number): Pick<AmmanWeather, "description" | "emoji"> {
  if (code === 0) return { description: "clear", emoji: "☀️" }
  if ([1, 2, 3].includes(code)) return { description: "cloudy", emoji: "🌤️" }
  if ([45, 48].includes(code)) return { description: "fog", emoji: "🌫️" }
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code))
    return { description: "rain", emoji: "🌧️" }
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { description: "snow", emoji: "❄️" }
  if ([95, 96, 99].includes(code)) return { description: "storm", emoji: "⛈️" }
  return { description: "unknown", emoji: "🌡️" }
}

export function useAmmanWeather() {
  return useQuery<AmmanWeather>({
    queryKey: ["weather", "amman"],
    queryFn: async () => {
      const res = await fetch(WEATHER_URL)
      if (!res.ok) throw new Error(`weather fetch failed: ${res.status}`)
      const json = await res.json()
      const cw = json?.current_weather ?? {}
      return {
        temperature: Math.round(cw.temperature ?? 0),
        code: Number(cw.weathercode ?? 0),
        ...describe(Number(cw.weathercode ?? 0)),
      }
    },
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

import { NextResponse } from "next/server";

const TIME_HOUR_MAP: Record<string, number> = {
  "今から": new Date().getHours(),
  "朝": 8,
  "昼": 12,
  "夕方": 17,
  "夜": 20,
  "深夜": 23,
};

function getWeatherIconUrl(icon: string) {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

function isRainyWeather(weatherId: number) {
  return weatherId >= 200 && weatherId < 700;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const type = searchParams.get("type") ?? "current";
  const outingTime = searchParams.get("outingTime") ?? "今から";
  const returnTime = searchParams.get("returnTime") ?? "深夜";

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat, lon が必要です" }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "APIキーが設定されていません" }, { status: 500 });
  }

  try {
    if (type === "current") {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ja`,
        { next: { revalidate: 1800 } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "天気の取得に失敗しました");

      return NextResponse.json({
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        tempMin: Math.round(data.main.temp_min),
        tempMax: Math.round(data.main.temp_max),
        humidity: data.main.humidity,
        description: data.weather[0]?.description ?? "",
        icon: data.weather[0]?.icon ?? "",
        iconUrl: getWeatherIconUrl(data.weather[0]?.icon ?? ""),
        cityName: data.name,
        windSpeed: data.wind?.speed ?? 0,
        isRainy: isRainyWeather(data.weather[0]?.id ?? 800),
      });
    }

    // type === "forecast"
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ja&cnt=16`,
      { next: { revalidate: 1800 } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message ?? "予報の取得に失敗しました");

    const outingHour = TIME_HOUR_MAP[outingTime] ?? new Date().getHours();
    const returnHour = TIME_HOUR_MAP[returnTime] ?? 23;

    const forecasts: Array<{ dt: number; temp: number; weatherId: number; description: string; icon: string }> =
      data.list.map((item: any) => ({
        dt: item.dt,
        temp: Math.round(item.main.temp),
        weatherId: item.weather[0]?.id ?? 800,
        description: item.weather[0]?.description ?? "",
        icon: item.weather[0]?.icon ?? "",
      }));

    // 今日の対象時間帯のforecastを抽出
    const now = new Date();
    const todayForecasts = forecasts.filter((f) => {
      const date = new Date(f.dt * 1000);
      const isToday = date.getDate() === now.getDate();
      const hour = date.getHours();
      const normalizedReturn = returnHour < outingHour ? returnHour + 24 : returnHour;
      const normalizedHour = hour < outingHour ? hour + 24 : hour;
      return isToday && normalizedHour >= outingHour && normalizedHour <= normalizedReturn;
    });

    const targetForecasts = todayForecasts.length > 0 ? todayForecasts : forecasts.slice(0, 4);

    const temps = targetForecasts.map((f) => f.temp);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const hasRain = targetForecasts.some((f) => isRainyWeather(f.weatherId));

    // 代表天気（最初のforecast）
    const representative = targetForecasts[0] ?? forecasts[0];

    return NextResponse.json({
      minTemp,
      maxTemp,
      isRainy: hasRain,
      description: representative.description,
      icon: representative.icon,
      iconUrl: getWeatherIconUrl(representative.icon),
      cityName: data.city?.name ?? "",
      forecasts: targetForecasts.map((f) => ({
        hour: new Date(f.dt * 1000).getHours(),
        temp: f.temp,
        description: f.description,
        icon: f.icon,
        iconUrl: getWeatherIconUrl(f.icon),
        isRainy: isRainyWeather(f.weatherId),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "天気の取得に失敗しました" },
      { status: 500 }
    );
  }
}
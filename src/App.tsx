import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
}
 
type Unit = "C" | "F";
type Tone = "idle" | "clear" | "cloud" | "rain" | "storm";
 
interface WeatherInfo {
  text: string;
  icon: string;
  tone: Exclude<Tone, "idle">;
}
 
interface ForecastResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}
const CITIES: City[] = [
  { id: "hanoi", name: "Hà Nội", lat: 21.0285, lon: 105.8542 },
  { id: "haiphong", name: "Hải Phòng", lat: 20.8449, lon: 106.6881 },
  { id: "hue", name: "Huế", lat: 16.4637, lon: 107.5909 },
  { id: "danang", name: "Đà Nẵng", lat: 16.0544, lon: 108.2022 },
  { id: "nhatrang", name: "Nha Trang", lat: 12.2388, lon: 109.1967 },
  { id: "dalat", name: "Đà Lạt", lat: 11.9404, lon: 108.4583 },
  { id: "hcm", name: "TP. Hồ Chí Minh", lat: 10.8231, lon: 106.6297 },
  { id: "cantho", name: "Cần Thơ", lat: 10.0452, lon: 105.7469 },
];

const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]

function describe(code: number): WeatherInfo {
  if (code === 0) return { text: "Trời quang", icon: "☀️", tone: "clear" };
  if (code <= 2) return { text: "Ít mây", icon: "🌤️", tone: "clear" };
  if (code === 3) return { text: "Nhiều mây", icon: "☁️", tone: "cloud" };
  if (code === 45 || code === 48) return { text: "Sương mù", icon: "🌫️", tone: "cloud" };
  if (code >= 51 && code <= 57) return { text: "Mưa phùn", icon: "🌦️", tone: "rain" };
  if (code >= 61 && code <= 67) return { text: "Mưa", icon: "🌧️", tone: "rain" };
  if (code >= 71 && code <= 77) return { text: "Tuyết", icon: "❄️", tone: "cloud" };
  if (code >= 80 && code <= 82) return { text: "Mưa rào", icon: "🌦️", tone: "rain" };
  if (code === 85 || code === 86) return { text: "Mưa tuyết", icon: "🌨️", tone: "cloud" };
  if (code >= 95) return { text: "Dông", icon: "⛈️", tone: "storm" };
  return { text: "Không xác định", icon: "❔", tone: "cloud" };
}

function formatDay(iso: string): { weekday: string; date: string } {
  const [y, m, d] = iso.split("-").map(Number);
  return {
    weekday: WEEKDAYS[new Date(y, m - 1, d).getDay()],
    date: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`,
  };
}
 
function formatUpdated(iso: string): string {
  const [date, time] = iso.split("T");
  const [y, m, d] = date.split("-");
  return `${time} ngày ${d}/${m}/${y}`;
}
const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

const toTemp = (c: number, unit: Unit): number => Math.round(unit === "C" ? c : (c * 9) / 5 + 32);

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, ForecastResponse>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>("C");
  const [query, setQuery] = useState<string>("");
  const [attempt, setAttempt] = useState<number>(0);

  const city = CITIES.find((c) => c.id === selectedId) ?? null;
  const data = selectedId ? cache[selectedId] : undefined;

  useEffect(() => {
    if (!city || cache[city.id]) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
 
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&timezone=Asia%2FHo_Chi_Minh&forecast_days=7`;
 
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Máy chủ trả về lỗi ${res.status}`);
        return res.json() as Promise<ForecastResponse>;
      })
      .then((json) => {
        setCache((prev) => ({ ...prev, [city.id]: json }));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return; 
        setError(err instanceof Error ? err.message : "Không thể tải dữ liệu");
        setLoading(false);
      });
 
    return () => controller.abort();
  }, [selectedId, attempt]);
 
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
 
  const visibleCities = useMemo<City[]>(() => {
    const q = normalize(query);
    return CITIES.filter((c) => normalize(c.name).includes(q));
  }, [query]);
 
  const current = data ? describe(data.current.weather_code) : null;
  const tone: Tone = current ? current.tone : "idle";
 
  return (
    <div className={`app tone-${tone}`}>
      <header className="app-header">
        <h1>Thời tiết Việt Nam</h1>
        <div className="unit-toggle" role="group" aria-label="Đơn vị nhiệt độ">
          {(["C", "F"] as const).map((u) => (
            <button key={u} className={unit === u ? "active" : ""} aria-pressed={unit === u} onClick={() => setUnit(u)}>
              °{u}
            </button>
          ))}
        </div>
      </header>
 
      <main className="layout">
        <aside className="panel cities">
          <input
            type="search"
            placeholder="Tìm thành phố"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Tìm thành phố"
          />
          <ul>
            {visibleCities.map((c) => (
              <li key={c.id} className={c.id === selectedId ? "selected" : ""}>
                <button
                  className="city-btn"
                  onClick={() => setSelectedId(c.id)}
                  aria-current={c.id === selectedId}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
          {visibleCities.length === 0 && <p className="muted">Không tìm thấy thành phố phù hợp.</p>}
        </aside>
 
        <section className="panel detail" aria-live="polite">
          {!city && (
            <div className="state">
              <p className="state-title">Chưa chọn thành phố</p>
              <p className="muted">Chọn một thành phố ở danh sách để xem thời tiết.</p>
            </div>
          )}
 
          {city && loading && (
            <div className="state">
              <div className="spinner" aria-hidden="true" />
              <p className="state-title">Đang tải thời tiết {city.name}…</p>
            </div>
          )}
 
          {city && !loading && error && (
            <div className="state">
              <p className="state-title">Không tải được dữ liệu</p>
              <p className="muted">{error}</p>
              <button className="retry" onClick={retry}>
                Thử lại
              </button>
            </div>
          )}
 
          {city && !loading && !error && data && current && (
            <>
              <div className="current">
                <h2>{city.name}</h2>
                <div className="now">
                  <span className="big-icon" aria-hidden="true">
                    {current.icon}
                  </span>
                  <span className="temp">
                    {toTemp(data.current.temperature_2m, unit)}°{unit}
                  </span>
                </div>
                <p className="desc">{current.text}</p>
                <dl className="facts">
                  <div>
                    <dt>Độ ẩm</dt>
                    <dd>{data.current.relative_humidity_2m}%</dd>
                  </div>
                  <div>
                    <dt>Gió</dt>
                    <dd>{data.current.wind_speed_10m} km/h</dd>
                  </div>
                  <div>
                    <dt>Cập nhật</dt>
                    <dd>{formatUpdated(data.current.time)}</dd>
                  </div>
                </dl>
              </div>
 
              <ol className="forecast">
                {data.daily.time.map((iso, i) => {
                  const day = formatDay(iso);
                  const w = describe(data.daily.weather_code[i]);
                  return (
                    <li key={iso}>
                      <span className="day">
                        <strong>{day.weekday}</strong> <span className="muted">{day.date}</span>
                      </span>
                      <span className="f-icon" title={w.text}>
                        {w.icon}
                      </span>
                      <span className="range">
                        <strong>{toTemp(data.daily.temperature_2m_max[i], unit)}°</strong>
                        <span className="muted"> / {toTemp(data.daily.temperature_2m_min[i], unit)}°</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
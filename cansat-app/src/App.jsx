import { useState, useEffect, useRef, useCallback } from "react";
import logo from "./assets/logo.png";
import { db } from "./firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc } from "firebase/firestore";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceArea, Label
} from "recharts";

const MAX_POINTS = 1000;
const COLORS = {
  accent:  "#00d4ff",
  accent2: "#00ff9d",
  accent3: "#ff6b35",
  accent4: "#c77dff",
  warn:    "#ffbe0b",
  gps:     "#ff4da6",
  muted:   "#4a6a88",
  panel:   "#0c1520",
  border:  "#1a2e44",
};

function parseCSV(text) {
  const lines = text.trim().split("\n").filter(l => l.trim() !== "");
  if (!lines.length) return [];
  const firstCols = lines[0].split(",").map(h => h.trim().toLowerCase());
  const hasHeader = isNaN(parseFloat(firstCols[0]));
  const headers = hasHeader ? firstCols : [
    "id","time","bme_t","bme_h","bme_p","bme_g",
    "ax","ay","az","gx","gy","gz",
    "lat","lon","sat","alt","rel_alt","impact","landed"
  ];
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows = [];
  for (const line of dataLines) {
    const vals = line.split(",").map(v => v.trim());
    if (!vals.length || vals[0] === "") continue;
    const raw = {};
    headers.forEach((h, i) => { raw[h] = vals[i]; });
    const f = (v) => (v && v !== "NA" && !isNaN(parseFloat(v)) ? parseFloat(v) : null);
    rows.push({
      time:        f(raw.id),
      gps_alt:     f(raw.alt),
      rel_alt:     f(raw.rel_alt),
      altitude:    f(raw.rel_alt) ?? f(raw.alt),
      temperature: f(raw.bme_t),
      pressure:    f(raw.bme_p),
      humidity:    f(raw.bme_h),
      gas:         f(raw.bme_g),
      ax:          f(raw.ax),
      ay:          f(raw.ay),
      az:          f(raw.az),
      gx:          f(raw.gx),
      gy:          f(raw.gy),
      gz:          f(raw.gz),
      lat:         f(raw.lat),
      lon:         f(raw.lon),
      gps_time:    raw.time && raw.time !== "NA" ? raw.time : null,
    });
  }
  return rows;
}

function generateDemo() {
  const rows = [];
  for (let i = 0; i < 120; i++) {
    const t = i * 0.5;
    const alt = i < 60
      ? i * 5.5 + Math.random() * 3
      : Math.max(0, 330 - (i - 60) * 5.5 + Math.random() * 3);
    rows.push({
      time: +t.toFixed(1),
      gps_alt: +(300 + alt).toFixed(2),
      rel_alt: +alt.toFixed(2),
      altitude: +alt.toFixed(2),
      temperature: +(22 - alt * 0.0065 + (Math.random() - 0.5) * 0.5).toFixed(2),
      pressure: +(1013 - alt * 0.12 + (Math.random() - 0.5) * 0.5).toFixed(2),
      ax: +((Math.random() - 0.5) * 2 + (i < 60 ? 1.5 : -0.5)).toFixed(3),
      ay: +((Math.random() - 0.5) * 1).toFixed(3),
      az: +(9.81 + (Math.random() - 0.5) * 0.5).toFixed(3),
      gx: +((Math.random() - 0.5) * 10).toFixed(2),
      gy: +((Math.random() - 0.5) * 10).toFixed(2),
      gz: +((Math.random() - 0.5) * 15).toFixed(2),
      lat: 48.15 + i * 0.00003 + (Math.random() - 0.5) * 0.00008,
      lon: 17.10 + i * 0.00002 + (Math.random() - 0.5) * 0.00008,
      humidity: +(40 + (Math.random() - 0.5) * 10).toFixed(1),
      gas: +(150 + Math.random() * 150).toFixed(1),
      gps_time: `${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor((t%3600)/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`,
    });
  }
  return rows;
}

function generateLivePoint(t, prevAlt) {
  let phase, alt;
  if (t < 15)      { phase = 0; alt = t * 22 + (Math.random() - 0.5) * 3; }
  else if (t < 35) { phase = 1; alt = Math.max(0, 330 - (t - 15) * 16 + (Math.random() - 0.5) * 2); }
  else             { phase = 2; alt = Math.max(0, (prevAlt ?? 0) - 0.1); }
  const seismic = phase === 1 && Math.random() < 0.1 ? Math.random() * 8 + 2 : 0;
  return {
    time: +t.toFixed(1),
    gps_alt: +(300 + alt).toFixed(2),
    rel_alt: +alt.toFixed(2),
    altitude: +alt.toFixed(2),
    temperature: +(22 - alt * 0.0065 + (Math.random() - 0.5) * 0.3).toFixed(2),
    pressure: +(1013 - alt * 0.12 + (Math.random() - 0.5) * 0.5).toFixed(2),
    ax: +((phase === 0 ? 2 : phase === 1 ? -1 : 0) + (Math.random() - 0.5) * 0.8 + seismic).toFixed(3),
    ay: +((Math.random() - 0.5) * 0.5 + seismic * 0.5).toFixed(3),
    az: +(9.81 + (Math.random() - 0.5) * 0.3 + (phase === 0 ? 1.5 : 0) + seismic).toFixed(3),
    gx: +((Math.random() - 0.5) * 5).toFixed(2),
    gy: +((Math.random() - 0.5) * 5).toFixed(2),
    gz: +((Math.random() - 0.5) * 8 + (phase === 1 ? (Math.random() - 0.5) * 20 : 0)).toFixed(2),
    lat: 48.15 + t * 0.00002 + (Math.random() - 0.5) * 0.00005,
    lon: 17.10 + t * 0.000015 + (Math.random() - 0.5) * 0.00005,
    humidity: +(40 + (Math.random() - 0.5) * 10).toFixed(1),
    gas: +(150 + Math.random() * 150).toFixed(1),
    gps_time: `${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor((t%3600)/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`,
    _phase: phase,
  };
}

function exportCSV(data) {
  if (!data.length) return;
  const headers = "time,gps_alt,rel_alt,temperature,pressure,humidity,gas,ax,ay,az,gx,gy,gz,lat,lon";
  const rows = data.map(d =>
    [d.time ?? "", d.gps_alt ?? "", d.rel_alt ?? "", d.temperature ?? "", d.pressure ?? "",
     d.humidity ?? "", d.gas ?? "", d.ax ?? "", d.ay ?? "", d.az ?? "", d.gx ?? "", d.gy ?? "", d.gz ?? "",
     d.lat ?? "", d.lon ?? ""].join(",")
  );
  const blob = new Blob(["\uFEFF" + headers + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cansat_export_${Date.now()}.csv`;
  a.click();
}

function formatClock(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `TIME ${h}:${m}:${s}`;
}

function Panel({ title, dotColor = COLORS.accent, badge, children, colSpan = 1, extra }) {
  return (
    <div className="rounded relative overflow-hidden" style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, gridColumn: `span ${colSpan}` }}>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${dotColor}, transparent)`, opacity: 0.6 }} />
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${COLORS.border}`, background: "rgba(0,0,0,0.2)" }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: COLORS.muted, fontFamily: "'Exo 2', sans-serif" }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-end", gap: 8, paddingRight: 4 }}>
          {badge && <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: COLORS.muted }}>{badge}</span>}
          {extra && <div style={{ marginTop: -20 }}>{extra}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, unit, delta, color, isMobile = false }) {
  return (
    <div className="rounded relative overflow-hidden" style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, padding: isMobile ? "8px 10px" : "14px 16px", minWidth: 0, overflow: "hidden", width: "100%", boxSizing: "border-box" }}>
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: color, opacity: 0.5 }} />
      <div style={{ color: COLORS.muted, fontFamily: "'Exo 2', sans-serif", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: isMobile ? 18 : 26, fontWeight: 700, color, lineHeight: 1 }}>{value ?? "---"}</div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{unit}</div>
      {delta !== undefined && delta !== null && (
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, marginTop: 4, color: delta >= 0 ? COLORS.accent2 : COLORS.accent3 }}>
          {delta >= 0 ? "▲ " : "▼ "}{Math.abs(delta).toFixed(2)}
        </div>
      )}
    </div>
  );
}

const chartStyle = { fontSize: 9, fontFamily: "'Share Tech Mono', monospace" };

const ToggleBtn = ({ active, onClick, children, color = COLORS.accent }) => (
  <span onClick={onClick} style={{
    cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9,
    letterSpacing: 1, padding: "2px 8px", borderRadius: 2, transition: "all .15s",
    color: active ? color : COLORS.muted,
    border: `1px solid ${active ? color : COLORS.border}`,
    background: active ? `${color}22` : "transparent"
  }}>{children}</span>
);

const CopyBtn = ({ chartId }) => (
  <span onClick={() => copyChart(chartId)} style={{
    cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9,
    color: COLORS.muted, letterSpacing: 1, padding: "2px 6px",
    border: `1px solid ${COLORS.border}`, borderRadius: 2
  }}
    onMouseEnter={e => e.target.style.color = COLORS.accent}
    onMouseLeave={e => e.target.style.color = COLORS.muted}
  >COPY</span>
);

async function copyChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const { default: html2canvas } = await import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js");
    const canvasEl = await html2canvas(container, { backgroundColor: "#0c1520", scale: 2, useCORS: true });
    canvasEl.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        alert("Graf skopírovaný! 📋");
      } catch(e) { alert("Kopírovanie zlyhalo."); }
    });
  } catch(e) { alert("Chyba: " + e.message); }
}

function AltitudeChart({ data, height = 180 }) {
  const [altMode, setAltMode] = useState("rel");
  const [timeMode, setTimeMode] = useState("packet");
  const [zoomed, setZoomed] = useState(false);
  const [zoomedData, setZoomedData] = useState([]);
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [selecting, setSelecting] = useState(false);

  const altKey = altMode === "rel" ? "rel_alt" : "gps_alt";
  const xKey = timeMode === "packet" ? "time" : "gps_time";
  const xLabel = timeMode === "packet" ? "t (s)" : "t (h)";

  const displayData = zoomed ? zoomedData : data;

  const zoom = () => {
    if (refAreaLeft === null || refAreaRight === null || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false); return;
    }
    const [l, r] = refAreaLeft < refAreaRight ? [refAreaLeft, refAreaRight] : [refAreaRight, refAreaLeft];
    setZoomedData(data.filter(d => (d[xKey] ?? 0) >= l && (d[xKey] ?? 0) <= r));
    setZoomed(true); setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false);
  };

  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 4, maxWidth: "100vw", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: `1px solid ${COLORS.border}`, background: "rgba(0,0,0,0.2)", flexWrap: "wrap", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent, boxShadow: `0 0 6px ${COLORS.accent}` }} />
          <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: COLORS.muted }}>Altitude</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <ToggleBtn active={altMode === "rel"} onClick={() => setAltMode("rel")} color={COLORS.accent}>REL ALT</ToggleBtn>
          <ToggleBtn active={altMode === "gps"} onClick={() => setAltMode("gps")} color={COLORS.accent}>GPS ALT</ToggleBtn>
          <div style={{ width: 1, height: 14, background: COLORS.border }} />
          <ToggleBtn active={timeMode === "packet"} onClick={() => setTimeMode("packet")} color={COLORS.accent2}>PACKET</ToggleBtn>
          <ToggleBtn active={timeMode === "gps"} onClick={() => setTimeMode("gps")} color={COLORS.accent2}>GPS TIME</ToggleBtn>
          {zoomed && <span onClick={() => { setZoomed(false); setZoomedData([]); }} style={{ cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: COLORS.accent3, letterSpacing: 1, padding: "2px 6px", border: `1px solid ${COLORS.accent3}`, borderRadius: 2 }}>RESET</span>}
        </div>
        <CopyBtn chartId="chart-alt" />
      </div>
      <div style={{ height, padding: "8px 12px 12px", userSelect: "none", overflow: "hidden", width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}
            onMouseDown={e => { if (e?.activeLabel) { setRefAreaLeft(e.activeLabel); setSelecting(true); } }}
            onMouseMove={e => { if (selecting && e?.activeLabel) setRefAreaRight(e.activeLabel); }}
            onMouseUp={zoom}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey={xKey} tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value={xLabel} position="insideBottomRight" offset={-5} style={{ ...chartStyle, fill: COLORS.muted }} />
            </XAxis>
            <YAxis tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value="h (m)" position="insideTopLeft" offset={5} style={{ ...chartStyle, fill: COLORS.muted }} />
            </YAxis>
            <Tooltip isAnimationActive={false} contentStyle={{ background: "#0c1520", border: `1px solid ${COLORS.border}`, fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }} labelStyle={{ color: COLORS.muted }} />
            <Line type="monotone" dataKey={altKey} stroke={COLORS.accent} dot={false} strokeWidth={2} name="Altitude (m)" isAnimationActive={false} />
            {selecting && refAreaLeft && refAreaRight && <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill={COLORS.accent} fillOpacity={0.2} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HumidityChart({ data, height = 180 }) {
  const [altMode, setAltMode] = useState("rel");
  const [zoomed, setZoomed] = useState(false);
  const [zoomedData, setZoomedData] = useState([]);
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [selecting, setSelecting] = useState(false);

  const xKey = altMode === "rel" ? "rel_alt" : "gps_alt";
  const displayData = zoomed ? zoomedData : data;

  const zoom = () => {
    if (refAreaLeft === null || refAreaRight === null || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false); return;
    }
    const [l, r] = refAreaLeft < refAreaRight ? [refAreaLeft, refAreaRight] : [refAreaRight, refAreaLeft];
    setZoomedData(data.filter(d => (d[xKey] ?? 0) >= l && (d[xKey] ?? 0) <= r));
    setZoomed(true); setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false);
  };

  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 4, maxWidth: "100vw", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: `1px solid ${COLORS.border}`, background: "rgba(0,0,0,0.2)", flexWrap: "wrap", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4A90D9", boxShadow: "0 0 6px #4A90D9" }} />
          <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: COLORS.muted }}>Humidity</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <ToggleBtn active={altMode === "rel"} onClick={() => setAltMode("rel")} color="#4A90D9">REL ALT</ToggleBtn>
          <ToggleBtn active={altMode === "gps"} onClick={() => setAltMode("gps")} color="#4A90D9">GPS ALT</ToggleBtn>
          {zoomed && <span onClick={() => { setZoomed(false); setZoomedData([]); }} style={{ cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: COLORS.accent3, letterSpacing: 1, padding: "2px 6px", border: `1px solid ${COLORS.accent3}`, borderRadius: 2 }}>RESET</span>}
        </div>
        <CopyBtn chartId="chart-hum" />
      </div>
      <div style={{ height, padding: "8px 12px 12px", userSelect: "none", overflow: "hidden", width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}
            onMouseDown={e => { if (e?.activeLabel) { setRefAreaLeft(e.activeLabel); setSelecting(true); } }}
            onMouseMove={e => { if (selecting && e?.activeLabel) setRefAreaRight(e.activeLabel); }}
            onMouseUp={zoom}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey={xKey} tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value="h (m)" position="insideBottomRight" offset={-5} style={{ ...chartStyle, fill: COLORS.muted }} />
            </XAxis>
            <YAxis tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value="H (%)" position="insideTopLeft" offset={5} style={{ ...chartStyle, fill: COLORS.muted }} />
            </YAxis>
            <Tooltip isAnimationActive={false} contentStyle={{ background: "#0c1520", border: `1px solid ${COLORS.border}`, fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }} labelStyle={{ color: COLORS.muted }} />
            <Line type="monotone" dataKey="humidity" stroke="#4A90D9" dot={false} strokeWidth={2} name="H (%)" isAnimationActive={false} />
            {selecting && refAreaLeft && refAreaRight && <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#4A90D9" fillOpacity={0.2} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TempPressChart({ data, height = 180 }) {
  const [altMode, setAltMode] = useState("rel");
  const [hidden, setHidden] = useState({});
  const [zoomed, setZoomed] = useState(false);
  const [zoomedData, setZoomedData] = useState([]);
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [selecting, setSelecting] = useState(false);

  const xKey = altMode === "rel" ? "rel_alt" : "gps_alt";
  const displayData = zoomed ? zoomedData : data;

  const zoom = () => {
    if (refAreaLeft === null || refAreaRight === null || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false); return;
    }
    const [l, r] = refAreaLeft < refAreaRight ? [refAreaLeft, refAreaRight] : [refAreaRight, refAreaLeft];
    setZoomedData(data.filter(d => (d[xKey] ?? 0) >= l && (d[xKey] ?? 0) <= r));
    setZoomed(true); setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false);
  };

  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 4, maxWidth: "100vw", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: `1px solid ${COLORS.border}`, background: "rgba(0,0,0,0.2)", flexWrap: "wrap", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent3, boxShadow: `0 0 6px ${COLORS.accent3}` }} />
          <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: COLORS.muted }}>Temperature & Pressure</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <ToggleBtn active={altMode === "rel"} onClick={() => setAltMode("rel")} color={COLORS.accent3}>REL ALT</ToggleBtn>
          <ToggleBtn active={altMode === "gps"} onClick={() => setAltMode("gps")} color={COLORS.accent3}>GPS ALT</ToggleBtn>
          {zoomed && <span onClick={() => { setZoomed(false); setZoomedData([]); }} style={{ cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: COLORS.accent3, letterSpacing: 1, padding: "2px 6px", border: `1px solid ${COLORS.accent3}`, borderRadius: 2 }}>RESET</span>}
        </div>
        <CopyBtn chartId="chart-tp" />
      </div>
      <div style={{ height, padding: "8px 12px 12px", userSelect: "none", overflow: "hidden", width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 4, right: 30, left: 0, bottom: 20 }}
            onMouseDown={e => { if (e?.activeLabel) { setRefAreaLeft(e.activeLabel); setSelecting(true); } }}
            onMouseMove={e => { if (selecting && e?.activeLabel) setRefAreaRight(e.activeLabel); }}
            onMouseUp={zoom}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey={xKey} tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value="h (m)" position="insideBottomRight" offset={-5} style={{ ...chartStyle, fill: COLORS.muted }} />
            </XAxis>
            <YAxis yAxisId="left" tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value="T (°C)" position="insideTopLeft" offset={5} style={{ ...chartStyle, fill: COLORS.muted }} />
            </YAxis>
            <YAxis yAxisId="right" orientation="right" tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value="p (hPa)" position="insideRight" dx={15} dy={-40} style={{ ...chartStyle, fill: COLORS.muted }} />
            </YAxis>
            <Tooltip isAnimationActive={false} contentStyle={{ background: "#0c1520", border: `1px solid ${COLORS.border}`, fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }} labelStyle={{ color: COLORS.muted }} />
            <Legend wrapperStyle={{ ...chartStyle, color: COLORS.muted, fontSize: 10, cursor: "pointer" }} onClick={e => setHidden(p => ({ ...p, [e.dataKey]: !p[e.dataKey] }))} />
            <Line yAxisId="left" type="monotone" dataKey="temperature" stroke={COLORS.accent3} dot={false} strokeWidth={2} name="T (°C)" isAnimationActive={false} hide={hidden.temperature} />
            <Line yAxisId="right" type="monotone" dataKey="pressure" stroke={COLORS.accent2} dot={false} strokeWidth={2} name="p (hPa)" isAnimationActive={false} hide={hidden.pressure} />
            {selecting && refAreaLeft && refAreaRight && <ReferenceArea yAxisId="left" x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill={COLORS.accent3} fillOpacity={0.2} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AirQualityChart({ data, height = 180 }) {
  const [mode, setMode] = useState("kohm");
  const [altMode, setAltMode] = useState("rel");
  const [zoomed, setZoomed] = useState(false);
  const [zoomedData, setZoomedData] = useState([]);
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [selecting, setSelecting] = useState(false);

  const xKey = altMode === "rel" ? "rel_alt" : "gps_alt";

  const displayData = (zoomed ? zoomedData : data)
  .map(r => {
    const gas = r.gas ?? 0;
    const hum = r.humidity ?? 40;
    
    // Nižší kOhm = nižší IAQ = lepší vzduch
    const gasIaq = Math.min(500, (gas / 300) * 500);
    
    // Humidity — optimum 40%, odchýlka zvyšuje IAQ
    const humDeviation = Math.abs(hum - 40);
    const humIaq = Math.min(500, humDeviation * 5);
    
    // Výsledný IAQ
    const iaq = +Math.max(0, Math.min(500, gasIaq * 0.75 + humIaq * 0.25)).toFixed(1);
    
    return { ...r, iaq };
  });

  const zoom = () => {
    if (refAreaLeft === null || refAreaRight === null || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false); return;
    }
    const [l, r] = refAreaLeft < refAreaRight ? [refAreaLeft, refAreaRight] : [refAreaRight, refAreaLeft];
    setZoomedData(data.filter(d => (d[xKey] ?? 0) >= l && (d[xKey] ?? 0) <= r));
    setZoomed(true); setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false);
  };

  const lastIaq = displayData[displayData.length - 1]?.iaq;
  const iaqColor = lastIaq == null ? COLORS.muted : lastIaq < 50 ? COLORS.accent2 : lastIaq < 100 ? "#90EE90" : lastIaq < 150 ? COLORS.warn : lastIaq < 200 ? COLORS.accent3 : "#2d8a4e";
  const yLabel = mode === "kohm" ? "AQ (kOhm)" : "AQ (AQI)";

  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 4, maxWidth: "100vw", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: `1px solid ${COLORS.border}`, background: "rgba(0,0,0,0.2)", flexWrap: "wrap", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#90EE90", boxShadow: "0 0 6px #90EE90" }} />
          <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: COLORS.muted }}>Air Quality</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <ToggleBtn active={mode === "kohm"} onClick={() => setMode("kohm")} color="#90EE90">kOhm</ToggleBtn>
          <ToggleBtn active={mode === "aqi"} onClick={() => setMode("aqi")} color="#90EE90">AQI</ToggleBtn>
          <div style={{ width: 1, height: 14, background: COLORS.border }} />
          <ToggleBtn active={altMode === "rel"} onClick={() => setAltMode("rel")} color="#90EE90">REL ALT</ToggleBtn>
          <ToggleBtn active={altMode === "gps"} onClick={() => setAltMode("gps")} color="#90EE90">GPS ALT</ToggleBtn>
          {zoomed && <span onClick={() => { setZoomed(false); setZoomedData([]); }} style={{ cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: COLORS.accent3, letterSpacing: 1, padding: "2px 6px", border: `1px solid ${COLORS.accent3}`, borderRadius: 2 }}>RESET</span>}
        </div>
        <CopyBtn chartId="chart-air" />
      </div>
      <div style={{ height, padding: "8px 12px 12px", userSelect: "none", overflow: "hidden", width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}
            onMouseDown={e => { if (e?.activeLabel) { setRefAreaLeft(e.activeLabel); setSelecting(true); } }}
            onMouseMove={e => { if (selecting && e?.activeLabel) setRefAreaRight(e.activeLabel); }}
            onMouseUp={zoom}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey={xKey} tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value="h (m)" position="insideBottomRight" offset={-5} style={{ ...chartStyle, fill: COLORS.muted }} />
            </XAxis>
            <YAxis tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value={yLabel} position="insideTopLeft" dx={-5} dy={10} style={{ ...chartStyle, fill: COLORS.muted }} />
            </YAxis>
            <Tooltip isAnimationActive={false} contentStyle={{ background: "#0c1520", border: `1px solid ${COLORS.border}`, fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }} labelStyle={{ color: COLORS.muted }} />
            <Line type="monotone" dataKey={mode === "kohm" ? "gas" : "iaq"} stroke={mode === "kohm" ? "#90EE90" : "#2d8a4e"} dot={false} strokeWidth={2} name={yLabel} isAnimationActive={false} />
            {selecting && refAreaLeft && refAreaRight && <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#90EE90" fillOpacity={0.2} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GyroChart({ data, height = 180 }) {
  const [mode, setMode] = useState("xyz");
  const [timeMode, setTimeMode] = useState("packet");
  const [hidden, setHidden] = useState({});
  const [zoomed, setZoomed] = useState(false);
  const [zoomedData, setZoomedData] = useState([]);
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [selecting, setSelecting] = useState(false);

  const xKey = timeMode === "packet" ? "time" : "gps_time";
  const xLabel = timeMode === "packet" ? "t (s)" : "t (h)";

  const displayData = (zoomed ? zoomedData : data).map(r => ({
    ...r,
    rotacia: r.gx != null ? +Math.sqrt((r.gx||0)**2 + (r.gy||0)**2 + (r.gz||0)**2).toFixed(3) : null
  }));

  const zoom = () => {
    if (refAreaLeft === null || refAreaRight === null || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false); return;
    }
    const [l, r] = refAreaLeft < refAreaRight ? [refAreaLeft, refAreaRight] : [refAreaRight, refAreaLeft];
    setZoomedData(data.filter(d => (d[xKey] ?? 0) >= l && (d[xKey] ?? 0) <= r));
    setZoomed(true); setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false);
  };

  const lines = mode === "xyz"
    ? [{ key: "gx", color: COLORS.warn, label: "Gx" }, { key: "gy", color: "#ffd166", label: "Gy" }, { key: "gz", color: "#ff9f1c", label: "Gz" }]
    : [{ key: "rotacia", color: COLORS.warn, label: "R (°/s)" }];

  const yLabel = mode === "xyz" ? "" : "R (°/s)";

  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 4, maxWidth: "100vw", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: `1px solid ${COLORS.border}`, background: "rgba(0,0,0,0.2)", flexWrap: "wrap", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.warn, boxShadow: `0 0 6px ${COLORS.warn}` }} />
          <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: COLORS.muted }}>Gyroscope</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <ToggleBtn active={mode === "xyz"} onClick={() => setMode("xyz")} color={COLORS.warn}>X / Y / Z</ToggleBtn>
          <ToggleBtn active={mode === "rotacia"} onClick={() => setMode("rotacia")} color={COLORS.warn}>ROTATION</ToggleBtn>
          <div style={{ width: 1, height: 14, background: COLORS.border }} />
          <ToggleBtn active={timeMode === "packet"} onClick={() => setTimeMode("packet")} color={COLORS.warn}>PACKET</ToggleBtn>
          <ToggleBtn active={timeMode === "gps"} onClick={() => setTimeMode("gps")} color={COLORS.warn}>GPS TIME</ToggleBtn>
          {zoomed && <span onClick={() => { setZoomed(false); setZoomedData([]); }} style={{ cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: COLORS.accent3, letterSpacing: 1, padding: "2px 6px", border: `1px solid ${COLORS.accent3}`, borderRadius: 2 }}>RESET</span>}
        </div>
        <CopyBtn chartId="chart-gyro" />
      </div>
      <div style={{ height, padding: "8px 12px 12px", userSelect: "none", overflow: "hidden", width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}
            onMouseDown={e => { if (e?.activeLabel) { setRefAreaLeft(e.activeLabel); setSelecting(true); } }}
            onMouseMove={e => { if (selecting && e?.activeLabel) setRefAreaRight(e.activeLabel); }}
            onMouseUp={zoom}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey={xKey} tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value={xLabel} position="insideBottomRight" offset={-5} style={{ ...chartStyle, fill: COLORS.muted }} />
            </XAxis>
            <YAxis tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value={yLabel} position="insideTopLeft" dx={0} style={{ ...chartStyle, fill: COLORS.muted }} />
            </YAxis>
            <Tooltip isAnimationActive={false} contentStyle={{ background: "#0c1520", border: `1px solid ${COLORS.border}`, fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }} labelStyle={{ color: COLORS.muted }} />
            {lines.length > 1 && <Legend wrapperStyle={{ ...chartStyle, color: COLORS.muted, fontSize: 10, cursor: "pointer" }} onClick={e => setHidden(p => ({ ...p, [e.dataKey]: !p[e.dataKey] }))} />}
            {lines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} dot={false} strokeWidth={2} name={l.label} isAnimationActive={false} hide={hidden[l.key]} />)}
            {selecting && refAreaLeft && refAreaRight && <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill={COLORS.warn} fillOpacity={0.2} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SeismoChart({ data, height = 180 }) {
  const [mode, setMode] = useState("xyz");
  const [timeMode, setTimeMode] = useState("packet");
  const [hidden, setHidden] = useState({});
  const [zoomed, setZoomed] = useState(false);
  const [zoomedData, setZoomedData] = useState([]);
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const velocityRef = useRef({ vx: 0, vy: 0, vz: 0 });

  const xKey = timeMode === "packet" ? "time" : "gps_time";
  const xLabel = timeMode === "packet" ? "t (s)" : "t (h)";

  const displayData = (zoomed ? zoomedData : data).map((r, i, arr) => {
    const dt = i > 0 && arr[i-1].time != null && r.time != null 
      ? Math.min(r.time - arr[i-1].time, 2) : 1;
    const ax = (r.ax || 0);
    const ay = (r.ay || 0) - 1.0;
    const az = (r.az || 0) - 9.81;
    velocityRef.current.vx = velocityRef.current.vx * 0.95 + ax * dt;
    velocityRef.current.vy = velocityRef.current.vy * 0.95 + ay * dt;
    velocityRef.current.vz = velocityRef.current.vz * 0.95 + az * dt;
    return {
      ...r,
      magnitude: r.ax != null ? +Math.sqrt((r.ax||0)**2 + (r.ay||0)**2 + (r.az||0)**2).toFixed(3) : null,
      rychlost: +Math.sqrt(velocityRef.current.vx**2 + velocityRef.current.vy**2 + velocityRef.current.vz**2).toFixed(3),
    };
  });

  const zoom = () => {
    if (refAreaLeft === null || refAreaRight === null || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false); return;
    }
    const [l, r] = refAreaLeft < refAreaRight ? [refAreaLeft, refAreaRight] : [refAreaRight, refAreaLeft];
    setZoomedData(data.filter(d => (d[xKey] ?? 0) >= l && (d[xKey] ?? 0) <= r));
    setZoomed(true); setRefAreaLeft(null); setRefAreaRight(null); setSelecting(false);
  };

  const lines = mode === "xyz"
    ? [{ key: "ax", color: COLORS.accent4, label: "Ax" }, { key: "ay", color: "#ff9de2", label: "Ay" }, { key: "az", color: "#7bc8f6", label: "Az" }]
    : [{ key: "magnitude", color: COLORS.accent3, label: "Magnitude" }];

  const yLabel = mode === "xyz" ? "" : mode === "" ? "" : "";

  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 4, maxWidth: "100vw", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: `1px solid ${COLORS.border}`, background: "rgba(0,0,0,0.2)", flexWrap: "wrap", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent3, boxShadow: `0 0 6px ${COLORS.accent3}` }} />
          <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: COLORS.muted }}>Seizmograph</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <ToggleBtn active={mode === "xyz"} onClick={() => setMode("xyz")} color={COLORS.accent3}>X / Y / Z</ToggleBtn>
          <ToggleBtn active={mode === "magnitude"} onClick={() => setMode("magnitude")} color={COLORS.accent3}>MAGNITUDE</ToggleBtn>
          <div style={{ width: 1, height: 14, background: COLORS.border }} />
          <ToggleBtn active={timeMode === "packet"} onClick={() => setTimeMode("packet")} color={COLORS.accent3}>PACKET</ToggleBtn>
          <ToggleBtn active={timeMode === "gps"} onClick={() => setTimeMode("gps")} color={COLORS.accent3}>GPS TIME</ToggleBtn>
          {zoomed && <span onClick={() => { setZoomed(false); setZoomedData([]); }} style={{ cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: COLORS.accent3, letterSpacing: 1, padding: "2px 6px", border: `1px solid ${COLORS.accent3}`, borderRadius: 2 }}>RESET</span>}
        </div>
        <CopyBtn chartId="chart-seismo" />
      </div>
      <div style={{ height, padding: "8px 12px 12px", userSelect: "none", overflow: "hidden", width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}
            onMouseDown={e => { if (e?.activeLabel) { setRefAreaLeft(e.activeLabel); setSelecting(true); } }}
            onMouseMove={e => { if (selecting && e?.activeLabel) setRefAreaRight(e.activeLabel); }}
            onMouseUp={zoom}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey={xKey} tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              <Label value={xLabel} position="insideBottomRight" offset={-5} style={{ ...chartStyle, fill: COLORS.muted }} />
            </XAxis>
            <YAxis tick={{ ...chartStyle, fill: COLORS.muted }} tickLine={false} axisLine={false}>
              {yLabel && <Label value={yLabel} position="insideTopLeft" dx={-5} dy={4} style={{ ...chartStyle, fill: COLORS.muted }} />}
            </YAxis>
            <Tooltip isAnimationActive={false} cursor={{ stroke: COLORS.accent, strokeWidth: 1 }} contentStyle={{ background: "#0c1520", border: `1px solid ${COLORS.border}`, fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }} labelStyle={{ color: COLORS.muted }} />
            {lines.length > 1 && <Legend wrapperStyle={{ ...chartStyle, color: COLORS.muted, fontSize: 10, cursor: "pointer" }} onClick={e => setHidden(p => ({ ...p, [e.dataKey]: !p[e.dataKey] }))} />}
            {lines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} dot={false} strokeWidth={2} name={l.label} isAnimationActive={false} hide={hidden[l.key]} />)}
            {selecting && refAreaLeft && refAreaRight && <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill={COLORS.accent3} fillOpacity={0.2} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GpsCanvas({ points }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!points.length) return;
    const lats = points.map(p => p.lat), lons = points.map(p => p.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const pad = 30, w = canvas.width - pad * 2, h = canvas.height - pad * 2;
    function toXY(lat, lon) {
      return {
        x: pad + ((lon - minLon) / (maxLon - minLon || 0.001)) * w,
        y: pad + h - ((lat - minLat) / (maxLat - minLat || 0.001)) * h,
      };
    }
    ctx.strokeStyle = "rgba(0,212,255,0.08)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = pad + i * (w / 4), y = pad + i * (h / 4);
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + w, y); ctx.stroke();
    }
    for (let i = 1; i < points.length; i++) {
      const p0 = toXY(points[i-1].lat, points[i-1].lon), p1 = toXY(points[i].lat, points[i].lon);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = `rgba(0,212,255,${0.2 + (i / points.length) * 0.8})`; ctx.lineWidth = 2; ctx.stroke();
    }
    points.forEach((pt, i) => {
      const { x, y } = toXY(pt.lat, pt.lon);
      const isLast = i === points.length - 1;
      ctx.beginPath(); ctx.arc(x, y, isLast ? 6 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? COLORS.accent : "rgba(0,212,255,0.4)"; ctx.fill();
    });
    const { x, y } = toXY(points[0].lat, points[0].lon);
    ctx.fillStyle = COLORS.accent2; ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.font = "9px 'Share Tech Mono', monospace"; ctx.fillStyle = COLORS.accent2;
    ctx.fillText("START", x + 6, y + 4);
  }, [points]);
  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

export default function App() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const isMobile = windowWidth < 768;
  const [data, setData] = useState([]);
  const [mode, setMode] = useState("IDLE");
  const [clockSec, setClockSec] = useState(0);
  const liveRef = useRef(null);
  const liveTRef = useRef(0);
  const clockRef = useRef(null);
  const fileRef = useRef(null);
  const tableRef = useRef(null);
  const serialRef = useRef(null);
  const readerRef = useRef(null);
  const [serialConnected, setSerialConnected] = useState(false);
  const [savedFlights, setSavedFlights] = useState([]);
  const [showFlights, setShowFlights] = useState(false);

  const trimmed = data.slice(-MAX_POINTS);
  const gpsPoints = data.filter(r => r.lat != null && r.lon != null).map(r => ({ lat: r.lat, lon: r.lon }));
  const last = data[data.length - 1] ?? {};
  const prev = data[data.length - 2] ?? {};
  const maxAlt = data.length ? Math.max(...data.map(r => r.rel_alt ?? r.altitude ?? -Infinity)) : null;
  const minTemp = data.length ? Math.min(...data.map(r => r.temperature ?? Infinity)) : null;

  useEffect(() => {
    loadSavedFlights();
  }, []);

  const loadSavedFlights = async () => {
    try {
      const q = query(collection(db, "flights"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const flights = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSavedFlights(flights);
    } catch(e) { console.error(e); }
  };

  const saveFlight = async () => {
    if (!data.length) { alert("No saved flights!"); return; }
    const name = prompt("Flight name:", `Flight ${new Date().toLocaleDateString("sk-EN")}`);
    if (!name) return;
    try {
      await addDoc(collection(db, "flights"), {
        name,
        timestamp: Date.now(),
        packets: data.length,
        data,
      });
      alert(`Flight "${name}" saved! ✓`);
      loadSavedFlights();
    } catch(e) { alert("Chyba: " + e.message); }
  };

  const loadFlight = (flight) => {
    setData(flight.data);
    setMode("CSV");
    setShowFlights(false);
  };

  const deleteFlight = async (id) => {
    if (!confirm("Delete this flight?")) return;
    try {
      await deleteDoc(doc(db, "flights", id));
      loadSavedFlights();
    } catch(e) { alert("Chyba: " + e.message); }
  };

  const renameFlight = async (id, currentName) => {
    const newName = prompt("New flight name:", currentName);
    if (!newName || newName === currentName) return;
    try {
      await updateDoc(doc(db, "flights", id), { name: newName });
      loadSavedFlights();
    } catch(e) { alert("Error: " + e.message); }
  };
  
  const startClock = useCallback(() => {
    if (clockRef.current) clearInterval(clockRef.current);
    clockRef.current = setInterval(() => setClockSec(s => s + 1), 1000);
  }, []);

  const stopClock = useCallback(() => {
    clearInterval(clockRef.current); clockRef.current = null;
  }, []);

  const clearAll = useCallback(() => {
    setData([]); setMode("IDLE"); stopClock(); setClockSec(0);
  }, [stopClock]);

  const stopLive = useCallback(() => {
    clearInterval(liveRef.current); liveRef.current = null;
    setMode("STOPPED"); stopClock();
  }, [stopClock]);

  const loadCSV = useCallback((e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      clearAll(); setData(rows); setMode("CSV"); startClock();
    };
    reader.readAsText(file); e.target.value = "";
  }, [clearAll, startClock]);

  const loadDemo = useCallback(() => {
    clearAll(); setData(generateDemo()); setMode("DEMO"); startClock();
  }, [clearAll, startClock]);

  const parseCanSatLine = (line) => {
    line = line.trim();
    if (!line || !line.includes("=")) return null;
    const obj = {};
    line.split(",").forEach(pair => {
      const [k, v] = pair.split("=");
      if (k && v !== undefined) obj[k.trim().toUpperCase()] = v.trim();
    });
    const f = (v) => (v && v !== "NA" ? parseFloat(v) : null);
    const packetId = f(obj.ID);
    return {
      time: packetId,
      gps_alt: f(obj.ALT),
      rel_alt: f(obj.REL_ALT),
      altitude: f(obj.REL_ALT) ?? f(obj.ALT),
      temperature: f(obj.BMP_T) ?? f(obj.BME_T),
      pressure: f(obj.BMP_P) ?? f(obj.BME_P),
      ax: f(obj.AX), ay: f(obj.AY), az: f(obj.AZ),
      gx: f(obj.GX), gy: f(obj.GY), gz: f(obj.GZ),
      lat: f(obj.LAT), lon: f(obj.LON),
      humidity: f(obj.BME_H),
      gas: f(obj.BME_G),
      gps_time: obj.TIME && obj.TIME !== "NA" ? obj.TIME : null,
    };
  };

  const stopSerial = useCallback(async () => {
    try {
      if (readerRef.current) { await readerRef.current.cancel(); readerRef.current = null; }
      if (serialRef.current) { await serialRef.current.close(); serialRef.current = null; }
    } catch(e) {}
    setSerialConnected(false); setMode("STOPPED"); stopClock();
  }, [stopClock]);

  const startSerial = useCallback(async () => {
    if (!("serial" in navigator)) { alert("Web Serial nefunguje! Použi Chrome alebo Edge."); return; }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      serialRef.current = port; setSerialConnected(true); setMode("SERIAL"); startClock();
      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      readerRef.current = reader;
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n"); buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith(">>>")) {
            const row = parseCanSatLine(line.replace(">>>", "").trim());
            if (row) setData(prev => [...prev, row].slice(-MAX_POINTS * 2));
          }
        }
      }
    } catch(e) { setSerialConnected(false); setMode("STOPPED"); stopClock(); }
  }, [startClock, stopClock]);

  useEffect(() => () => { clearInterval(liveRef.current); clearInterval(clockRef.current); }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#060a0f", color: "#cde8ff", fontFamily: "'Exo 2', sans-serif", fontSize: 13 }}>
      <div className="fixed inset-0 pointer-events-none z-50" style={{ background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px)" }} />
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

      <header className="sticky top-0 z-40" style={{ background: "rgba(12,21,32,0.97)", borderBottom: `1px solid ${COLORS.border}`, backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "8px 12px" : "10px 24px", flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={logo} alt="3BFMetallican" style={{ width: isMobile ? 36 : 52, height: isMobile ? 36 : 52, objectFit: "contain", borderRadius: "50%" }} />
            <div>
              <div style={{ fontFamily: "'Exo 2', sans-serif", fontWeight: 800, fontSize: isMobile ? 13 : 18, letterSpacing: isMobile ? 1 : 3, color: COLORS.accent, textTransform: "uppercase" }}>3BFMETALLICAN</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: COLORS.muted, letterSpacing: 2 }}>Ground Station v2.0</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: isMobile ? 14 : 22, color: COLORS.accent, letterSpacing: isMobile ? 2 : 4 }}>{formatClock(clockSec)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 20 }}>
            {[{ label: "Link", value: "ONLINE", color: COLORS.accent2 }, { label: "Packets", value: data.length, color: COLORS.accent }, { label: "Mode", value: mode, color: COLORS.accent3 }].map(s => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: COLORS.muted, letterSpacing: 1, textTransform: "uppercase" }}>{s.label}</span>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, fontWeight: 600, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: isMobile ? "6px 8px" : "8px 24px", background: "rgba(8,14,22,0.85)", borderTop: `1px solid ${COLORS.border}`, flexWrap: "wrap", width: "100%", boxSizing: "border-box", overflow: "hidden" }}>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={loadCSV} style={{ display: "none" }} />
          {!isMobile && <Btn onClick={() => fileRef.current?.click()}>📂 Load CSV</Btn>}
          {!isMobile && <div style={{ width: 1, height: 28, background: COLORS.border }} />}
          {!isMobile && (mode !== "LIVE" && mode !== "SERIAL"
            ? <Btn color={COLORS.accent2} onClick={startSerial}>▶ Start</Btn>
            : <Btn color="#ff4444" onClick={() => { stopLive(); stopSerial(); }}>■ Stop</Btn>)}
          {!isMobile && <Btn onClick={loadDemo}>⚡ Demo Data</Btn>}
          <Btn color={COLORS.accent3} onClick={clearAll} isMobile={isMobile}>🗑 Clear</Btn>
          {!isMobile && <div style={{ width: 1, height: 28, background: COLORS.border }} />}
          {!isMobile && <Btn onClick={() => exportCSV(data)}>⬇ Export CSV</Btn>}
          {!isMobile && <Btn color={COLORS.accent2} onClick={saveFlight}>💾 Save Flight</Btn>}
          <Btn color={COLORS.accent4} onClick={() => { setShowFlights(true); loadSavedFlights(); }} isMobile={isMobile}>📁 Flight History</Btn>
          {!isMobile && <div style={{ width: 1, height: 28, background: COLORS.border }} />}
          {!isMobile && (!serialConnected
            ? <Btn color="#ff4444" onClick={startSerial}>⏹ GS DISCONNECTED</Btn>
            : <Btn color="#00ff9d" onClick={stopSerial}>🔌 GS CONNECTED</Btn>)}
        </div>
      </header>

      {showFlights && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: isMobile ? 16 : 24, width: isMobile ? "95vw" : 600, maxHeight: "80vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontFamily: "'Exo 2', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.accent, letterSpacing: 2 }}>Flight History</span>
              <span onClick={() => setShowFlights(false)} style={{ cursor: "pointer", color: COLORS.muted, fontSize: 20 }}>✕</span>
            </div>  
            {savedFlights.length === 0 ? (
              <div style={{ color: COLORS.muted, fontFamily: "'Share Tech Mono', monospace", fontSize: 12, textAlign: "center", padding: 32 }}>No saved flights</div>
            ) : (
              savedFlights.map(f => (
                <div key={f.timestamp} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", marginBottom: 8, background: "rgba(255,255,255,0.03)", border: `1px solid ${COLORS.border}`, borderRadius: 4 }}>
                  <div>
                    <div style={{ fontFamily: "'Exo 2', sans-serif", fontWeight: 600, fontSize: 13, color: COLORS.accent }}>{f.name}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: COLORS.muted, marginTop: 4 }}>
                      {new Date(f.timestamp).toLocaleString("sk-SK")} · {f.packets} packets
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn color={COLORS.accent2} onClick={() => loadFlight(f)}>▶ Load</Btn>
                    <Btn color={COLORS.warn} onClick={() => renameFlight(f.id, f.name)}>✏️</Btn>
                    <Btn color="#ff4444" onClick={() => deleteFlight(f.id)}>🗑</Btn>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <main className="flex-1 z-10" style={{ padding: 10, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(6, 1fr)", gap: 10, width: "100%", boxSizing: "border-box", overflow: "hidden" }}>
        <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(6, 1fr)", gap: 6, width: "100%", boxSizing: "border-box" }}>
          <KpiCard label="Altitude (REL)" value={last.rel_alt?.toFixed(1)} unit="meters" color={COLORS.accent} delta={last.rel_alt != null && prev.rel_alt != null ? last.rel_alt - prev.rel_alt : null} isMobile={isMobile} />
          <KpiCard label="Temperature" value={last.temperature?.toFixed(1)} unit="°C" color={COLORS.accent3} delta={last.temperature != null && prev.temperature != null ? last.temperature - prev.temperature : null} isMobile={isMobile} />
          <KpiCard label="Pressure" value={last.pressure?.toFixed(1)} unit="hPa" color={COLORS.accent2} delta={last.pressure != null && prev.pressure != null ? last.pressure - prev.pressure : null} isMobile={isMobile} />
          <KpiCard label="Humidity" value={last.humidity?.toFixed(1)} unit="%" color={COLORS.accent4} delta={last.humidity != null && prev.humidity != null ? last.humidity - prev.humidity : null} isMobile={isMobile} />
          <KpiCard label="Gas (kOhm)" value={last.gas?.toFixed(1)} unit="kOhm" color="#90EE90" delta={last.gas != null && prev.gas != null ? last.gas - prev.gas : null} isMobile={isMobile} />
          <KpiCard label="GPS Fix" value={last.lat != null ? "FIX" : "NO FIX"} unit={last.lat != null ? `${last.lat?.toFixed(4)}, ${last.lon?.toFixed(4)}` : "---, ---"} color={last.lat != null ? COLORS.accent2 : COLORS.gps} isMobile={isMobile} />
        </div>

        <div id="chart-alt" style={{ gridColumn: isMobile ? "span 1" : "span 2" }}><AltitudeChart data={trimmed} height={isMobile ? 250 : 180} /></div>
        <div id="chart-hum" style={{ gridColumn: isMobile ? "span 1" : "span 2" }}><HumidityChart data={trimmed} height={isMobile ? 250 : 180} /></div>
        <div id="chart-tp" style={{ gridColumn: isMobile ? "span 1" : "span 2" }}><TempPressChart data={trimmed} height={isMobile ? 250 : 180} /></div>

        <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
          <Panel title="GPS Track" dotColor={COLORS.gps} badge={gpsPoints.length ? `${gpsPoints.length} pts` : "No fix"} colSpan={2}>
            <div style={{ height: 220, background: "#0a1520", position: "relative", overflow: "hidden", width: "100%" }}>
              <GpsCanvas points={gpsPoints} />
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: COLORS.muted, padding: "6px 12px", borderTop: `1px solid ${COLORS.border}` }}>
              {last.lat != null ? `LAT: ${last.lat.toFixed(5)}   LON: ${last.lon.toFixed(5)}   ALT: ${last.gps_alt ?? "—"}m` : "LAT: —   LON: —   ALT: —"}
            </div>
          </Panel>
        </div>
        <div id="chart-air" style={{ gridColumn: isMobile ? "span 1" : "span 2" }}><AirQualityChart data={trimmed} height={isMobile ? 250 : 220} /></div>
        <div id="chart-gyro" style={{ gridColumn: isMobile ? "span 1" : "span 2" }}><GyroChart data={trimmed} height={isMobile ? 250 : 220} /></div>
        <div id="chart-seismo" style={{ gridColumn: isMobile ? "span 1" : "span 6" }}><SeismoChart data={trimmed} height={isMobile ? 250 : 160} /></div>

        <Panel title="Packet Log" dotColor={COLORS.accent2} badge={`${data.length} rows`} colSpan={isMobile ? 1 : 3}>
          <div
            ref={tableRef}
            style={{ maxHeight: 200, overflowY: "auto", overflowX: "auto" }}
            onTouchStart={e => { tableRef.current._startX = e.touches[0].clientX; tableRef.current._scrollLeft = tableRef.current.scrollLeft; }}
            onTouchMove={e => { const dx = tableRef.current._startX - e.touches[0].clientX; tableRef.current.scrollLeft = tableRef.current._scrollLeft + dx; }}
          >
            <div style={{ minWidth: isMobile ? 600 : "100%" }}></div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
              <thead>
                <tr>{["Paket", "REL_ALT", "GPS_ALT", "Temp", "Pres", "Hum", "Gas", "Ax", "Ay", "Az", "Gx", "Gy", "Gz", "Lat", "Lon"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "5px 8px", color: COLORS.muted, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {[...data].reverse().slice(0, 500).map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: "4px 8px", color: COLORS.muted, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.time ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.accent, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.rel_alt?.toFixed(1) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.accent2, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.gps_alt?.toFixed(1) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.accent3, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.temperature?.toFixed(1) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.accent2, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.pressure?.toFixed(1) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.accent4, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.humidity?.toFixed(1) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: "#90EE90", borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.gas?.toFixed(1) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.accent4, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.ax?.toFixed(2) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.accent4, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.ay?.toFixed(2) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.accent4, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.az?.toFixed(2) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.warn, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.gx?.toFixed(2) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.warn, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.gy?.toFixed(2) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.warn, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.gz?.toFixed(2) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.gps, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.lat?.toFixed(5) ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: COLORS.gps, borderBottom: `1px solid rgba(26,46,68,0.4)` }}>{r.lon?.toFixed(5) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Info" dotColor={COLORS.accent} colSpan={isMobile ? 1 : 3}>
          <div className="p-3" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, lineHeight: 2, color: COLORS.muted }}>
            <div style={{ color: COLORS.accent, marginBottom: 8 }}>Ovládanie grafov:</div>
            <div><span style={{ color: COLORS.accent2 }}>REL ALT / GPS ALT</span> — prepnutie osi X medzi relatívnou a GPS výškou</div>
            <div><span style={{ color: COLORS.accent2 }}>PACKET / GPS TIME</span> — prepnutie osi X medzi číslom paketu a GPS časom</div>
            <div><span style={{ color: COLORS.accent2 }}>Klick + Grab</span> — zoom na grafe</div>
            <div><span style={{ color: COLORS.accent2 }}>RESET</span> — zrušenie zoomu</div>
            <div style={{ marginTop: 10, color: COLORS.accent }}>Ukladanie letov:</div>
            <div><span style={{ color: COLORS.accent2 }}>💾 Save flight</span> — uloží aktuálne dáta zdieľane pre všetkých</div>
            <div><span style={{ color: COLORS.accent2 }}>📁 Flight History</span> — zobrazí všetky uložené lety</div>
          </div>
        </Panel>
      </main>

      <footer className="flex items-center gap-6 px-6 py-1.5 z-30" style={{ background: "rgba(6,10,15,0.97)", borderTop: `1px solid ${COLORS.border}`, fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: COLORS.muted }}>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: mode === "LIVE" || mode === "SERIAL" ? COLORS.accent2 : COLORS.muted }} />
          <span>{mode === "IDLE" ? "Waiting for data…" : mode === "LIVE" ? "Live feed active" : mode === "CSV" ? `CSV loaded — ${data.length} rows` : mode === "DEMO" ? "Demo flight loaded" : mode === "SERIAL" ? "Serial connected" : "Feed stopped"}</span>
        </div>
        <span>Packets: <span style={{ color: COLORS.accent }}>{data.length}</span></span>
        <span>Max REL alt: <span style={{ color: COLORS.accent }}>{maxAlt != null && isFinite(maxAlt) ? maxAlt.toFixed(1) + " m" : "—"}</span></span>
        <span>Min temp: <span style={{ color: COLORS.accent3 }}>{minTemp != null && isFinite(minTemp) ? minTemp.toFixed(1) + "°C" : "—"}</span></span>
      </footer>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>
    </div>
  );
}

function Btn({ children, onClick, color = COLORS.accent, isMobile = false }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: isMobile ? "5px 8px" : "6px 16px", border: `1px solid ${hover ? color : COLORS.border}`, background: hover ? `${color}22` : `${color}0d`, color, fontFamily: "'Exo 2', sans-serif", fontSize: isMobile ? 10 : 12, fontWeight: 600, letterSpacing: isMobile ? 0 : 1, textTransform: "uppercase", cursor: "pointer", borderRadius: 3, transition: "all .15s", display: "flex", alignItems: "center", gap: 4 }}>
      {children}
    </button>
  );
}
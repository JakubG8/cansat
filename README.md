# CanSat

- `cansat-app/` – webová aplikácia (React + Vite, Firebase) na zobrazenie telemetrie
- `PlatformIO/Projects/CanSat/` – firmvér satelitu (ESP32: BME680, MPU6050, GPS, LoRa)
- `PlatformIO/Projects/GroundStation/` – firmvér pozemnej stanice (ESP32, LoRa)

## Spustenie appky

```bash
cd cansat-app
npm install
npm run dev
```

## Firmvér

Otvor priečinok projektu v PlatformIO (VS Code) a nahraj cez **Upload**.

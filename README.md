# CanSat

Projekt tímu 3BF Metallican – satelit v plechovke, pozemná stanica a webová appka na zobrazenie telemetrie.

```
CanSat (ESP32)  --LoRa 433 MHz-->  GroundStation (ESP32)  --USB/Serial-->  cansat-app (prehliadač)
```

| Priečinok | Čo to je |
|---|---|
| `PlatformIO/Projects/CanSat/` | firmvér satelitu – meria senzory, posiela dáta cez LoRa, ukladá na SD kartu |
| `PlatformIO/Projects/GroundStation/` | firmvér pozemnej stanice – prijíma LoRa pakety a posiela ich do PC cez USB |
| `cansat-app/` | webová appka (React + Vite) – číta dáta zo stanice, zobrazuje grafy, ukladá lety do Firebase |

---

## 1. Firmvér (C++ / PlatformIO)

### Čo potrebuješ

- [VS Code](https://code.visualstudio.com/) s rozšírením **PlatformIO IDE**
- 2× doska **ESP32** (esp32dev) a USB kábel
- ovládač USB-serial pre tvoju dosku (CP210x alebo CH340), ak ju Windows nevidí

Knižnice (LoRa, BME680, TinyGPSPlus …) netreba inštalovať ručne – PlatformIO ich stiahne samo pri prvom builde podľa `platformio.ini`.

### Nahratie do dosky

1. Vo VS Code daj **File → Open Folder** a otvor priečinok **`PlatformIO/Projects/CanSat`** (alebo `GroundStation`).
   Treba otvoriť priamo priečinok projektu (ten, kde je `platformio.ini`), nie celý repozitár.
2. Pripoj ESP32 cez USB.
3. Skontroluj port. V `CanSat/platformio.ini` je nastavené `upload_port = COM5`.
   Ak má tvoja doska iné číslo (nájdeš ho v **Správcovi zariadení → Porty (COM a LPT)**), prepíš ho, alebo tie dva riadky (`upload_port`, `monitor_port`) zmaž a PlatformIO port nájde samo.
4. V dolnej lište PlatformIO klikni na **✓ Build**, potom **→ Upload**.
   Ak upload nejde, podrž na doske tlačidlo **BOOT**, kým sa nezačne nahrávať.
5. Klikni na **🔌 Serial Monitor** (115200 baud) a uvidíš výpis.

### Nahratie z terminálu (bez VS Code)

Postup je rovnaký pre `CanSat` aj `GroundStation`, líši sa len priečinok.

**1. Nainštaluj PlatformIO** (raz, potrebuješ [Python](https://www.python.org/downloads/) 3.8+):

```bash
pip install platformio
```

Over, že funguje: `pio --version`

**2. Stiahni repozitár:**

```bash
git clone https://github.com/JakubG8/cansat.git
cd cansat
```

**3. Choď do priečinka projektu:**

```bash
cd PlatformIO/Projects/CanSat
```

(pre pozemnú stanicu `cd PlatformIO/Projects/GroundStation`)

**4. Pripoj ESP32 cez USB a zisti port:**

```bash
pio device list
```

**5. Skompiluj a nahraj do dosky** (`COM5` nahraď svojím portom):

```bash
pio run -t upload --upload-port COM5
```

Prvý build trvá dlhšie – PlatformIO stiahne kompilátor pre ESP32 a knižnice.

**6. Pozri výpis z dosky:**

```bash
pio device monitor --port COM5 --baud 115200
```

Ukončíš ho cez **Ctrl+C**.

Iné užitočné príkazy:

| Príkaz | Čo robí |
|---|---|
| `pio run` | len skompiluje (overí, že kód je bez chýb) |
| `pio run -t clean` | zmaže build, keď sa niečo zasekne |
| `pio run -t upload -t monitor` | nahrá a hneď otvorí výpis |

### Zapojenie – CanSat

| Súčiastka | Piny ESP32 |
|---|---|
| BME688 (I2C, adresa 0x77) | SDA 23, SCL 22 |
| MPU6500 (I2C, adresa 0x68) | SDA 23, SCL 22 |
| GPS (UART, 9600 baud) | RX 17, TX 16 |
| LoRa SX127x (VSPI) | SCK 18, MISO 19, MOSI 5, NSS 27, RST 14, DIO0 26 |
| SD karta (HSPI) | SCK 33, MISO 34, MOSI 32, CS 4 |
| Bzučiak | 25 |

### Zapojenie – GroundStation

| Súčiastka | Piny ESP32 |
|---|---|
| LoRa SX127x | SCK 18, MISO 19, MOSI 5, NSS 27, RST 14, DIO0 26 |

Obe strany musia mať rovnaké LoRa nastavenia: **433 MHz, SF7, BW 125 kHz, CR 4/5, sync word 0x12**.

### Čo robí CanSat

- každú sekundu zmeria teplotu, vlhkosť, tlak, plyn (BME688), zrýchlenie a gyroskop (MPU6500) a polohu (GPS)
- pri štarte si zapamätá výšku zeme podľa tlaku
- detekuje štart (> 15 m nad zemou), náraz (> 2,5 g) a pristátie – po pristátí pípa bzučiak, aby sa dal nájsť
- paket posiela cez LoRa a zapisuje do `/telemetry.csv` na SD karte

Formát paketu:

```
ID=12,TIME=14:05:33,BME_T=21.50,BME_H=45.20,BME_P=1002.10,BME_G=50.12,AX=0.010,AY=0.020,AZ=1.000,GX=0.100,GY=0.200,GZ=0.300,LAT=48.148598,LON=17.107748,SAT=7,ALT=150.20,REL_ALT=0.00,IMPACT=0,LANDED=0
```

Keď niečo nie je k dispozícii (napr. GPS ešte nemá signál), je tam `NA`.

### Čo robí GroundStation

Prijme paket a pošle ho cez USB do PC. Riadok pre appku začína `>>>`, ostatné riadky (RSSI, SNR, status) sú len informačné.

---

## 2. Webová appka

Potrebuješ [Node.js](https://nodejs.org/) (verzia 18 alebo novšia).

```bash
cd cansat-app
npm install
npm run dev
```

Otvor adresu, ktorú vypíše (zvyčajne http://localhost:5173).

### Pripojenie k pozemnej stanici

1. Pripoj GroundStation cez USB. **Zatvor Serial Monitor v PlatformIO**, inak je port obsadený.
2. Appku otvor v **Chrome alebo Edge** (Firefox a Safari nepodporujú Web Serial).
3. Klikni na červené tlačidlo **⏹ GS DISCONNECTED** a vyber COM port stanice. Tlačidlo zozelenie (**🔌 GS CONNECTED**) a dáta sa začnú zobrazovať.
   Na mobile sa tlačidlo nezobrazuje – pripojenie funguje len na počítači.

Appka ukladá lety do Firebase (Firestore, projekt `cansat-3bfmetallican`).

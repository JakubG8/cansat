# CanSat – 3BF Metallican

Satelit v plechovke, pozemná stanica a webová appka na zobrazenie nameraných dát.

Tento návod je písaný **od úplnej nuly** – pre niekoho, kto nemá nič nainštalované a nikdy nerobil s ESP32 ani s terminálom.

**Obsah**

1. [Ako to celé funguje](#1-ako-to-celé-funguje)
2. [Čo je v repozitári](#2-čo-je-v-repozitári)
3. [Inštalácia programov (raz)](#3-inštalácia-programov-raz)
4. [Stiahnutie projektu](#4-stiahnutie-projektu)
5. [Nahratie programu do ESP32 cez terminál](#5-nahratie-programu-do-esp32-cez-terminál)
6. [Spustenie webovej appky](#6-spustenie-webovej-appky)
7. [Celý postup pri lete](#7-celý-postup-pri-lete)
8. [Riešenie problémov](#8-riešenie-problémov)
9. [Technické detaily](#9-technické-detaily)

---

## 1. Ako to celé funguje

Systém má tri časti:

```
┌──────────────┐   rádio LoRa    ┌───────────────┐   USB kábel   ┌──────────────┐
│   CanSat     │ ──────────────► │ GroundStation │ ────────────► │  cansat-app  │
│  (ESP32 v    │    433 MHz      │  (ESP32 pri   │               │ (prehliadač  │
│  plechovke)  │                 │   počítači)   │               │  na PC)      │
└──────────────┘                 └───────────────┘               └──────────────┘
```

1. **CanSat** je malý počítač ESP32 so senzormi. Každú sekundu zmeria teplotu, vlhkosť, tlak, plyn, zrýchlenie, otáčanie a GPS polohu. Tieto hodnoty pošle rádiom (LoRa) na zem a zároveň ich uloží na SD kartu (záloha, keby sa rádiový signál stratil).
2. **GroundStation** je druhé ESP32 s rovnakým rádiom. Čaká na správy zo satelitu a každú prijatú pošle cez USB kábel do počítača.
3. **cansat-app** je webová stránka. Otvorí sa v prehliadači, cez USB číta dáta z pozemnej stanice a kreslí z nich grafy. Lety sa dajú uložiť a neskôr znova pozrieť.

Programy pre ESP32 sú napísané v **C++** (jazyk Arduino). Aby sa dostali do dosky, treba ich **skompilovať** (preložiť do strojového kódu, ktorému ESP32 rozumie) a **nahrať** cez USB. Na oboje používame nástroj **PlatformIO**.

---

## 2. Čo je v repozitári

```
cansat/
├── README.md                      ← tento návod
├── PlatformIO/Projects/
│   ├── CanSat/                    ← program pre satelit
│   │   ├── platformio.ini         ← nastavenia: aká doska, aké knižnice, aký port
│   │   └── src/main.cpp           ← samotný program
│   └── GroundStation/             ← program pre pozemnú stanicu
│       ├── platformio.ini
│       └── src/main.cpp
└── cansat-app/                    ← webová appka (React)
    ├── package.json               ← zoznam knižníc appky
    └── src/App.jsx                ← hlavný kód appky
```

**`platformio.ini`** hovorí PlatformIO, čo má robiť – napríklad:

```ini
[env:esp32dev]
platform = espressif32     ; čip ESP32
board = esp32dev           ; typ dosky
framework = arduino        ; píšeme v Arduino štýle
monitor_speed = 115200     ; rýchlosť komunikácie cez USB
lib_deps =                 ; knižnice, ktoré sa stiahnu automaticky
    sandeepmistry/LoRa
```

**`main.cpp`** má (ako každý Arduino program) dve hlavné funkcie:

- `setup()` – spustí sa **raz** po zapnutí: nastaví senzory, rádio, SD kartu,
- `loop()` – opakuje sa **stále dokola**: zmeraj → pošli → ulož → počkaj 1 sekundu.

---

## 3. Inštalácia programov (raz)

Toto stačí urobiť raz na každom počítači. Návod je pre **Windows**.

### 3.1 Python

PlatformIO je napísané v Pythone, takže ho potrebuje.

1. Choď na https://www.python.org/downloads/ a stiahni najnovšiu verziu.
2. Spusti inštalátor a **úplne dole zaškrtni „Add python.exe to PATH“** (veľmi dôležité – inak terminál Python nenájde).
3. Klikni **Install Now**.

### 3.2 Git

Git slúži na stiahnutie projektu z GitHubu.

1. Choď na https://git-scm.com/download/win a stiahni inštalátor.
2. Prejdi ho s predvolenými nastaveniami (stále **Next**).

### 3.3 Node.js (len ak chceš spúšťať webovú appku)

1. Choď na https://nodejs.org/ a stiahni verziu **LTS**.
2. Nainštaluj s predvolenými nastaveniami.

### 3.4 Ovládač pre ESP32

Aby Windows rozpoznal ESP32 pripojené cez USB, potrebuje ovládač. Na doske je jeden z dvoch USB čipov (býva na ňom napísané):

- **CP2102** → ovládač: https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers
- **CH340** → ovládač: https://www.wch-ic.com/downloads/CH341SER_EXE.html

Ak nevieš, ktorý máš, pripoj dosku a pozri **Správcu zariadení** (pravý klik na Štart → Správca zariadení). Ak je v sekcii **Porty (COM a LPT)** niečo ako „USB-SERIAL CH340 (COM5)“ alebo „Silicon Labs CP210x (COM5)“, ovládač už máš.

### 3.5 Otvorenie terminálu

Všetky ďalšie príkazy sa píšu do terminálu:

- stlač **Win**, napíš **PowerShell** a stlač **Enter**.

Do okna, ktoré sa otvorí, sa príkaz napíše (alebo vloží pravým klikom) a potvrdí **Enterom**.

> ⚠️ Po inštalácii programov **zavri terminál a otvor nový** – starý o nových programoch ešte nevie.

### 3.6 PlatformIO

V termináli spusti:

```bash
pip install platformio
```

`pip` je inštalátor balíčkov pre Python – stiahne a nainštaluje PlatformIO.

### 3.7 Overenie

Zavri terminál, otvor nový a spusti tieto príkazy po jednom. Každý by mal vypísať číslo verzie:

```bash
python --version
```
```bash
git --version
```
```bash
pio --version
```
```bash
node --version
```

Ak niektorý vypíše chybu „is not recognized“, pozri [Riešenie problémov](#8-riešenie-problémov).

---

## 4. Stiahnutie projektu

V termináli sa najprv presuň tam, kam chceš projekt uložiť (napríklad na Plochu):

```bash
cd $HOME\Desktop
```

`cd` znamená *change directory* – „choď do priečinka“.

Stiahni projekt:

```bash
git clone https://github.com/JakubG8/cansat.git
```

Na Ploche sa vytvorí priečinok `cansat` so všetkými súbormi. Presuň sa doň:

```bash
cd cansat
```

---

## 5. Nahratie programu do ESP32 cez terminál

Postup je **rovnaký pre CanSat aj GroundStation** – líši sa len priečinok, do ktorého vojdeš. Nižšie je príklad pre CanSat.

### 5.1 Vojdi do priečinka projektu

```bash
cd PlatformIO\Projects\CanSat
```

(pre pozemnú stanicu: `cd PlatformIO\Projects\GroundStation`)

PlatformIO príkazy treba spúšťať v priečinku, kde je súbor `platformio.ini` – podľa neho vie, čo robiť. Či si na správnom mieste, overíš príkazom `dir` – vo výpise musí byť `platformio.ini`.

### 5.2 Pripoj ESP32 a zisti port

Pripoj dosku USB káblom (musí to byť dátový kábel, nie len nabíjací) a spusti:

```bash
pio device list
```

Vypíše zoznam zariadení, napríklad:

```
COM5
----
Hardware ID: USB VID:PID=10C4:EA60 ...
Description: Silicon Labs CP210x USB to UART Bridge (COM5)
```

**COM5** je port, cez ktorý sa s doskou komunikuje. Zapamätaj si ho – u teba môže byť iné číslo.

### 5.3 Skompiluj a nahraj program

```bash
pio run -t upload --upload-port COM5
```

(`COM5` nahraď svojím portom)

Čo sa pritom deje:

1. **Prvé spustenie trvá niekoľko minút.** PlatformIO si stiahne kompilátor pre ESP32 a všetky knižnice zo `platformio.ini` (LoRa, BME680, GPS …). Nabudúce to už bude rýchle.
2. **Kompilácia** – C++ kód sa preloží do strojového kódu. Uvidíš riadky ako `Compiling .pio/build/...`.
3. **Nahrávanie** – výsledok sa pošle do dosky. Uvidíš `Connecting....` a potom percentá `Writing at 0x... (35 %)`.
4. Na konci musí byť:

   ```
   ======== [SUCCESS] Took 25.31 seconds ========
   ```

> 💡 Ak sa to zasekne na `Connecting.......`, **podrž na doske tlačidlo BOOT**, kým sa nezačnú ukazovať percentá, potom ho pusti.

Po nahratí sa program v doske **hneď spustí** a zostane v nej aj po odpojení – pri ďalšom zapnutí (aj z batérie) sa spustí sám.

### 5.4 Pozri, čo doska robí

```bash
pio device monitor --port COM5 --baud 115200
```

Toto zobrazí všetko, čo program vypisuje cez `Serial.println(...)`. `115200` je rýchlosť komunikácie – musí sedieť s tou v programe, inak uvidíš nezmyselné znaky.

**CanSat** by mal po štarte vypísať:

```
=== CANSAT START ===
BME OK
MPU OK
GPS OK
LoRa OK
SD OK
=== READY ===
ID=0,TIME=NA,BME_T=23.41,BME_H=41.02,BME_P=1003.55,...
ID=1,TIME=NA,BME_T=23.42,...
```

Pri každom module vidíš, či funguje (`OK`) alebo nie (`FAIL`). `TIME=NA` a `LAT=NA` sú normálne, kým GPS nenájde satelity (vonku to trvá 1–5 minút, v budove často vôbec).

**GroundStation** vypíše:

```
=== GROUND STATION RX START ===
LoRa OK
Waiting for packets...
```

a keď prijme dáta zo satelitu:

```
---- DATA RECEIVED ----
Packet #: 1
RSSI: -45
SNR: 9.75
>>>ID=0,TIME=NA,BME_T=23.41,...
```

**RSSI** je sila signálu (bližšie k 0 = silnejší, okolo −120 už signál končí), **SNR** je kvalita signálu.

Monitor ukončíš klávesmi **Ctrl+C**.

### 5.5 Prehľad príkazov

| Príkaz | Čo robí |
|---|---|
| `pio device list` | ukáže pripojené dosky a ich porty |
| `pio run` | len skompiluje – overí, či je v kóde chyba |
| `pio run -t upload --upload-port COM5` | skompiluje a nahrá do dosky |
| `pio device monitor --port COM5 --baud 115200` | zobrazí výpis z dosky |
| `pio run -t upload -t monitor --upload-port COM5` | nahrá a hneď zobrazí výpis |
| `pio run -t clean` | zmaže skompilované súbory, keď sa niečo zasekne |

### 5.6 Keď zmeníš kód

Uprav `src\main.cpp` (napr. v Poznámkovom bloku alebo VS Code), ulož a znova spusti:

```bash
pio run -t upload --upload-port COM5
```

---

## 6. Spustenie webovej appky

Z hlavného priečinka `cansat` choď do appky:

```bash
cd cansat-app
```

Nainštaluj knižnice (len prvýkrát, trvá to chvíľu):

```bash
npm install
```

`npm` je inštalátor balíčkov pre JavaScript – podľa `package.json` stiahne všetko, čo appka potrebuje, do priečinka `node_modules`.

Spusti appku:

```bash
npm run dev
```

Vypíše adresu, typicky:

```
  ➜  Local:   http://localhost:5173/
```

Otvor ju v prehliadači **Chrome alebo Edge**. Appka beží, kým je terminál otvorený – zastavíš ju **Ctrl+C**.

### Pripojenie pozemnej stanice do appky

1. Pripoj GroundStation cez USB.
2. **Zavri `pio device monitor`**, ak beží – port môže naraz používať len jeden program.
3. V appke klikni na červené tlačidlo **⏹ GS DISCONNECTED**.
4. Prehliadač ponúkne zoznam portov – vyber ten so stanicou a klikni **Pripojiť**.
5. Tlačidlo zozelenie (**🔌 GS CONNECTED**) a grafy sa začnú plniť.

Appka si z výpisu stanice berie len riadky začínajúce `>>>` – to sú dáta zo satelitu.

> Pripojenie cez USB funguje len v Chrome/Edge na počítači (Firefox, Safari a mobil to nepodporujú).

---

## 7. Celý postup pri lete

1. Nahraj program do **CanSatu** a skontroluj v monitore, že všetko je `OK`.
2. Nahraj program do **GroundStation**.
3. Daj do CanSatu **SD kartu** (formát FAT32) a pripoj batériu.
4. CanSat zapni **na zemi** – pri štarte si zapamätá tlak na zemi a podľa neho počíta výšku.
5. GroundStation pripoj k notebooku, spusti appku a pripoj sa (kapitola 6).
6. Over, že prichádzajú dáta.
7. Po pristátí CanSat **pípa** – podľa zvuku ho nájdeš.
8. Všetky dáta sú aj na SD karte v súbore `telemetry.csv` (otvoríš v Exceli).

---

## 8. Riešenie problémov

| Problém | Riešenie |
|---|---|
| `'pio' is not recognized` | Zavri a otvor nový terminál. Ak to nepomôže, Python nebol pridaný do PATH – preinštaluj ho so zaškrtnutým „Add python.exe to PATH“, alebo používaj `python -m platformio` namiesto `pio`. |
| `pio device list` nič nevypíše | Skús iný USB kábel (veľa káblov je len nabíjacích) a iný USB port. Nainštaluj ovládač (kapitola 3.4). |
| Zasekne sa na `Connecting.......` | Pri nahrávaní podrž tlačidlo **BOOT** na doske. |
| `could not open port 'COM5'` / `Access is denied` | Port používa iný program – zavri `pio device monitor`, Arduino IDE, appku v prehliadači alebo iný terminál. |
| V monitore sú nezmyselné znaky | Zlá rýchlosť – použi `--baud 115200`. |
| `LoRa FAIL` | Skontroluj zapojenie rádia (kapitola 9) a či má rádio anténu. |
| `BME FAIL` / `MPU FAIL` | Skontroluj zapojenie SDA/SCL a napájanie senzora. |
| `SD FAIL` | Karta nie je vložená, nie je naformátovaná na FAT32, alebo je zle zapojená. |
| GPS má stále `NA` | GPS potrebuje výhľad na oblohu – choď von a počkaj pár minút. |
| GroundStation nič neprijíma | Obe dosky musia mať rovnaké nastavenia LoRa (kapitola 9). Skús ich dať bližšie k sebe. |

---

## 9. Technické detaily

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

### Nastavenia rádia (musia byť na oboch rovnaké)

433 MHz, spreading factor 7, šírka pásma 125 kHz, coding rate 4/5, sync word 0x12.

### Čo robí CanSat v každom kroku

1. prečíta GPS, BME688 a MPU6500,
2. vypočíta výšku nad zemou z tlaku,
3. vyhodnotí fázu letu:
   - **štart** – výška > 15 m nad zemou,
   - **náraz** – zrýchlenie > 2,5 g po štarte,
   - **pristátie** – po náraze je pod 8 m, výška sa nemení a je v pokoji aspoň 5 sekúnd → zapne bzučiak,
4. zostaví paket, pošle ho cez LoRa a zapíše na SD kartu,
5. počká 1 sekundu.

### Formát paketu

```
ID=12,TIME=14:05:33,BME_T=21.50,BME_H=45.20,BME_P=1002.10,BME_G=50.12,AX=0.010,AY=0.020,AZ=1.000,GX=0.100,GY=0.200,GZ=0.300,LAT=48.148598,LON=17.107748,SAT=7,ALT=150.20,REL_ALT=0.00,IMPACT=0,LANDED=0
```

| Pole | Význam | Jednotka |
|---|---|---|
| ID | poradové číslo paketu | – |
| TIME | čas z GPS (letný čas SR) | hh:mm:ss |
| BME_T / BME_H / BME_P / BME_G | teplota / vlhkosť / tlak / odpor plynu | °C / % / hPa / kΩ |
| AX, AY, AZ | zrýchlenie | g |
| GX, GY, GZ | uhlová rýchlosť | °/s |
| LAT, LON | GPS poloha | stupne |
| SAT | počet viditeľných satelitov | – |
| ALT | nadmorská výška z GPS | m |
| REL_ALT | výška nad miestom štartu (z tlaku) | m |
| IMPACT, LANDED | bol náraz / pristál | 0 / 1 |

Keď hodnota nie je k dispozícii, je tam `NA`. Na SD karte je ten istý obsah ako CSV (bez názvov polí, s hlavičkou na prvom riadku).

### Webová appka

React + Vite, dáta zo stanice číta cez Web Serial API, lety ukladá do Firebase Firestore (projekt `cansat-3bfmetallican`).

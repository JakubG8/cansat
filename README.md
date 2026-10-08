# CanSat – 3BF Metallican

Satelit v plechovke, pozemná stanica a webová appka na zobrazenie nameraných dát.

Tento návod je písaný **od úplnej nuly** – pre niekoho, kto nemá nič nainštalované a nikdy nerobil s ESP32. Všetko sa robí vo **Visual Studio Code**.

**Obsah**

1. [Ako to celé funguje](#1-ako-to-celé-funguje)
2. [Čo je v repozitári](#2-čo-je-v-repozitári)
3. [Inštalácia programov (raz)](#3-inštalácia-programov-raz)
4. [Stiahnutie projektu vo VS Code](#4-stiahnutie-projektu-vo-vs-code)
5. [Nahratie programu do ESP32 vo VS Code](#5-nahratie-programu-do-esp32-vo-vs-code)
6. [Spustenie webovej appky vo VS Code](#6-spustenie-webovej-appky-vo-vs-code)
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

Programy pre ESP32 sú napísané v **C++** (jazyk Arduino). Aby sa dostali do dosky, treba ich **skompilovať** (preložiť do strojového kódu, ktorému ESP32 rozumie) a **nahrať** cez USB. Na oboje používame rozšírenie **PlatformIO** vo VS Code.

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

### 3.1 Visual Studio Code

VS Code je editor kódu – v ňom budeš kód otvárať, upravovať a nahrávať do ESP32.

1. Choď na https://code.visualstudio.com/ a klikni **Download for Windows**.
2. Spusti inštalátor. Pri voľbách zaškrtni **„Add to PATH“** a **„Add 'Open with Code' action…“** (potom vieš otvoriť priečinok pravým klikom).
3. Dokonči inštaláciu a VS Code spusti.

### 3.2 Git

Git slúži na stiahnutie projektu z GitHubu (a neskôr na nahrávanie zmien).

1. Choď na https://git-scm.com/download/win a stiahni inštalátor.
2. Prejdi ho s predvolenými nastaveniami (stále **Next**).
3. **Reštartuj VS Code**, aby o Gite vedel.

> Bez Gitu sa dá projekt stiahnuť aj ako ZIP – na stránke repozitára zelené tlačidlo **Code → Download ZIP** a rozbaliť.

### 3.3 Rozšírenie PlatformIO IDE

PlatformIO je doplnok do VS Code, ktorý vie kód pre ESP32 skompilovať (preložiť do strojového kódu) a nahrať do dosky. Python, ktorý potrebuje, si nainštaluje sám.

1. Vo VS Code klikni vľavo na ikonu **Extensions** (štyri štvorčeky) alebo stlač **Ctrl+Shift+X**.
2. Do vyhľadávania napíš **PlatformIO IDE**.
3. Pri rozšírení od **PlatformIO** klikni **Install**.
4. Počkaj – vpravo dole sa ukazuje priebeh inštalácie. **Prvá inštalácia trvá aj niekoľko minút.**
5. Keď vyskočí hláška, že treba reštartovať, klikni **Reload Now** (alebo VS Code zavri a otvor).

Po inštalácii pribudne vľavo ikona **mravčej hlavy 👽** (PlatformIO) a dole v modrej lište nové tlačidlá.

### 3.4 Node.js (len ak chceš spúšťať webovú appku)

1. Choď na https://nodejs.org/ a stiahni verziu **LTS**.
2. Nainštaluj s predvolenými nastaveniami.
3. **Reštartuj VS Code.**

### 3.5 Ovládač pre ESP32

Aby Windows rozpoznal ESP32 pripojené cez USB, potrebuje ovládač. Na doske je jeden z dvoch USB čipov (býva na ňom napísané):

- **CP2102** → ovládač: https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers
- **CH340** → ovládač: https://www.wch-ic.com/downloads/CH341SER_EXE.html

Ak nevieš, ktorý máš, pripoj dosku a otvor **Správcu zariadení** (pravý klik na Štart → Správca zariadení). Ak je v sekcii **Porty (COM a LPT)** niečo ako „USB-SERIAL CH340 (COM5)“ alebo „Silicon Labs CP210x (COM5)“, ovládač už máš. Číslo v zátvorke (napr. **COM5**) je port dosky.

---

## 4. Stiahnutie projektu vo VS Code

1. Vo VS Code stlač **Ctrl+Shift+P** (otvorí sa príkazový riadok hore).
2. Napíš **Git: Clone** a stlač **Enter**.
3. Vlož adresu:

   ```
   https://github.com/JakubG8/cansat.git
   ```

   a stlač **Enter**.
4. Vyber priečinok, kam sa má projekt uložiť (napr. **Dokumenty**) a klikni **Select as Repository Destination**.
5. Po stiahnutí sa VS Code opýta, či ho chceš otvoriť – klikni **Open**.

Vľavo v **Explorer** (ikona dvoch papierov, **Ctrl+Shift+E**) teraz vidíš všetky súbory projektu.

---

## 5. Nahratie programu do ESP32 vo VS Code

Postup je **rovnaký pre CanSat aj GroundStation** – líši sa len to, ktorý priečinok otvoríš. Nižšie je príklad pre CanSat.

### 5.1 Otvor priečinok projektu

PlatformIO potrebuje, aby bol otvorený **priamo priečinok s `platformio.ini`** – nie celý repozitár. Inak dole v lište nebudú tlačidlá na nahratie.

1. **File → Open Folder…** (**Ctrl+K Ctrl+O**).
2. Prejdi do `cansat\PlatformIO\Projects\` a vyber priečinok **`CanSat`** (pre pozemnú stanicu **`GroundStation`**).
3. Klikni **Select Folder**. Ak sa VS Code opýta „Do you trust the authors…“, klikni **Yes, I trust the authors**.

**Pri prvom otvorení** PlatformIO automaticky sťahuje kompilátor pre ESP32 a knižnice zo `platformio.ini` (LoRa, BME680, GPS …). Vpravo dole uvidíš „PlatformIO: Configuring project“ / „Installing…“. **Počkaj, kým to skončí** (pár minút, len prvýkrát).

Program nájdeš vľavo v Exploreri v **`src\main.cpp`**.

### 5.2 Spodná lišta PlatformIO

Po otvorení projektu sa v modrej lište dole objavia tlačidlá:

| Ikona | Názov | Čo robí |
|---|---|---|
| 🏠 | PlatformIO Home | úvodná stránka PlatformIO |
| ✓ | **Build** | skompiluje kód – overí, či je bez chýb |
| → | **Upload** | skompiluje a nahrá do dosky |
| 🗑 | Clean | zmaže skompilované súbory (keď sa niečo zasekne) |
| 🔌 | **Serial Monitor** | zobrazí, čo doska vypisuje |
| >_ | PlatformIO Terminal | terminál s príkazmi `pio` |
| 🔌 Auto | **port** | na ktorý USB port sa nahráva |

Keď prejdeš myšou nad ikonu, zobrazí sa jej názov.

Tie isté akcie nájdeš aj po kliknutí na ikonu **👽 PlatformIO** vľavo → **PROJECT TASKS → esp32dev → General**.

### 5.3 Pripoj ESP32 a nastav port

1. Pripoj dosku USB káblom (musí to byť **dátový** kábel, nie len nabíjací).
2. V `platformio.ini` projektu **CanSat** je napevno nastavený port:

   ```ini
   upload_port = COM5
   monitor_port = COM5
   ```

   Ak má tvoja doska iné číslo portu (pozri kapitolu 3.5), **prepíš COM5 na svoje** a ulož (**Ctrl+S**).
   Alebo tieto dva riadky zmaž – potom PlatformIO nájde dosku samo, prípadne port vyberieš kliknutím na **🔌 Auto** v dolnej lište.

   GroundStation port nastavený nemá, takže dosku nájde samo.

### 5.4 Skompiluj a nahraj

1. Klikni na **✓ Build** v dolnej lište.
   Dole sa otvorí okno **Terminal** a ukazuje priebeh kompilácie. Na konci musí byť:

   ```
   ======== [SUCCESS] Took 12.34 seconds ========
   ```

   Ak je tam **[FAILED]**, nad tým je červeno vypísané, na ktorom riadku je chyba.
2. Klikni na **→ Upload**.
   Uvidíš `Connecting....` a potom percentá `Writing at 0x... (35 %)`. Na konci opäť **[SUCCESS]**.

> 💡 Ak sa to zasekne na `Connecting.......`, **podrž na doske tlačidlo BOOT**, kým sa nezačnú ukazovať percentá, potom ho pusti.

Po nahratí sa program v doske **hneď spustí** a zostane v nej aj po odpojení – pri ďalšom zapnutí (aj z batérie) sa spustí sám.

### 5.5 Pozri, čo doska robí – Serial Monitor

Klikni na **🔌 Serial Monitor** v dolnej lište. Dole sa zobrazí všetko, čo program vypisuje cez `Serial.println(...)`.

> Ak vidíš nezmyselné znaky, je zlá rýchlosť – musí byť **115200** (je nastavená v `platformio.ini` ako `monitor_speed`).
> Ak monitor nič nevypisuje, stlač na doske tlačidlo **EN** (reset) – program sa spustí odznova a uvidíš aj úvodné správy.

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

Monitor zavrieš kliknutím na **🗑 (Kill Terminal)** vpravo hore v okne terminálu alebo klávesmi **Ctrl+C**.

> ⚠️ Pred ďalším **Upload** monitor nemusíš zatvárať – PlatformIO ho zavrie samo. Ale **pred pripojením appky** ho zavrieť musíš (kapitola 6).

### 5.6 Keď zmeníš kód

1. Uprav `src\main.cpp`.
2. Ulož (**Ctrl+S**).
3. Klikni **→ Upload**.

### 5.7 Prepnutie na druhý projekt

Na nahratie GroundStation: **File → Open Folder…** → `cansat\PlatformIO\Projects\GroundStation` a zopakuj kroky 5.3–5.5 (s druhou doskou).

Ak chceš mať oba projekty otvorené naraz, otvor druhý v novom okne: **File → New Window** a v ňom **Open Folder**.

---

## 6. Spustenie webovej appky vo VS Code

1. **File → Open Folder…** → vyber priečinok **`cansat\cansat-app`**.
2. Otvor terminál: **Terminal → New Terminal** (**Ctrl+ö**, na anglickej klávesnici **Ctrl+`**). Dole sa zobrazí okno, kde sa píšu príkazy.
3. Nainštaluj knižnice (len prvýkrát, trvá to chvíľu):

   ```bash
   npm install
   ```

   `npm` je inštalátor balíčkov pre JavaScript – podľa `package.json` stiahne všetko, čo appka potrebuje, do priečinka `node_modules`.
4. Spusti appku:

   ```bash
   npm run dev
   ```

   Vypíše adresu, typicky:

   ```
     ➜  Local:   http://localhost:5173/
   ```

5. Podrž **Ctrl** a klikni na adresu – otvorí sa v prehliadači. Použi **Chrome alebo Edge**.

Appka beží, kým je terminál otvorený – zastavíš ju klávesmi **Ctrl+C** v termináli.

### Pripojenie pozemnej stanice do appky

1. Pripoj GroundStation cez USB.
2. **Zavri Serial Monitor v PlatformIO**, ak beží – port môže naraz používať len jeden program.
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
| V dolnej lište nie sú tlačidlá ✓ → 🔌 | Nemáš otvorený priečinok s `platformio.ini`. Daj **File → Open Folder** a vyber priamo `PlatformIO\Projects\CanSat` (alebo `GroundStation`). Ak sú stále preč, počkaj, kým PlatformIO dokončí inštaláciu (vpravo dole), alebo reštartuj VS Code. |
| `Git: Clone` sa nedá nájsť / „git not found“ | Git nie je nainštalovaný alebo VS Code nebol po inštalácii reštartovaný (kapitola 3.2). Alebo stiahni projekt ako ZIP. |
| `npm` is not recognized | Node.js nie je nainštalovaný, alebo treba reštartovať VS Code (kapitola 3.4). |
| Build hlási chybu pri knižniciach | Klikni **🗑 Clean** a potom znova **✓ Build**. Over pripojenie na internet – knižnice sa sťahujú. |
| Doska sa nenájde / `No serial port found` | Skús iný USB kábel (veľa káblov je len nabíjacích) a iný USB port. Nainštaluj ovládač (kapitola 3.5). Over port v `platformio.ini` (kapitola 5.3). |
| Zasekne sa na `Connecting.......` | Pri nahrávaní podrž tlačidlo **BOOT** na doske. |
| `could not open port 'COM5'` / `Access is denied` | Port používa iný program – zavri Serial Monitor, Arduino IDE, appku v prehliadači alebo druhé okno VS Code. |
| V monitore sú nezmyselné znaky | Zlá rýchlosť – v `platformio.ini` musí byť `monitor_speed = 115200`. |
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

### Bez VS Code (len terminál)

Ak máš PlatformIO nainštalované ako príkaz (`pip install platformio`), v priečinku projektu (`PlatformIO\Projects\CanSat` alebo `GroundStation`):

| Príkaz | Čo robí |
|---|---|
| `pio device list` | ukáže pripojené dosky a ich porty |
| `pio run` | skompiluje |
| `pio run -t upload --upload-port COM5` | skompiluje a nahrá do dosky |
| `pio device monitor --port COM5 --baud 115200` | zobrazí výpis z dosky |

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <LoRa.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>
#include <TinyGPSPlus.h>
#include <math.h>

// ===== I2C BME + MPU =====
#define BME_MPU_SDA 23
#define BME_MPU_SCL 22

// ===== GPS =====
#define GPS_RX 17
#define GPS_TX 16

// ===== LoRa SPI =====
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  5
#define LORA_NSS   27
#define LORA_RST   14
#define LORA_DIO0  26

// ===== SD SPI =====
#define SD_SCK   33
#define SD_MISO  34
#define SD_MOSI  32
#define SD_CS    4

// ===== BUZZER =====
#define BUZZER_PIN 25

// ===== TIME OFFSET =====
#define TIME_OFFSET_HOURS 2

// ===== MPU6500 =====
#define MPU_ADDR         0x68
#define MPU_PWR_MGMT_1   0x6B
#define MPU_ACCEL_XOUT_H 0x3B
#define MPU_GYRO_XOUT_H  0x43
#define MPU_WHO_AM_I     0x75

// ===== SPI OBJEKTY =====
SPIClass loraSPI(VSPI);
SPIClass sdSPI(HSPI);

// ===== OBJEKTY =====
Adafruit_BME680 bme;
TinyGPSPlus gps;
HardwareSerial GPSSerial(2);

// ===== STAV =====
bool bme_ok = false;
bool mpu_ok = false;
bool gps_ok = false;
bool lora_ok = false;
bool sd_ok = false;

// ===== DATA =====
float bmeTemp = NAN, bmeHum = NAN, bmePress = NAN, bmeGas = NAN;
float ax = NAN, ay = NAN, az = NAN;
float gx = NAN, gy = NAN, gz = NAN;

// ===== PACKET =====
uint32_t packetId = 0;

// ===== LANDING / BUZZER =====
bool launched = false;
bool impactDetected = false;
bool landed = false;

float groundAltitude = NAN;
float relativeAltitude = NAN;
float lastRelativeAltitude = NAN;

unsigned long stableStartTime = 0;

// ===== SD FILE =====
const char *logFileName = "/telemetry.csv";

// ===== ALTITUDE HELPER =====
float pressureToAltitudeMeters(float pressure_hPa, float seaLevel_hPa = 1013.25f) {
  if (isnan(pressure_hPa) || pressure_hPa <= 0.0f) return NAN;
  return 44330.0f * (1.0f - pow(pressure_hPa / seaLevel_hPa, 0.1903f));
}

// ===== MPU HELPERS =====
void mpuWriteByte(uint8_t reg, uint8_t data) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(data);
  Wire.endTransmission();
}

bool mpuReadBytes(uint8_t reg, uint8_t count, uint8_t *dest) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);

  if (Wire.endTransmission(false) != 0) return false;

  uint8_t received = Wire.requestFrom((uint8_t)MPU_ADDR, count);
  if (received != count) return false;

  for (uint8_t i = 0; i < count; i++) {
    dest[i] = Wire.read();
  }

  return true;
}

int16_t makeInt16(uint8_t highByte, uint8_t lowByte) {
  return (int16_t)((highByte << 8) | lowByte);
}

// ===== BME688 =====
void setupBME() {
  Serial.println("Testing BME688...");

  Wire.setClock(100000);

  if (!bme.begin(0x77, &Wire)) {
    Serial.println("BME FAIL");
    bme_ok = false;
    return;
  }

  Serial.println("BME begin OK");

  bme.setTemperatureOversampling(BME680_OS_2X);
  bme.setHumidityOversampling(BME680_OS_2X);
  bme.setPressureOversampling(BME680_OS_2X);
  bme.setIIRFilterSize(BME680_FILTER_SIZE_0);

  
  bme.setGasHeater(320, 150);

  bme_ok = true;
  Serial.println("BME OK");
}

void readBME() {
  if (!bme_ok) return;

  if (!bme.performReading()) {
    Serial.println("BME READ FAIL");
    return;
  }

  bmeTemp = bme.temperature;
  bmeHum = bme.humidity;
  bmePress = bme.pressure / 100.0f;
  bmeGas = bme.gas_resistance / 1000.0f;
}

// ===== MPU6500 =====
void setupMPU() {
  Serial.println("Testing MPU6500...");

  uint8_t whoami = 0;

  if (!mpuReadBytes(MPU_WHO_AM_I, 1, &whoami)) {
    Serial.println("MPU FAIL (WHO_AM_I read)");
    mpu_ok = false;
    return;
  }

  Serial.print("MPU WHO_AM_I: 0x");
  Serial.println(whoami, HEX);

  mpuWriteByte(MPU_PWR_MGMT_1, 0x00);
  delay(100);

  uint8_t testData[6];
  if (!mpuReadBytes(MPU_ACCEL_XOUT_H, 6, testData)) {
    Serial.println("MPU FAIL (ACC read)");
    mpu_ok = false;
    return;
  }

  mpu_ok = true;
  Serial.println("MPU OK");
}

void readMPU() {
  if (!mpu_ok) return;

  uint8_t data[14];

  if (!mpuReadBytes(MPU_ACCEL_XOUT_H, 14, data)) {
    Serial.println("MPU READ FAIL");
    return;
  }

  int16_t ax_raw = makeInt16(data[0], data[1]);
  int16_t ay_raw = makeInt16(data[2], data[3]);
  int16_t az_raw = makeInt16(data[4], data[5]);

  int16_t gx_raw = makeInt16(data[8], data[9]);
  int16_t gy_raw = makeInt16(data[10], data[11]);
  int16_t gz_raw = makeInt16(data[12], data[13]);

  ax = ax_raw / 16384.0f;
  ay = ay_raw / 16384.0f;
  az = az_raw / 16384.0f;

  gx = gx_raw / 131.0f;
  gy = gy_raw / 131.0f;
  gz = gz_raw / 131.0f;
}

// ===== GPS =====
void setupGPS() {
  Serial.println("Testing GPS...");
  GPSSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  gps_ok = true;
  Serial.println("GPS OK");
}

void updateGPS() {
  if (!gps_ok) return;

  while (GPSSerial.available()) {
    gps.encode(GPSSerial.read());
  }
}

// ===== LoRa =====
void setupLoRa() {
  Serial.println("Testing LoRa...");

  loraSPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);

  pinMode(LORA_NSS, OUTPUT);
  digitalWrite(LORA_NSS, HIGH);

  pinMode(LORA_RST, OUTPUT);
  digitalWrite(LORA_RST, LOW);
  delay(50);
  digitalWrite(LORA_RST, HIGH);
  delay(100);

  LoRa.setSPI(loraSPI);
  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(433E6)) {
    Serial.println("LoRa FAIL");
    lora_ok = false;
    return;
  }

  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);
  LoRa.setSyncWord(0x12);

  lora_ok = true;
  Serial.println("LoRa OK");
}

void sendLoRaPacket(const String &data) {
  if (!lora_ok) return;

  LoRa.beginPacket();
  LoRa.print(data);
  LoRa.endPacket();
}

// ===== SD =====
void setupSD() {
  Serial.println("Testing SD...");

  sdSPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);

  pinMode(SD_CS, OUTPUT);
  digitalWrite(SD_CS, HIGH);

  if (!SD.begin(SD_CS, sdSPI, 4000000)) {
    Serial.println("SD FAIL");
    sd_ok = false;
    return;
  }

  Serial.println("SD OK");

  if (!SD.exists(logFileName)) {
    File f = SD.open(logFileName, FILE_WRITE);
    if (f) {
      f.println("ID,TIME,BME_T,BME_H,BME_P,BME_G,AX,AY,AZ,GX,GY,GZ,LAT,LON,SAT,ALT,REL_ALT,IMPACT,LANDED");
      f.close();
      Serial.println("CSV header created");
    } else {
      Serial.println("CSV header create FAIL");
    }
  }

  sd_ok = true;
}

void logToSD(const String &data) {
  if (!sd_ok) return;
  File f = SD.open(logFileName, FILE_APPEND);
  if (!f) return;
  
  // Parsuj key=value a zapíš len hodnoty
  String values = "";
  int start = 0;
  while (start < data.length()) {
    int eq = data.indexOf('=', start);
    if (eq == -1) break;
    int comma = data.indexOf(',', eq);
    String val = (comma == -1) ? data.substring(eq + 1) : data.substring(eq + 1, comma);
    if (values.length() > 0) values += ",";
    values += val;
    start = (comma == -1) ? data.length() : comma + 1;
  }
  f.println(values);
  f.close();
}

// ===== LANDING DETECTION =====
void updateLandingDetection() {
  if (!bme_ok || isnan(bmePress)) return;
  if (!mpu_ok || isnan(ax) || isnan(ay) || isnan(az)) return;

  float currentAltitude = pressureToAltitudeMeters(bmePress);
  if (isnan(currentAltitude) || isnan(groundAltitude)) return;

  relativeAltitude = currentAltitude - groundAltitude;

  float accMagnitude = sqrt(ax * ax + ay * ay + az * az);

  if (!launched && relativeAltitude > 15.0f) {
    launched = true;
    Serial.println("LAUNCH DETECTED");
  }

  if (launched && !impactDetected && accMagnitude > 2.5f) {
    impactDetected = true;
    Serial.println("IMPACT DETECTED");
  }

  if (impactDetected && !landed) {
    float altitudeDelta = fabs(relativeAltitude - lastRelativeAltitude);

    bool nearGround = relativeAltitude < 8.0f;
    bool altitudeStable = altitudeDelta < 0.5f;
    bool motionStable = (accMagnitude > 0.85f && accMagnitude < 1.20f);

    if (nearGround && altitudeStable && motionStable) {
      if (stableStartTime == 0) stableStartTime = millis();

      if (millis() - stableStartTime > 5000) {
        landed = true;
        Serial.println("LANDING CONFIRMED");
      }
    } else {
      stableStartTime = 0;
    }
  }

  lastRelativeAltitude = relativeAltitude;
}

void updateBuzzer() {
  if (!landed) {
    digitalWrite(BUZZER_PIN, LOW);
    return;
  }

  static unsigned long lastToggle = 0;
  static bool buzzerState = false;

  if (millis() - lastToggle > 250) {
    lastToggle = millis();
    buzzerState = !buzzerState;
    digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
  }
}

// ===== PACKET =====
String makePacket() {
  String data = "";

  data += "ID=" + String(packetId);

  data += ",TIME=";
  if (gps.time.isValid()) {
    int hourLocal = gps.time.hour() + TIME_OFFSET_HOURS;
    if (hourLocal >= 24) hourLocal -= 24;

    char t[16];
    sprintf(t, "%02d:%02d:%02d", hourLocal, gps.time.minute(), gps.time.second());
    data += String(t);
  } else {
    data += "NA";
  }

  data += ",BME_T=";
  data += isnan(bmeTemp) ? "NA" : String(bmeTemp, 2);

  data += ",BME_H=";
  data += isnan(bmeHum) ? "NA" : String(bmeHum, 2);

  data += ",BME_P=";
  data += isnan(bmePress) ? "NA" : String(bmePress, 2);

  data += ",BME_G=";
  data += isnan(bmeGas) ? "NA" : String(bmeGas, 2);

  data += ",AX=";
  data += isnan(ax) ? "NA" : String(ax, 3);

  data += ",AY=";
  data += isnan(ay) ? "NA" : String(ay, 3);

  data += ",AZ=";
  data += isnan(az) ? "NA" : String(az, 3);

  data += ",GX=";
  data += isnan(gx) ? "NA" : String(gx, 3);

  data += ",GY=";
  data += isnan(gy) ? "NA" : String(gy, 3);

  data += ",GZ=";
  data += isnan(gz) ? "NA" : String(gz, 3);

  data += ",LAT=";
  data += gps.location.isValid() ? String(gps.location.lat(), 6) : "NA";

  data += ",LON=";
  data += gps.location.isValid() ? String(gps.location.lng(), 6) : "NA";

  data += ",SAT=";
  data += gps.satellites.isValid() ? String(gps.satellites.value()) : "NA";

  data += ",ALT=";
  data += gps.altitude.isValid() ? String(gps.altitude.meters(), 2) : "NA";

  data += ",REL_ALT=";
  data += isnan(relativeAltitude) ? "NA" : String(relativeAltitude, 2);

  data += ",IMPACT=";
  data += impactDetected ? "1" : "0";

  data += ",LANDED=";
  data += landed ? "1" : "0";

  return data;
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("=== CANSAT START ===");

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  Wire.begin(BME_MPU_SDA, BME_MPU_SCL);
  Wire.setClock(100000);

  setupBME();
  setupMPU();
  setupGPS();

  setupLoRa();
  setupSD();

  readBME();
  delay(200);
  readBME();

  if (!isnan(bmePress)) {
    groundAltitude = pressureToAltitudeMeters(bmePress);
    lastRelativeAltitude = 0.0f;

    Serial.print("GROUND ALTITUDE SET TO: ");
    Serial.println(groundAltitude, 2);
  } else {
    Serial.println("GROUND ALTITUDE NOT SET");
  }

  Serial.println("=== READY ===");
  Serial.print("BME: ");  Serial.println(bme_ok ? "OK" : "FAIL");
  Serial.print("MPU: ");  Serial.println(mpu_ok ? "OK" : "FAIL");
  Serial.print("GPS: ");  Serial.println(gps_ok ? "OK" : "FAIL");
  Serial.print("LoRa: "); Serial.println(lora_ok ? "OK" : "FAIL");
  Serial.print("SD: ");   Serial.println(sd_ok ? "OK" : "FAIL");
  Serial.println();
}

// ===== LOOP =====
void loop() {
  updateGPS();

  readBME();
  readMPU();

  updateLandingDetection();
  updateBuzzer();

  String packet = makePacket();

  Serial.println(packet);
  sendLoRaPacket(packet);
  logToSD(packet);

  packetId++;

  delay(1000);
}
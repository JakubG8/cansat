#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>

// ===== LoRa PINY =====
#define LORA_SCK  18
#define LORA_MISO 19
#define LORA_MOSI 5
#define LORA_NSS  27
#define LORA_RST  14
#define LORA_DIO0 26

uint32_t packetCount = 0;
unsigned long lastPacketTime = 0;

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("=== GROUND STATION RX START ===");

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);

  pinMode(LORA_RST, OUTPUT);
  digitalWrite(LORA_RST, LOW);
  delay(50);
  digitalWrite(LORA_RST, HIGH);
  delay(50);

  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(433E6)) {
    Serial.println("LoRa FAIL");
    while (true);
  }

  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);
  LoRa.setSyncWord(0x12);

  Serial.println("LoRa OK");
  Serial.println("Waiting for packets...");
}

void loop() {
  int packetSize = LoRa.parsePacket();

  if (packetSize) {
    Serial.println("Data processing...");
    Serial.println("Data confirmed...");
    Serial.println("---- DATA RECEIVED ----");

    packetCount++;
    lastPacketTime = millis();

    String data = "";
    while (LoRa.available()) {
      data += (char)LoRa.read();
    }

    Serial.print("Packet #: ");
    Serial.println(packetCount);
    Serial.print("Length: ");
    Serial.println(packetSize);
    Serial.print("RSSI: ");
    Serial.println(LoRa.packetRssi());
    Serial.print("SNR: ");
    Serial.println(LoRa.packetSnr());
    Serial.print("Payload: ");
    Serial.println(data);
    Serial.println(">>>" + data);
    Serial.println("-----------------------");
  }

  // Status každých 10 sekúnd
  static unsigned long lastStatus = 0;
  if (millis() - lastStatus > 10000) {
    lastStatus = millis();
    Serial.println("=== GROUND STATION STATUS ===");
    Serial.print("LoRa: OK");
    Serial.println();
    Serial.print("Received packets: ");
    Serial.println(packetCount);
    Serial.print("Last packet age [ms]: ");
    Serial.println(lastPacketTime > 0 ? millis() - lastPacketTime : 0);
    Serial.println("=============================");
  }
}
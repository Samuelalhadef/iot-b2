#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <SPIFFS.h>

const char* ssid = "ESP32_TETRIS";
const char* password = "12345678";

WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.printf("[%u] Déconnecté!\n", num);
            break;
        case WStype_CONNECTED:
            {
                Serial.printf("[%u] Connecté!\n", num);
                webSocket.sendTXT(num, "Connected");
            }
            break;
        case WStype_TEXT:
            {
                String message = String((char*)payload);
                Serial.printf("Message reçu: %s\n", message.c_str());
                webSocket.broadcastTXT(payload, length);
            }
            break;
    }
}

String getContentType(String filename) {
    if (filename.endsWith(".html")) return "text/html";
    else if (filename.endsWith(".css")) return "text/css";
    else if (filename.endsWith(".js")) return "application/javascript";
    return "text/plain";
}

void handleRoot() {
    if (SPIFFS.exists("/index.html")) {
        File file = SPIFFS.open("/index.html", "r");
        server.streamFile(file, "text/html");
        file.close();
    } else {
        server.send(404, "text/plain", "404: Not Found");
    }
}

void handleController() {
    if (SPIFFS.exists("/controller.html")) {
        File file = SPIFFS.open("/controller.html", "r");
        server.streamFile(file, "text/html");
        file.close();
    } else {
        server.send(404, "text/plain", "404: Not Found");
    }
}

void handleFile() {
    String path = server.uri();
    Serial.println("handleFile: " + path);
    
    if (SPIFFS.exists(path)) {
        String contentType = getContentType(path);
        File file = SPIFFS.open(path, "r");
        server.streamFile(file, contentType);
        file.close();
    } else {
        server.send(404, "text/plain", "404: Not Found");
    }
}

void setup() {
    Serial.begin(115200);
    
    if (!SPIFFS.begin(true)) {
        Serial.println("Erreur SPIFFS");
        return;
    }

    // Liste les fichiers présents
    File root = SPIFFS.open("/");
    File file = root.openNextFile();
    while(file) {
        Serial.print("Fichier: ");
        Serial.println(file.name());
        file = root.openNextFile();
    }

    WiFi.softAP(ssid, password);
    IPAddress IP = WiFi.softAPIP();
    Serial.print("Point d'accès IP: ");
    Serial.println(IP);

    // Configuration des routes
    server.on("/", HTTP_GET, handleRoot);
    server.on("/controller", HTTP_GET, handleController);
    server.on("/styles.css", HTTP_GET, []() { handleFile(); });
    server.on("/tetris.js", HTTP_GET, []() { handleFile(); });

    server.onNotFound([]() {
        handleFile();
    });

    // Démarrage des serveurs
    server.begin();
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);

    Serial.println("Serveur HTTP et WebSocket démarrés");
}

void loop() {
    webSocket.loop();
    server.handleClient();
}
from machine import Pin, ADC, UART
import time

capteur1 = ADC(Pin(26))  # GP26 = ADC0
capteur2 = ADC(Pin(27))  

# Configuration UART
uart = UART(1, baudrate=9600, tx=Pin(8), rx=Pin(9))

def send_command(command, param=0):
    """
    Envoie une commande au module MP3-TF-16P avec checksum.
    """
    packet = bytearray([
        0x7E,  # Start byte
        0xFF,  # Version
        0x06,  # Length
        command,  # Command
        0x00,  # Feedback (0x00 = pas de retour)
        (param >> 8) & 0xFF,  # High byte du paramètre
        param & 0xFF,  # Low byte du paramètre
    ])
    
    # Calcul du checksum (somme des valeurs inversée)
    checksum = -(sum(packet[1:]) & 0xFFFF)
    packet.append((checksum >> 8) & 0xFF)
    packet.append(checksum & 0xFF)
    packet.append(0xEF)  # End byte
    
    uart.write(packet)
    time.sleep(0.1)  # Pause pour laisser le module traiter la commande

def play_track(track_number):
    """
    Joue un fichier audio depuis la carte SD.
    """
    print(f"Playing track: {track_number}")
    send_command(0x03, track_number)

def set_volume(volume):
    """
    Définit le volume (0-30).
    """
    if 0 <= volume <= 30:
        print(f"Setting volume to: {volume}")
        send_command(0x06, volume)
    else:
        print("Volume hors limite (0-30)")

def stop_playback():
    """
    Arrête la lecture audio.
    """
    print("Stopping playback")
    send_command(0x16)

set_volume(30)
while True:

    capteur1Value = capteur1.read_u16()
    if capteur1Value > 4000:
        play_track(1)
    else:
        stop_playback()
    
    capteur2Value = capteur2.read_u16()
    if capteur2Value > 4000:
        play_track(2)
    else:
        stop_playback()
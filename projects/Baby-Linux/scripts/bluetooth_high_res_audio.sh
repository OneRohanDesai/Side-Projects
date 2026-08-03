#!/bin/bash

# Detect the Bluetooth card automatically
BT_CARD=$(pactl list cards short | grep bluez_card | awk '{print $2}')

if [ -z "$BT_CARD" ]; then
    notify-send "Bluetooth" "No Bluetooth headset detected!"
    exit 1
fi

# Switch to A2DP mode
pactl set-card-profile "$BT_CARD" a2dp-sink

notify-send "Audio Mode" "Switched to HIGH-QUALITY A2DP 🎧"

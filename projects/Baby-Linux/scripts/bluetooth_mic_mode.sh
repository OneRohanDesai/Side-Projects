#!/bin/bash

# Detect the Bluetooth card automatically
BT_CARD=$(pactl list cards short | grep bluez_card | awk '{print $2}')

if [ -z "$BT_CARD" ]; then
    notify-send "Bluetooth" "No Bluetooth headset detected!"
    exit 1
fi

# Switch to mic mode (mSBC if available)
pactl set-card-profile "$BT_CARD" headset-head-unit

notify-send "Audio Mode" "Switched to MIC MODE 🎤 (HFP/mSBC)"

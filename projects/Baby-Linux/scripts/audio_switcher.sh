#!/bin/bash

# Ensure Bluetooth and internal speakers are properly loaded
pactl load-module module-switch-on-port-available 2>/dev/null

# Get all available sinks
ALL_SINKS=$(pactl list short sinks | awk '{print $2}')

# Ensure Bluetooth headphones, speakers, wired headphones, and HDMI1 are included
POSSIBLE_SINKS=$(echo "$ALL_SINKS" | grep -iE 'headphones|speaker|analog|internal|bluetooth|bluez|hdmi1')

# Manually add Bluetooth sink if it's missing but device is connected
if pactl list cards | grep -qi bluez && ! echo "$POSSIBLE_SINKS" | grep -qi bluez; then
    BT_SINK=$(pactl list sinks short | grep bluez | awk '{print $2}')
    if [ -n "$BT_SINK" ]; then
        POSSIBLE_SINKS="$POSSIBLE_SINKS"$'\n'"$BT_SINK"
    fi
fi

# Manually add HDMI1 sink if it's missing but exists
HDMI1_SINK=$(echo "$ALL_SINKS" | grep -i 'hdmi1')
if [ -n "$HDMI1_SINK" ]; then
    POSSIBLE_SINKS="$POSSIBLE_SINKS"$'\n'"$HDMI1_SINK"
fi

# If filtering removes all options, show everything
if [ -z "$POSSIBLE_SINKS" ]; then
    POSSIBLE_SINKS="$ALL_SINKS"
fi

# Debug: Print all detected sinks
echo "Detected sinks: $POSSIBLE_SINKS" | tee /tmp/audio_sink_debug.log

# Show selection in rofi
SELECTED_SINK=$(echo "$POSSIBLE_SINKS" | rofi -dmenu -p "Select Audio Sink")

# If a sink was selected, switch to it and disable others
if [ -n "$SELECTED_SINK" ]; then
    pactl set-default-sink "$SELECTED_SINK"

    # Move all audio streams to the selected sink
    pactl list short sink-inputs | awk '{print $1}' | while read -r input; do
        pactl move-sink-input "$input" "$SELECTED_SINK"
    done

    notify-send "Audio Sink" "Switched to $SELECTED_SINK"
fi

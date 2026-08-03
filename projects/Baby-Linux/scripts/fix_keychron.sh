#!/usr/bin/env bash

DEVICE_NAME="Keychron K2"

echo "== Restarting Bluetooth =="
sudo systemctl restart bluetooth

sleep 3

echo "== Reloading HID modules =="

sudo modprobe -r hid_apple 2>/dev/null
sudo modprobe -r hid_generic 2>/dev/null
sudo modprobe -r uhid 2>/dev/null

sleep 1

sudo modprobe uhid
sudo modprobe hid_generic

sleep 2

echo "== Finding keyboard MAC =="

MAC=$(bluetoothctl devices | grep "$DEVICE_NAME" | awk '{print $2}')

if [ -z "$MAC" ]; then
    echo "Keyboard not found."
    exit 1
fi

echo "Found: $MAC"

echo "== Connecting keyboard =="

bluetoothctl connect "$MAC"

echo "== Waiting for connection =="

CONNECTED=0

for i in {1..10}; do
    if bluetoothctl info "$MAC" | grep -q "Connected: yes"; then
        CONNECTED=1
        break
    fi

    sleep 1
done

if [ "$CONNECTED" -ne 1 ]; then
    echo "Bluetooth connection failed."
    exit 1
fi

echo "Keyboard connected."

echo "== Waiting for X input device =="

for i in {1..10}; do
    ID=$(xinput list | grep "$DEVICE_NAME" | sed -n 's/.*id=\([0-9]*\).*/\1/p' | head -n1)

    if [ ! -z "$ID" ]; then
        break
    fi

    sleep 1
done

if [ -z "$ID" ]; then
    echo "Keyboard connected but not visible in X yet."
    exit 1
fi

echo "Found X input device ID: $ID"

xinput enable "$ID"

echo "== Keychron recovery complete =="

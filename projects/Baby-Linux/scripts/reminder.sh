#!/usr/bin/env bash

script_dir="$(dirname "$(realpath "$0")")"
schedule_file="$script_dir/schedule.txt"

decimal_to_hhmm() {
    local dec="$1"
    local hour=${dec%.*}
    local frac="0.${dec#*.}"
    local minute
    minute=$(printf "%.0f" "$(echo "$frac * 60" | bc -l)")
    printf "%02d:%02d" "$hour" "$minute"
}

# Prevent repeating popups in the same minute
last_trigger=""

while true; do
    now=$(date +%H:%M)
    today=$(date +%a)   # Sun Mon Tue Wed Thu Fri Sat

    # Decide which timetable to use
    if [[ "$today" == "Sat" ]]; then
        active_block="Sat"
    else
        active_block="Sun-Fri"
    fi

    current_block=""

    while IFS= read -r line; do
        # Trim whitespace
        line="$(echo "$line" | xargs)"

        [[ -z "$line" ]] && continue

        # Detect block headers [Sun-Fri], [Sat]
        if [[ "$line" =~ ^\[.*\]$ ]]; then
            current_block="${line#[}"
            current_block="${current_block%]}"
            continue
        fi

        # Skip lines not in today's block
        [[ "$current_block" != "$active_block" ]] && continue

        # Parse: start-end > message
        IFS=">" read -r range msg <<< "$line"
        range="$(echo "$range" | xargs)"
        msg="$(echo "$msg" | xargs)"

        [[ -z "$range" || -z "$msg" ]] && continue

        start="${range%-*}"
        end="${range#*-}"

        # Convert start time only
        event_time=$(decimal_to_hhmm "$start")

        # Trigger only once per minute
        if [[ "$event_time" == "$now" && "$last_trigger" != "$now" ]]; then
            last_trigger="$now"

            html="
            <html>
            <body style='
                background-color:#000000;
                color:#ffffff;
                margin:0;
                padding:0;
                display:flex;
                align-items:center;
                justify-content:center;
                height:100%;
                font-family:Sans;
                text-align:center;
            '>
                <div style='font-size:42px; font-weight:bold;'>
                    $msg
                </div>
            </body>
            </html>
            "

            echo "$html" | yad --html \
                --undecorated \
                --no-buttons \
                --center \
                --skip-taskbar \
                --on-top \
                --geometry=800x300 \
                --escape-ok \
                --title="Reminder"
        fi

    done < "$schedule_file"

    sleep 60
done

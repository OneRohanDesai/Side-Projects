#!/bin/sh

POP=${POPULATION:-100000}
COUNTRY=$(echo "$COUNTRY" | tr '[:upper:]' '[:lower:]')
CONTINENT=${CONTINENT:-unknown}

mkdir -p /metrics
mkdir -p /events
mkdir -p /state

EVENT_LOG=/events/events.log
POP_FILE=/state/population

touch $EVENT_LOG
echo $POP > $POP_FILE

echo "country_population{country=\"$COUNTRY\",continent=\"$CONTINENT\"} $POP" > /metrics/data

read_pop() {
  cat $POP_FILE
}

write_pop() {
  echo $1 > $POP_FILE
}

log_event() {
  TS=$(date "+%Y-%m-%d %H:%M:%S")
  echo "$TS | $COUNTRY | $1" | tee -a $EVENT_LOG
}

. ./regions.sh
REGION=$(get_region)

(
while true
do

  SEED=$(( $(date +%s) / 30 ))
  R=$((SEED % 20))

  if [ "$REGION" = "caribbean" ] && [ $R -lt 5 ]; then
      log_event "REGIONAL HURRICANE"
      P=$(read_pop)
      P=$((P - P/30))
      write_pop $P
  fi

  if [ "$REGION" = "centralamerica" ] && [ $R -lt 3 ]; then
      log_event "REGIONAL EARTHQUAKE"
      P=$(read_pop)
      P=$((P - P/40))
      write_pop $P
  fi

  if [ "$REGION" = "northamerica" ] && [ $R -lt 2 ]; then
      log_event "REGIONAL WILDFIRE"
      P=$(read_pop)
      P=$((P - P/50))
      write_pop $P
  fi

  sleep 15

done
) &

(
while true
do

  R=$(od -An -N2 -tu2 /dev/urandom | tr -d ' ')
  R=$((R % 100))

  if [ $R -lt 3 ]; then
      log_event "LOCAL EARTHQUAKE"
      P=$(read_pop)
      P=$((P - P/40))
      write_pop $P
  fi

  if [ $R -ge 3 ] && [ $R -lt 6 ]; then
      log_event "LOCAL FLOOD"
      P=$(read_pop)
      P=$((P - P/60))
      write_pop $P
  fi

  if [ $R -ge 6 ] && [ $R -lt 8 ]; then
      log_event "LOCAL HURRICANE"
      P=$(read_pop)
      P=$((P - P/50))
      write_pop $P
  fi

  if [ $R -ge 8 ] && [ $R -lt 10 ]; then
      log_event "MIGRATION SURGE"
      P=$(read_pop)
      P=$((P + P/30))
      write_pop $P
  fi

  sleep 20

done
) &

(
while true
do

  P=$(read_pop)

  CHANGE=$((P / 1000))
  P=$((P + CHANGE))

  write_pop $P

  echo "country_population{country=\"$COUNTRY\",continent=\"$CONTINENT\"} $P" > /metrics/data

  sleep 10

done
) &

python3 - <<'EOF'
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/metrics":
            try:
                with open("/metrics/data") as f:
                    data = f.read()
            except:
                data = ""

            self.send_response(200)
            self.send_header("Content-Type","text/plain; version=0.0.4")
            self.end_headers()
            self.wfile.write(data.encode())
        else:
            self.send_response(404)
            self.end_headers()

HTTPServer(("0.0.0.0",8080), Handler).serve_forever()
EOF
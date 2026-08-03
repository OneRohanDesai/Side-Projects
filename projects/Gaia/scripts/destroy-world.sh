#!/bin/bash
set -e

ROOT="$HOME/Gaia"
cd "$ROOT"

DATE=$(date +%Y-%m-%d_%H-%M-%S)
SIM_DIR="simulations/$DATE"

mkdir -p "$SIM_DIR"

echo "Stopping Gaia simulation..."

echo "Aggregating world data from Prometheus..."

bash scripts/daily-aggregate.sh

echo "Archiving simulation..."

cp dashboard/data.json "$SIM_DIR/final_population.json"

if [ -f logs/events.log ]; then
    cp logs/events.log "$SIM_DIR/events.log"
else
    touch "$SIM_DIR/events.log"
fi


echo "Updating persistent world state..."

STATE_FILE="state/last_state.json"

if [ ! -f "$STATE_FILE" ]; then
    echo "No previous state found. Creating new world state."
    cp dashboard/data.json "$STATE_FILE"

else

jq -n \
--argjson prev "$(cat $STATE_FILE)" \
--argjson new "$(cat dashboard/data.json)" \
'
{
date: $new.date,

countries:
(
($prev.countries + $new.countries)
| group_by(.name)
| map(last)
),

continents:
(
($prev.continents + $new.continents)
| group_by(.name)
| map(last)
),

recent_events:
($prev.recent_events + $new.recent_events)
}
' > state/tmp_state.json

mv state/tmp_state.json "$STATE_FILE"

fi

echo "Uploading results to S3..."

export AWS_PROFILE=1ladybug

aws s3 cp state/last_state.json \
s3://gaia-static-bucket/data.json

echo "Stopping background services..."

pkill -f "port-forward" || true
pkill -f "uvicorn" || true

echo "Deleting Kubernetes clusters..."

for CLUSTER in asia africa europe northamerica southamerica oceania global-control
do
    kind delete cluster --name $CLUSTER
done

rm -f logs/events.log

echo "Simulation archived at:"
echo "$SIM_DIR"
echo "Latest simulation results uploaded to S3."
echo "Gaia world destroyed successfully."
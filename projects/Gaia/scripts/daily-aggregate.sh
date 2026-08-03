#!/bin/bash

DATE=$(date +%F)
OUTPUT="dashboard/data.json"

PROM_PORTS=()

for p in 9091 9092 9093 9094 9095 9096
do
if curl -s "http://localhost:$p/-/ready" >/dev/null 2>&1
then
PROM_PORTS+=($p)
fi
done

TMP="tmp_world_data.json"
> $TMP

for PORT in "${PROM_PORTS[@]}"
do
curl -s "http://localhost:$PORT/api/v1/query?query=country_population" \
| jq -c '.data.result[]' >> $TMP
done

COUNTRIES=$(jq -s '
map({
 name:.metric.country,
 continent:.metric.continent,
 population:(.value[1]|tonumber|floor)
})
' $TMP)

CONTINENTS=$(jq -s '
group_by(.metric.continent)
| map({
 name:.[0].metric.continent,
 population:(map(.value[1]|tonumber|floor)|add)
})
' $TMP)

EVENTS="[]"

if [ -f logs/events.log ]; then

EVENTS=$(cat logs/events.log | jq -R '
select(length>0) |
split(" | ") |
{
 time: .[0],
 country: .[1],
 event: .[2]
}
' | jq -s '.')

fi

STATE="state/last_state.json"

if [ -f "$STATE" ]; then
PREV=$(cat "$STATE")
else
PREV='{"countries":[],"continents":[],"recent_events":[]}'
fi

jq -n \
--arg date "$DATE" \
--argjson prev "$PREV" \
--argjson countries "$COUNTRIES" \
--argjson continents "$CONTINENTS" \
--argjson events "$EVENTS" \
'
{
date:$date,

countries:
(
($prev.countries + $countries)
| group_by(.name)
| map(last)
),

continents:
(
($prev.continents + $continents)
| group_by(.name)
| map(last)
),

recent_events:
($prev.recent_events + $events)
}
' > $OUTPUT


echo "All data aggregated and stored"

rm -f $TMP
#!/bin/bash

set -e

clusters=(
global-control
asia
europe
africa
northamerica
southamerica
oceania
)

for cluster in "${clusters[@]}"
do

echo "Creating cluster $cluster"

kind create cluster \
--name $cluster \
--config kind-config.yaml

done
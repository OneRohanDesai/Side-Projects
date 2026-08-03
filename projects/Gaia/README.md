# Gaia

Gaia is a distributed world population simulation built on top of a multi-cluster Kubernetes environment.

The system models each **country as an independent compute unit running inside its own Kubernetes pod**, while **continents are represented as separate Kubernetes clusters**.

The goal of the project is not to build a scientifically accurate population model, but to explore how **global-scale systems behave when implemented as distributed infrastructure**.

The simulation resembles a production-scale platform where many independent services operate concurrently, expose metrics, and run autonomous processes while being monitored through an observability pipeline.

The entire system runs locally on a single machine and requires **no cloud infrastructure**.
At the end of each simulation run, aggregated results are exported as a JSON snapshot which powers a small dashboard.

This repository contains the full simulator, infrastructure orchestration scripts, monitoring stack, simulation engine, and operational dashboard.

---

# Design Goals

The project was designed with several objectives.

First, to model the world as a **distributed system** where each country behaves independently but participates in a larger global environment.

Second, to demonstrate real operational patterns commonly used in modern infrastructure platforms such as:

* multi-cluster Kubernetes orchestration
* metrics-based observability pipelines
* automated infrastructure provisioning
* distributed workload isolation

Third, to create a **practical environment for experimenting with reliability engineering concepts** such as failure isolation, observability, and automated recovery.

Finally, the system was designed to be **fully reproducible on a developer laptop** without requiring external cloud infrastructure.

---

# Concept

In Gaia, the world is represented as a distributed system composed of many independent components.

Each **country** is implemented as a Kubernetes pod running a lightweight simulation process.

Each **continent** is represented as its own Kubernetes cluster.

A **global control cluster** hosts shared infrastructure services such as monitoring and the operational dashboard.

High level structure:

```
                Local Control Dashboard
                   (FastAPI + JS UI)
                           |
                           |
                   Observability Layer
                 Prometheus + Grafana
                           |
 -------------------------------------------------------------
 |           |           |           |           |           |
Asia       Africa       Europe    NorthAmerica SouthAmerica  Oceania
cluster    cluster      cluster      cluster      cluster     cluster
 |           |           |           |           |           |
country pods country pods country pods country pods country pods country pods
```

Each country pod performs three tasks:

1. maintain internal population state
2. publish metrics for monitoring
3. run an autonomous disaster simulation engine

---

# Simulation Model

Each country runs a small process that continuously updates its population.

Population growth is applied periodically using a configurable growth rate.

Example update cycle:

```
population = population + growth_rate
```

External events can modify population through predefined effects such as disasters or migration.

The simulation intentionally uses simple rules in order to keep the focus on **infrastructure behavior rather than demographic accuracy**.

---

# Event System

Population changes are influenced by **autonomous disaster engines running inside each country pod**.

Two types of events exist.

### Local disasters

Random events affecting a single country.

Examples:

* earthquake
* flood
* migration surge

### Regional disasters

Events affecting multiple countries within the same geographic region.

Examples:

* Caribbean hurricanes
* Pacific cyclones
* regional earthquakes

Regions are defined in:

```
apps/country-simulator/regions.sh
```

These events occur automatically during the simulation and modify population values accordingly.

---

# Observability

The simulator exposes full observability using **Prometheus and Grafana**.

Each country pod exposes a metrics endpoint containing its current population value.

Example metric:

```
country_population{country="india",continent="asia"}
```

Prometheus instances run inside each continent cluster and scrape the country metrics locally.

Ports assigned to Prometheus instances:

```
Asia           9091
Africa         9092
Europe         9093
North America  9094
South America  9095
Oceania        9096
```

Grafana runs in the global control cluster and aggregates metrics across all Prometheus instances.

This allows visualization of:

* global population
* continent population
* country comparisons
* population trends

---

# Control Dashboard

A local control dashboard provides operational visibility and management.

Backend:

```
FastAPI
```

Frontend:

```
Vanilla JavaScript + CSS
```

Capabilities include:

* viewing cluster status
* listing all country pods
* inspecting country logs
* restarting pods
* scaling country deployments
* monitoring cluster availability

The dashboard acts as a simplified **operations console for the simulated infrastructure platform**.

---

# Infrastructure Layout

Seven clusters are used in the simulation.

```
global-control
asia
africa
europe
northamerica
southamerica
oceania
```

Responsibilities:

### Global control cluster

* Grafana monitoring
* dashboard backend

### Continent clusters

* country simulation pods
* Prometheus monitoring

Each continent cluster contains only the countries belonging to that region.

This architecture mirrors **geographically distributed production deployments**.

---

# Reliability Engineering Features

The system demonstrates several reliability engineering principles.

Multi-cluster isolation ensures failures in one region do not affect others.

Autonomous workloads allow countries to continue operating independently.

Observability pipelines provide visibility into system state.

Automated infrastructure scripts allow deterministic environment creation and teardown.

Failures can be simulated by manually stopping pods or deleting clusters to observe system behavior.

---

# Data Aggregation

At the end of each simulation run, a data aggregation process collects the final system state.

The aggregation script queries Prometheus for population metrics across continent clusters and collects disaster event logs.

The aggregated dataset includes:

* final population of each country
* continent population totals
* recent event history

Example output:

```
{
  "countries":[
    {"name":"India","population":1432000000},
    {"name":"Brazil","population":216000000}
  ],
  "continents":[
    {"name":"Asia","population":4700000000}
  ],
  "recent_events":[
    "Earthquake Japan",
    "Flood Bangladesh"
  ]
}
```

The final JSON snapshot is stored locally and uploaded to an S3 bucket which powers the public dashboard.

---

# System Requirements

Recommended configuration:

```
CPU: 6 cores
RAM: 16 GB
Disk: 10 GB free
```

Minimum configuration:

```
CPU: 4 cores
RAM: 8 GB
```

Running all continent clusters simultaneously requires moderate resources due to Kubernetes and Prometheus overhead.

---

# Installation

Clone the repository.

```
git clone https://git.sr.ht/~username/gaia
cd gaia
```

Install required tools:

```
docker
kubectl
kind
helm
python
```

Create Python environment.

```
python -m venv venv
source venv/bin/activate
pip install -r dashboard/requirements.txt
```

---

# Running the Simulation

Start the full environment.

```
./scripts/create-world.sh
```

The script performs the following operations:

1. start the control dashboard
2. create Kubernetes clusters
3. build the simulation container image
4. load the image into clusters
5. generate Kubernetes manifests
6. deploy country pods
7. start Prometheus instances
8. start Grafana

After startup the following services become available:

```
Dashboard           http://localhost:9000
Grafana             http://localhost:3000

Prometheus Asia     http://localhost:9091
Prometheus Africa   http://localhost:9092
Prometheus Europe   http://localhost:9093
Prometheus NA       http://localhost:9094
Prometheus SA       http://localhost:9095
Prometheus Oceania  http://localhost:9096
```

---

# Stopping the Simulation

To archive results and clean up infrastructure:

```
./scripts/destroy-world.sh
```

This script performs the following steps:

1. aggregate final population metrics
2. collect event history
3. save simulation snapshot
4. upload JSON result to S3
5. stop monitoring services
6. delete all Kubernetes clusters

The entire simulation environment is removed after execution.

---

# Repository Structure

```
apps/
  country-simulator/

dashboard/
  backend/
  frontend/

data/
  countries.yaml

manifests/
  country deployments

observability/
  prometheus
  grafana

scripts/
  create-world.sh
  destroy-world.sh
  generate-manifests.py
  daily-aggregate.sh

simulations/
  archived simulation runs

state/
  last simulation state
```

---

# Potential Extensions

The simulator was designed to allow further experimentation.

Possible extensions include:

* migration modeling between countries
* economic indicators
* infrastructure capacity constraints
* advanced disaster propagation models
* chaos engineering experiments

---

# License

MIT License

---

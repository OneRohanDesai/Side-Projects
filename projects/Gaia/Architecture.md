# Gaia Architecture

This document describes the architectural design of the Gaia distributed simulation platform.

Gaia models the world as a distributed infrastructure system built on top of Kubernetes. Each country operates as an independent compute unit while continents are represented as separate Kubernetes clusters.

The platform is intentionally designed to resemble real multi-region production infrastructure where services operate independently but remain observable through centralized monitoring systems.

The goal of the architecture is not to simulate real population dynamics, but to demonstrate distributed systems patterns such as multi-cluster orchestration, observability pipelines, and autonomous workloads.

---

# System Overview

In Gaia, the world is modeled as a distributed platform composed of many independent components.

Countries run as Kubernetes pods that execute lightweight simulation workloads.
Each pod continuously updates its internal population state and exposes metrics for monitoring.

Continents are modeled as independent Kubernetes clusters.
This separation mimics geographically distributed infrastructure deployments used in real production systems.

A dedicated control cluster hosts shared services such as the operational dashboard and monitoring tools.

High-level architecture:

```
                Control Dashboard
                   (FastAPI)

                Global Monitoring
                     (Grafana)

---------------------------------------------------------------

 Asia       Africa       Europe     NorthAmerica   SouthAmerica   Oceania
cluster     cluster      cluster      cluster        cluster        cluster
   |            |            |            |             |              |

country pods country pods country pods country pods country pods country pods
```

Each continent cluster runs its own simulation workloads and monitoring pipeline while remaining observable from the global control cluster.

Country pods do not communicate directly with each other.
Instead, they operate autonomously and react to internally generated events such as regional disasters.

---

# Cluster Layout

The simulation environment consists of seven Kubernetes clusters created using **kind**.

Clusters:

```
global-control
asia
africa
europe
northamerica
southamerica
oceania
```

Responsibilities are divided between the global control plane and continent clusters.

Global control cluster:

* Grafana monitoring dashboards
* operational control dashboard (FastAPI backend)
* frontend simulation dashboard

Continent clusters:

* country simulation pods
* Prometheus monitoring instance
* metrics scraping pipelines

This architecture mirrors the structure of multi-region infrastructure deployments where services are regionally isolated but globally observable.

---

# Country Pod Design

Each country is implemented as a lightweight container that runs a continuous simulation process.

A country container performs four primary tasks.

Population simulation

The country periodically updates its internal population value using a simple growth model.

Metrics exposure

Each container exposes a Prometheus metrics endpoint that publishes the current population value.

Autonomous disaster simulation

Local and regional disaster events occur automatically within each country pod.

Event logging

Disaster events and state changes are written to local log files and collected during simulation shutdown.

Example responsibilities inside a country container:

```
population update loop
regional disaster engine
local disaster engine
metrics endpoint server
event logger
```

This design allows hundreds of country simulations to run simultaneously while remaining lightweight.

---

# Disaster and Event Simulation

Events in Gaia are generated autonomously by simulation loops running inside each country pod.

Two types of disasters exist.

Local disasters

These events affect a single country.

Examples:

* earthquake
* flood
* migration surge

Regional disasters

These events affect multiple countries within a shared geographic region.

Examples:

* Caribbean hurricanes
* Pacific cyclones
* regional earthquakes

Regions are defined in `regions.sh`, which maps countries to geographic disaster zones.

When a regional event occurs, all countries belonging to the same region apply the population impact simultaneously.

This design allows correlated population changes across multiple countries.

---

# Observability Pipeline

The platform exposes full observability using Prometheus and Grafana.

Each country container exposes a metrics endpoint:

```
/metrics
```

Example metric:

```
country_population{country="india",continent="asia"}
```

Prometheus instances run inside each continent cluster and scrape country metrics locally.

Each cluster runs its own Prometheus instance to ensure monitoring remains region-local.

Prometheus ports:

```
Asia           9091
Africa         9092
Europe         9093
North America  9094
South America  9095
Oceania        9096
```

Grafana runs in the global-control cluster and connects to all Prometheus instances.

This architecture resembles a federated monitoring model used in large distributed systems.

---

# Control Dashboard

A local operational dashboard provides visibility and management capabilities for the simulation.

Backend:

FastAPI

Frontend:

Vanilla JavaScript interface

The dashboard functions as the operational control plane for the simulation.

Capabilities include:

* viewing cluster health
* listing country pods
* inspecting country logs
* restarting pods
* starting or stopping country deployments
* injecting manual events for testing

The dashboard interacts with the Kubernetes API to perform operational tasks.

---

# Data Aggregation

When a simulation run ends, the system aggregates the final state of the world.

The aggregation process queries Prometheus APIs across all continent clusters and collects:

* final population of each country
* continent population totals
* event history generated during the simulation

The results are stored locally in the `simulations/` directory and persisted to a global state file.

Example output:

```
{
  "countries": [...],
  "continents": [...],
  "recent_events": [...]
}
```

The aggregated dataset is also uploaded to an S3 bucket which powers the public dashboard.

---

# Infrastructure Automation

The entire simulation environment is controlled through automation scripts.

create-world.sh

Creates clusters, builds container images, deploys country pods, and starts monitoring services.

destroy-world.sh

Aggregates simulation results, stores historical data, uploads the snapshot to S3, and deletes all clusters.

This approach ensures the entire distributed environment can be reproduced deterministically on any machine.

---

# Design Tradeoffs

The architecture prioritizes simplicity and reproducibility over strict realism.

Key tradeoffs include:

* autonomous disaster simulation instead of complex event streaming systems
* lightweight container workloads instead of full microservices
* region-local monitoring instead of centralized metrics ingestion

These choices allow the entire distributed environment to run on a single developer machine while still demonstrating realistic distributed infrastructure patterns.

---

# Architectural Characteristics

The Gaia architecture demonstrates several distributed systems properties:

* regional infrastructure isolation
* autonomous service workloads
* federated observability pipelines
* infrastructure automation
* deterministic environment creation

These characteristics mirror patterns used in real multi-region infrastructure platforms.

---
# Failure Scenarios

This document describes failure experiments that can be performed within the Gaia simulation environment.

The purpose of these experiments is to observe how the distributed system behaves under failure conditions and to demonstrate operational resilience patterns.

These scenarios resemble reliability testing techniques commonly used in production infrastructure environments.

---

# Overview

Gaia models the world as a distributed infrastructure system composed of many independent components.

Each country runs as an individual Kubernetes workload.
Each continent runs inside its own Kubernetes cluster.

Because these components are loosely coupled, failures in one area should not cascade into other parts of the system.

The following experiments demonstrate how the system behaves when failures occur.

---

# Pod Failure

A single country pod can be deleted to simulate a service failure.

Example:

```
kubectl delete pod india-sim
```

Expected behavior:

* Kubernetes automatically recreates the pod
* Prometheus briefly reports missing metrics
* Population simulation resumes after the pod restarts
* Grafana graphs show a short metric gap

This demonstrates Kubernetes self-healing behavior.

---

# Country Deployment Shutdown

A country deployment can be intentionally stopped.

Example:

```
kubectl scale deployment india-sim --replicas=0
```

Effects:

* Population updates stop for that country
* Prometheus metrics disappear
* Other countries continue running normally
* The overall system remains stable

This demonstrates graceful degradation of individual services.

---

# Country Restart

A country workload can be restarted to simulate a rolling restart.

Example:

```
kubectl delete pod india-sim
```

Expected behavior:

* The pod is recreated automatically
* Population state resumes from the latest internal value
* Monitoring briefly shows missing metrics
* No other countries are affected

---

# Cluster Failure

An entire continent cluster can be removed.

Example:

```
kind delete cluster --name asia
```

Expected system behavior:

* All Asia country pods disappear
* Prometheus queries for Asia fail
* Grafana graphs for Asia show missing data
* Other continent clusters continue operating normally

This demonstrates regional isolation in a multi-cluster architecture.

---

# Monitoring Failure

Prometheus in a continent cluster can be stopped.

Example:

```
kubectl delete pod prometheus
```

Effects:

* Metrics from that region temporarily disappear
* The simulation continues normally
* Country pods remain operational
* Observability is lost but system behavior continues

This demonstrates that observability systems are independent of the simulation workloads.

---

# Disaster Engine Failure

Each country pod runs a disaster simulation engine internally.

If this loop fails, population growth continues but disaster events stop occurring.

Detection methods:

* Grafana graphs show steady growth with no drops
* Pod logs stop showing disaster events

Example log entries normally produced:

```
2026-03-15 | jamaica | REGIONAL HURRICANE
2026-03-15 | mexico | LOCAL FLOOD
```

Recovery:

```
kubectl delete pod <country-pod>
```

The disaster engine restarts automatically when the pod restarts.

---

# High Event Frequency

Disaster probability can be increased to simulate extreme global conditions.

This causes frequent population changes across multiple countries.

Expected observations:

* rapid population drops and recovery
* increased log activity
* Grafana population graphs become volatile

This scenario demonstrates system stability during high simulation activity.

---

# Resource Pressure

Cluster resource usage can be stressed by scaling workloads.

Example:

```
kubectl scale deployment india-sim --replicas=10
```

Effects:

* increased CPU usage
* more pods scheduled by Kubernetes
* Prometheus scraping load increases

This helps evaluate cluster capacity and scheduler behavior.

---

# Network Isolation

Clusters can be temporarily isolated by disabling networking or deleting nodes.

Effects:

* monitoring pipelines may fail
* clusters may temporarily stop communicating
* simulation loops continue locally inside each cluster

This scenario mimics real multi-region infrastructure networking issues.

---

# Observability During Failures

Failures can be observed through Grafana dashboards.

Key metrics to monitor:

* total world population
* continent population totals
* number of active country pods
* missing metrics
* disaster frequency

These dashboards provide insight into system health during failure scenarios.

---

# Operational Lessons

Running these experiments highlights several important distributed system principles.

Regional isolation prevents cascading failures.

Independent workloads improve system resilience.

Monitoring systems provide visibility into infrastructure health.

Automated infrastructure enables predictable recovery.

These principles reflect real operational practices used in distributed infrastructure platforms.

---
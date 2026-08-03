# Failure Scenarios

This document describes controlled failure experiments that can be performed within the **Gaia simulation environment**.

The goal of these scenarios is to observe how a distributed infrastructure behaves when components fail.
These experiments demonstrate common reliability engineering principles such as **self-healing systems, regional isolation, observability, and operational resilience**.

The scenarios can be executed manually using Kubernetes commands or through the control dashboard.

---

# Pod Failure

A single country pod can be terminated to simulate a service crash.

Example:

```
kubectl delete pod india-sim
```

Expected behavior:

• Kubernetes automatically recreates the pod
• Prometheus briefly reports missing metrics
• Population simulation resumes after restart
• Grafana dashboards show a temporary gap in metrics

This demonstrates **Kubernetes self-healing capabilities**.

---

# Country Deployment Shutdown

A country can be intentionally stopped to simulate a service being disabled.

Example:

```
kubectl scale deployment india-sim --replicas=0
```

Expected effects:

• population updates stop for that country
• Prometheus stops scraping metrics for that pod
• other countries continue operating normally

This scenario demonstrates **graceful degradation** in distributed systems.

---

# Cluster Failure

An entire continent cluster can be removed to simulate a regional outage.

Example:

```
kind delete cluster --name asia
```

Expected system behavior:

• all country pods in the affected continent disappear
• Prometheus metrics for that region stop updating
• other continent clusters continue operating normally

This demonstrates **regional isolation**, a key principle of large-scale distributed infrastructure.

---

# Disaster Engine Failure

Each country pod runs an internal disaster simulation loop that generates regional or local population events.

If this loop fails:

• population growth will continue normally
• disaster events will stop occurring for that country
• population graphs will show no sudden drops

Detection method:

Check Grafana population charts or inspect pod logs.

Example:

```
kubectl logs <country-pod>
```

Recovery:

Restart the pod.

```
kubectl delete pod <pod-name>
```

The simulation container will restart and the disaster engine will resume automatically.

This scenario demonstrates **process-level fault recovery inside containerized workloads**.

---

# Monitoring Failure

Prometheus can be stopped in a region to simulate monitoring pipeline failure.

Example:

```
kubectl delete pod prometheus
```

Expected behavior:

• metrics from that region temporarily disappear
• simulation workloads continue running normally
• Grafana dashboards show missing data for that region

This demonstrates that **observability failures do not impact application workloads**.

---

# Resource Pressure

Cluster resources can be stressed by scaling country deployments.

Example:

```
kubectl scale deployment india-sim --replicas=20
```

Expected effects:

• increased CPU and memory usage
• additional pods scheduled across cluster nodes
• Prometheus metrics update frequency increases

This test helps evaluate **cluster scheduling behavior and resource limits**.

---

# Network Partition Simulation

Network isolation can be introduced to simulate cross-cluster connectivity issues.

Potential effects:

• monitoring pipelines may temporarily fail
• cross-cluster observability may degrade
• country simulations continue running locally

This scenario reflects **multi-region network failures commonly seen in distributed systems**.

---

# Observability During Failure

Failures can be monitored through **Grafana dashboards and Prometheus metrics**.

Useful metrics include:

• total world population
• continent population totals
• number of active country pods
• missing metrics or scrape failures

These dashboards provide real-time visibility similar to production monitoring systems.

---

# Operational Lessons

Running these experiments highlights several important distributed system principles.

Regional isolation prevents cascading failures across clusters.

Container orchestration enables automatic recovery from service crashes.

Observability pipelines provide visibility into system behavior during incidents.

Infrastructure automation ensures environments can be recreated reliably.

These principles mirror operational practices used in **large-scale distributed infrastructure platforms**.

---
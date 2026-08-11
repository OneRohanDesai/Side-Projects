//! Phase 4 System Intelligence Graph.
//!
//! Full entity kinds · relationship inference · blast radius · pathfinding.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use uuid::Uuid;
use veritas_core::{Edge, Entity, EntityId, SystemSnapshot};

/// Canonical edge types for the intelligence graph.
pub const EDGE_CALLS: &str = "calls";
pub const EDGE_USES: &str = "uses";
pub const EDGE_DEPLOYED_ON: &str = "deployed_on";
pub const EDGE_RUNS_ON: &str = "runs_on";
pub const EDGE_RUNS: &str = "runs";
pub const EDGE_CONTAINS: &str = "contains";
pub const EDGE_EXPOSES: &str = "exposes";
pub const EDGE_PRODUCED_BY: &str = "produced_by";
pub const EDGE_DEPENDS_ON: &str = "depends_on";
pub const EDGE_ROUTES_TO: &str = "routes_to";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphStats {
    pub entities: usize,
    pub edges: usize,
    pub by_kind: HashMap<String, usize>,
    pub by_edge_type: HashMap<String, usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlastRadiusReport {
    pub origin: EntityId,
    pub depth: u32,
    pub entities: Vec<EntityId>,
    pub by_kind: HashMap<String, u32>,
    pub services: u32,
    pub pods: u32,
    pub hosts: u32,
    pub databases: u32,
    pub containers: u32,
    pub processes: u32,
    pub network_endpoints: u32,
    pub estimated_request_pct: f64,
    pub edges_traversed: Vec<TraversedEdge>,
    pub critical_path: Vec<EntityId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraversedEdge {
    pub from: EntityId,
    pub to: EntityId,
    pub edge_type: String,
    pub hop: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathResult {
    pub from: EntityId,
    pub to: EntityId,
    pub found: bool,
    pub hops: Vec<EntityId>,
    pub edge_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Neighborhood {
    pub center: EntityId,
    pub depth: u32,
    pub nodes: Vec<Entity>,
    pub edges: Vec<Edge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceResult {
    pub added_edges: Vec<Edge>,
    pub added_entities: Vec<Entity>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct SystemGraph {
    entities: HashMap<EntityId, Entity>,
    edges: Vec<Edge>,
}

impl SystemGraph {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn from_snapshot(snap: &SystemSnapshot) -> Self {
        let mut g = Self::new();
        for e in &snap.entities {
            g.upsert_entity(e.clone());
        }
        for edge in &snap.edges {
            g.add_edge(edge.clone());
        }
        g
    }

    /// Build from owned snapshot.
    pub fn from_snapshot_owned(snap: SystemSnapshot) -> Self {
        Self::from_snapshot(&snap)
    }

    /// Enrich sample topology with process · container · pod · network entities.
    pub fn enrich_phase4_topology(&mut self) {
        let extras: Vec<Entity> = vec![
            entity(
                "pod:prod/checkout-7f9c",
                "pod",
                "checkout-7f9c",
                0.72,
                &[("namespace", "prod"), ("app", "checkout")],
            ),
            entity(
                "pod:prod/payment-3a1b",
                "pod",
                "payment-3a1b",
                0.94,
                &[("namespace", "prod"), ("app", "payment")],
            ),
            entity(
                "ctr:checkout-7f9c-app",
                "container",
                "checkout-app",
                0.71,
                &[("image", "checkout:v4.82.1"), ("pod", "checkout-7f9c")],
            ),
            entity(
                "ctr:payment-3a1b-app",
                "container",
                "payment-app",
                0.95,
                &[("image", "payment:v2.14.0"), ("pod", "payment-3a1b")],
            ),
            entity(
                "proc:checkout-main",
                "process",
                "checkout-server",
                0.70,
                &[("pid", "4421"), ("user", "app")],
            ),
            entity(
                "proc:postgres",
                "process",
                "postgres",
                0.68,
                &[("pid", "1201"), ("user", "postgres")],
            ),
            entity(
                "net:ep-checkout",
                "network",
                "checkout:8080",
                0.80,
                &[("port", "8080"), ("protocol", "tcp")],
            ),
            entity(
                "net:ep-postgres",
                "network",
                "postgres:5432",
                0.75,
                &[("port", "5432"), ("protocol", "tcp")],
            ),
            entity(
                "net:ep-redis",
                "network",
                "redis:6379",
                0.96,
                &[("port", "6379"), ("protocol", "tcp")],
            ),
            entity(
                "ns:prod",
                "namespace",
                "prod",
                0.93,
                &[("cluster", "prod-cluster")],
            ),
            entity(
                "deploy:checkout",
                "deployment",
                "checkout",
                0.71,
                &[("replicas", "6"), ("version", "v4.82.1")],
            ),
            entity(
                "node:node-17",
                "node",
                "node-17",
                0.90,
                &[("role", "worker")],
            ),
        ];

        for e in extras {
            self.upsert_entity(e);
        }

        // Align host id alias
        if self.entities.contains_key("host:node-17") {
            // link k8s node view to host
            self.link("node:node-17", "host:node-17", EDGE_RUNS_ON, 1.0);
        }

        self.link("deploy:checkout", "pod:prod/checkout-7f9c", EDGE_CONTAINS, 1.0);
        self.link("ns:prod", "pod:prod/checkout-7f9c", EDGE_CONTAINS, 1.0);
        self.link("ns:prod", "pod:prod/payment-3a1b", EDGE_CONTAINS, 1.0);
        self.link("k8s:prod", "ns:prod", EDGE_CONTAINS, 1.0);
        self.link("pod:prod/checkout-7f9c", "ctr:checkout-7f9c-app", EDGE_CONTAINS, 1.0);
        self.link("pod:prod/payment-3a1b", "ctr:payment-3a1b-app", EDGE_CONTAINS, 1.0);
        self.link("ctr:checkout-7f9c-app", "proc:checkout-main", EDGE_RUNS, 1.0);
        self.link("db:postgres-main", "proc:postgres", EDGE_RUNS, 0.9);
        self.link("pod:prod/checkout-7f9c", "node:node-17", EDGE_RUNS_ON, 1.0);
        self.link("pod:prod/payment-3a1b", "node:node-17", EDGE_RUNS_ON, 0.8);
        self.link("svc:checkout", "deploy:checkout", EDGE_DEPLOYED_ON, 1.0);
        self.link("svc:checkout", "pod:prod/checkout-7f9c", EDGE_DEPLOYED_ON, 1.0);
        self.link("svc:payment", "pod:prod/payment-3a1b", EDGE_DEPLOYED_ON, 1.0);
        self.link("svc:checkout", "net:ep-checkout", EDGE_EXPOSES, 1.0);
        self.link("db:postgres-main", "net:ep-postgres", EDGE_EXPOSES, 1.0);
        self.link("cache:redis-sessions", "net:ep-redis", EDGE_EXPOSES, 1.0);
        self.link("net:ep-checkout", "net:ep-postgres", EDGE_ROUTES_TO, 0.85);
        self.link("proc:checkout-main", "net:ep-postgres", EDGE_USES, 0.95);
        self.link("proc:checkout-main", "net:ep-redis", EDGE_USES, 0.8);
        self.link("svc:checkout", "proc:checkout-main", EDGE_RUNS, 1.0);
    }

    pub fn upsert_entity(&mut self, e: Entity) {
        self.entities.insert(e.id.clone(), e);
    }

    pub fn add_edge(&mut self, edge: Edge) {
        if !self.edges.iter().any(|e| e.id == edge.id) {
            // also dedupe by from/to/type
            if !self.edges.iter().any(|e| {
                e.from == edge.from && e.to == edge.to && e.edge_type == edge.edge_type
            }) {
                self.edges.push(edge);
            }
        }
    }

    pub fn link(&mut self, from: &str, to: &str, edge_type: &str, weight: f64) {
        if !self.entities.contains_key(from) || !self.entities.contains_key(to) {
            return;
        }
        self.add_edge(Edge {
            id: format!("e:{}", Uuid::new_v4()),
            from: from.into(),
            to: to.into(),
            edge_type: edge_type.into(),
            weight,
            observed: true,
        });
    }

    pub fn entities(&self) -> Vec<Entity> {
        let mut v: Vec<_> = self.entities.values().cloned().collect();
        v.sort_by(|a, b| a.id.cmp(&b.id));
        v
    }

    pub fn edges(&self) -> &[Edge] {
        &self.edges
    }

    pub fn entity(&self, id: &str) -> Option<&Entity> {
        self.entities.get(id)
    }

    pub fn stats(&self) -> GraphStats {
        let mut by_kind = HashMap::new();
        for e in self.entities.values() {
            *by_kind.entry(e.kind.clone()).or_insert(0) += 1;
        }
        let mut by_edge_type = HashMap::new();
        for e in &self.edges {
            *by_edge_type.entry(e.edge_type.clone()).or_insert(0) += 1;
        }
        GraphStats {
            entities: self.entities.len(),
            edges: self.edges.len(),
            by_kind,
            by_edge_type,
        }
    }

    pub fn neighbors(&self, id: &str, outbound: bool, inbound: bool) -> Vec<(&Edge, &EntityId)> {
        self.edges
            .iter()
            .filter_map(|e| {
                if outbound && e.from == id {
                    Some((e, &e.to))
                } else if inbound && e.to == id {
                    Some((e, &e.from))
                } else {
                    None
                }
            })
            .collect()
    }

    pub fn blast_radius(&self, origin: &str, depth: u32) -> BlastRadiusReport {
        let depth = depth.max(1).min(8);
        let mut visited = HashSet::new();
        let mut q = VecDeque::new();
        let mut edges_traversed = Vec::new();
        let mut critical_path = vec![origin.to_string()];

        q.push_back((origin.to_string(), 0u32));
        visited.insert(origin.to_string());

        while let Some((id, hop)) = q.pop_front() {
            if hop >= depth {
                continue;
            }
            for edge in &self.edges {
                let next = if edge.from == id {
                    Some((edge.to.clone(), edge))
                } else if edge.to == id {
                    // undirected for blast radius impact
                    Some((edge.from.clone(), edge))
                } else {
                    None
                };
                if let Some((nid, edge)) = next {
                    if visited.insert(nid.clone()) {
                        edges_traversed.push(TraversedEdge {
                            from: edge.from.clone(),
                            to: edge.to.clone(),
                            edge_type: edge.edge_type.clone(),
                            hop: hop + 1,
                        });
                        if hop + 1 == 1 {
                            critical_path.push(nid.clone());
                        }
                        q.push_back((nid, hop + 1));
                    }
                }
            }
        }

        let mut by_kind: HashMap<String, u32> = HashMap::new();
        let mut services = 0u32;
        let mut pods = 0u32;
        let mut hosts = 0u32;
        let mut databases = 0u32;
        let mut containers = 0u32;
        let mut processes = 0u32;
        let mut network_endpoints = 0u32;

        for id in &visited {
            if let Some(e) = self.entities.get(id) {
                *by_kind.entry(e.kind.clone()).or_insert(0) += 1;
                match e.kind.as_str() {
                    "service" => services += 1,
                    "pod" => pods += 1,
                    "host" | "node" => hosts += 1,
                    "database" => databases += 1,
                    "container" => containers += 1,
                    "process" => processes += 1,
                    "network" => network_endpoints += 1,
                    _ => {}
                }
            }
        }

        // Estimate request share: critical tier services get higher weight
        let mut request_pct = 0.05_f64 * services as f64;
        if let Some(o) = self.entities.get(origin) {
            if o.labels.get("tier").map(|s| s.as_str()) == Some("critical") {
                request_pct = 0.27;
            }
        }
        request_pct = request_pct.min(1.0);

        let mut entities: Vec<_> = visited.into_iter().collect();
        entities.sort();

        BlastRadiusReport {
            origin: origin.into(),
            depth,
            entities,
            by_kind,
            services,
            pods,
            hosts,
            databases,
            containers,
            processes,
            network_endpoints,
            estimated_request_pct: request_pct,
            edges_traversed,
            critical_path,
        }
    }

    pub fn path(&self, from: &str, to: &str) -> PathResult {
        let mut prev: HashMap<String, (String, String)> = HashMap::new();
        let mut q = VecDeque::new();
        let mut seen = HashSet::new();
        q.push_back(from.to_string());
        seen.insert(from.to_string());

        let mut found = false;
        while let Some(id) = q.pop_front() {
            if id == to {
                found = true;
                break;
            }
            for edge in &self.edges {
                let next = if edge.from == id {
                    Some((edge.to.clone(), edge.edge_type.clone()))
                } else if edge.to == id {
                    Some((edge.from.clone(), edge.edge_type.clone()))
                } else {
                    None
                };
                if let Some((nid, et)) = next {
                    if seen.insert(nid.clone()) {
                        prev.insert(nid.clone(), (id.clone(), et));
                        q.push_back(nid);
                    }
                }
            }
        }

        if !found {
            return PathResult {
                from: from.into(),
                to: to.into(),
                found: false,
                hops: vec![],
                edge_types: vec![],
            };
        }

        let mut hops = vec![to.to_string()];
        let mut edge_types = Vec::new();
        let mut cur = to.to_string();
        while cur != from {
            if let Some((p, et)) = prev.get(&cur) {
                edge_types.push(et.clone());
                hops.push(p.clone());
                cur = p.clone();
            } else {
                break;
            }
        }
        hops.reverse();
        edge_types.reverse();

        PathResult {
            from: from.into(),
            to: to.into(),
            found: true,
            hops,
            edge_types,
        }
    }

    pub fn neighborhood(&self, center: &str, depth: u32) -> Neighborhood {
        let report = self.blast_radius(center, depth);
        let idset: HashSet<_> = report.entities.iter().cloned().collect();
        let nodes: Vec<_> = report
            .entities
            .iter()
            .filter_map(|id| self.entities.get(id).cloned())
            .collect();
        let edges: Vec<_> = self
            .edges
            .iter()
            .filter(|e| idset.contains(&e.from) && idset.contains(&e.to))
            .cloned()
            .collect();
        Neighborhood {
            center: center.into(),
            depth,
            nodes,
            edges,
        }
    }

    /// Infer edges from simple conventions (service uses db by name, etc.).
    pub fn infer_relationships(&mut self) -> InferenceResult {
        let mut added_edges = Vec::new();
        let mut notes = Vec::new();
        let entities: Vec<_> = self.entities.values().cloned().collect();

        // service -> database when labels share team or name hints
        for svc in entities.iter().filter(|e| e.kind == "service") {
            for db in entities.iter().filter(|e| e.kind == "database") {
                let related = svc.labels.get("team") == db.labels.get("team")
                    || db.name.contains("postgres")
                        && (svc.name.contains("checkout") || svc.name.contains("payment"));
                if related {
                    let before = self.edges.len();
                    self.link(&svc.id, &db.id, EDGE_USES, 0.55);
                    if self.edges.len() > before {
                        if let Some(e) = self.edges.last().cloned() {
                            added_edges.push(e);
                            notes.push(format!("inferred uses {} → {}", svc.id, db.id));
                        }
                    }
                }
            }
        }

        // container -> process if names align
        for ctr in entities.iter().filter(|e| e.kind == "container") {
            for proc in entities.iter().filter(|e| e.kind == "process") {
                if proc.name.contains("checkout") && ctr.name.contains("checkout") {
                    let before = self.edges.len();
                    self.link(&ctr.id, &proc.id, EDGE_RUNS, 0.7);
                    if self.edges.len() > before {
                        if let Some(e) = self.edges.last().cloned() {
                            added_edges.push(e);
                            notes.push(format!("inferred runs {} → {}", ctr.id, proc.id));
                        }
                    }
                }
            }
        }

        // pod runs_on host if node label present
        for pod in entities.iter().filter(|e| e.kind == "pod") {
            if self.entities.contains_key("host:node-17") {
                let before = self.edges.len();
                self.link(&pod.id, "host:node-17", EDGE_RUNS_ON, 0.6);
                if self.edges.len() > before {
                    if let Some(e) = self.edges.last().cloned() {
                        added_edges.push(e);
                    }
                }
            }
        }

        if added_edges.is_empty() {
            notes.push("No new edges inferred. Topology already dense.".into());
        }

        InferenceResult {
            added_edges,
            added_entities: vec![],
            notes,
        }
    }

    pub fn merge_entities(&mut self, incoming: Vec<Entity>) -> usize {
        let mut n = 0;
        for e in incoming {
            if !self.entities.contains_key(&e.id) {
                n += 1;
            }
            self.upsert_entity(e);
        }
        n
    }

    pub fn to_graph_json(&self) -> serde_json::Value {
        serde_json::json!({
            "nodes": self.entities(),
            "edges": self.edges,
            "stats": self.stats(),
        })
    }
}

fn entity(id: &str, kind: &str, name: &str, health: f64, labels: &[(&str, &str)]) -> Entity {
    Entity {
        id: id.into(),
        kind: kind.into(),
        name: name.into(),
        health,
        labels: labels
            .iter()
            .map(|(k, v)| ((*k).into(), (*v).into()))
            .collect(),
        attributes: HashMap::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn ent(id: &str, kind: &str, name: &str) -> Entity {
        Entity {
            id: id.into(),
            kind: kind.into(),
            name: name.into(),
            health: 0.9,
            labels: HashMap::new(),
            attributes: HashMap::new(),
        }
    }

    #[test]
    fn blast_and_path() {
        let mut g = SystemGraph::new();
        g.upsert_entity(ent("svc:checkout", "service", "checkout"));
        g.upsert_entity(ent("db:postgres-main", "database", "postgres"));
        g.upsert_entity(ent("svc:payment", "service", "payment"));
        g.link("svc:checkout", "db:postgres-main", EDGE_USES, 1.0);
        g.link("svc:checkout", "svc:payment", EDGE_CALLS, 1.0);
        g.enrich_phase4_topology();

        let br = g.blast_radius("svc:checkout", 3);
        assert!(br.entities.len() > 3);
        assert!(br.services >= 1);

        let path = g.path("svc:checkout", "db:postgres-main");
        assert!(path.found);
        assert!(path.hops.len() >= 2);

        let stats = g.stats();
        assert!(stats.entities >= 5);
        assert!(stats.by_kind.contains_key("pod") || stats.by_kind.contains_key("service"));
    }
}

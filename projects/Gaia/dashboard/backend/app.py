from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from state import WorldState
from events import EVENTS, EventEngine, EVENT_LOG
from kubernetes import client, config
import os

engine = EventEngine()
world = WorldState()

app = FastAPI(title="Gaia Control")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLUSTERS = [
    "kind-asia",
    "kind-africa",
    "kind-europe",
    "kind-northamerica",
    "kind-southamerica",
    "kind-oceania",
    "kind-global-control",
]


class EventRequest(BaseModel):
    event: str
    country: str
    intensity: float


@app.get("/")
def root():
    return {"system": "Gaia Control", "status": "online"}


@app.get("/countries")
def countries():
    return world.get_countries()


@app.get("/clusters")
def clusters():
    status = []

    for ctx in CLUSTERS:
        try:
            config.load_kube_config(context=ctx)
            v1 = client.CoreV1Api()
            v1.list_pod_for_all_namespaces(limit=1)
            status.append({"name": ctx.replace("kind-", ""), "status": "active"})
        except:
            status.append({"name": ctx.replace("kind-", ""), "status": "inactive"})

    return status


@app.get("/events")
def list_events():
    return EVENTS


@app.get("/events/log")
def event_log():
    return EVENT_LOG[-50:]


@app.post("/events/trigger")
def trigger_event(req: EventRequest):
    return engine.trigger_event(req.event, req.country, req.intensity)


@app.get("/countries/{country}/logs")
def country_logs(country: str):

    pod = world.get_country_pod(country)

    if not pod:
        return {"logs": ["pod not found"]}

    logs = world.k8s.get_pod_logs(pod)

    return {"logs": logs}


@app.post("/countries/{country}/restart")
def restart_country(country: str):

    pod = world.get_country_pod(country)

    if not pod:
        return {"status": "not found"}

    os.system(f"kubectl delete pod {pod}")

    return {"status": "restarted"}


@app.post("/countries/{country}/stop")
def stop_country(country: str):

    os.system(f"kubectl scale deployment {country}-sim --replicas=0")

    return {"status": "stopped"}


@app.post("/countries/{country}/start")
def start_country(country: str):

    os.system(f"kubectl scale deployment {country}-sim --replicas=1")

    return {"status": "started"}

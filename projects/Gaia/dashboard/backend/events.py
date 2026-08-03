import datetime

EVENT_LOG = []

EVENTS = [
    "earthquake",
    "flood",
    "pandemic",
    "drought",
    "war",
    "migration_wave",
    "economic_crash",
    "food_shortage",
    "oil_shock",
]


class EventEngine:

    def trigger_event(self, event, country, intensity):

        timestamp = datetime.datetime.now().strftime("%H:%M:%S")

        log = {
            "time": timestamp,
            "event": event,
            "country": country,
            "intensity": intensity,
        }

        EVENT_LOG.append(log)

        return {"status": "executed", "event": log}

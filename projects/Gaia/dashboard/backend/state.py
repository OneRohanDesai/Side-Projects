from k8s_client import K8sClient


class WorldState:

    def __init__(self):
        self.k8s = K8sClient()

    def get_countries(self):

        pods = self.k8s.list_country_pods()

        countries = []

        for p in pods:

            countries.append(
                {
                    "country": p["country"],
                    "continent": p["continent"],
                    "status": p["status"],
                }
            )

        return countries

    def get_country_pod(self, country):

        pods = self.k8s.list_country_pods()

        for p in pods:

            if p["country"] == country:
                return p["pod"]

        return None

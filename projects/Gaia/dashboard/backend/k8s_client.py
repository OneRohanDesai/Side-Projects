from kubernetes import client, config

CLUSTERS = [
    "kind-asia",
    "kind-africa",
    "kind-europe",
    "kind-northamerica",
    "kind-southamerica",
    "kind-oceania",
]


class K8sClient:

    def list_country_pods(self):

        results = []

        for ctx in CLUSTERS:

            try:

                config.load_kube_config(context=ctx)

                v1 = client.CoreV1Api()

                pods = v1.list_pod_for_all_namespaces()

                for pod in pods.items:

                    name = pod.metadata.name

                    if "-sim" not in name:
                        continue

                    env_country = None
                    env_continent = None

                    try:
                        containers = pod.spec.containers

                        for c in containers:

                            if not c.env:
                                continue

                            for e in c.env:

                                if e.name == "COUNTRY":
                                    env_country = e.value

                                if e.name == "CONTINENT":
                                    env_continent = e.value

                    except:
                        pass

                    results.append(
                        {
                            "pod": name,
                            "country": env_country,
                            "continent": env_continent,
                            "status": pod.status.phase,
                        }
                    )

            except:
                pass

        return results

    def get_pod_logs(self, pod_name, namespace="default", lines=100):

        for ctx in CLUSTERS:

            try:

                config.load_kube_config(context=ctx)

                v1 = client.CoreV1Api()

                logs = v1.read_namespaced_pod_log(
                    name=pod_name, namespace=namespace, tail_lines=lines
                )

                return logs.split("\n")

            except:
                pass

        return ["pod not found"]

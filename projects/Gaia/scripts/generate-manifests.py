import yaml
import os
import shutil

INPUT = "data/countries_runtime.yaml"
BASE_DIR = "manifests/countries"

with open(INPUT) as f:
    data = yaml.safe_load(f)

countries = data

if os.path.exists(BASE_DIR):
    shutil.rmtree(BASE_DIR)

os.makedirs(BASE_DIR, exist_ok=True)

template = """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {name}-sim
  labels:
    app: country-sim
    country: {name}

spec:
  replicas: 1

  selector:
    matchLabels:
      app: country-sim
      country: {name}

  template:
    metadata:
      labels:
        app: country-sim
        country: {name}
        continent: {continent}

    spec:
      containers:
      - name: simulator
        image: gaia/country-sim:latest
        imagePullPolicy: IfNotPresent

        ports:
        - containerPort: 8080
          name: metrics

        resources:
          requests:
            cpu: "5m"
            memory: "8Mi"
          limits:
            cpu: "20m"
            memory: "32Mi"

        env:
        - name: COUNTRY
          value: "{name}"

        - name: CONTINENT
          value: "{continent}"

        - name: POPULATION
          value: "{population}"

        - name: GROWTH_RATE
          value: "{growth}"

        - name: REDIS_HOST
          value: "host.docker.internal"

        - name: REDIS_PORT
          value: "6379"
"""

service_template = """
apiVersion: v1
kind: Service
metadata:
  name: {name}-metrics
  labels:
    app: country-sim
    country: {name}

spec:
  selector:
    app: country-sim
    country: {name}

  ports:
  - name: metrics
    port: 8080
    targetPort: 8080
"""

for c in countries:

    name = c["name"].lower()
    continent = c["continent"].lower()
    population = c["population"]
    growth = c.get("growth_rate", "0.01")

    continent_dir = f"{BASE_DIR}/{continent}"
    os.makedirs(continent_dir, exist_ok=True)

    manifest = template.format(
        name=name, continent=continent, population=population, growth=growth
    )

    path = f"{continent_dir}/{name}.yaml"

    with open(path, "w") as f:
        f.write(manifest)

    service_manifest = service_template.format(name=name)

    service_path = f"{continent_dir}/{name}-svc.yaml"

    with open(service_path, "w") as f:
        f.write(service_manifest)

print(f"Generated {len(countries)} manifests.")

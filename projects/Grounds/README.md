# Grounds

**Local practice arena** for everything in `Practice1.md` and `Practice2.md`:

| Track | Source | Count | Local stand-in |
|-------|--------|------:|----------------|
| **aws** | 50 Days of Cloud | 50 | [LocalStack](https://localstack.cloud) + Terraform |
| **devops** | 100 Days of DevOps | 100 | Linux lab, Git, Docker, Kind, Jenkins, Ansible |
| **sadservers** | sadservers.com-style | 20 | Broken labs you must repair |

No paid cloud required. You solve problems against a small production-style app (**Nimbus**) and local infra that the CLI spins up per scenario.

---

## Quick start

```bash
cd ~/Execution\ rehab/Practice/grounds

# optional: put CLI on PATH for this shell
export PATH="$PWD/bin:$PATH"

# dependency check
grounds doctor

# interactive menu
grounds

# or non-interactive
grounds list aws
grounds start aws-001
# ... solve it ...
grounds verify
grounds stop
```

First scenario that needs heavy images will pull them (LocalStack, Postgres, Jenkins, Kind node images, etc.). Plan disk + a few minutes on first use.

---

## How a session works

1. **Select a problem** (`grounds` menu or `grounds start <id>`).
2. Grounds **starts only the infra that scenario needs** (LocalStack, Nimbus, Linux lab, Kind, Jenkins, Ansible targets, …).
3. Scenario **setup** seeds a broken or empty state and writes a brief under `state/workspaces/<id>/`.
4. You **fix it** the production way (CLI, Terraform, Ansible, kubectl, Docker, bash).
5. Run **`grounds verify`** — automated checks mark progress when you pass.
6. **`grounds stop`** / **`grounds infra down`** tears things down when you are done.

Progress is stored in `progress/progress.json`.

---

## Production app: Nimbus

Multi-service order platform used as the “real” system under practice:

| Service | URL / port | Role |
|---------|------------|------|
| API | http://localhost:8080 | FastAPI orders/products/health |
| Web | http://localhost:3000 | Simple UI |
| Nginx edge | http://localhost:8088 | Reverse proxy |
| Postgres | localhost:5432 | `nimbus` / `nimbus` |
| Redis | localhost:6379 | Cache + job list |
| Worker | (internal) | Redis/SQS consumer |

Source: `app/nimbus/`  
Compose stack: `stacks/nimbus/`  
Kubernetes sample: `app/nimbus/k8s/`

```bash
grounds infra up nimbus
curl -s http://localhost:8080/health | jq
curl -s http://localhost:8080/products | jq
```

---

## Infra map (all local)

```bash
grounds infra up localstack   # AWS APIs on :4566
grounds infra up nimbus       # production app
grounds infra up linux        # Ubuntu lab (SSH :2222, web :8081)
grounds infra up kind         # Kubernetes cluster "grounds"
grounds infra up jenkins      # CI on :18080 (admin/grounds)
grounds infra up ansible      # app01/app02/db01 targets
grounds infra up git          # bare-repo helper
grounds status
grounds infra down            # stop compose stacks
```

**AWS CLI against LocalStack:**

```bash
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566
# or: aws_local s3 ls   (from a shell after `source lib/common.sh`)
```

**Kind:**

```bash
kubectl --context kind-grounds get nodes
```

**Linux lab:**

```bash
docker exec -it grounds-linux-lab bash
# or: grounds shell   (when a linux scenario is active)
```

---

## Scenario coverage

- **170** scenarios in `scenarios/catalog.json` (every Practice1 task + 20 troubleshooting labs).
- **~55** ship with full `setup.sh` + `verify.sh` (core learning path across AWS, DevOps, SRE).
- **Remaining** are scaffolded: objective brief + workspace + soft verify so you can still practice and self-mark.

Fully automated IDs include:

- AWS: `aws-001`, `002`, `004`, `016`, `018`, `023`, `033`, `039`, `042`, `046`, `047`, `048`
- DevOps: users/cron/bash, git, docker, compose, k8s pods/deploys/secrets, ansible, terraform
- SadServers: `sad-001` … `sad-020`

List only implemented ones:

```bash
grounds list | grep -v '·'   # completed show ✓ after verify
jq -r '.scenarios[]|select(.implemented)|.id' scenarios/catalog.json
```

Regenerate catalog after editing Practice1.md:

```bash
python3 tools/generate-catalog.py
python3 tools/write-implemented-scenarios.py   # refresh shipped scripts
```

---

## CLI reference

```
grounds                     Interactive menu
grounds list [track] [q]    aws | devops | sadservers
grounds start <id>
grounds verify [id]
grounds show <id>
grounds hint [id] [level]
grounds shell
grounds stop
grounds status
grounds progress
grounds progress reset
grounds infra up|down|status
grounds doctor
```

---

## Recommended learning path

1. **Linux & bash** — `devops-001`, `004`, `006`, `010` + `sad-001`…`004`
2. **Git** — `devops-021` → `033`
3. **Docker** — `devops-035` → `046`
4. **AWS via LocalStack** — `aws-001` → `048` (S3, IAM, Lambda, SNS/SQS, CFN)
5. **Kubernetes (Kind)** — `devops-048` → `062` + `sad-013`/`014`
6. **Ansible & Terraform** — `devops-082`+ / `094`+
7. **Jenkins** — `devops-068`+ (scaffolded; stack ready on `:18080`)
8. **Harder AWS** — VPC, ALB, RDS, EKS-style on Kind (`aws-027`+)

---

## Layout

```
grounds/
├── bin/grounds           # CLI entrypoint
├── lib/                  # menu, infra, scenario, progress
├── app/nimbus/           # production practice application
├── stacks/               # docker compose + kind config
├── scenarios/
│   ├── catalog.json
│   ├── aws/aws-NNN/
│   ├── devops/devops-NNN/
│   └── sadservers/sad-NNN/
├── state/workspaces/     # your per-scenario work (gitignored)
├── progress/             # completion tracking
├── tools/                # catalog + scenario generators
├── Practice1.md
└── Practice2.md
```

---

## Requirements

- Docker + Compose
- Python 3.10+
- jq, curl, git
- Optional but recommended: `kind`, `kubectl`, `terraform`, `ansible`, `aws` CLI

```bash
grounds doctor
```

---

## Notes on fidelity

LocalStack does **not** perfectly emulate every AWS API (especially EC2 networking, ALB, EKS, RDS). Scenarios are designed so the **workflow and tooling** match production even when the backend is a simulator. Kind replaces EKS; Docker Compose replaces ECS; the Linux lab replaces remote VMs.

When a scenario is scaffold-only, treat the objective as a real ticket: automate it under `state/workspaces/<id>/` and use `grounds verify` to self-certify.

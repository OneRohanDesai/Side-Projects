#!/usr/bin/env python3
"""Generate scenarios/catalog.json + scaffold dirs from Practice1.md + SadServers list."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRACTICE1 = ROOT / "Practice1.md"
OUT = ROOT / "scenarios" / "catalog.json"

# ── Skill / needs inference ─────────────────────────────────────────────────

AWS_SKILL_MAP = [
    (r"key pair|ssh key", ["ec2", "ssh"], ["localstack"], "easy"),
    (r"security group", ["ec2", "networking", "security"], ["localstack"], "easy"),
    (r"subnet", ["vpc", "networking"], ["localstack"], "easy"),
    (r"s3.*version|versioning", ["s3"], ["localstack"], "easy"),
    (r"gp3|ebs volume creation", ["ebs", "ec2"], ["localstack"], "easy"),
    (r"instance launch|ec2 instance launch", ["ec2"], ["localstack"], "easy"),
    (r"instance type", ["ec2"], ["localstack"], "easy"),
    (r"stop protection|termination protection", ["ec2"], ["localstack"], "easy"),
    (r"elastic ip", ["ec2", "networking"], ["localstack"], "medium"),
    (r"network interface|eni", ["ec2", "networking"], ["localstack"], "medium"),
    (r"ebs volume attachment|volume attachment", ["ebs", "ec2"], ["localstack"], "medium"),
    (r"ami creation", ["ec2", "ami"], ["localstack"], "medium"),
    (r"instance termination", ["ec2"], ["localstack"], "easy"),
    (r"snapshot", ["ebs", "backup"], ["localstack"], "easy"),
    (r"iam user", ["iam"], ["localstack"], "easy"),
    (r"iam group", ["iam"], ["localstack"], "easy"),
    (r"iam policy|read-only iam|policy attachment", ["iam"], ["localstack"], "medium"),
    (r"iam role", ["iam", "ec2"], ["localstack"], "medium"),
    (r"secure ssh", ["ec2", "ssh", "security"], ["localstack", "linux"], "medium"),
    (r"s3 bucket data migration|s3.*cli", ["s3", "cli"], ["localstack"], "medium"),
    (r"application load balancer|load balanc", ["elb", "ec2"], ["localstack", "nimbus"], "hard"),
    (r"cloudwatch", ["cloudwatch", "monitoring"], ["localstack"], "medium"),
    (r"nginx", ["nginx", "ec2"], ["nimbus", "linux"], "medium"),
    (r"public vpc|private vpc|vpc configuration|vpc peering|nat ", ["vpc", "networking"], ["localstack"], "hard"),
    (r"ecr", ["ecr", "docker"], ["localstack", "docker"], "medium"),
    (r"rds", ["rds", "database"], ["localstack", "nimbus"], "hard"),
    (r"lambda", ["lambda", "serverless"], ["localstack"], "medium"),
    (r"ecs|containerized application deployment with ecs", ["ecs", "docker"], ["localstack", "docker", "nimbus"], "hard"),
    (r"static website|s3.*hosting", ["s3", "static"], ["localstack"], "easy"),
    (r"troubleshooting.*connectivity", ["networking", "debug"], ["nimbus", "linux"], "hard"),
    (r"kms|encryption", ["kms", "security"], ["localstack"], "medium"),
    (r"dynamodb|nosql", ["dynamodb"], ["localstack"], "medium"),
    (r"eks|kubernetes cluster", ["eks", "kubernetes"], ["kind", "nimbus"], "hard"),
    (r"auto scaling", ["asg", "ec2"], ["localstack", "nimbus"], "hard"),
    (r"event-driven|s3 and lambda", ["s3", "lambda", "events"], ["localstack"], "medium"),
    (r"sqs|sns|messaging", ["sqs", "sns"], ["localstack"], "medium"),
    (r"cloudformation", ["cloudformation", "iac"], ["localstack"], "hard"),
    (r"audit logging|centralized", ["cloudtrail", "logs"], ["localstack"], "hard"),
    (r"storage expansion", ["ebs", "ec2"], ["localstack", "linux"], "medium"),
]

DEVOPS_SKILL_MAP = [
    (r"user creation|temporary user|non-interactive shell", ["linux", "users"], ["linux"], "easy"),
    (r"root ssh|ssh authentication|ssh access", ["linux", "ssh", "security"], ["linux"], "medium"),
    (r"script permission|permission management", ["linux", "permissions"], ["linux"], "easy"),
    (r"selinux", ["linux", "security"], ["linux"], "medium"),
    (r"cron", ["linux", "cron"], ["linux"], "easy"),
    (r"ansible installation", ["ansible"], ["linux", "ansible"], "easy"),
    (r"mariadb|mysql troubleshooting", ["database", "debug"], ["linux", "nimbus"], "medium"),
    (r"bash scripting", ["bash", "scripting"], ["linux"], "easy"),
    (r"tomcat", ["java", "tomcat"], ["linux", "docker"], "medium"),
    (r"network services|iptables|firewall", ["linux", "networking", "security"], ["linux"], "medium"),
    (r"process troubleshooting", ["linux", "debug"], ["linux"], "medium"),
    (r"ssl.*nginx|nginx.*ssl", ["nginx", "tls"], ["nimbus", "linux"], "medium"),
    (r"nginx load balancer", ["nginx", "lb"], ["nimbus"], "medium"),
    (r"postgresql|database server", ["postgres", "database"], ["nimbus", "linux"], "medium"),
    (r"web application deployment", ["deploy", "web"], ["nimbus"], "medium"),
    (r"php-fpm", ["nginx", "php"], ["linux"], "medium"),
    (r"git repository|git clone|git fork|git branch|git merge|git remote|revert|cherry-pick|pull request|hard reset|stash|rebase|merge conflict|git hook",
     ["git"], ["git"], "easy"),
    (r"docker installation|docker service", ["docker"], ["docker", "linux"], "easy"),
    (r"nginx container|docker container|file transfer to docker|docker image|dockerfile|docker network|docker port|docker compose|docker exec",
     ["docker"], ["docker", "nimbus"], "medium"),
    (r"python application deployment with docker", ["docker", "python"], ["docker", "nimbus"], "medium"),
    (r"kubernetes|k8s|pod deployment|rolling update|rollback|volume|sidecar|init container|secret|persistent volume|grafana.*kubernetes|redis.*kubernetes|mysql.*kubernetes|guest book",
     ["kubernetes"], ["kind", "nimbus"], "hard"),
    (r"jenkins", ["jenkins", "ci"], ["jenkins"], "medium"),
    (r"ansible inventory|ansible playbook|ansible ping|ansible.*module|jinja2|ansible conditional|package installation with ansible|service management using ansible|acl management",
     ["ansible"], ["ansible"], "medium"),
    (r"terraform|vpc creation using terraform|security group.*terraform|ec2.*terraform|iam policy.*terraform|cloudwatch.*terraform",
     ["terraform", "iac"], ["localstack"], "medium"),
    (r"environment variable", ["linux", "env"], ["linux"], "easy"),
]

SADSERVERS = [
    ("sad-001", "Broken Nginx — connection refused", "easy",
     "Nginx is installed but not serving on port 80. Restore the site.",
     ["linux", "nginx", "debug"], ["linux", "nimbus"]),
    ("sad-002", "Disk full — can't write logs", "easy",
     "Application can't write logs because the disk is full (or inode exhaustion). Free space without deleting critical data.",
     ["linux", "disk", "debug"], ["linux"]),
    ("sad-003", "Permission denied on deploy path", "easy",
     "Deploy user cannot write to the app directory. Fix ownership/permissions the least-privilege way.",
     ["linux", "permissions"], ["linux", "nimbus"]),
    ("sad-004", "Cron job not firing", "easy",
     "A backup cron job never runs. Diagnose and fix scheduling/environment issues.",
     ["linux", "cron"], ["linux"]),
    ("sad-005", "SSH lockout risk — fix sshd_config", "medium",
     "sshd is misconfigured (bad PermitRootLogin / PasswordAuthentication / AllowUsers). Fix without locking yourself out.",
     ["linux", "ssh", "security"], ["linux"]),
    ("sad-006", "Port conflict — app won't bind", "easy",
     "Nimbus API fails to start because something else holds port 8080. Identify and resolve.",
     ["linux", "networking", "debug"], ["linux", "nimbus"]),
    ("sad-007", "DNS resolution broken in container", "medium",
     "Container can't resolve external hostnames. Fix resolv.conf / Docker DNS.",
     ["docker", "dns", "debug"], ["docker", "nimbus"]),
    ("sad-008", "Postgres auth failed", "medium",
     "App returns 500; Postgres rejects credentials after a secret rotation went wrong.",
     ["postgres", "debug"], ["nimbus"]),
    ("sad-009", "OOM killer struck the worker", "medium",
     "Background worker keeps dying. Find OOM evidence and constrain / fix memory use.",
     ["linux", "memory", "debug"], ["linux", "nimbus"]),
    ("sad-010", "TLS certificate expired", "medium",
     "Nginx serves expired self-signed cert. Issue a new local cert and reload safely.",
     ["nginx", "tls"], ["nimbus", "linux"]),
    ("sad-011", "Half-open firewall", "medium",
     "iptables allows SSH but blocks app traffic asymmetrically. Restore correct rules.",
     ["linux", "firewall"], ["linux"]),
    ("sad-012", "Docker zombie — container restart loop", "medium",
     "A compose service is crash-looping. Use logs/inspect to find the root cause and fix the image/config.",
     ["docker", "debug"], ["docker", "nimbus"]),
    ("sad-013", "Kubernetes CrashLoopBackOff", "hard",
     "Nimbus pod on Kind is CrashLoopBackOff. Diagnose events, logs, probes, and config.",
     ["kubernetes", "debug"], ["kind", "nimbus"]),
    ("sad-014", "Kubernetes service has no endpoints", "hard",
     "Service selector doesn't match pods. Traffic fails. Fix labels/selectors.",
     ["kubernetes", "networking"], ["kind"]),
    ("sad-015", "Time drift breaks JWT auth", "hard",
     "Auth tokens invalid due to clock skew in the lab container. Fix time sync.",
     ["linux", "time", "security"], ["linux", "nimbus"]),
    ("sad-016", "SQS consumer lag (LocalStack)", "medium",
     "Messages pile up; worker not consuming. Fix queue URL/permissions/env.",
     ["sqs", "debug"], ["localstack", "nimbus"]),
    ("sad-017", "S3 access denied after IAM change", "medium",
     "App lost S3 access after policy edit. Restore least-privilege access.",
     ["s3", "iam", "debug"], ["localstack", "nimbus"]),
    ("sad-018", "Load balancer health checks failing", "hard",
     "ALB/nginx upstream health checks fail. App is up but health path wrong.",
     ["lb", "nginx", "debug"], ["nimbus"]),
    ("sad-019", "Git detached HEAD on deploy server", "easy",
     "Deploy server is in detached HEAD; releases can't pull. Fix branch tracking.",
     ["git", "deploy"], ["git", "linux"]),
    ("sad-020", "Ansible unreachable hosts", "medium",
     "Playbook fails on unreachable inventory hosts. Fix SSH keys/inventory.",
     ["ansible", "ssh"], ["ansible"]),
]


def infer_aws(title: str):
    t = title.lower()
    for pat, skills, needs, diff in AWS_SKILL_MAP:
        if re.search(pat, t):
            return skills, needs, diff
    return ["aws"], ["localstack"], "medium"


def infer_devops(title: str):
    t = title.lower()
    for pat, skills, needs, diff in DEVOPS_SKILL_MAP:
        if re.search(pat, t):
            return skills, needs, diff
    return ["linux"], ["linux"], "medium"


def parse_practice1() -> list[dict]:
    text = PRACTICE1.read_text(encoding="utf-8")
    scenarios: list[dict] = []
    section = None
    for line in text.splitlines():
        if "50 Days of Cloud" in line:
            section = "aws"
            continue
        if "100 Days of DevOps" in line:
            section = "devops"
            continue
        m = re.match(r"\*\*Task\s+(\d+):\*\*\s+(.+)$", line.strip())
        if not m or not section:
            continue
        num = int(m.group(1))
        title = m.group(2).strip()
        if section == "aws":
            sid = f"aws-{num:03d}"
            skills, needs, diff = infer_aws(title)
            objective = (
                f"Complete the AWS task «{title}» using LocalStack (and Terraform/CLI where appropriate). "
                f"Operate against the local Nimbus production stack when the task involves app hosting, "
                f"load balancing, storage, or IAM for workloads."
            )
            track = "aws"
        else:
            sid = f"devops-{num:03d}"
            skills, needs, diff = infer_devops(title)
            objective = (
                f"Complete the DevOps task «{title}» entirely on local infrastructure. "
                f"Use the Linux lab, Git lab, Docker, Kind, Jenkins, or Ansible targets as required. "
                f"Prefer automating the fix so it could ship to production."
            )
            track = "devops"
        scenarios.append(
            {
                "id": sid,
                "track": track,
                "number": num,
                "title": title,
                "objective": objective,
                "skills": skills,
                "needs": needs,
                "difficulty": diff,
                "implemented": False,
                "source": "Practice1.md",
            }
        )
    return scenarios


def implemented_set() -> set[str]:
    """IDs we ship with real setup/verify scripts."""
    return {
        # AWS core path
        "aws-001", "aws-002", "aws-004", "aws-016", "aws-018", "aws-023",
        "aws-033", "aws-039", "aws-042", "aws-046", "aws-047", "aws-048",
        # DevOps core path
        "devops-001", "devops-002", "devops-004", "devops-006", "devops-010",
        "devops-021", "devops-024", "devops-025", "devops-033",
        "devops-035", "devops-036", "devops-041", "devops-044", "devops-046",
        "devops-048", "devops-049", "devops-050", "devops-062",
        "devops-082", "devops-086", "devops-094", "devops-095", "devops-096",
        # SadServers (all implemented)
        *[s[0] for s in SADSERVERS],
    }


def scaffold_dirs(scenarios: list[dict]) -> None:
    for sc in scenarios:
        d = ROOT / "scenarios" / sc["track"] / sc["id"]
        d.mkdir(parents=True, exist_ok=True)
        obj = d / "OBJECTIVE.md"
        if not obj.exists():
            obj.write_text(
                f"# {sc['title']}\n\n"
                f"**Track:** {sc['track']}  \n"
                f"**Difficulty:** {sc['difficulty']}  \n"
                f"**Skills:** {', '.join(sc['skills'])}  \n"
                f"**Infra:** {', '.join(sc['needs'])}\n\n"
                f"## Goal\n\n{sc['objective']}\n\n"
                f"## Success criteria\n\n"
                f"- You can demonstrate the end state with CLI output or running services\n"
                f"- Solution artifacts live in `state/workspaces/{sc['id']}/`\n"
                f"- `grounds verify` passes\n",
                encoding="utf-8",
            )


def main() -> None:
    scenarios = parse_practice1()
    impl = implemented_set()
    for sid, title, diff, objective, skills, needs in SADSERVERS:
        scenarios.append(
            {
                "id": sid,
                "track": "sadservers",
                "number": int(sid.split("-")[1]),
                "title": title,
                "objective": objective,
                "skills": skills,
                "needs": needs,
                "difficulty": diff,
                "implemented": True,
                "source": "Practice2.md / sadservers.com style",
            }
        )
    for sc in scenarios:
        if sc["id"] in impl:
            sc["implemented"] = True

    catalog = {
        "version": 1,
        "name": "Grounds",
        "description": "Local practice arena: 50 AWS + 100 DevOps + SadServers troubleshooting",
        "scenarios": scenarios,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    scaffold_dirs(scenarios)
    by_track: dict[str, int] = {}
    impl_count = 0
    for sc in scenarios:
        by_track[sc["track"]] = by_track.get(sc["track"], 0) + 1
        if sc["implemented"]:
            impl_count += 1
    print(f"Wrote {OUT} ({len(scenarios)} scenarios)")
    print(f"  tracks: {by_track}")
    print(f"  fully implemented: {impl_count}")
    print(f"  scaffolded: {len(scenarios) - impl_count}")


if __name__ == "__main__":
    main()

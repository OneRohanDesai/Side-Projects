# **Nexu — AWS DevOps & SRE Infrastructure Project**

**Nexu** is a clean, AWS-native demonstration of DevOps & SRE infrastructure design using Terraform, EKS, ECR, IAM, CloudFront, Lambda, and SNS.
This project focuses on building a production-grade infrastructure foundation — without app-specific complexity — suitable for learning, showcasing, and extending.

It demonstrates how to design, provision, and automate a modern Kubernetes-ready cloud platform entirely through Infrastructure-as-Code.

Outcomes of this project has been placed in this repo in the form of screenshots.

---

## 📌 **Overview**

This project provisions:

* **A secure Terraform backend** (S3 + DynamoDB + KMS)
* **A production-grade VPC** (multi-AZ, public/private subnets, NAT, IGW)
* **An Amazon EKS cluster** (Managed Node Group + Fargate profile)
* **Amazon ECR repositories** (for container deployment)
* **A serverless alert pipeline** (API Gateway → Lambda → SNS)
* **Optional application deployment via Helm charts**
* **A static demo page hosted on CloudFront/S3**
* **A fully written AWS-native CI/CD pipeline** (CodePipeline + CodeBuild)

  * *Note: cannot be deployed in ap-south-1 because CodeStar Connections is not available in this region; Terraform code is included for portability.*

This version intentionally keeps the platform lightweight — **no Prometheus, no Grafana, no ArgoCD**, and no heavy monitoring stacks.

---

# 🧱 **Architecture**

```
Terraform → VPC → EKS → (optional Helm workloads)
                ↳ ECR container registry
                ↳ SNS + Lambda + API Gateway (alert automation)
CloudFront → S3 Static Demo Page
```

---

# ⚙️ **Infrastructure Components**

## 🔐 **Terraform Backend**

Provisioned in `bootstrap-backend/`:

* S3 bucket for Terraform remote state
* DynamoDB table for state locking
* KMS for encryption
* Backend enables consistent, collaborative IaC workflows

---

## 🌐 **Networking**

A production-ready multi-AZ network:

* 3× public subnets
* 3× private subnets
* NAT Gateway for egress from private workloads
* Internet Gateway for public ingress
* Strict route tables
* Security groups based on least privilege

---

## ☸️ **Amazon EKS Cluster**

Deployed via Terraform:

* Fully-managed Amazon EKS control plane
* Managed Node Group (EC2 worker nodes)
* Fargate profile for serverless pod execution
* IAM Roles for Service Accounts (IRSA) enabled
* Kubeconfig KMS-secured

Namespaces created:

```
prod
load
```

---

## 📦 **Amazon ECR**

Used to store container images built locally or via CI/CD:

* `nexu-demo`
* Additional per-service repositories can be created by Terraform or manually

---

# 🔔 **AWS-Native Alerting Pipeline**

This project implements a clean, serverless alerting mechanism:

```
HTTP POST → API Gateway → Lambda → SNS
```

Use cases:

* Application alerts
* Health checks
* External monitoring integrations
* Synthetic checks
* CI/CD failure notifications

Terraform provisions:

* Lambda function
* API Gateway (REST)
* SNS topic
* IAM permissions for execution and publishing

This is intentionally light and AWS-native — no Prometheus/Alertmanager required.

---

# 📦 **Workload Deployment (Optional)**

Two Helm charts are included:

### ✔ Streaming

Minimal placeholder Deployment & Service, configurable via values.

### ✔ Locust

Distributed load generator chart, deployed into the `load` namespace.

You can deploy either with:

```bash
helm install streaming helm/charts/streaming -n prod
helm install locust helm/charts/locust -n load
```

---

# ⚙️ **CI/CD Pipeline (Terraform Code Included — Deployment Blocked in ap-south-1)**

A full AWS-native CI/CD pipeline is included in `terraform/modules/pipeline`, consisting of:

* **CodePipeline**
* **CodeBuild (Build Stage)**
* **CodeBuild (Deploy Stage)**
* **S3 Artifact Storage**
* **ECR repository**
* **IAM roles & policies**

This pipeline performs:

1. Source checkout from SourceHut (via CodeStar Connections)
2. Docker image build
3. Push to ECR
4. Kubernetes deployment via `kubectl apply`

### ⚠️ Important Note

At the time of project development, **AWS CodeStar Connections is *not available* in the ap-south-1 (Mumbai) region**, which means:

* CodePipeline cannot connect to SourceHut/GitHub
* The pipeline cannot be deployed in this region
* All other resources (EKS, VPC, ECR, Lambda) must remain in ap-south-1

**However, the full Terraform pipeline code is included and will work in any region that supports CodeStar Connections — with zero changes.**

This preserves the architecture and design intent while acknowledging AWS regional constraints.

---

# 🗂️ **Repository Structure**

```
Nexu/
├── Components.md                 # Architecture notes
├── README.md                     # Project documentation
├── nexu-static-page.html         # Static demo landing page
├── stream.gif / stream.mp4       # Demo assets
│
├── helm/
│   └── charts/
│       ├── streaming/
│       └── locust/
│
└── terraform/
    ├── backend.tf                # Remote state configuration
    ├── main.tf                   # Root infrastructure module
    │
    ├── bootstrap-backend/        # First-time Terraform backend provisioning
    │   ├── main.tf
    │   ├── provider.tf
    │   └── variables.tf
    │
    └── modules/
        ├── vpc/                  # VPC, subnets, routing, NAT
        ├── eks/                  # EKS cluster + nodegroups + fargate
        └── alerting/             # Lambda + SNS + API Gateway webhook
        └── pipeline/             # CodePipeline + CodeBuild (not deployable in ap-south-1)
```

---

# 🚀 **Deployment Guide**

### 1️⃣ Bootstrap Terraform Backend

```bash
cd terraform/bootstrap-backend
terraform init
terraform apply -auto-approve
```

### 2️⃣ Deploy Infrastructure

```bash
cd ..
terraform init
terraform apply -auto-approve
```

### 3️⃣ Deploy Optional Workloads

```bash
kubectl create ns prod
kubectl create ns load
helm install streaming helm/charts/streaming -n prod
helm install locust helm/charts/locust -n load
```

### 4️⃣ Test Alerting Pipeline

```bash
curl -X POST -d '{"alert": "test"}' \
https://<api-id>.execute-api.ap-south-1.amazonaws.com/prod/alert
```

SNS should receive the message instantly.

---

# 🎯 **What This Project Demonstrates**

### ✔ Infrastructure-as-Code (Terraform)

### ✔ Modern AWS networking & security architecture

### ✔ Amazon EKS deployment foundation

### ✔ ECR-based container lifecycle

### ✔ Helm-based Kubernetes deployments

### ✔ Serverless alert automation

### ✔ CI/CD pipeline design (Terraform code included)

### ✔ CloudFront static site hosting

### ✔ Clean separation of concerns (infra-only project)

---

# 👤 **Author**

**Rohan Desai**
Rajkot, Gujarat, India
📧 `pro.rohandesai@gmail.com`

---
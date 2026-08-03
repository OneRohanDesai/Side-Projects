FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    wget \
    vim \
    nano \
    less \
    sudo \
    openssh-server \
    openssh-client \
    nginx \
    cron \
    iproute2 \
    iputils-ping \
    net-tools \
    iptables \
    dnsutils \
    procps \
    psmisc \
    strace \
    lsof \
    tar \
    gzip \
    unzip \
    git \
    python3 \
    python3-pip \
    python3-venv \
    jq \
    openssl \
    apache2-utils \
    postgresql-client \
    redis-tools \
    mariadb-client \
    acl \
    rsync \
    findutils \
    passwd \
    adduser \
    systemd \
    && rm -rf /var/lib/apt/lists/*

# SSH
RUN mkdir -p /var/run/sshd /var/practice /workspaces \
    && echo 'root:grounds' | chpasswd \
    && sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config \
    && sed -i 's/#PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Practice users (recreated/modified by scenarios)
RUN useradd -m -s /bin/bash student \
    && echo 'student:student' | chpasswd \
    && usermod -aG sudo student \
    && echo 'student ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/student

COPY lab-init.sh /usr/local/bin/lab-init.sh
RUN chmod +x /usr/local/bin/lab-init.sh

WORKDIR /var/practice
EXPOSE 22 80

CMD ["/usr/local/bin/lab-init.sh"]

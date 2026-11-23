# Two independent container hosts for local SSH/harness testing; no claim of
# separate physical machines. Only the selected company's fixtures are copied.
FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv openssh-server ca-certificates \
    && rm -rf /var/lib/apt/lists/* && useradd -m -s /bin/bash researcher \
    && usermod -p '*' researcher && mkdir -p /run/sshd /home/researcher/.ssh /etc/ssh/demo
WORKDIR /srv/research-collab-demo
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev && npm cache clean --force
COPY antigravity/requirements-lock.txt /tmp/requirements.txt
RUN python3 -m venv /opt/antigravity && /opt/antigravity/bin/pip install --no-cache-dir -r /tmp/requirements.txt
COPY src ./src
COPY web ./web
COPY vendor ./vendor
COPY config ./config
COPY antigravity ./antigravity
ARG COMPANY
COPY fixtures/company-${COMPANY} ./fixtures/company-${COMPANY}
COPY deployment/sshd_config /etc/ssh/sshd_config
COPY deployment/start-host.sh /start-host.sh
RUN mkdir -p .local .cache && chown -R researcher:researcher .local .cache /home/researcher/.ssh
CMD ["/bin/sh", "/start-host.sh"]

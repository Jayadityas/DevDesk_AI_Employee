ARG DEVDESK_BASE_IMAGE=node:24-bookworm-slim
FROM ${DEVDESK_BASE_IMAGE}
USER root
RUN if command -v g++ && test -x /usr/bin/chromium && test -f /usr/include/sqlite3.h; then true; else apt-get update && apt-get install -y --no-install-recommends g++ libsqlite3-dev chromium fonts-liberation ca-certificates && rm -rf /var/lib/apt/lists/*; fi
WORKDIR /opt/runner
RUN if test -f node_modules/playwright/package.json && test "$(node -p 'require("./node_modules/playwright/package.json").version')" = '1.64.0'; then true; else npm install --ignore-scripts --no-audit --no-fund playwright@1.64.0; fi
COPY check.mjs /opt/runner/check.mjs
COPY runtime-build.mjs preview.mjs preview-relay.mjs backend-app.mjs backend-checks.mjs /opt/runner/
COPY db-read.cpp /opt/runner/db-read.cpp
RUN g++ -std=c++20 /opt/runner/db-read.cpp -lsqlite3 -o /opt/runner/db-read && chmod -R a-w /opt/runner && mkdir -p /input && chmod 755 /input
USER 10001:10001
ENV HOME=/tmp TMPDIR=/tmp
ENTRYPOINT ["timeout", "--signal=KILL", "150s", "node", "/opt/runner/check.mjs"]

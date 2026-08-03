FROM nginx:1.29-alpine

# Patch OS packages that Trivy reports on the base image.
RUN apk update \
    && apk upgrade --no-cache \
    && rm -rf /var/cache/apk/*

COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1

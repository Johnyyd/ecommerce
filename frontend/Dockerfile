FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

RUN addgroup -g 1000 -S appgroup && adduser -u 1000 -S appuser -G appgroup \
    && mkdir -p /var/cache/nginx /var/run /var/log/nginx /tmp \
    && chown -R appuser:appgroup \
       /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html /tmp /etc/nginx \
    && chmod -R 775 /var/cache/nginx /var/run /var/log/nginx /tmp /etc/nginx \
    && sed -i 's/^user/#user/' /etc/nginx/nginx.conf \
    && sed -i 's|/run/nginx.pid|/tmp/nginx.pid|g' /etc/nginx/nginx.conf \
    && sed -i 's|/var/run/nginx.pid|/tmp/nginx.pid|g' /etc/nginx/nginx.conf

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R appuser:appgroup /usr/share/nginx/html /etc/nginx/conf.d \
    && chmod -R 775 /usr/share/nginx/html /etc/nginx/conf.d

USER appuser
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

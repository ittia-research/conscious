# Nginx reverse proxy for production

FROM nginx:stable-alpine

# Install envsubst (part of gettext package)
RUN apk update && apk add --no-cache gettext

COPY nginx/default.template.conf /etc/nginx/templates/default.template.conf
COPY nginx/nginx.conf /etc/nginx/nginx.conf

COPY nginx/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Default command to run after entrypoint (Nginx itself)
# This will be passed as "$@" to the entrypoint script
CMD ["nginx", "-g", "daemon off;"]

EXPOSE 80
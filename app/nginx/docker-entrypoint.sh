#!/bin/sh
# Generate nginx config file based on template with env variables

# Exit on error
set -e

# Perform variable substitution
envsubst '$${FRONTEND_HOST}' < /etc/nginx/templates/nginx.template.conf > /etc/nginx/conf.d/default.conf

# Print the generated config for debugging
echo "--- Generated Nginx Config (/etc/nginx/conf.d/default.conf) ---"
cat /etc/nginx/conf.d/default.conf
echo "--------------------------------------------------------------"

# Execute the CMD passed to the container (or start Nginx directly)
# Using "exec" ensures Nginx becomes PID 1 and receives signals properly
exec "$@"
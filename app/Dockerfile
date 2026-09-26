FROM nginxinc/nginx-unprivileged:stable-alpine

# Aplica correções de segurança do Alpine que ainda não chegaram na imagem base
USER root
RUN apk upgrade --no-cache
USER 101

COPY default.conf /etc/nginx/conf.d/default.conf
COPY html/ /usr/share/nginx/html/

EXPOSE 8080

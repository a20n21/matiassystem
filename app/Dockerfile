FROM nginxinc/nginx-unprivileged:stable-alpine

# Commit que gerou a imagem (passado pelo CI). O ZAP da hml lê /version.txt para
# publicar o resultado do scan no commit certo do GitHub.
ARG VERSION=local

# Aplica correções de segurança do Alpine que ainda não chegaram na imagem base
USER root
RUN apk upgrade --no-cache \
 && echo "$VERSION" > /usr/share/nginx/html/version.txt
USER 101

COPY default.conf /etc/nginx/conf.d/default.conf
COPY html/ /usr/share/nginx/html/

EXPOSE 8080

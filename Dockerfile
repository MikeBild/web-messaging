FROM node:0.10-onbuild
ADD . /
WORKDIR /
ENTRYPOINT ["node","server.js"]
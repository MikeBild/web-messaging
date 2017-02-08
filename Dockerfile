FROM node:0.10-onbuild
ADD . /
WORKDIR /
RUN npm install
ENTRYPOINT ["node","server.js"]

FROM mhart/alpine-node:6

WORKDIR /app
COPY . /app

EXPOSE 2112
ENTRYPOINT ["node", "src/index.js"]

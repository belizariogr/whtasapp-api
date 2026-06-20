FROM oven/bun:alpine

WORKDIR /usr/app

RUN bun upgrade --canary

EXPOSE 9000

CMD ["bun", "start"]

FROM oven/bun:alpine

WORKDIR /usr/app

EXPOSE 6000

CMD ["bun", "run", "start"]

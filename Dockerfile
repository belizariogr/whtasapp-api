FROM oven/bun:alpine

WORKDIR /usr/app

EXPOSE 9000

CMD ["bun", "start"]

FROM node:14-alpine
RUN npm install -g  @prisma/cli

WORKDIR /proj

# Copy package.json
COPY ./packages/prisma/prisma/postgres.prisma /proj/prisma/schema.prisma
COPY ./packages/prisma/prisma/migrations /proj/prisma/migrations

FROM postgres

COPY ./packages/prisma/init.d/init.sql /docker-entrypoint-initdb.d/
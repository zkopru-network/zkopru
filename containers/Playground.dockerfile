FROM node:13-alpine
WORKDIR /proj
RUN apk add --no-cache git curl make musl-dev go
RUN apk add --no-cache sqlite postgresql-client
RUN apk add --no-cache tmux

# Configure Go
ENV GOROOT /usr/lib/go
ENV GOPATH /go
ENV PATH /go/bin:$PATH

RUN mkdir -p ${GOPATH}/src ${GOPATH}/bin

# Install Glide
RUN go get github.com/yudai/gotty
RUN apk add --no-cache udev ttf-freefont chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

RUN apk add --no-cache --virtual .gyp \
        python \
        make \
        g++ \
    && npm install -g truffle ganache-cli \
    && apk del .gyp

# Install yarn
RUN git clone --depth=1 https://github.com/zkopru-network/zkopru
RUN cd /proj/zkopru && yarn

ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV DATABASE_URL=sqlite:///temp
WORKDIR /proj/zkopru/packages/cli

RUN  ganache-cli --db=/proj/data -i 20200406 -p 5000 --deterministic --host 0.0.0.0 & \
        sleep 5 && cd /proj/zkopru/packages/contracts && truffle migrate --network testnet

COPY keys /proj/zkopru/packages/cli/keys
# RUN  ganache-cli --db=/proj/data -i 20200406 -p 5000 --deterministic --host 0.0.0.0 & \
#         sleep 5 && cd /proj/zkopru/packages/contracts && truffle migrate --network testnet;\
#         cd /proj/zkopru/packages/cli; \
#         gotty -w --port 1234 node /proj/zkopru/packages/cli/dist/apps/coordinator/cli.js \
#         --config /proj/zkopru/packages/cli/coordinator.playground.json & \
#         gotty -w --port 4321 node /proj/zkopru/packages/cli/dist/apps/wallet/cli.js \
#         --config /proj/zkopru/packages/cli/wallet.playground.json & \
#         sleep 5 && echo "Start playground setup" && \
#         /proj/zkopru/node_modules/.bin/ts-node /proj/zkopru/packages/integration-test/utils/playground-setup.ts && \
#         echo "Finished playground setup"

# EXPOSE 4321
# EXPOSE 1234

CMD  ganache-cli --db=/proj/data -i 20200406 -p 5000 --deterministic --host 0.0.0.0 > /dev/null & \
        sleep 1;\
        node /proj/zkopru/packages/cli/dist/apps/coordinator/cli.js \
        --nonInteractive --config /proj/zkopru/packages/cli/coordinator.playground.json > /dev/null & \
        sleep 2;\
        node /proj/zkopru/packages/cli/dist/apps/wallet/cli.js \
        --config /proj/zkopru/packages/cli/wallet.playground.json
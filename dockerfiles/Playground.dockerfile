FROM node:12-stretch-slim
RUN apt update
RUN apt install -y git make musl-dev sqlite g++ python
WORKDIR /proj

RUN npm install -g node-gyp-build
RUN ln -s "$(which nodejs)" /usr/bin/node
RUN npm install -g truffle ganache-cli

# Install yarn
RUN git clone --depth=1 https://github.com/zkopru-network/zkopru

WORKDIR /proj/zkopru
RUN yarn
RUN yarn build

WORKDIR /proj/zkopru/packages/cli

RUN  ganache-cli --db=/proj/data -i 20200406 -p 5000 --deterministic --host 0.0.0.0 & \
        sleep 5 && cd /proj/zkopru/packages/contracts && truffle migrate --network testnet

COPY ./packages/contracts/keys /proj/zkopru/packages/cli/keys

CMD  ganache-cli --db=/proj/data -i 20200406 -p 5000 --deterministic --host 0.0.0.0 > /dev/null & \
        sleep 1;\
        node /proj/zkopru/packages/cli/dist/apps/coordinator/cli.js \
        --nonInteractive --config /proj/zkopru/packages/cli/coordinator.playground.json > /dev/null & \
        sleep 2;\
        node /proj/zkopru/packages/cli/dist/apps/wallet/cli.js \
        --config /proj/zkopru/packages/cli/wallet.playground.json
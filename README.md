# zkopru

[WIP]

## What is zkopru?

[WIP]


## How to run cli-wallet of zkopru?

```shell
npm install -g @zkopru/cli-wallet
zkopru-wallet
```

## How to run coordinator of zkopru?

```shell
npm install -g @zkopru/coordinator
zkopru-wallet --ws
zkopru-coordinator
```

## Development

### Prerequisites

1. You need docker & docker-compose for integration test

    * Get [docker](https://docs.docker.com/get-docker/)
    * Get [docker-compose](https://docs.docker.com/compose/install/)

2. Set your node version v12. It currently supports Node v12.

    * Get nvm [here](https://github.com/nvm-sh/nvm#installing-and-updating)
    * Download node version 12 and set to use it.
      ```shell
      nvm install 12
      nvm use 12
      ```
      If you want to make node 12 as the default option run  && yarn build:keys
      ```shell
      nvm alias default 12
      ```

3. Install yarn globally. You can skip this step if you already have yarn.

    ```shell
    npm install -g yarn
    ```

### Build

1. Install packages

    ```shell
    yarn
    ```

2. Build packages

    ```shell
    yarn build
    ```

### Run

1. Prepare three terminals

2. Run ganache and deploy contract by one-click.

    ```shell
    docker-compose up --build testnet
    ```

3. Go to cooridnator package and run coordinator with a pre-configured test account.

    ```shell
    cd packages/coordinator && yarn dev:config
    ```
    This will give you a cli menu to operate coordinator locally.


4. Go to the cli-wallet package and run wallet with a pre-configured test account.

    ```shell
    cd packages/cli-wallet && yarn dev:config
    ```
    This will give you a cli menu to run cli-wallet locally.


### Optional commands

#### Fresh build

```shell
yarn build:fresh
```

This command will re-build the whole packages by wiping away every artifacts.

#### Setting up new snark keys

```shell
yarn build:keys
```

### Testing

```shell
yarn test
```

### Module dev

```shell
lerna run build --scope=@zkopru/modulename
lerna run test --scope=@zkopru/modulename
```

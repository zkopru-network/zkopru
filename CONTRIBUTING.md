# Contributing to Zkopru👋

Thanks for taking a time to read this document. This document includes how to contribute to the project including testing and commits. 

## Table of Content

* [Security vulnerability](#security-vulnerability)
* [Commit rule](#commit-rule)
* [Style guide](#style-guide)
* [Development](#development)
* [Packages](#packages)

## Security vulnerability

After the mainnet stage, you should not open up issues on Github to report bugs that can affect the network's security.
Mostly, it will be the case when you find some bugs in [`packages/contracts`](./packages/contracts) or [`packages/circuits`](./pacakges/circuits).
In this case, please report the bug via [security@zkopru.network](mailto:security@zkopru.network) instead of opening a public issue on Github.

## Commit rule

This project follows the conventional commit rule.
To check the full specification, please see [https://www.conventionalcommits.org/](https://www.conventionalcommits.org/)
 Here is the sample commits.
 
1. Commit message with description and breaking change footer

    ```
    feat: allow provided config object to extend other configs
    
    BREAKING CHANGE: `extends` key in config file is now used for extending other config files
    ```
2. Commit message with ! to draw attention to breaking change

    ```
    refactor!: drop support for Node 6
    ```

3. Commit message with both ! and BREAKING CHANGE footer

    ```
    refactor!: drop support for Node 6

    BREAKING CHANGE: refactor to use JavaScript features not available in Node 6.
    ```
4. Commit message with no body

    ```
    docs: correct spelling of CHANGELOG
    ```
5. Commit message with scope

    ```
    feat(lang): add polish language
    ```
6. Commit message with multi-paragraph body and multiple footers

    ```
    fix: correct minor typos in code
    
    see the issue for details 
    
    on typos fixed.
    
    Reviewed-by: Z
    Refs #133
    ```

## Style guide

This uses airbnb eslint, and husky will automatically prettify using commit-hook.

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

1. Install & get initial setup for the project

    ```shell
    yarn initialize
    ```

2. Build packages

    ```shell
    yarn build
    ```

3. Run development env

    ```shell
    make develop
    ```

    This command will run the coordinator & cli wallet using docker and you can easily access to the running programs via web browser.
    * coordinator: http://localhost:1234
    * cli wallet: http://localhost:4321

    Or you can setup the environment without docker-compose. Please check ["Manually setup Run cli applications"](#manually-setup-run-cli-applications) section.

### Integration test

```
yarn test
```

### Manually setup Run cli applications

1. Prepare three terminals

2. Run ganache and deploy contract using the following command.

    ```shell
    docker-compose up --build testnet
    ```

3. Go to cli package and run coordinator with a pre-configured test account.

    ```shell
    cd packages/cli && yarn dev:coordinator
    ```
    This will give you a cli menu to operate coordinator locally.


4. Go to the cli package and run wallet with a pre-configured test account.

    ```shell
    cd packages/cli && yarn dev:wallet
    ```
    This will give you a cli menu to run wallet locally.

5. It stores the dev log in `packages/cli/WALLET_LOG` and `packages/cli/COORDINATOR_LOG`. You can beautify the logs using this command.

    ```shell
    $ npm install -g pino-pretty
    $ tail -f packages/cli/WALLET_LOG | pino-pretty
    $ tail -f packages/cli/COORDINATOR_LOG | pino-pretty
    ```
### How to make changes of the circuit package.

1. Add a test circuit in the directory `packages/circuits/tester/`
2. Build a docker image for testing the circuit
  ```shell
  # root directory of the project
  make circuit-testing-container
  ```
3. Write testcase in the directory `packages/circuits/tests`
4. Run test command
  ```shell
  lerna run test --scope=@zkopru/circuits
  ```
  or
  ```
  cd packages/circuits
  yarn test  
  ```
5. After the testing, build a docker image to use the compiled circuit and keys
  ```
  # root directory of the project
  make circuit-container
  ```
  This command will compile and setup circuits in the `impls` directory.

6. Tag the docker image and push to the docker hub.
7. (Optional) Specify the docker image tag in the test cases.

### Explore database

You can open the Prisma Studio to explore the database with following steps:

1. Create `pacakges/prisma/prisma/.env`

2. Write up the database connection information.

    * for dev coordinator
        ```
        # file packages/prisma/prisma/.env
        DATABASE_URL="file:../../cli/zkopru-coordinator.db"
        ```
    * for dev wallet
        ```
        # file packages/prisma/prisma/.env
        DATABASE_URL="file:../../cli/zkopru-wallet.db"
        ```
3. Run `yarn studio`

    ```shell
    cd packages/prisma && yarn studio
    ```

### Update database schema

1. Modify `packages/prisma/prisma/schema.prisma`

2. Run the following command will update the typescript automatically.
    ```shell
    yarn build:prisma
    ```
3. Update mockup database (WIP)

### Optional commands

#### Fresh build

```shell
yarn build:fresh
```

#### Build only typescript (will save your time)

```shell
yarn build:ts
```


This command will re-build the whole packages by wiping away every artifacts.

#### Setting up new snark keys

```shell
yarn build:keys
```

## Packages

### account

This module contains HD Wallet that manages zk accounts which supports both the Babyjubjub EdDSA and Ethereum.

### babyjubjub

This modules contains basic crypto classes for the babyjubjub elliptic curve to integrate its third pary libraries into the zkopru project.

### circuits

This library contains zk SNARK circuits written in Circom DSL.

### cli

Cli applications. Wallet and coordinator node.

### contracts

This library contains the smart contract which runs the upstream layer 1 part of the system. This library is written in solidity.

### coordinator

This is an application package for the coordinator. It synchonizes, verifies, and generates blocks with its full-node feature.

### core

The core layer2 blockchain system which supports both the full node and the light node. Using this package, you can develop a new application such as mobile wallets or payment solutions.

### dataset

This module generates dataset for test cases. To avoid the recursive dependency graph, only the test cases refer this package using symbolic links.

### integration-test

This module is the integration test set to run the local testnet for development.

### prisma

database layer.

### transaction

This modules contains the transaction builder.

### tree

This package contains a light weight roll up tree for zkopru system. Especially the light sync mode allows running the system with a very tiny size of tree data (~30 MB).

### utils

This package contains miscellaneous tools for zkopru project.

### zk-wizard

It contains a zk-wizard which creates a zk-SNARK proof for raw transactions and zk-wallet that manages the accounts and UTXOs.

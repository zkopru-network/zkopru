## packages

### account

This module contains HD Wallet that manages zk accounts which supports both the Babyjubjub EdDSA and Ethereum.

### babyjubjub

This modules contains basic crypto classes for the babyjubjub elliptic curve to integrate its third pary libraries into the zkopru project.

### circuits

This library contains zk SNARK circuits written in Circom DSL.

### contracts

This library contains the smart contract which runs the upstream layer 1 part of the system. This library is written in solidity.

### coordinator

This is an application package for the coordinator. It synchonizes, verifies, and generates blocks with its full-node feature.

### core

The core layer2 blockchain system which supports both the full node and the light node. Using this package, you can develop a new application such as mobile wallets or payment solutions.

### database

This package is a nanoSQL based database layer for the layer2 chain.

### testnet

This module is the integration test set to run the local testnet for the development purpose.

### transaction

This modules contains the zk transaction building libraries. If you are trying to develop wallet you may use this packge to create transactions.

### tree

This package contains a light weight roll up tree for zkopru system. Especially the light sync mode allows us to run the system with a very tiny size of tree data (~30 MB).

### utils

This package contains some miscellaneous tools for zkopru project.

### zk-wizard

This is a simple cli version of wallet application for zkopru.

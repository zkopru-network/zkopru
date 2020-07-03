# Getting started [WIP]

## Install wallet for zkopru

The zkopru wallet includes a full node(light node is in progress), and manages user's own UTXOs and the proof data. To use zkopru, you need to install the zkopru wallet first. Currently, it only supports the CLI version but it is expected to have a mobile version in the near future.


### Install `@zkopru/cli`

```shell
$ npm install -g @zkopru/cli
```

This will install `zkopru-wallet` and `zkopru-coordinator`. We'll use `zkopru-wallet` binary for this tutorial.

### Run `zkopru-wallet`

```shell
$ zkopru-wallet
```

`zkopru-wallet` will connect you to the layer-1 using websocket. The defaulf websocket url is set to [ws://testnet.zkopru.network:5555](ws://coordinator.zkopru.network:5555), but you can specify another url using cli option or configuration file.

Also, the default value of the coordinator's url is set to https://coordinator.zkopru.network. Later you can also specify the url if there are other coordinators.

```shell
$ zkopru-wallet --ws ws://{CUSTOM_WEBSOCKET} --coordinator https://{COORDINATOR_URL}
```

When you run this command, this will download the zk SNARK keys from S3 storage.

```shell
Downloading snark keys | [=--------------------] | 8% | 28047/344592 KiB | ETA: 25s
```

And then, the it automatically checks that the SNARK keys are correctly paried with the registered verifying keys on the layer-1 contract. You can manually download the keys [here](https://d2xnpw7ihgc4iv.cloudfront.net/keys.tgz)

### Configuration

```shell
? You should configure database › - Use arrow-keys. Return to submit.
    Postgres(recommended)
❯   Sqlite
```

After downloading the keys, configure the database. Please select Sqlite. Then type the path where you will save the data(just press 'enter' key if you want to use the default path).

```shell
✔ You should configure database › Sqlite
? Provide sqlite db here › zkopru-wallet.db
```

Next, please configure the HD wallet using mnemonic words. You can create a new mnemonic word set or import exising keys.

```shell
? You should import mnemonic keys or create a new one. › - Use arrow-keys. Return to submit.
❯   create
    import
```

Once you create or import keys, it will ask you how many accounts youw want to manage.

```
List of tracking accounts

0: 0x531023e7a198c8c0839a7b713f4fdbe460792051
? This node will keep tracking on the utxos for these accounts. › - Use arrow-keys. Return to submit.
❯   Create a new account
    Proceed to the next step
```

If you select "create a new account", it will make a new derived Ethereum account using bip-39 algorithm. And save your configuration.

```shell
✔ This node will keep tracking on the utxos for these accounts. › Proceed to the next step
✔ Do you want to save this configuration? … yes
✔ Type your password … **********
✔ Save to … wallet.json
```

If you saved your configuration, you can run the wallet using the config file with this command.

```shell
$ zkopru-wallet --config wallet.json
```

### Deposit

Select an account to use then it will print the account's detail information on the info box.

![](https://i.imgur.com/RcDK7wK.png)

In this example, the account has 100 ETH on the layer-1, and we will move this to the layer-2 using deposit menu.

1. Click "Deposit".
2. Click "Ether(balance: 100ETH)".
3. Type the amount of ETH.
4. Type the fee for the coordinator.
5. Confirm the deposit transaction.

Then the wallet stores the detail of your deposit leaf and the leaf is recorded on the layer-1 contract. Then the contract merges your leaf into the staged "mass deposit". And the coordinator commits the staged mass deposit, when it proposes a new block. Or the coordinator can commit the staged mass deposit manually. Finally, the coordinator includes the committed mass deposits into the new proposal, and then you can use your UTXOs on the layer-2.

### Transfer

Once your deposit is included in the block, you can now use the private transfer feature. 

![](https://i.imgur.com/R5hIKUM.png)

To send your ETH, ERC20, or ERC721, you need to get the recipient's babyjubjub public key. The babyjubjub public key is derived from the correspondng Ethereum account's private key.

1. Type the babyjubjub public key of the recipient.
    > For testing, you can get your another account's public key from the info box.
3. Type the amount of transfer.
4. Type the price per byte for the tx fee. Zkopru wallet fetches the fee per byte from the coordinator and it is set to the default value. If you want to give more fee, you can type the custom value. Please note that the total fee depends on the size of your transaction.

    > This is because the calldata size mainly affects the cost of Optimsitic Rollup. To test a tx instantly, you can just set the price about 100 times. Then the coordinator will include your transaction because it has aggregated enough fee for proposing.

4. Finally it generates zk SNARK proof in a few seconds, and send the transaction to the coordinator.
    > It currently uses http protocol to send transaction to the coordinator. To secure the network privacy, you should use use Tor.

5. Once you've created a transaction, the UTXOs will be locked which are used for the transaction.

6. After the coordinator include the transaction, wallet will mark the locked UTXOs as spent and apploy the new UTXOs to your account's balance.

### Withdrawal

If you want to withdraw out your assets to the layer 1, you need to send the withdrawal request first. And then you need to wait 7 days for the finalization of your withdrawal request.

However, the system supports instant withdrawal using pay-in-advance feature. When you create a withdrawal request, you can set an additional fee for the pay-in-advance. Then, after a block includes the withdrawal request, you can request a pay-in-advance to the proxy payer. It works in a way that the proxy payer pays first while transferring the withdrawal leaf's ownership.

#### Withdrawal request & withdraw out after the finalization.

1. Select 'withdraw request' menu at the top menu screen.
2. Type the address to withdraw out to.
3. Type the amount of withdrawal.
4. Type fee.
5. Type 0 for pay-in-advance fee.
6. Wait the finalization (testnet finalizes it )
7. Go to 'withdraw out' menu.
8. Select a finalized withdrawal from the list.

![](https://i.imgur.com/9jt6OmS.png)


#### Instant withdrawal

[WIP]

### Migration 

[WIP]

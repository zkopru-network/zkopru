/* eslint-disable no-use-before-define */
const path = require("path");
const fs = require("fs");
const { Address } = require("soltypes");
const Web3 = require("web3");
const { toWei } = require("web3-utils");
const {
  Block,
  FullNode,
  L1Contract,
  verifyingKeyIdentifier
} = require("~core");
const { ZkAccount } = require("~account");
const { DB, schema } = require("~database");
const { SQLiteConnector } = require("~database/node");
const { ZKWalletAccount, ZkWallet } = require("~zk-wizard");
const { readFromContainer, pullAndGetContainer } = require("~utils-docker");
const { sleep, attachConsoleLogToPino } = require("~utils");
const { ZKAccount, HDWallet } = require("~account");
const { DEFAULT } = require("~cli-config");
const { Coordinator } = require("~coordinator");
const { Layer1 } = require("../dist");
const { Fp } = require("~babyjubjub");
const { TxBuilder, Utxo, ZkTx, ZkAddress } = require("~transaction");

const outputPath = path.join(__dirname, "../test-cases");

process.env.BLOCK_CONFIRMATIONS = "0";

(async () => {
  let context;
  try {
    if (process.env.DEBUG) attachConsoleLogToPino();
    console.log(`Generating test block, writing to "${outputPath}"`);
    context = await initContext();
    console.log("Registering vks");
    await registerVks(context);
    console.log("Finishing setup");
    await finishSetup(context);
    console.log("Registering coordinator");
    await registerCoordinator(context);
    console.log("Registering tokens");
    await registerTokens(context);
    // Now deposit some funds so we can generate a transfer
    // Deposit ether, create a few notes
    console.log("Depositing ether");
    await context.wallets.wallet.depositEther(
      toWei("1", "ether"),
      toWei("10", "milliether")
    );
    await context.wallets.wallet.depositEther(
      toWei("1", "ether"),
      toWei("10", "milliether")
    );
    await context.wallets.wallet.depositEther(
      toWei("1", "ether"),
      toWei("10", "milliether")
    );
    await context.wallets.wallet.depositEther(
      toWei("1", "ether"),
      toWei("10", "milliether")
    );
    // airdrop first
    console.log("Depositing erc20");
    await context.wallets.coordinator.sendLayer1Tx({
      contract: context.tokens.erc20.address,
      tx: context.tokens.erc20.contract.methods.transfer(
        context.accounts.wallet.ethAddress,
        toWei("10000", "ether")
      )
    });
    const amount = toWei("1000", "ether");
    await context.wallets.wallet.sendLayer1Tx({
      contract: context.tokens.erc20.address,
      tx: context.tokens.erc20.contract.methods.approve(
        context.zkopruAddress,
        toWei("100000", "ether")
      )
    });
    // deposit erc20
    await context.wallets.wallet.depositERC20(
      toWei("0", "ether"),
      context.tokens.erc20.address,
      amount,
      toWei("1", "milliether")
    );
    await context.wallets.wallet.depositERC20(
      toWei("0", "ether"),
      context.tokens.erc20.address,
      amount,
      toWei("1", "milliether")
    );
    // wait for coordinator to propose block
    console.log("Waiting for block proposal...");
    for (;;) {
      const blocks = await context.contract.upstream.methods
        .proposedBlocks()
        .call();
      if (blocks === "2") break;
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log("Waiting for block to be processed...");
    for (;;) {
      const processed =
        context.coordinator.node().synchronizer.latestProcessed || 0;
      if (processed === 1) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    // generate deposit, withdrawal, transfer, migration
    const zkTx = [];
    {
      // transfer eth
      console.log("Transferring ether");
      const walletSpendables = await context.wallets.wallet.getSpendables(
        context.accounts.wallet
      );
      const ethRawTx = TxBuilder.from(context.accounts.wallet.zkAddress)
        .provide(...walletSpendables.map(note => Utxo.from(note)))
        .weiPerByte(toWei("10000", "gwei"))
        .sendEther({
          eth: Fp.from(toWei("1", "ether")),
          to: context.accounts.coordinator.zkAddress
        })
        .build();
      const ethZkTx = await context.wallets.wallet.shieldTx({
        tx: ethRawTx,
        encryptTo: context.accounts.coordinator.zkAddress
      });
      zkTx.push(ethZkTx);
    }
    {
      // transfer erc20
      console.log("Transferring erc20");
      const walletSpendables = await context.wallets.wallet.getSpendables(
        context.accounts.wallet
      );
      const erc20RawTx = TxBuilder.from(context.accounts.wallet.zkAddress)
        .provide(...walletSpendables.map(note => Utxo.from(note)))
        .weiPerByte(toWei("10000", "gwei"))
        .sendERC20({
          eth: Fp.zero,
          tokenAddr: context.tokens.erc20.address,
          erc20Amount: Fp.from(toWei("1", "ether")),
          to: context.accounts.coordinator.zkAddress
        })
        .build();
      const erc20ZkTx = await context.wallets.wallet.shieldTx({
        tx: erc20RawTx,
        encryptTo: context.accounts.coordinator.zkAddress
      });
      zkTx.push(erc20ZkTx);
    }
    {
      // withdraw erc20
      console.log("Withdrawing erc20");
      const walletSpendables = await context.wallets.wallet.getSpendables(
        context.accounts.wallet
      );
      const erc20RawTx = TxBuilder.from(context.accounts.wallet.zkAddress)
        .provide(...walletSpendables.map(note => Utxo.from(note)))
        .weiPerByte(toWei("10000", "gwei"))
        .sendERC20({
          eth: Fp.zero,
          tokenAddr: context.tokens.erc20.address,
          erc20Amount: Fp.from(toWei("1", "ether")),
          to: ZkAddress.null,
          withdrawal: {
            to: Fp.from(context.accounts.wallet.ethAddress),
            fee: Fp.from(toWei("10000", "gwei"))
          }
        })
        .build();
      const erc20ZkTx = await context.wallets.wallet.shieldTx({
        tx: erc20RawTx
      });
      zkTx.push(erc20ZkTx);
    }
    // deposit erc721
    console.log("Depositing erc721");
    await context.wallets.coordinator.sendLayer1Tx({
      contract: context.tokens.erc721.address,
      tx: context.tokens.erc721.contract.methods[
        "safeTransferFrom(address,address,uint256)"
      ](
        context.accounts.coordinator.ethAddress,
        context.accounts.wallet.ethAddress,
        "1"
      )
    });
    await context.wallets.wallet.sendLayer1Tx({
      contract: context.tokens.erc721.address,
      tx: context.tokens.erc721.contract.methods.setApprovalForAll(
        context.zkopruAddress,
        true
      )
    });
    await context.wallets.wallet.depositERC721(
      toWei("0", "ether"),
      context.tokens.erc721.address,
      "1",
      toWei("1", "milliether")
    );

    const promises = [];
    for (const tx of zkTx) {
      promises.push(context.wallets.wallet.sendLayer2Tx(tx));
    }
    await Promise.all(promises);
    console.log("Waiting for block proposal...");
    for (;;) {
      const blocks = await context.contract.upstream.methods
        .proposedBlocks()
        .call();
      if (blocks === "3") break;
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log("Waiting for block to be processed...");
    for (;;) {
      const processed =
        context.coordinator.node().synchronizer.latestProcessed || 0;
      if (processed === 2) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    {
      const proposal = await context.coordinator
        .node()
        .layer2.getProposalByNumber(1, true);
      const tx = JSON.parse(proposal.proposalData);
      const block = Block.fromTx(tx, true);
      fs.writeFileSync(
        path.join(outputPath, "block-1.txt"),
        `0x${block.serializeBlock().toString("hex")}`
      );
    }
    {
      const proposal = await context.coordinator
        .node()
        .layer2.getProposalByNumber(2, true);
      const tx = JSON.parse(proposal.proposalData);
      const block = Block.fromTx(tx, true);
      fs.writeFileSync(
        path.join(outputPath, "block-2.txt"),
        `0x${block.serializeBlock().toString("hex")}`
      );
    }
    console.log("File(s) written, exiting");
    await Promise.race([
      terminate(context),
      new Promise(r => setTimeout(r, 30000))
    ]);
    process.exit(0);
  } catch (err) {
    console.log(err);
    console.log("Uncaught error generating block");
    await Promise.race([
      terminate(context).catch(() => {}),
      new Promise(r => setTimeout(r, 30000))
    ]);
    process.exit(1);
  }
})();

async function terminate(context) {
  const {
    layer1Container,
    circuitArtifactContainer,
    dbs,
    coordinator,
    wallets,
    provider
  } = context;
  provider.disconnect(0, "exit");
  await Promise.all([
    coordinator.stop(),
    wallets.wallet.node.stop(),
    wallets.coordinator.node.stop()
  ]);
  await Promise.all([dbs.map(db => db.close())]);
  await Promise.all([
    await layer1Container.stop(),
    await circuitArtifactContainer.stop()
  ]);
  await Promise.all([
    await layer1Container.delete(),
    await circuitArtifactContainer.delete()
  ]);
}

async function registerCoordinator({ wallets, web3, contract }) {
  const consensus = await contract.upstream.methods.consensusProvider().call();
  await wallets.coordinator.sendLayer1Tx({
    contract: consensus,
    tx: Layer1.getIBurnAuction(web3, consensus).methods.register(),
    option: {
      value: toWei("32", "ether")
    }
  });
}

async function registerTokens({ wallets, contract, tokens }) {
  const registerERC20Tx = contract.coordinator.methods.registerERC20(
    tokens.erc20.address
  );
  await wallets.coordinator.sendLayer1Tx({
    contract: contract.address,
    tx: registerERC20Tx
  });
  const registerERC721Tx = contract.coordinator.methods.registerERC721(
    tokens.erc721.address
  );
  await wallets.coordinator.sendLayer1Tx({
    contract: contract.address,
    tx: registerERC721Tx
  });
  const isSynced = async wallet => {
    const tokenRegistry = await wallet.node.layer2.getTokenRegistry();
    const erc20Sync = !!tokenRegistry.erc20s.find(addr =>
      addr.eq(Address.from(tokens.erc20.address))
    );
    const erc721Sync = !!tokenRegistry.erc721s.find(addr =>
      addr.eq(Address.from(tokens.erc721.address))
    );
    return !!(erc20Sync && erc721Sync);
  };
  for (;;) {
    const walletSyncedNewTokenRegistration = await isSynced(wallets.wallet);
    if (walletSyncedNewTokenRegistration) break;
    await sleep(500);
  }
}

async function registerVks({ contract, vks, accounts }) {
  const nIn = Object.keys(vks);
  const nOut = Object.keys(vks[1]);
  const registerVKs = [];
  let registeredNum = 0;
  nIn.forEach(i => {
    nOut.forEach(j => {
      registerVKs.push(async () => {
        const vk = vks[i][j];
        const tx = contract.setup.methods.registerVk(i, j, [
          [vk.vk_alpha_1[0], vk.vk_alpha_1[1]],
          [vk.vk_beta_2[0].reverse(), vk.vk_beta_2[1].reverse()],
          [vk.vk_gamma_2[0].reverse(), vk.vk_gamma_2[1].reverse()],
          [vk.vk_delta_2[0].reverse(), vk.vk_delta_2[1].reverse()],
          vk.IC.map(ic => [ic[0], ic[1]])
        ]);
        const estimatedGas = await tx.estimateGas();
        const receipt = await tx.send({
          from: accounts.coordinator.ethAddress,
          gas: estimatedGas
        });
        registeredNum += 1;
      });
    });
  });
  await Promise.all(registerVKs.map(f => f()));
}

async function finishSetup({ accounts, contract, wallets, coordinator }) {
  const tx = contract.setup.methods.completeSetup();
  const gas = await tx.estimateGas();
  await tx.send({ from: accounts.coordinator.ethAddress, gas });
  const vks = await contract.getVKs();
  const NUM_OF_INPUTS = 4;
  const NUM_OF_OUTPUTS = 4;
  for (let nI = 1; nI <= NUM_OF_INPUTS; nI += 1) {
    for (let nO = 1; nO <= NUM_OF_OUTPUTS; nO += 1) {
      const sig = verifyingKeyIdentifier(nI, nO);
      wallets.wallet.node.layer2.snarkVerifier.addVerifyingKey(
        nI,
        nO,
        vks[sig]
      );
      wallets.coordinator.node.layer2.snarkVerifier.addVerifyingKey(
        nI,
        nO,
        vks[sig]
      );
      coordinator.node().layer2.snarkVerifier.addVerifyingKey(nI, nO, vks[sig]);
    }
  }
}

async function getContainers() {
  const layer1Container = await pullAndGetContainer({
    compose: [__dirname, "../../../dockerfiles"],
    service: "contracts-for-integration-test"
  });
  const circuitArtifactContainer = await pullAndGetContainer({
    compose: [__dirname, "../../../dockerfiles"],
    service: "circuits"
  });
  return { layer1Container, circuitArtifactContainer };
}

async function getAddresses(layer1Container) {
  const deployed = await readFromContainer(
    layer1Container,
    "/proj/build/deployed/Zkopru.json"
  );
  const deployedERC20 = await readFromContainer(
    layer1Container,
    "/proj/build/deployed/TestERC20.json"
  );
  const deployedERC721 = await readFromContainer(
    layer1Container,
    "/proj/build/deployed/TestERC721.json"
  );
  const zkopruAddress = JSON.parse(deployed.toString()).address;
  const erc20Address = JSON.parse(deployedERC20.toString()).address;
  const erc721Address = JSON.parse(deployedERC721.toString()).address;
  return { zkopruAddress, erc20Address, erc721Address };
}

async function getContainerIP(container) {
  const status = await container.status();
  const containerIP = status.data.NetworkSettings.IPAddress;
  return containerIP;
}

async function getWeb3(ws) {
  const provider = new Web3.providers.WebsocketProvider(ws, {
    reconnect: { auto: true }
  });
  async function waitConnection() {
    return new Promise(res => {
      if (provider.connected) res();
      provider.on("connect", res);
    });
  }
  await waitConnection();
  const web3 = new Web3(provider);
  return { web3, provider };
}

async function getAccounts(web3) {
  const mockup = await SQLiteConnector.create(schema, ":memory:");
  const hdWallet = new HDWallet(web3, mockup);
  const mnemonic =
    "myth like bonus scare over problem client lizard pioneer submit female collect";
  await hdWallet.init(mnemonic, "samplepassword");
  const coordinator = await hdWallet.createAccount(0);
  const wallet = await hdWallet.createAccount(1);
  const accounts = { coordinator, wallet };
  await mockup.close();
  return accounts;
}

async function getVKs(circuitArtifactContainer) {
  const vks = {
    1: {},
    2: {},
    3: {},
    4: {}
  };
  const nIn = [1, 2, 3, 4];
  const nOut = [1, 2, 3, 4];
  const readVKs = [];
  nIn.forEach(i => {
    nOut.forEach(j => {
      const readVK = async () => {
        const vk = JSON.parse(
          (
            await readFromContainer(
              circuitArtifactContainer,
              `/proj/build/vks/zk_transaction_${i}_${j}.vk.json`
            )
          ).toString("utf8")
        );
        vks[i][j] = vk;
      };
      readVKs.push(readVK);
    });
  });
  await Promise.all(readVKs.map(f => f()));
  return vks;
}

async function getCoordinator(provider, address, account) {
  const mockupDB = await SQLiteConnector.create(schema, ":memory:");
  const fullNode = await FullNode.new({
    address,
    provider,
    db: mockupDB
  });
  const { maxBytes, priceMultiplier, port } = DEFAULT;
  const coordinator = new Coordinator(fullNode, account, {
    maxBytes,
    priceMultiplier, // 32 gas is the current default price for 1 byte
    vhosts: "*",
    publicUrls: `localhost:${port}`,
    port,
    maxBid: 20000,
    bootstrap: false
  });
  return { coordinator, mockupDB };
}

async function getWallet({ account, provider, erc20s, erc721s, address }) {
  const mockupDB = await SQLiteConnector.create(schema, ":memory:");
  const node = await FullNode.new({
    address,
    provider,
    db: mockupDB,
    slasher: account.ethAccount
  });
  const web3 = new Web3(provider);
  const hdWallet = new HDWallet(web3, mockupDB);
  const zkWallet = new ZkWallet({
    db: mockupDB,
    wallet: hdWallet,
    node,
    accounts: [account],
    erc20: erc20s.map(Address.from),
    erc721: erc721s.map(Address.from),
    snarkKeyPath: path.join(__dirname, "../../circuits/keys")
  });
  zkWallet.setAccount(account);
  return { zkWallet, mockupDB };
}

async function getWallets({ accounts, config }) {
  const { zkWallet: wallet, mockupDB: walletDB } = await getWallet({
    account: accounts.wallet,
    ...config
  });
  const { zkWallet: coordinator, mockupDB: coordinatorDB } = await getWallet({
    account: accounts.coordinator,
    ...config
  });
  return {
    wallets: { wallet, coordinator },
    dbs: [walletDB, coordinatorDB]
  };
}

async function initContext() {
  const { layer1Container, circuitArtifactContainer } = await getContainers();
  await Promise.all([
    layer1Container.start(),
    circuitArtifactContainer.start()
  ]);
  const { zkopruAddress, erc20Address, erc721Address } = await getAddresses(
    layer1Container
  );
  await sleep(2000);
  const containerIP = await getContainerIP(layer1Container);
  const { web3, provider } = await getWeb3(`ws://${containerIP}:5000`);
  const contract = new L1Contract(web3, zkopruAddress);
  const erc20 = Layer1.getERC20(web3, erc20Address);
  const erc721 = Layer1.getERC721(web3, erc721Address);
  const accounts = await getAccounts(web3);
  const vks = await getVKs(circuitArtifactContainer);
  // await getCircuitArtifacts(circuitArtifactContainer)
  const { coordinator, mockupDB: coordinatorDB } = await getCoordinator(
    provider,
    zkopruAddress,
    accounts.coordinator.ethAccount
  );
  await coordinator.start();
  const { wallets, dbs } = await getWallets({
    accounts,
    config: {
      provider,
      address: zkopruAddress,
      erc20s: [erc20Address],
      erc721s: [erc721Address]
    }
  });
  wallets.wallet.node.start();
  wallets.coordinator.node.start();

  return {
    layer1Container,
    circuitArtifactContainer,
    accounts,
    web3,
    provider,
    zkopruAddress,
    dbs: [...dbs, coordinatorDB],
    contract,
    coordinator,
    wallets,
    vks,
    tokens: {
      erc20: { contract: erc20, address: erc20Address },
      erc721: { contract: erc721, address: erc721Address }
    }
  };
}

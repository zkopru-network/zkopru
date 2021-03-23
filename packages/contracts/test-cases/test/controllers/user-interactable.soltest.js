/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
const chai = require("chai");
const { Address } = require("soltypes");
const { toWei, toBN } = require("web3-utils");
const { Block } = require("~core");
const { Withdrawal, Utxo, ZkAddress } = require("~transaction");
const { merkleRoot, keccakHasher } = require("~tree");

const { expect } = chai;

const UserInteractableTester = artifacts.require("UserInteractableTester");
const TestERC20 = artifacts.require("TestERC20");
const TestERC721 = artifacts.require("TestERC721");

contract("User Interaction gas report", async accounts => {
  let ui;
  let erc20;
  let erc721;
  before(async () => {
    ui = await UserInteractableTester.deployed();
    erc20 = await TestERC20.new();
    erc721 = await TestERC721.new();
    await erc20.approve(ui.address, toWei("10000"));
    await erc721.approve(ui.address, "1");
    await erc721.approve(ui.address, "2");
    await erc721.approve(ui.address, "3");
    await ui.registerERC20(erc20.address);
    await ui.registerERC721(erc721.address);
  });
  describe("deposit()", () => {
    it("ether", async () => {
      const spendingPubKey = 0;
      const salt = 0;
      const eth = toWei("10");
      const token = "0x0000000000000000000000000000000000000000";
      const erc20Amount = 0;
      const nft = 0;
      const fee = 0;
      await ui.deposit(
        spendingPubKey,
        salt,
        eth,
        token,
        erc20Amount,
        nft,
        fee,
        {
          value: toWei("10")
        }
      );
    });
    it("eRC20 only", async () => {
      const spendingPubKey = 0;
      const salt = 0;
      const eth = 0;
      const token = erc20.address;
      const erc20Amount = toWei("10");
      const nft = 0;
      const fee = 0;
      await ui.deposit(spendingPubKey, salt, eth, token, erc20Amount, nft, fee);
    });
    it("eRC20 with Ether", async () => {
      const spendingPubKey = 0;
      const salt = 0;
      const eth = toWei("10");
      const token = erc20.address;
      const erc20Amount = toWei("10");
      const nft = 0;
      const fee = 0;
      await ui.deposit(
        spendingPubKey,
        salt,
        eth,
        token,
        erc20Amount,
        nft,
        fee,
        {
          value: toWei("10")
        }
      );
    });
    it("nFT only", async () => {
      const spendingPubKey = 0;
      const salt = 0;
      const eth = 0;
      const token = erc721.address;
      const erc20Amount = 0;
      const nft = 1;
      const fee = 0;
      await ui.deposit(spendingPubKey, salt, eth, token, erc20Amount, nft, fee);
    });
    it("nFT with Ether", async () => {
      const spendingPubKey = 0;
      const salt = 0;
      const eth = toWei("10");
      const token = erc721.address;
      const erc20Amount = 0;
      const nft = 2;
      const fee = 0;
      await ui.deposit(
        spendingPubKey,
        salt,
        eth,
        token,
        erc20Amount,
        nft,
        fee,
        {
          value: toWei("10")
        }
      );
    });
  });
  describe("withdraw()", () => {
    it("withdraw Ether", async () => {
      const note = Utxo.newEtherNote({
        owner: ZkAddress.null,
        eth: toWei("10"),
        salt: 0
      });
      const withdrawal = Withdrawal.from(note, accounts[0], toWei("1"));
      const mockSiblings = Array(48).fill(toBN("11"));
      const mockLeafIndex = 10;
      const mockRoot = merkleRoot(
        keccakHasher(48),
        toBN(mockLeafIndex),
        withdrawal.withdrawalHash().toBN(),
        mockSiblings
      );
      const mockBlockHash =
        "0x067bbff6b8363c31b4599c7bbe376748eee3d2c82682219a5845f337e4e20ff1";
      await ui.mockWithdrawalRoot(mockBlockHash, mockRoot);
      await ui.withdraw(
        withdrawal.hash(),
        withdrawal.publicData.to.toAddress().toString(),
        withdrawal.eth(),
        withdrawal
          .tokenAddr()
          .toAddress()
          .toString(),
        withdrawal.erc20Amount(),
        withdrawal.nft(),
        withdrawal.publicData.fee,
        mockBlockHash,
        toBN(mockLeafIndex),
        mockSiblings
      );
    });
    it("withdraw ERC20 only", async () => {
      const note = Utxo.newERC20Note({
        owner: ZkAddress.null,
        eth: 0,
        salt: 0,
        tokenAddr: erc20.address,
        erc20Amount: toWei("10")
      });
      const withdrawal = Withdrawal.from(note, accounts[0], toWei("1"));
      const mockSiblings = Array(48).fill(toBN("11"));
      const mockLeafIndex = 10;
      const mockRoot = merkleRoot(
        keccakHasher(48),
        toBN(mockLeafIndex),
        withdrawal.withdrawalHash().toBN(),
        mockSiblings
      );
      const mockBlockHash =
        "0x067bbff6b8363c31b4599c7bbe376748eee3d2c82682219a5845f337e4e20ff1";
      await ui.mockWithdrawalRoot(mockBlockHash, mockRoot);
      await ui.withdraw(
        withdrawal.hash(),
        withdrawal.publicData.to.toAddress().toString(),
        withdrawal.eth(),
        withdrawal
          .tokenAddr()
          .toAddress()
          .toString(),
        withdrawal.erc20Amount(),
        withdrawal.nft(),
        withdrawal.publicData.fee,
        mockBlockHash,
        toBN(mockLeafIndex),
        mockSiblings
      );
    });
    it("withdraw ERC20 with ETH", async () => {
      const note = Utxo.newERC20Note({
        owner: ZkAddress.null,
        eth: toWei("1"),
        salt: 0,
        tokenAddr: erc20.address,
        erc20Amount: toWei("10")
      });
      const withdrawal = Withdrawal.from(note, accounts[0], toWei("1"));
      const mockSiblings = Array(48).fill(toBN("11"));
      const mockLeafIndex = 10;
      const mockRoot = merkleRoot(
        keccakHasher(48),
        toBN(mockLeafIndex),
        withdrawal.withdrawalHash().toBN(),
        mockSiblings
      );
      const mockBlockHash =
        "0x067bbff6b8363c31b4599c7bbe376748eee3d2c82682219a5845f337e4e20ff1";
      await ui.mockWithdrawalRoot(mockBlockHash, mockRoot);
      await ui.withdraw(
        withdrawal.hash(),
        withdrawal.publicData.to.toAddress().toString(),
        withdrawal.eth(),
        withdrawal
          .tokenAddr()
          .toAddress()
          .toString(),
        withdrawal.erc20Amount(),
        withdrawal.nft(),
        withdrawal.publicData.fee,
        mockBlockHash,
        toBN(mockLeafIndex),
        mockSiblings
      );
    });
    it("withdraw NFT only", async () => {
      const note = Utxo.newNFTNote({
        owner: ZkAddress.null,
        eth: 0,
        salt: 0,
        tokenAddr: erc721.address,
        nft: 1
      });
      const withdrawal = Withdrawal.from(note, accounts[0], toWei("1"));
      const mockSiblings = Array(48).fill(toBN("11"));
      const mockLeafIndex = 10;
      const mockRoot = merkleRoot(
        keccakHasher(48),
        toBN(mockLeafIndex),
        withdrawal.withdrawalHash().toBN(),
        mockSiblings
      );
      const mockBlockHash =
        "0x067bbff6b8363c31b4599c7bbe376748eee3d2c82682219a5845f337e4e20ff1";
      await ui.mockWithdrawalRoot(mockBlockHash, mockRoot);
      await ui.withdraw(
        withdrawal.hash(),
        withdrawal.publicData.to.toAddress().toString(),
        withdrawal.eth(),
        withdrawal
          .tokenAddr()
          .toAddress()
          .toString(),
        withdrawal.erc20Amount(),
        withdrawal.nft(),
        withdrawal.publicData.fee,
        mockBlockHash,
        toBN(mockLeafIndex),
        mockSiblings
      );
    });
    it("withdraw NFT with ETH", async () => {
      const note = Utxo.newNFTNote({
        owner: ZkAddress.null,
        eth: toWei("1"),
        salt: 0,
        tokenAddr: erc721.address,
        nft: 2
      });
      const withdrawal = Withdrawal.from(note, accounts[0], toWei("1"));
      const mockSiblings = Array(48).fill(toBN("11"));
      const mockLeafIndex = 10;
      const mockRoot = merkleRoot(
        keccakHasher(48),
        toBN(mockLeafIndex),
        withdrawal.withdrawalHash().toBN(),
        mockSiblings
      );
      const mockBlockHash =
        "0x067bbff6b8363c31b4599c7bbe376748eee3d2c82682219a5845f337e4e20ff1";
      await ui.mockWithdrawalRoot(mockBlockHash, mockRoot);
      await ui.withdraw(
        withdrawal.hash(),
        withdrawal.publicData.to.toAddress().toString(),
        withdrawal.eth(),
        withdrawal
          .tokenAddr()
          .toAddress()
          .toString(),
        withdrawal.erc20Amount(),
        withdrawal.nft(),
        withdrawal.publicData.fee,
        mockBlockHash,
        toBN(mockLeafIndex),
        mockSiblings
      );
    });
  });
});

/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-expressions */
import "ethereum-waffle";
import { Withdrawal, Utxo, ZkAddress } from "~transaction";
import { merkleRoot, keccakHasher } from "~tree";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { UserInteractableTester, TestERC20, TestERC721 } from "../../typechain";
import { Context, ZkopruTestFixture } from "../fixtures";

describe("user Interaction gas report", () => {
  let ui: UserInteractableTester;
  let erc20: TestERC20;
  let erc721: TestERC721;
  let account: SignerWithAddress;
  let fixtures: ZkopruTestFixture;
  const context = new Context();
  before(async () => {
    fixtures = await context.getFixtures();
    account = await context.getDeployer();
    ui = fixtures.userInteractableTester;
    erc20 = fixtures.testERC20;
    erc721 = fixtures.testERC721;
    await erc20.approve(ui.address, parseEther("10000"));
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
      const eth = parseEther("10");
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
          value: parseEther("10")
        }
      );
    });
    it("eRC20 only", async () => {
      const spendingPubKey = 0;
      const salt = 0;
      const eth = 0;
      const token = erc20.address;
      const erc20Amount = parseEther("10");
      const nft = 0;
      const fee = 0;
      await ui.deposit(spendingPubKey, salt, eth, token, erc20Amount, nft, fee);
    });
    it("eRC20 with Ether", async () => {
      const spendingPubKey = 0;
      const salt = 0;
      const eth = parseEther("10");
      const token = erc20.address;
      const erc20Amount = parseEther("10");
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
          value: parseEther("10")
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
      const eth = parseEther("10");
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
          value: parseEther("10")
        }
      );
    });
  });
  describe("withdraw()", () => {
    it("withdraw Ether", async () => {
      const note = Utxo.newEtherNote({
        owner: ZkAddress.null,
        eth: parseEther("10"),
        salt: 0
      });
      const withdrawal = Withdrawal.from(
        note,
        account.address,
        parseEther("1")
      );
      const mockSiblings = Array(48).fill(BigNumber.from("11"));
      const mockLeafIndex = 10;
      const mockRoot = merkleRoot(
        keccakHasher(48),
        BigNumber.from(mockLeafIndex),
        withdrawal.withdrawalHash().toBigNumber(),
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
        BigNumber.from(mockLeafIndex),
        mockSiblings
      );
    });
    it("withdraw ERC20 only", async () => {
      const note = Utxo.newERC20Note({
        owner: ZkAddress.null,
        eth: 0,
        salt: 0,
        tokenAddr: erc20.address,
        erc20Amount: parseEther("10")
      });
      const withdrawal = Withdrawal.from(
        note,
        account.address,
        parseEther("1")
      );
      const mockSiblings = Array(48).fill(BigNumber.from("11"));
      const mockLeafIndex = 10;
      const mockRoot = merkleRoot(
        keccakHasher(48),
        BigNumber.from(mockLeafIndex),
        withdrawal.withdrawalHash().toBigNumber(),
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
        BigNumber.from(mockLeafIndex),
        mockSiblings
      );
    });
    it("withdraw ERC20 with ETH", async () => {
      const note = Utxo.newERC20Note({
        owner: ZkAddress.null,
        eth: parseEther("1"),
        salt: 0,
        tokenAddr: erc20.address,
        erc20Amount: parseEther("10")
      });
      const withdrawal = Withdrawal.from(
        note,
        account.address,
        parseEther("1")
      );
      const mockSiblings = Array(48).fill(BigNumber.from("11"));
      const mockLeafIndex = 10;
      const mockRoot = merkleRoot(
        keccakHasher(48),
        BigNumber.from(mockLeafIndex),
        withdrawal.withdrawalHash().toBigNumber(),
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
        BigNumber.from(mockLeafIndex),
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
      const withdrawal = Withdrawal.from(
        note,
        account.address,
        parseEther("1")
      );
      const mockSiblings = Array(48).fill(BigNumber.from("11"));
      const mockLeafIndex = 10;
      const mockRoot = merkleRoot(
        keccakHasher(48),
        BigNumber.from(mockLeafIndex),
        withdrawal.withdrawalHash().toBigNumber(),
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
        BigNumber.from(mockLeafIndex),
        mockSiblings
      );
    });
    it("withdraw NFT with ETH", async () => {
      const note = Utxo.newNFTNote({
        owner: ZkAddress.null,
        eth: parseEther("1"),
        salt: 0,
        tokenAddr: erc721.address,
        nft: 2
      });
      const withdrawal = Withdrawal.from(
        note,
        account.address,
        parseEther("1")
      );
      const mockSiblings = Array(48).fill(BigNumber.from("11"));
      const mockLeafIndex = 10;
      const mockRoot = merkleRoot(
        keccakHasher(48),
        BigNumber.from(mockLeafIndex),
        withdrawal.withdrawalHash().toBigNumber(),
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
        BigNumber.from(mockLeafIndex),
        mockSiblings
      );
    });
  });
});

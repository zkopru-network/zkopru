pragma solidity >= 0.6.0;

import "../libraries/Types.sol";
import { Pairing } from "../libraries/Pairing.sol";
import { SNARKsVerifier } from "../libraries/SNARKs.sol";
import { Configurated } from "./Configurated.sol";
import { OPRU, SplitRollUp } from "merkle-tree-rollup/contracts/library/Types.sol";
import { SMT256 } from "smt-rollup/contracts/SMT.sol";

struct RollUpProofs {
    SplitRollUp[] ofUTXORollUp;
    SMT256.OPRU[] ofNullifierRollUp;
    SplitRollUp[] ofWithdrawalRollUp;
    mapping(uint8=>mapping(uint=>address)) permittedTo;
}

contract Layer2 is Configurated {
    /** State of the layer2 blockchain is maintained by the optimistic roll up */
    Blockchain chain;

    /** SNARKs verifying keys assigned by the setup wizard for each tx type */
    mapping(bytes32=>SNARKsVerifier.VerifyingKey) vks;

    /** Addresses allowed to migrate from. Setup wizard manages the list */
    mapping(address=>bool) allowedMigrants;

    /** Roll up proofs for challenge */
    RollUpProofs proof;
}

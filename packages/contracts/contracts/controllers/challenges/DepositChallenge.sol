pragma solidity >= 0.6.0;

import { Layer2 } from "../../storage/Layer2.sol";
import { Challengeable } from "../Challengeable.sol";
import { SNARKsVerifier } from "../../libraries/SNARKs.sol";
import { SMT256 } from "smt-rollup/contracts/SMT.sol";
import {
    Block,
    MassDeposit,
    Challenge,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";

contract DepositChallenge is Challengeable {
    using Types for MassDeposit;
    using SMT256 for SMT256.OPRU;
    using SNARKsVerifier for SNARKsVerifier.VerifyingKey;

    function challengeMassDeposit(
        uint index,
        bytes calldata
    ) external {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeMassDeposit(_block, index);
        _execute(result);
    }

    function _challengeMassDeposit(
        Block memory _block,
        uint _index
    )
        internal
        view
        returns (Challenge memory)
    {
        MassDeposit memory massDeposit = _block.body.massDeposits[_index];
        if(chain.committedDeposits[massDeposit.hash()] > 0) {
            /// This mass deposit does not exist
            return Challenge(
                true,
                _block.submissionId,
                _block.header.proposer,
                "This deposit queue is not committed"
            );
        }
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Layer2 } from "../../storage/Layer2.sol";
import { Challengeable } from "../Challengeable.sol";
import { SNARK } from "../../libraries/SNARK.sol";
import { SMT254 } from "../../libraries/SMT.sol";
import {
    Block,
    MassDeposit,
    Challenge,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";

contract DepositChallenge is Challengeable {
    using Types for MassDeposit;
    using SMT254 for SMT254.OPRU;
    using SNARK for SNARK.VerifyingKey;

    function challengeMassDeposit(
        uint256 index,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeMassDeposit(_block, index);
        _execute(proposalId, result);
    }

    function _challengeMassDeposit(
        Block memory _block,
        uint256 _index
    )
        internal
        view
        returns (Challenge memory)
    {
        MassDeposit memory massDeposit = _block.body.massDeposits[_index];
        if(chain.committedDeposits[massDeposit.hash()] == 0) {
            // This mass deposit does not exist
            return Challenge(
                true,
                _block.header.proposer,
                "This deposit queue is not committed"
            );
        }
    }
}

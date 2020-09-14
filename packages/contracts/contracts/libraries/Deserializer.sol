// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import {
    Header,
    Body,
    Transaction,
    Inflow,
    Outflow,
    Proof,
    MassDeposit,
    MassMigration,
    ERC20Migration,
    ERC721Migration,
    Block,
    PublicData,
    Finalization
} from "./Types.sol";

import {
    G1Point,
    G2Point
} from "./Pairing.sol";

library Deserializer {
    /**
     * @dev Block data will be serialized with the following structure
     *      https://docs.zkopru.network/how-it-works/block
     * @param paramIndex The index of the block calldata parameter in the external function
     */
    function blockFromCalldataAt(uint256 paramIndex)
    internal
    pure
    returns (Block memory)
    {
        // 4 means the length of the function signature in the calldata
        uint256 start = 4 + abi.decode(msg.data[4 + 32*paramIndex:4 + 32*(paramIndex+1)], (uint256));
        uint256 cp = start + 0x20; //calldata position
        Block memory _block;
        (_block.header, cp) = dequeueHeader(cp);
        (_block.body.txs, cp) = dequeueTxs(cp);
        (_block.body.massDeposits, cp) = dequeueMassDeposits(cp);
        (_block.body.massMigrations, cp) = dequeueMassMigrations(cp);
        // get data length from the calldata
        uint256 dataLen;
        assembly {
            let p := mload(0x40)
            calldatacopy(p, start, 0x20)
            dataLen := mload(p)
            mstore(0x40, add(p, 0x20))
        }
        // Check that deserialization fits to the original data length
        if(dataLen != cp - start - 0x20) {
            revert("Serialization has a problem");
        }
        return _block;
    }

    function dequeueHeader(uint256 calldataPos) internal pure returns (
        Header memory header,
        uint256 end
    ) {
        assembly {
            // Header
            mstore(header, 0) // put zeroes into the first 32bytes
            calldatacopy(add(header, 0x0c), calldataPos, 0x154) // header_len := 0x154 = 0x14 + 10 * 0x20;
        }
        end = calldataPos + 0x154;
    }

    function dequeueTxs(uint256 calldataPos) internal pure returns (
        Transaction[] memory txs,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 txsLen;
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            mstore(free_mem, 0)
            calldatacopy(add(free_mem, 0x1e), cp, 0x02)
            txsLen := mload(free_mem)
            cp := add(cp, 0x02)
            mstore(0x40, add(free_mem, 0x20))
        }
        txs = new Transaction[](txsLen);
        for (uint256 i = 0; i < txsLen; i++) {
            (txs[i], cp) = dequeueTx(cp);
        }
        end = cp;
    }

    function dequeueTx(uint256 calldataPos) internal pure returns (
        Transaction memory transaction,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint8 indicator;
        (transaction.inflow, cp) = dequeueInflowArr(cp);
        (transaction.outflow, cp) = dequeueOutflowArr(cp);
        (transaction.fee, cp) = dequeueUint(cp);
        (transaction.proof, cp) = dequeueProof(cp);
        (indicator, cp) = dequeueByte(cp);
        if (indicator & 1 != 0) {
            // has swap
            (transaction.swap, cp) = dequeueUint(cp);
        }
        if (indicator & 2 != 0) {
            // has memo
            (transaction.memo, cp) = dequeueMemo(cp);
        }
        end = cp;
    }

    function dequeueInflowArr(uint256 calldataPos) internal pure returns (
        Inflow[] memory inflow,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 inflowLen;
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            mstore(free_mem, 0)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            inflowLen := mload(free_mem)
            cp := add(cp, 0x01)
            mstore(0x40, add(free_mem, 0x20))
        }
        inflow = new Inflow[](inflowLen);
        for (uint256 i = 0; i < inflowLen; i++) {
            (inflow[i], cp) = dequeueInflow(cp);
        }
        end = cp;
    }

    function dequeueInflow(uint256 calldataPos) internal pure returns (
        Inflow memory inflow,
        uint256 end
    ) {
        assembly {            
            calldatacopy(inflow, calldataPos, 0x40)
            end := add(calldataPos, 0x40)
        }
    }

    function dequeueOutflowArr(uint256 calldataPos) internal pure returns (
        Outflow[] memory outflow,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 outflowLen;
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            mstore(free_mem, 0)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            outflowLen := mload(free_mem)
            cp := add(cp, 0x01)
            mstore(0x40, add(free_mem, 0x20))
        }
        outflow = new Outflow[](outflowLen);
        for (uint256 i = 0; i < outflowLen; i++) {
            (outflow[i], cp) = dequeueOutflow(cp);
        }
        end = cp;
    }

    function dequeueOutflow(uint256 calldataPos) internal pure returns (
        Outflow memory outflow,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        assembly {        
            // Outflow.note
            calldatacopy(outflow, cp, 0x20)
            cp := add(cp, 0x20)
            // Outflow.outflowType
            calldatacopy(add(outflow, 0x3f), cp, 0x01)
            cp := add(cp, 0x01)
        }
        if (outflow.outflowType != 0) {
            PublicData memory publicData;
            assembly {        
                // PublicData.to
                calldatacopy(add(publicData, 0x0c), cp, 0x14)
                cp := add(cp, 0x14)
                // PublicData.eth
                calldatacopy(add(publicData, 0x20), cp, 0x20)
                cp := add(cp, 0x20)
                // PublicData.token
                calldatacopy(add(publicData, 0x4c), cp, 0x14)
                cp := add(cp, 0x14)
                // PublicData amount
                calldatacopy(add(publicData, 0x60), cp, 0x20)
                cp := add(cp, 0x20)
                // PublicData.nft
                calldatacopy(add(publicData, 0x80), cp, 0x20)
                cp := add(cp, 0x20)
                // PublicData.fee
                calldatacopy(add(publicData, 0xa0), cp, 0x20)
                cp := add(cp, 0x20)
            }
            outflow.publicData = publicData;
        }
        end = cp;
    }
    
    function dequeueUint(uint256 calldataPos) internal pure returns (
        uint256 val,
        uint256 end
    ) {
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            calldatacopy(free_mem, calldataPos, 0x20)
            val := mload(free_mem)
            end := add(calldataPos, 0x20)
            mstore(0x40, add(free_mem, 0x20))
        }
    }

    function dequeueBytes32(uint256 calldataPos) internal pure returns (
        bytes32 val,
        uint256 end
    ) {
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            calldatacopy(free_mem, calldataPos, 0x20)
            val := mload(free_mem)
            end := add(calldataPos, 0x20)
            mstore(0x40, add(free_mem, 0x20))
        }
    }

    function dequeueByte(uint256 calldataPos) internal pure returns (
        uint8 val,
        uint256 end
    ) {
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            mstore(free_mem, 0)
            calldatacopy(add(free_mem, 0x1f), calldataPos, 0x01)
            val := mload(free_mem)
            end := add(calldataPos, 0x01)
            mstore(0x40, add(free_mem, 0x20))
        }
    }

    function dequeueG1Point(uint256 calldataPos) internal pure returns (
        G1Point memory point,
        uint256 end
    ) {
        assembly {
            calldatacopy(point, calldataPos, 0x40)
            end := add(calldataPos, 0x40)
        }
    }
    
    function dequeueUint2Arr(uint256 calldataPos) internal pure returns (
        uint256[2] memory arr,
        uint256 end
    ) {
        assembly {
            calldatacopy(arr, calldataPos, 0x40)
            end := add(calldataPos, 0x40)
        }
    }

    function dequeueG2Point(uint256 calldataPos) internal pure returns (
        G2Point memory point,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        (point.X, cp) = dequeueUint2Arr(cp);
        (point.Y, cp) = dequeueUint2Arr(cp);
        end = cp;
    }

    function dequeueProof(uint256 calldataPos) internal pure returns (
        Proof memory proof,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        (proof.a, cp) = dequeueG1Point(cp);
        (proof.b, cp) = dequeueG2Point(cp);
        (proof.c, cp) = dequeueG1Point(cp);
        end = cp;
    }
    
    function dequeueMemo(uint256 calldataPos) internal pure returns (
        bytes memory memo,
        uint256 end
    ) {
        assembly {
            let free_mem := mload(0x40)
            memo := free_mem
            mstore(memo, 0x51)
            calldatacopy(add(memo, 0x20), calldataPos, 0x51)
            end := add(calldataPos, 0x51)
            mstore(0x40, add(free_mem, 0x71))
        }
    }
    
    function dequeueMassDeposits(uint256 calldataPos) internal pure returns (
        MassDeposit[] memory massDeposits,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 len;
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            mstore(free_mem, 0)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            len := mload(free_mem)
            cp := add(cp, 0x01)
            mstore(0x40, add(free_mem, 0x20))
        }
        massDeposits = new MassDeposit[](len);
        for (uint256 i = 0; i < len; i++) {
            (massDeposits[i], cp) = dequeueMassDeposit(cp);
        }
        end = cp;
    }
    
    function dequeueMassDeposit(uint256 calldataPos) internal pure returns (
        MassDeposit memory massDeposit,
        uint256 end
    ) {
        assembly {            
            calldatacopy(massDeposit, calldataPos, 0x40)
            end := add(calldataPos, 0x40)
        }
    }

    function dequeueMassMigrations(uint256 calldataPos) internal pure returns (
        MassMigration[] memory massMigrations,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 len;
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            mstore(free_mem, 0)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            len := mload(free_mem)
            cp := add(cp, 0x01)
            mstore(0x40, add(free_mem, 0x20))
        }
        massMigrations = new MassMigration[](len);
        for (uint256 i = 0; i < len; i++) {
            (massMigrations[i], cp) = dequeueMassMigration(cp);
        }
        end = cp;
    }
    
    function dequeueMassMigration(uint256 calldataPos) internal pure returns (
        MassMigration memory migration,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        (migration.destination, cp) = dequeueAddress(cp);
        (migration.totalETH, cp) = dequeueUint(cp);
        (migration.migratingLeaves, cp) = dequeueMassDeposit(cp);
        (migration.erc20, cp) = dequeueERC20Migrations(cp);
        (migration.erc721, cp) = dequeueERC721Migrations(cp);
        end = cp;
    }

    function dequeueAddress(uint256 calldataPos) internal pure returns (
        address val,
        uint256 end
    ) {
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            mstore(free_mem, 0)
            calldatacopy(add(free_mem, 0x0c), calldataPos, 0x14)
            val := mload(free_mem)
            end := add(calldataPos, 0x14)
            mstore(0x40, add(free_mem, 0x20))
        }
    }

    function dequeueERC20Migrations(uint256 calldataPos) internal pure returns (
        ERC20Migration[] memory erc20,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 len;
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            mstore(free_mem, 0)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            len := mload(free_mem)
            cp := add(cp, 0x01)
            mstore(0x40, add(free_mem, 0x20))
        }
        erc20 = new ERC20Migration[](len);
        for (uint256 i = 0; i < len; i++) {
            (erc20[i], cp) = dequeueERC20Migration(cp);
        }
        end = cp;
    }

    function dequeueERC20Migration(uint256 calldataPos) internal pure returns (
        ERC20Migration memory migration,
        uint256 end
    ) {
        assembly {        
            mstore(migration, 0)
            calldatacopy(add(migration, 0x0c), calldataPos, 0x34)
            end := add(calldataPos, 0x34)
        }
    }
    
    function dequeueERC721Migrations(uint256 calldataPos) internal pure returns (
        ERC721Migration[] memory erc721,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 len;
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            mstore(free_mem, 0)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            len := mload(free_mem)
            cp := add(cp, 0x01)
            mstore(0x40, add(free_mem, 0x20))
        }
        erc721 = new ERC721Migration[](len);
        for (uint256 i = 0; i < len; i++) {
            (erc721[i], cp) = dequeueERC721Migration(cp);
        }
        end = cp;
    }
    
    function dequeueERC721Migration(uint256 calldataPos) internal pure returns (
        ERC721Migration memory migration,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        (migration.addr, cp) = dequeueAddress(cp);
        (migration.nfts, cp) = dequeueNfts(cp);
        end = cp;
    }
    
    function dequeueNfts(uint256 calldataPos) internal pure returns (
        uint256[] memory nfts,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 len;
        assembly {            
            // load free memory
            let free_mem := mload(0x40)
            nfts := free_mem
            mstore(nfts, 0)
            calldatacopy(add(nfts, 0x1f), cp, 0x01)
            len := mload(nfts)
            cp := add(cp, 0x01)
            let total_len_of_items := mul(0x20, len)
            calldatacopy(add(nfts, 0x20), cp, total_len_of_items)
            cp := add(cp, total_len_of_items)
            mstore(0x40, add(free_mem, add(0x20, total_len_of_items)))
        }
        end = cp;
    }

    function headerFromCalldataAt(uint256 paramIndex) internal pure returns (Header memory) {
        uint256 start = 4 + abi.decode(msg.data[4 + 32*paramIndex:4 + 32*(paramIndex+1)], (uint256));
        uint256 cp = start + 0x20; //calldata position
        Header memory _header;
        (_header, cp) = dequeueHeader(cp);
        return _header;
    }

    function massMigrationFromCalldataAt(uint256 paramIndex) internal pure returns (MassMigration memory) {
        uint256 start = 4 + abi.decode(msg.data[4 + 32*paramIndex:4 + 32*(paramIndex+1)], (uint256));
        uint256 cp = start + 0x20; //calldata position
        MassMigration memory _massMigration;
        (_massMigration, cp) = dequeueMassMigration(cp);
        return _massMigration;
    }

    function finalizationFromCalldataAt(uint256 paramIndex) internal pure returns (Finalization memory) {
        // 4 means the length of the function signature in the calldata
        uint256 start = 4 + abi.decode(msg.data[4 + 32*paramIndex:4 + 32*(paramIndex+1)], (uint256));
        uint256 cp = start + 0x20; //calldata position
        Finalization memory _finalization;
        (_finalization.proposalChecksum, cp) = dequeueBytes32(cp);
        (_finalization.header, cp) = dequeueHeader(cp);
        (_finalization.massDeposits, cp) = dequeueMassDeposits(cp);
        (_finalization.massMigrations, cp) = dequeueMassMigrations(cp);
        uint256 dataLen;
        assembly {
            let p := mload(0x40)
            calldatacopy(p, start, 0x20)
            dataLen := mload(p)
            mstore(0x40, add(p, 0x20))
        }
        if(dataLen != cp - start - 0x20) {
            revert("Serialization has a problem");
        }
        return _finalization;
    }
}

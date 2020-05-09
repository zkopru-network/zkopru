pragma solidity >= 0.6.0;

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

library Deserializer {    
    /**
     * @dev Block data will be serialized with the following structure
     *      https://github.com/wanseob/zkopru/wiki/Serialization
     * @param paramIndex The index of the block calldata parameter in the external function
     */
    function blockFromCalldataAt(uint paramIndex) internal pure returns (Block memory) {
        /// 4 means the length of the function signature in the calldata
        uint start = 4 + abi.decode(msg.data[4 + 32*paramIndex:4 + 32*(paramIndex+1)], (uint));
        uint cp = start + 0x20; //calldata position
        Block memory _block;
        (_block.header, cp) = dequeueHeader(cp);
        (_block.body.txs, cp) = dequeueTxs(cp);
        (_block.body.massDeposits, cp) = dequeueMassDeposits(cp);
        (_block.body.massMigrations, cp) = dequeueMassMigrations(cp);
        uint dataLen;
        assembly {
            let p := mload(0x40)
            calldatacopy(p, start, 0x20)
            dataLen := mload(p)
            mstore(0x40, add(p, 0x20))
        }
        if(dataLen != cp - start - 0x20) {
            revert("Serialization has a problem");
        }
        return _block;
    }

    function dequeueHeader(uint calldataPos) internal pure returns (
        Header memory header,
        uint end
    ) {
        assembly {
            // Header
            mstore(header, 0) // put zeroes into the first 32bytes
            calldatacopy(add(header, 0x0c), calldataPos, 0x174) // header_len := 0x214 = 0x14 + 16 * 0x20;
        }
        end = calldataPos + 0x174;
    }

    function dequeueTxs(uint calldataPos) internal pure returns (
        Transaction[] memory txs,
        uint end
    ) {
        uint cp = calldataPos;
        uint txsLen;
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
        for (uint i = 0; i < txsLen; i++) {
            (txs[i], cp) = dequeueTx(cp);
        }
        end = cp;
    }

    function dequeueTx(uint calldataPos) internal pure returns (
        Transaction memory transaction,
        uint end
    ) {
        uint cp = calldataPos;
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

    function dequeueInflowArr(uint calldataPos) internal pure returns (
        Inflow[] memory inflow,
        uint end
    ) {
        uint cp = calldataPos;
        uint inflowLen;
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
        for (uint i = 0; i < inflowLen; i++) {
            (inflow[i], cp) = dequeueInflow(cp);
        }
        end = cp;
    }

    function dequeueInflow(uint calldataPos) internal pure returns (
        Inflow memory inflow,
        uint end
    ) {
        assembly {            
            calldatacopy(inflow, calldataPos, 0x40)
            end := add(calldataPos, 0x40)
        }
    }

    function dequeueOutflowArr(uint calldataPos) internal pure returns (
        Outflow[] memory outflow,
        uint end
    ) {
        uint cp = calldataPos;
        uint outflowLen;
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
        for (uint i = 0; i < outflowLen; i++) {
            (outflow[i], cp) = dequeueOutflow(cp);
        }
        end = cp;
    }

    function dequeueOutflow(uint calldataPos) internal pure returns (
        Outflow memory outflow,
        uint end
    ) {
        uint cp = calldataPos;
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
    
    function dequeueUint(uint calldataPos) internal pure returns (
        uint val,
        uint end
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

    function dequeueByte(uint calldataPos) internal pure returns (
        uint8 val,
        uint end
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

    function dequeueProof(uint calldataPos) internal pure returns (
        Proof memory proof,
        uint end
    ) {
        assembly {
            let free_mem := mload(0x40)
            proof := free_mem
            calldatacopy(free_mem, calldataPos, 0x100)
            end := add(calldataPos, 0x100)
            mstore(0x40, add(free_mem, 0x100))
        }
    }
    
    function dequeueMemo(uint calldataPos) internal pure returns (
        bytes memory memo,
        uint end
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
    
    function dequeueMassDeposits(uint calldataPos) internal pure returns (
        MassDeposit[] memory massDeposits,
        uint end
    ) {
        uint cp = calldataPos;
        uint len;
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
        for (uint i = 0; i < len; i++) {
            (massDeposits[i], cp) = dequeueMassDeposit(cp);
        }
        end = cp;
    }
    
    function dequeueMassDeposit(uint calldataPos) internal pure returns (
        MassDeposit memory massDeposit,
        uint end
    ) {
        assembly {            
            calldatacopy(massDeposit, calldataPos, 0x40)
            end := add(calldataPos, 0x40)
        }
    }

    function dequeueMassMigrations(uint calldataPos) internal pure returns (
        MassMigration[] memory massMigrations,
        uint end
    ) {
        uint cp = calldataPos;
        uint len;
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
        for (uint i = 0; i < len; i++) {
            (massMigrations[i], cp) = dequeueMassMigration(cp);
        }
        end = cp;
    }
    
    function dequeueMassMigration(uint calldataPos) internal pure returns (
        MassMigration memory migration,
        uint end
    ) {
        uint cp = calldataPos;
        (migration.destination, cp) = dequeueAddress(cp);
        (migration.totalETH, cp) = dequeueUint(cp);
        (migration.migratingLeaves, cp) = dequeueMassDeposit(cp);
        (migration.erc20, cp) = dequeueERC20Migrations(cp);
        (migration.erc721, cp) = dequeueERC721Migrations(cp);
        end = cp;
    }

    function dequeueAddress(uint calldataPos) internal pure returns (
        address val,
        uint end
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

    function dequeueERC20Migrations(uint calldataPos) internal pure returns (
        ERC20Migration[] memory erc20,
        uint end
    ) {
        uint cp = calldataPos;
        uint len;
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
        for (uint i = 0; i < len; i++) {
            (erc20[i], cp) = dequeueERC20Migration(cp);
        }
        end = cp;
    }

    function dequeueERC20Migration(uint calldataPos) internal pure returns (
        ERC20Migration memory migration,
        uint end
    ) {
        assembly {        
            mstore(migration, 0)
            calldatacopy(add(migration, 0x0c), calldataPos, 0x34)
            end := add(calldataPos, 0x34)
        }
    }
    
    function dequeueERC721Migrations(uint calldataPos) internal pure returns (
        ERC721Migration[] memory erc721,
        uint end
    ) {
        uint cp = calldataPos;
        uint len;
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
        for (uint i = 0; i < len; i++) {
            (erc721[i], cp) = dequeueERC721Migration(cp);
        }
        end = cp;
    }
    
    function dequeueERC721Migration(uint calldataPos) internal pure returns (
        ERC721Migration memory migration,
        uint end
    ) {
        uint cp = calldataPos;
        (migration.addr, cp) = dequeueAddress(cp);
        (migration.nfts, cp) = dequeueNfts(cp);
        end = cp;
    }
    
    function dequeueNfts(uint calldataPos) internal pure returns (
        uint[] memory nfts,
        uint end
    ) {
        uint cp = calldataPos;
        uint len;
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

    function headerFromCalldataAt(uint paramIndex) internal pure returns (Header memory) {
        uint start = 4 + abi.decode(msg.data[4 + 32*paramIndex:4 + 32*(paramIndex+1)], (uint));
        uint cp = start + 0x20; //calldata position
        Header memory _header;
        (_header, cp) = dequeueHeader(cp);
        return _header;
    }

    function massMigrationFromCalldataAt(uint paramIndex) internal pure returns (MassMigration memory) {
        uint start = 4 + abi.decode(msg.data[4 + 32*paramIndex:4 + 32*(paramIndex+1)], (uint));
        uint cp = start + 0x20; //calldata position
        MassMigration memory _massMigration;
        (_massMigration, cp) = dequeueMassMigration(cp);
        return _massMigration;
    }

    function finalizationFromCalldataAt(uint paramIndex) internal pure returns (Finalization memory) {
        /// 4 means the length of the function signature in the calldata
        uint start = 4 + abi.decode(msg.data[4 + 32*paramIndex:4 + 32*(paramIndex+1)], (uint));
        uint cp = start + 0x20; //calldata position
        Finalization memory _finalization;
        (_finalization.header, cp) = dequeueHeader(cp);
        (_finalization.massDeposits, cp) = dequeueMassDeposits(cp);
        (_finalization.massMigrations, cp) = dequeueMassMigrations(cp);
        uint dataLen;
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

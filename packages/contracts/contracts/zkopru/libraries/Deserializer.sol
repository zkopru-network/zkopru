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
     * @dev This retrieves block data from the calldata and returns its hash value.
     * @param paramIndex The index of the block calldata parameter in the external function
     */
    function proposalIdFromCalldata(uint256 paramIndex)
    internal
    pure
    returns (bytes32 proposalId)
    {
        // This function assumes that bytes type of block data exists in the calldata at the given parameter index.
        // Get the position where the block data starts.
        uint256 pointer = getPointerAddress(paramIndex);
        // The first 32 bytes are the length of the bytes data.
        uint256 len;
        assembly {
            len := calldataload(pointer)
        }
        // Using slice function memcopy the calldata into the hash function.
        return keccak256(bytes(msg.data[pointer + 32: pointer + 32 + len]));
    }

    /**
     * @dev This retrieves block data from the calldata and returns its hash value.
     * @param paramIndex The index of the block calldata parameter in the external function
     */
    function proposerAddressFromCalldata(uint256 paramIndex)
    internal
    pure
    returns (address proposer)
    {
        // This function assumes that bytes type of block data exists in the calldata at the given parameter index.
        // Get the position where the block data starts.
        uint256 start = getPointerAddress(paramIndex);
        // Skip the first 32 bytes because it indicates the length of the block data.
        uint256 cp = start + 0x20;
        // Now dequeue header from the calldata.
        Header memory header;
        (header, cp) = dequeueHeader(cp);
        return header.proposer;
    }

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
        // This function assumes that bytes type of block data exists in the calldata at the given parameter index.
        // Get the position where the block data starts.
        uint256 start = getPointerAddress(paramIndex);
        // The first 32 bytes are the length of the bytes data.
        uint256 len;
        assembly {
            len := calldataload(start)
        }
        uint256 cp = start + 0x20;
        // Deserialize block data
        Block memory _block;
        (_block.header, cp) = dequeueHeader(cp);
        (_block.body.txs, cp) = dequeueTxs(cp);
        (_block.body.massDeposits, cp) = dequeueMassDeposits(cp);
        (_block.body.massMigrations, cp) = dequeueMassMigrations(cp);
        // Check that deserialization fits to the original data length
        if(len != cp - start - 0x20) {
            revert("Serialization has a problem");
        }
        return _block;
    }

    /**
     * @dev It dequeues Header struct from the calldata.
     * @param calldataPos The position of the header data in the calldata.
     * @return header The dequeued header object
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueHeader(uint256 calldataPos) internal pure returns (
        Header memory header,
        uint256 end
    ) {
        assembly {
            // Header
            mstore(header, 0) // put zeroes into the first 32bytes
            calldatacopy(add(header, 0x0c), calldataPos, 0x154) // header_len := 0x154 = 0x14 + 10 * 0x20;
        }
        // move the cursor and return
        end = calldataPos + 0x154;
    }

    /**
     * @dev It dequeues the array of l2 txs from the calldata.
     * @param calldataPos The position where the l2 tx array starts in the calldata.
     * @return txs The dequeued array of l2 txs.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueTxs(uint256 calldataPos) internal pure returns (
        Transaction[] memory txs,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 txsLen;
        assembly {            
            // Acquire the free memory pointer for array length
            let free_mem := mload(0x40)
            // Initialize the 32 bytes size slot with zeroes
            mstore(free_mem, 0)
            // Copy 2 bytes from the calldata and overwrite it onto the end of the memory slot. (30 bytes zeroes + 2 bytes data)
            calldatacopy(add(free_mem, 0x1e), cp, 0x02)
            // Point the txLen variable to the given memory slot
            txsLen := mload(free_mem)
            // Move cursor 2 bytes
            cp := add(cp, 0x02)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, 0x20))
        }
        txs = new Transaction[](txsLen);
        for (uint256 i = 0; i < txsLen; i++) {
            (txs[i], cp) = dequeueTx(cp);
        }
        end = cp;
    }
    
    /**
     * @dev It dequeues a tx from the calldata.
     * @param calldataPos The position where the tx data starts in the calldata.
     * @return transaction The dequeued l2 tx.
     * @return end The calldata cursor position to start to read the next items.
     */
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

    /**
     * @dev It dequeues the array of inflow of an l2 transaction from the calldata.
     * @param calldataPos The position where the array of inflow starts in the calldata.
     * @return inflow The dequeued array of inflow of an l2 transaction.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueInflowArr(uint256 calldataPos) internal pure returns (
        Inflow[] memory inflow,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 inflowLen;
        assembly {            
            // Acquire the free memory pointer for array length
            let free_mem := mload(0x40)
            // Initialize the 32 bytes size slot with zeroes
            mstore(free_mem, 0)
            // Copy 1 byte from the calldata and overwrite it onto the end of the memory slot. (31 bytes zeroes + 1 byte data)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            // Point the inflowLen variable to the given memory slot
            inflowLen := mload(free_mem)
            // Move the cursor 1 byte
            cp := add(cp, 0x01)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, 0x20))
        }
        inflow = new Inflow[](inflowLen);
        for (uint256 i = 0; i < inflowLen; i++) {
            (inflow[i], cp) = dequeueInflow(cp);
        }
        end = cp;
    }

    /**
     * @dev It dequeues the inflow of an l2 transaction from the calldata.
     * @param calldataPos The position where the inflow data starts in the calldata.
     * @return inflow The dequeued inflow data.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueInflow(uint256 calldataPos) internal pure returns (
        Inflow memory inflow,
        uint256 end
    ) {
        assembly {            
            calldatacopy(inflow, calldataPos, 0x40)
            end := add(calldataPos, 0x40)
        }
    }

    /**
     * @dev It dequeues the array of outflow of an l2 transaction from the calldata.
     * @param calldataPos The position where the array of outflow starts in the calldata.
     * @return outflow The dequeued array of outflow of an l2 transaction.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueOutflowArr(uint256 calldataPos) internal pure returns (
        Outflow[] memory outflow,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 outflowLen;
        assembly {            
            // Acquire the free memory pointer for array length
            let free_mem := mload(0x40)
            // Initialize the 32 bytes size slot with zeroes
            mstore(free_mem, 0)
            // Copy 1 byte from the calldata and overwrite it onto the end of the memory slot. (31 bytes zeroes + 1 byte data)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            // Point the outflowLen variable to the given memory slot
            outflowLen := mload(free_mem)
            // Move the cursor 1 byte
            cp := add(cp, 0x01)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, 0x20))
        }
        outflow = new Outflow[](outflowLen);
        for (uint256 i = 0; i < outflowLen; i++) {
            (outflow[i], cp) = dequeueOutflow(cp);
        }
        end = cp;
    }

    /**
     * @dev It dequeues the outflow of an l2 transaction from the calldata.
     * @param calldataPos The position where the outflow data starts in the calldata.
     * @return outflow The dequeued outflow data.
     * @return end The calldata cursor position to start to read the next items.
     */
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
    
    /**
     * @dev It dequeues 32 bytes from the calldata and returns an uint256 value.
     * @param calldataPos The position where the uint256 starts in the calldata.
     * @return val The dequeued uint256 value.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueUint(uint256 calldataPos) internal pure returns (
        uint256 val,
        uint256 end
    ) {
        assembly {            
            // Acquire the free memory pointer
            let free_mem := mload(0x40)
            // Copy 32 bytes from the calldata and overwrite it onto the memory slot.
            calldatacopy(free_mem, calldataPos, 0x20)
            // Point the val variable to the given memory slot
            val := mload(free_mem)
            // Move the cursor 32 bytes
            end := add(calldataPos, 0x20)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, 0x20))
        }
    }

    /**
     * @dev It dequeues 32 bytes from the calldata and returns it.
     * @param calldataPos The position where the bytes32 starts in the calldata.
     * @return val The dequeued bytes32 value.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueBytes32(uint256 calldataPos) internal pure returns (
        bytes32 val,
        uint256 end
    ) {
        assembly {            
            // Acquire the free memory pointer
            let free_mem := mload(0x40)
            // Copy 32 bytes from the calldata and overwrite it onto the memory slot.
            calldatacopy(free_mem, calldataPos, 0x20)
            // Point the val variable to the given memory slot
            val := mload(free_mem)
            // Move the cursor 32 bytes
            end := add(calldataPos, 0x20)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, 0x20))
        }
    }

    /**
     * @dev It dequeues a byte from the calldata and returns it.
     * @param calldataPos The position where the byte starts in the calldata.
     * @return val The dequeued byte value.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueByte(uint256 calldataPos) internal pure returns (
        uint8 val,
        uint256 end
    ) {
        assembly {            
            // Acquire the free memory pointer
            let free_mem := mload(0x40)
            // Initialize the 32 bytes size slot with zeroes
            mstore(free_mem, 0)
            // Copy 1 byte from the calldata and overwrite it onto the end of the memory slot. (31 bytes zeroes + 1 byte data)
            calldatacopy(add(free_mem, 0x1f), calldataPos, 0x01)
            // Point the val variable to the given memory slot
            val := mload(free_mem)
            // Move the cursor 1 byte
            end := add(calldataPos, 0x01)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, 0x20))
        }
    }

    /**
     * @dev It dequeues a G1Point for SNARK pairing from the calldata.
     * @param calldataPos The position where the G1Point data starts in the calldata.
     * @return point The dequeued G1Point.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueG1Point(uint256 calldataPos) internal pure returns (
        G1Point memory point,
        uint256 end
    ) {
        assembly {
            // Because G1Point has 64 bytes size, we can simply copy the data from calldata to the memory slot
            calldatacopy(point, calldataPos, 0x40)
            // Move cursor 64 bytes.
            end := add(calldataPos, 0x40)
        }
    }
    
    /**
     * @dev It dequeues an array of length 2 uint256 from the calldata.
     * @param calldataPos The position where the array starts in the calldata.
     * @return arr The dequeued array of uint256.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueUint2Arr(uint256 calldataPos) internal pure returns (
        uint256[2] memory arr,
        uint256 end
    ) {
        assembly {
            // Because Uint256[2] has 64 bytes size, we can simply copy the data from calldata to the memory slot
            calldatacopy(arr, calldataPos, 0x40)
            // Move cursor 64 bytes.
            end := add(calldataPos, 0x40)
        }
    }

    /**
     * @dev It dequeues a G2Point for SNARK pairing from the calldata.
     * @param calldataPos The position where the G2Point data starts in the calldata.
     * @return point The dequeued G2Point.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueG2Point(uint256 calldataPos) internal pure returns (
        G2Point memory point,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        (point.X, cp) = dequeueUint2Arr(cp);
        (point.Y, cp) = dequeueUint2Arr(cp);
        end = cp;
    }

    /**
     * @dev It dequeues a Proof for SNARK verification from the calldata.
     * @param calldataPos The position where the Proof data starts in the calldata.
     * @return proof The dequeued Proof.
     * @return end The calldata cursor position to start to read the next items.
     */
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
    
    /**
     * @dev It dequeues the memo field of an l2 transaction.
     * @param calldataPos The position where the memo field starts in the calldata.
     * @return memo The dequeued memo data.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueMemo(uint256 calldataPos) internal pure returns (
        bytes memory memo,
        uint256 end
    ) {
        assembly {
            // Acquire the free memory pointer for the memo object
            let free_mem := mload(0x40)
            // Point memo object to the acquired memory slot.
            memo := free_mem
            // Set memo data's length as 81 bytes(0x51 = 81)
            mstore(memo, 0x51)
            // Copy 81 bytes from calldata fo the memory
            calldatacopy(add(memo, 0x20), calldataPos, 0x51)
            // Move cursor 81 bytes
            end := add(calldataPos, 0x51)
            // Release the free memory
            mstore(0x40, add(free_mem, 0x71))
        }
    }
    
    /**
     * @dev It dequeues the array of mass deposits from the calldata.
     * @param calldataPos The position where the array starts in the calldata.
     * @return massDeposits The dequeued array of mass deposits.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueMassDeposits(uint256 calldataPos) internal pure returns (
        MassDeposit[] memory massDeposits,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 len;
        assembly {
            // Acquire the free memory pointer for the length of the array
            let free_mem := mload(0x40)
            // Initialize the 32 bytes size slot with zeroes
            mstore(free_mem, 0)
            // Copy 1 byte from the calldata and overwrite it onto the end of the memory slot. (31 bytes zeroes + 1 byte data)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            // Point the length variable to the given memory slot
            len := mload(free_mem)
            // Move the cursor 1 byte
            cp := add(cp, 0x01)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, 0x20))
        }
        massDeposits = new MassDeposit[](len);
        for (uint256 i = 0; i < len; i++) {
            (massDeposits[i], cp) = dequeueMassDeposit(cp);
        }
        end = cp;
    }
    
    /**
     * @dev It dequeues a mass deposit from the calldata.
     * @param calldataPos The position where the mass deposit data starts in the calldata.
     * @return massDeposit The dequeued mass deposit.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueMassDeposit(uint256 calldataPos) internal pure returns (
        MassDeposit memory massDeposit,
        uint256 end
    ) {
        assembly {
            // Because MassDeposit has 64 bytes size, we can simply copy the data from calldata to the memory slot
            calldatacopy(massDeposit, calldataPos, 0x40)
            // Move cursor 64 bytes.
            end := add(calldataPos, 0x40)
        }
    }

    /**
     * @dev It dequeues the array of mass migrations from the calldata.
     * @param calldataPos The position where the array of mass migration data starts in the calldata.
     * @return massMigrations The dequeued array of mass migrations.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueMassMigrations(uint256 calldataPos) internal pure returns (
        MassMigration[] memory massMigrations,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 len;
        assembly {  
            // Acquire the free memory pointer for the length of the array
            let free_mem := mload(0x40)
            // Initialize the 32 bytes size slot with zeroes
            mstore(free_mem, 0)
            // Copy 1 byte from the calldata and overwrite it onto the end of the memory slot. (31 bytes zeroes + 1 byte data)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            // Point the length variable to the given memory slot
            len := mload(free_mem)
            // Move the cursor 1 byte
            cp := add(cp, 0x01)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, 0x20))
        }
        massMigrations = new MassMigration[](len);
        for (uint256 i = 0; i < len; i++) {
            (massMigrations[i], cp) = dequeueMassMigration(cp);
        }
        end = cp;
    }
    
    /**
     * @dev It dequeues a mass migrations from the calldata.
     * @param calldataPos The position where the mass migration data starts in the calldata.
     * @return migration The dequeued mass migration.
     * @return end The calldata cursor position to start to read the next items.
     */
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

    /**
     * @dev It dequeues 20 bytes from the calldata and returns an address value.
     * @param calldataPos The position where the address data starts in the calldata.
     * @return val The dequeued address value.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueAddress(uint256 calldataPos) internal pure returns (
        address val,
        uint256 end
    ) {
        assembly {            
            // Acquire the free memory pointer
            let free_mem := mload(0x40)
            // Initialize the 32 bytes size slot with zeroes
            mstore(free_mem, 0)
            // Copy 20 bytes from the calldata and overwrite it onto the end of the memory slot. (12 bytes zeroes + 20 bytes data)
            calldatacopy(add(free_mem, 0x0c), calldataPos, 0x14)
            // Point the variable to the given memory slot
            val := mload(free_mem)
            // Move the cursor 20 bytes
            end := add(calldataPos, 0x14)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, 0x20))
        }
    }

    /**
     * @dev It dequeues the array of ERC20Migrations from the calldata.
     * @param calldataPos The position where the array data starts in the calldata.
     * @return erc20 The dequeued array of erc20 migrations.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueERC20Migrations(uint256 calldataPos) internal pure returns (
        ERC20Migration[] memory erc20,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 len;
        assembly {
            // Acquire the free memory pointer for the length of the array
            let free_mem := mload(0x40)
            // Initialize the 32 bytes size slot with zeroes
            mstore(free_mem, 0)
            // Copy 1 byte from the calldata and overwrite it onto the end of the memory slot. (31 bytes zeroes + 1 byte data)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            // Point the length variable to the given memory slot
            len := mload(free_mem)
            // Move the cursor 1 byte
            cp := add(cp, 0x01)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, 0x20))
        }
        erc20 = new ERC20Migration[](len);
        for (uint256 i = 0; i < len; i++) {
            (erc20[i], cp) = dequeueERC20Migration(cp);
        }
        end = cp;
    }

    /**
     * @dev It dequeues an ERC20Migrations from the calldata.
     * @param calldataPos The position where the array data starts in the calldata.
     * @return migration The dequeued erc20 migration.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueERC20Migration(uint256 calldataPos) internal pure returns (
        ERC20Migration memory migration,
        uint256 end
    ) {
        assembly {
            // Initialize with zeroes
            mstore(migration, 0)
            // Copy 52 bytes and overwrite on the the end of the memory slot(10 bytes zero + 20 bytes address + 32 bytes amount)
            calldatacopy(add(migration, 0x0c), calldataPos, 0x34)
            // Move cursor 52 bytes
            end := add(calldataPos, 0x34)
        }
    }
    
    /**
     * @dev It dequeues the array of ERC721Migrations from the calldata.
     * @param calldataPos The position where the array data starts in the calldata.
     * @return erc721 The dequeued array of erc721 migrations.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueERC721Migrations(uint256 calldataPos) internal pure returns (
        ERC721Migration[] memory erc721,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 len;
        assembly {
            // Acquire the free memory pointer for the length of the array
            let free_mem := mload(0x40)
            // Initialize the 32 bytes size slot with zeroes
            mstore(free_mem, 0)
            // Copy 1 byte from the calldata and overwrite it onto the end of the memory slot. (31 bytes zeroes + 1 byte data)
            calldatacopy(add(free_mem, 0x1f), cp, 0x01)
            // Point the length variable to the given memory slot
            len := mload(free_mem)
            // Move the cursor 1 byte
            cp := add(cp, 0x01)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, 0x20))
        }
        erc721 = new ERC721Migration[](len);
        for (uint256 i = 0; i < len; i++) {
            (erc721[i], cp) = dequeueERC721Migration(cp);
        }
        end = cp;
    }
    
    /**
     * @dev It dequeues an ERC721Migrations from the calldata.
     * @param calldataPos The position where the array data starts in the calldata.
     * @return migration The dequeued erc721 migration.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueERC721Migration(uint256 calldataPos) internal pure returns (
        ERC721Migration memory migration,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        (migration.addr, cp) = dequeueAddress(cp);
        (migration.nfts, cp) = dequeueNfts(cp);
        end = cp;
    }
    
    /**
     * @dev It dequeues the array of NFTs from the calldata.
     * @param calldataPos The position where the array data starts in the calldata.
     * @return nfts The dequeued array of nfts.
     * @return end The calldata cursor position to start to read the next items.
     */
    function dequeueNfts(uint256 calldataPos) internal pure returns (
        uint256[] memory nfts,
        uint256 end
    ) {
        uint256 cp = calldataPos;
        uint256 len;
        assembly {
            // Acquire the free memory pointer for the length of the array
            let free_mem := mload(0x40)
            // Point the nfts variable to the given memory slot
            nfts := free_mem
            // Initialize the first 32 bytes slot with zeroes
            mstore(nfts, 0)
            // Copy 1 byte from the calldata and overwrite it onto the end of the memory slot. (31 bytes zeroes + 1 byte data)
            calldatacopy(add(nfts, 0x1f), cp, 0x01)
            // Point the length variable to the given memory slot and get the number of nfts
            len := mload(nfts)
            // Move the cursor 1 byte
            cp := add(cp, 0x01)
            // Get the total size of the nfts
            let total_len_of_items := mul(0x20, len)
            // Copy every nfts into the array
            calldatacopy(add(nfts, 0x20), cp, total_len_of_items)
            // Move the cursor
            cp := add(cp, total_len_of_items)
            // Release the free memory pointer
            mstore(0x40, add(free_mem, add(0x20, total_len_of_items)))
        }
        end = cp;
    }

    function headerFromCalldataAt(uint256 paramIndex) internal pure returns (Header memory) {
        uint256 start = getPointerAddress(paramIndex);
        uint256 cp = start + 0x20; //calldata position
        Header memory _header;
        (_header, cp) = dequeueHeader(cp);
        return _header;
    }

    function massMigrationFromCalldataAt(uint256 paramIndex) internal pure returns (MassMigration memory) {
        uint256 start = getPointerAddress(paramIndex);
        uint256 cp = start + 0x20; //calldata position
        MassMigration memory _massMigration;
        (_massMigration, cp) = dequeueMassMigration(cp);
        return _massMigration;
    }

    function finalizationFromCalldataAt(uint256 paramIndex) internal pure returns (Finalization memory) {
        // 4 means the length of the function signature in the calldata
        uint256 start = getPointerAddress(paramIndex);
        uint256 cp = start + 0x20; //calldata position
        Finalization memory _finalization;
        (_finalization.proposalChecksum, cp) = dequeueBytes32(cp);
        (_finalization.header, cp) = dequeueHeader(cp);
        (_finalization.massDeposits, cp) = dequeueMassDeposits(cp);
        (_finalization.massMigrations, cp) = dequeueMassMigrations(cp);
        uint256 len;
        assembly {
            len := calldataload(start)
        }
        if(len != cp - start - 0x20) {
            revert("Serialization has a problem");
        }
        return _finalization;
    }

    function getPointerAddress(uint256 paramIndex) private pure returns (uint256) {
        uint256 LEFT_PADDING = 4; // function sig 4 bytes
        uint256 pp = LEFT_PADDING + 32 * paramIndex; // pointer of pointer of the given parameter
        uint256 p;
        assembly {
            p := calldataload(pp)
        }
        return LEFT_PADDING + p;
    }
}

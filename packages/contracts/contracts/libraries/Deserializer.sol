pragma solidity >= 0.6.0;

import { Header, Body, Transaction, MassDeposit, MassMigration, Block, Finalization } from "./Types.sol";

library Deserializer {
    /**
     * @dev Block data will be serialized with the following structure
     *      https://github.com/wilsonbeam/zk-optimistic-rollup/wiki/Serialization
     * @param paramIndex The index of the block calldata parameter in the external function
     */
    function blockFromCalldataAt(uint paramIndex) internal pure returns (Block memory) {
        /// 4 means the length of the function signature in the calldata
        uint start = 4 + abi.decode(msg.data[4 + 32*paramIndex:4 + 32*(paramIndex+1)], (uint));
        Block memory _block;
        Transaction memory txs;
        assembly {
            function copy_and_move(curr_mem_cursor, curr_call_cursor) -> new_mem_cursor, new_calldata_cursor {
                calldatacopy(curr_mem_cursor, curr_call_cursor, 0x20)
                new_calldata_cursor := add(curr_call_cursor, 0x20)
                new_mem_cursor := add(curr_mem_cursor, 0x20)
            }
            function partial_copy_and_move(curr_mem_cursor, curr_call_cursor, len) -> new_mem_cursor, new_calldata_cursor { 
                mstore(curr_mem_cursor, 0) // initialization with zeroes
                calldatacopy(add(curr_mem_cursor, sub(0x20, len)), curr_call_cursor, len)
                new_calldata_cursor := add(curr_call_cursor, len)
                new_mem_cursor := add(curr_mem_cursor, 0x20)
            }
            function assign_and_move(curr_mem_cursor, value) -> new_mem_cursor {
                mstore(curr_mem_cursor, value)
                new_mem_cursor := add(curr_mem_cursor, 0x20)
            }
            function skip(mem_pos, n) -> new_mem_pos {
                new_mem_pos := add(mem_pos, mul(0x20, n))
            }

            // bytes.length
            let starting_mem_pos := mload(0x40)
            let mem_pos := starting_mem_pos
            let cp := start
            mem_pos, cp := copy_and_move(mem_pos, cp)
            let data_len := mload(starting_mem_pos)
            let _

            // Block memory _block;
            _block := mem_pos
            mem_pos := skip(mem_pos, 3) // id, header, body

            // Header
            mstore(add(_block, 0x20), mem_pos) // Block.header
            mstore(mem_pos, 0) // put zeroes into the first 32bytes
            calldatacopy(add(mem_pos, 0x0c), cp, 0x214) // header_len := 0x214 = 0x14 + 16 * 0x20;
            mem_pos := skip(mem_pos, 17)
            cp := add(cp, 0x214) // skip bytes.length + header.length

            // Body
            mstore(add(_block, 0x40), mem_pos) // Block.body
            txs := mem_pos
            mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x02) //txs.len
            mem_pos := skip(mem_pos, mload(txs))
            // reserve slots for p_txs_i
            for { let i := 0 } lt(i, mload(txs)) { i := add(i, 1) } {
                let p_txs_i := mem_pos
                mstore(add(txs, mul(0x20, add(i, 1))), p_txs_i) // init txs[i]
                mem_pos := skip(mem_pos, 5)

                /// Get items of Inflow[] array
                mstore(p_txs_i, mem_pos)// init txs[i].inflow
                mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x01) // inflow len
                let inflow_len := mload(sub(mem_pos, 0x20))
                let p_txs_i_inflow_j := mem_pos
                // reserve slots for p_txs_i_inflow_j
                mem_pos := skip(mem_pos, inflow_len)
                for { let j := 0 } lt(j, inflow_len) { j := add(j, 1) } {
                    // init inflow[j]
                    mstore(p_txs_i_inflow_j, mem_pos)
                    p_txs_i_inflow_j := add(p_txs_i_inflow_j, 0x20)
                    mem_pos, cp := copy_and_move(mem_pos, cp) // root
                    mem_pos, cp := copy_and_move(mem_pos, cp) // nullifier
                }
                /// Get items of Outflow[] array
                mstore(add(p_txs_i, 0x20), mem_pos)// init txs[i].outflow
                mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x01) // outflow len
                let outflow_len := mload(sub(mem_pos, 0x20))
                let p_txs_i_outflow_j := mem_pos
                // reserve slots for p_txs_i_outflow_j
                mem_pos := skip(mem_pos, outflow_len)
                for { let j := 0 } lt(j, outflow_len) { j := add(j, 1) } {
                    mstore(p_txs_i_outflow_j, mem_pos)
                    mem_pos, cp := copy_and_move(mem_pos, cp) // note
                    mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x01) // type
                    mstore(mem_pos, add(mem_pos, 0x20)) // public data
                    mem_pos := skip(mem_pos, 1)
                    // init outflow[j].publicData
                    switch mload(sub(mem_pos, 0x40))
                    case 0 // utxo
                    {
                        mem_pos := assign_and_move(mem_pos, 0)
                        mem_pos := assign_and_move(mem_pos, 0)
                        mem_pos := assign_and_move(mem_pos, 0)
                        mem_pos := assign_and_move(mem_pos, 0)
                        mem_pos := assign_and_move(mem_pos, 0)
                        mem_pos := assign_and_move(mem_pos, 0)
                    }
                    default // withdrawal & migration
                    {
                        mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x14) // to
                        mem_pos, cp := copy_and_move(mem_pos, cp) // eth
                        mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x14) // token
                        mem_pos, cp := copy_and_move(mem_pos, cp) // amount
                        mem_pos, cp := copy_and_move(mem_pos, cp) // nft
                        mem_pos, cp := copy_and_move(mem_pos, cp) // fee
                    }
                    p_txs_i_outflow_j := add(p_txs_i_outflow_j, 0x20)
                }
                // AtomicSwap
                _, cp := partial_copy_and_move(mem_pos, cp, 0x01) // swap existence
                switch mload(mem_pos)
                case 0 {
                    mstore(add(p_txs_i, 0x40), 0)// txs[i].swap = 0
                }
                default
                {
                    _, cp := copy_and_move(mem_pos, cp)
                    mstore(add(p_txs_i, 0x40), mload(mem_pos))// txs[i].swap = copied
                    mem_pos := add(mem_pos, 0x20)
                }
                //  Fee
                _, cp := copy_and_move(mem_pos, cp)
                mstore(add(p_txs_i, 0x60), mload(mem_pos))// txs[i].fee
                mem_pos := add(mem_pos, 0x20)
                // SNARK proof
                let p_tx_proof := mem_pos
                mstore(add(p_txs_i, 0x80), p_tx_proof)// init txs[i].outflow
                mem_pos := skip(mem_pos, 3)
                mstore(p_tx_proof, mem_pos) // proof.a
                mem_pos, cp := copy_and_move(mem_pos, cp) // a.X
                mem_pos, cp := copy_and_move(mem_pos, cp) // a.Y
                mstore(add(p_tx_proof, 0x20), mem_pos) // proof.b
                mem_pos, cp := copy_and_move(mem_pos, cp) // a.X[0]
                mem_pos, cp := copy_and_move(mem_pos, cp) // a.X[1]
                mem_pos, cp := copy_and_move(mem_pos, cp) // b.Y[0]
                mem_pos, cp := copy_and_move(mem_pos, cp) // b.Y[1]
                mstore(add(p_tx_proof, 0x60), mem_pos) // proof.c
                mem_pos, cp := copy_and_move(mem_pos, cp) // c.X
                mem_pos, cp := copy_and_move(mem_pos, cp) // c.Y
                // Memo
                _, cp := partial_copy_and_move(mem_pos, cp, 0x01) //txs.len
                let memo_len := mload(mem_pos)
                mem_pos := add(mem_pos, 0x20)
                calldatacopy(mem_pos, cp, memo_len)
                mem_pos := skip(mem_pos, memo_len)
            }
            /**
            let p_mass_deposits := mem_pos
            mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x02) //massDeposits.len
            let mass_deposits_len := mload(p_mass_deposits)
            let p_mass_deposit_0 := mem_pos
            // reserve slots for p_mass_deposit_i
            mem_pos := add(mem_pos, mul(mass_deposits_len, 0x20))
            for { let i := 0 } lt(i, mass_deposits_len) { i := add(i, 1) } {
                let p_mass_deposit_i := mem_pos
                mem_pos, cp := copy_and_move(mem_pos, cp) // merged
                mem_pos, cp := copy_and_move(mem_pos, cp) // fee
                mstore(add(p_mass_deposit_0, mul(0x20, i)), p_mass_deposit_i)
            }

            let p_mass_migrations := mem_pos
            mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x02) //massDeposits.len
            let mass_migrations_len := mload(p_mass_migrations)
            let p_mass_migration_0 := mem_pos
            // reserve slots for p_mass_migration_i
            mem_pos := add(mem_pos, mul(mass_migrations_len, 0x20))
            for { let i := 0 } lt(i, mass_migrations_len) { i := add(i, 1) } {
                let p_mass_migration_i_dest := mem_pos
                mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x14) // dest
                let p_mass_migration_i_eth := mem_pos
                mem_pos, cp := copy_and_move(mem_pos, cp) // eth
                let p_mass_migration_i_mass_deposit := mem_pos
                mem_pos, cp := copy_and_move(mem_pos, cp) // migration_i_mass_deposit_merged
                mem_pos, cp := copy_and_move(mem_pos, cp) // migration_i_mass_deposit_fee


                /// Get items of ERC20Migration[] array
                let p_mm_i_erc20 := mem_pos
                mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x01) // erc20 migration len
                let mm_i_erc20_len := mload(p_mm_i_erc20)
                let p_mm_i_erc20_0 := mem_pos
                // reserve slots for p_txs_i_inflow_j
                mem_pos := add(mem_pos, mul(mm_i_erc20_len, 0x20))
                for { let j := 0 } lt(j, mm_i_erc20_len) { j := add(j, 1) } {
                    // init ERC20Migration[j]
                    let p_mm_i_erc20_j := mem_pos
                    mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x14) // token addr
                    mem_pos, cp := copy_and_move(mem_pos, cp) // amount
                    mstore(add(p_mm_i_erc20_0, mul(0x20, j)), p_mm_i_erc20_j)
                }

                /// Get items of ERC721Migration[] array
                let p_mm_i_erc721 := mem_pos
                mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x01) // erc721 migration len
                let mm_i_erc721_len := mload(p_mm_i_erc721)
                let p_mm_i_erc721_0 := mem_pos
                // reserve slots for p_txs_i_inflow_j
                mem_pos := add(mem_pos, mul(mm_i_erc721_len, 0x20))
                for { let j := 0 } lt(j, mm_i_erc721_len) { j := add(j, 1) } {
                    // init ERC721Migration[j]
                    let p_mm_i_erc721_j_addr := mem_pos
                    mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x14) // token addr
                    let p_mm_i_erc721_j_nft := mem_pos
                    mem_pos, cp := partial_copy_and_move(mem_pos, cp, 0x01) // nft length
                    for { let k := 0 } lt(k, mload(p_mm_i_erc721_j_nft)) { k := add(k, 1) } {
                        mem_pos, cp := copy_and_move(mem_pos, cp) // nft[k]
                    }
                    let p_mm_i_erc721_j := mem_pos
                    mem_pos := assign_and_move(mem_pos, mload(p_mm_i_erc721_j_addr))
                    mem_pos := assign_and_move(mem_pos, p_mm_i_erc721_j_nft)
                    mstore(add(p_mm_i_erc721_0, mul(0x20, j)), p_mm_i_erc721_j)
                }
                let p_mass_migration_i := mem_pos
                mem_pos := assign_and_move(mem_pos, mload(p_mass_migration_i_dest))
                mem_pos := assign_and_move(mem_pos, mload(p_mass_migration_i_eth))
                mem_pos := assign_and_move(mem_pos, p_mass_migration_i_mass_deposit)
                mem_pos := assign_and_move(mem_pos, p_mm_i_erc20)
                mem_pos := assign_and_move(mem_pos, p_mm_i_erc721)
                mstore(add(p_mass_migration_0, mul(0x20, i)), p_mass_migration_i)
            }
            let p_body := mem_pos
            mem_pos := assign_and_move(mem_pos, p_txs)
            mem_pos := assign_and_move(mem_pos, p_mass_deposits)
            mem_pos := assign_and_move(mem_pos, p_mass_migrations)
            let submission_id := keccak256(starting_mem_pos, sub(mem_pos, starting_mem_pos))
            _block := mem_pos
            mem_pos := assign_and_move(mem_pos, submission_id)
            mem_pos := assign_and_move(mem_pos, p_header)
            mem_pos := assign_and_move(mem_pos, p_body)
            mstore(0x40, mem_pos)
            if not(eq(sub(cp, start), data_len)) {
                revert(0, 0)
            } 
            */
        }
        return _block;
    }
    
    function massMigrationFromCalldataAt(uint paramIndex) internal pure returns (MassMigration memory) {
    }
    function finalizationFromCalldataAt(uint paramIndex) internal pure returns (Finalization memory) {
    }
}

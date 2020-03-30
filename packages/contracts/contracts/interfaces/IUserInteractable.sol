pragma solidity >= 0.6.0;

interface IUserInteractable {
    /**
     * @notice Users can use zkopru network by submitting a new homomorphically hiden note.
     * @param note Should be same with the poseidon hash of (amount, fee, pubKey)
     * @param amount Amount to deposit
     * @param fee Amount of fee to give to the coordinator
     * @param pubKey EdDSA public key to use in the zkopru network
     */
    function deposit(
        uint note,
        uint amount,
        uint fee,
        uint[2] calldata pubKey
    ) external payable;

    /**
     * @notice Users can withdraw a note when your withdrawal tx is finalized
     * @param amount Amount to withdraw out.
     * @param proofHash Hash value of the SNARKs proof of your withdrawal transaction.
     * @param rootIndex Withdrawer should submit inclusion proof. Submit which withdrawal root to use.
     *                  withdrawables[0]: daily snapshot of withdrawable tree
     *                  withdrawables[latest]: the latest withdrawal tree
     *                  withdrawables[1~latest-1]: finalized tree
     * @param leafIndex The index of your withdrawal note's leaf in the given tree.
     * @param siblings Inclusion proof data
     */
    function withdraw(
        uint amount,
        bytes32 proofHash,
        uint rootIndex,
        uint leafIndex,
        uint[] calldata siblings
    ) external;

    /**
     * @notice Others can execute the withdrawal instead of the recipient account using ECDSA.
     * @param amount Amount to withdraw out.
     * @param to Address of the ECDSA signer
     * @param proofHash Hash value of the SNARKs proof of your withdrawal transaction.
     * @param rootIndex Withdrawer should submit inclusion proof. Submit which withdrawal root to use.
     *                  withdrawables[0]: daily snapshot of withdrawable tree
     *                  withdrawables[latest]: the latest withdrawal tree
     *                  withdrawables[1~latest-1]: finalized tree
     * @param leafIndex The index of your withdrawal note's leaf in the given tree.
     * @param siblings Inclusion proof data
     * @param v ECDSA signature v
     * @param r ECDSA signature r
     * @param s ECDSA signature s
     */
    function withdrawUsingSignature(
        uint amount,
        address to,
        bytes32 proofHash,
        uint rootIndex,
        uint leafIndex,
        uint[] calldata siblings,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
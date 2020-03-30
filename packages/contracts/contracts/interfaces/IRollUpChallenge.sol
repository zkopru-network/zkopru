pragma solidity >= 0.6.0;

interface IRollUpChallenge {
    /**
     * @dev Challenge when the submitted block's utxo tree transition is invalid.
     * @param proofId Id of your utxo roll up proof. See 'RollUpable.sol'.
     * @param deposits Submit all deposit leaves to be merged.
     * @param numOfUTXO Number of new UTXOs to help the computation.
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeUTXORollUp(uint proofId, uint[] calldata deposits, uint numOfUTXO, bytes calldata submission) external;

    /**
     * @dev Challenge when the submitted block's nullifier tree transition is invalid.
     * @param proofId Id of your nullifier roll up proof. See 'RollUpable.sol'.
     * @param numOfNullifiers Number of used nullifiers to help the computation.
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeNullifierRollUp(uint proofId, uint numOfNullifiers, bytes calldata submission) external;

    /**
     * @dev Challenge when the submitted block's withdrawal tree transition is invalid.
     * @param proofId Id of your withdrawal roll up proof. See 'RollUpable.sol'.
     * @param numOfWithdrawals Number of new withdrawal notes to help the computation.
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeWithdrawalRollUp(uint proofId, uint numOfWithdrawals, bytes calldata submission) external;
}
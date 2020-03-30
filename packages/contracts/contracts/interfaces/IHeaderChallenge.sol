pragma solidity >= 0.6.0;

interface IHeaderChallenge {
    /**
     * @dev Challenge when the submitted header's deposit root is invalid.
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeDepositRoot(bytes calldata submission) external;

    /**
     * @dev Challenge when the submitted header's transfer root is invalid.
     *      The transfer root in the header should be the merkle root of the transfer
     *      tx hash values.
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeTxRoot(bytes calldata submission) external;

    /**
     * @dev Challenge when the submitted header's migration root is invalid.
     *      The migration root in the header should be the merkle root of the migration
     *      tx hash values.
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeMigrationRoot(bytes calldata submission) external;

    /**
     * @dev Challenge when the submitted header's total fee is not same with
     *      the sum of the fees in every transactions in the block.
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeTotalFee(bytes calldata submission) external;
}
pragma solidity >= 0.6.0;

interface ICoordinatable {
    event NewProposal(uint256 proposalNum, bytes32 blockHash);    
    event Finalized(bytes32 blockHash);
    event MassDepositCommit(uint index, bytes32 merged, uint256 fee);

    /**
     * @notice Coordinator calls this function for the proof of stake.
     *         Coordinator should pay more than MINIMUM_STAKE. See 'Configurated.sol'
     *
     */
    function register() external payable;

    /**
     * @notice Coordinator can withdraw deposited stakes after the challenge period.
     */
    function deregister() external;

    /**
     * @dev Coordinator proposes a new block using this function. propose() will freeze
     *      the current mass deposit for the next block proposer, and will go through
     *      CHALLENGE_PERIOD.
     * @param submission Serialized newly minted block data
     */
    function propose(bytes calldata submission) external;

    /**
     * @dev Coordinator can finalize a submitted block if it isn't slashed during the
     *      challenge period. It updates the aggregated fee and withdrawal root.
     * @param submissionId Keccak256 of submitted block data
     * @param finalization Block data without tx details
     */
    function finalize(bytes32 submissionId, bytes calldata finalization) external;

    /**
     * @dev Coordinators can withdraw aggregated transaction fees.
     * @param amount Amount to withdraw.
     */
    function withdrawReward(uint amount) external;

    /**
     * @dev Coordinator can commit mass deposits. The pending deposits will be automatically
     *      committed by propose() block. But to start the first propose() block, there
     *      should be enough pending deposits, and the coordinator will commit them using
     *      this standalone function.
     */
    function commitMassDeposit() external;

    /**
     * @dev You can override this function to implement your own consensus logic.
     * @param proposerAddr Coordinator address to check the allowance of block proposing.
     */
    function isProposable(address proposerAddr) external view returns (bool);
}
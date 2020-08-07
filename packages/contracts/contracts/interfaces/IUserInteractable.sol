pragma solidity >= 0.6.0;

interface IUserInteractable {
    event Deposit(uint indexed queuedAt, uint note, uint fee);

    /**
     * @notice Users can use zkopru network by submitting a new homomorphically hiden note.
     * @param spendingPubKey P = poseidon(p*G, N) https://github.com/zkopru-network/zkopru/issues/34#issuecomment-666988505
     * @param salt 254bit salt for the privacy
     * @param eth Amount of Ether to deposit
     * @param token Token address of ERC20 or ERC721. It can be undefined.
     * @param amount Amount of ERC20 when the token param is defined and it is an ERC20
     * @param nft NFT id when the token param is defined and it is an ERC721
     * @param fee Amount of fee to give to the coordinator
     */
    function deposit(
        uint spendingPubKey,
        uint salt,
        uint eth,
        address token,
        uint amount,
        uint nft,
        uint fee
    ) external payable;

    /**
     * @notice Users can withdraw notes when only after they're finazlied.
     * @param note Note hash in layer 2. It is a poseidon hash
     * @param owner The original owner's address of the note
     * @param eth Amount of Ether to withdraw out
     * @param token Token address of ERC20 or ERC721. It can be undefined.
     * @param amount Amount of ERC20 when the token param is defined and it is an ERC20
     * @param nft NFT id when the token param is defined and it is an ERC721
     * @param fee Amount of fee to give to the coordinator
     * @param blockHash Finalized block hash to find the finalized withdrawal root
     * @param leafIndex The index of your withdrawal note's leaf in the given tree.
     * @param siblings Inclusion proof data
     */
    function withdraw(
        uint note,
        address owner,
        uint eth,
        address token,
        uint amount,
        uint nft,
        uint fee,
        bytes32 blockHash,
        uint256 leafIndex,
        uint[] calldata siblings
    ) external;

    /**
     * @notice Someone can pay in advance for unfinalized withdrawals
     * @param note Poseidon note hash of the withdrawal
     * @param owner Address of the note
     * @param eth Amount of Ether to withdraw out
     * @param token Token address of ERC20 or ERC721. It can be undefined.
     * @param amount Amount of ERC20 when the token param is defined and it is an ERC20
     * @param nft NFT id when the token param is defined and it is an ERC721
     * @param fee Amount of fee to give to the coordinator
     * @param signature ECDSA signature
     */
    function payInAdvance(
        uint note,
        address owner,
        uint eth,
        address token,
        uint amount,
        uint nft,
        uint fee,
        bytes calldata signature
    ) external;
}
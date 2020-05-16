pragma solidity >= 0.6.0;

interface IUserInteractable {
    event Deposit(uint indexed queuedAt, uint note, uint fee);

    /**
     * @notice Users can use zkopru network by submitting a new homomorphically hiden note.
     * @param eth Amount of Ether to deposit
     * @param salt 254bit salt for the privacy
     * @param token Token address of ERC20 or ERC721. It can be undefined.
     * @param amount Amount of ERC20 when the token param is defined and it is an ERC20
     * @param nft NFT id when the token param is defined and it is an ERC721
     * @param pubKey EdDSA public key to use in the zkopru network
     * @param fee Amount of fee to give to the coordinator
     */
    function deposit(
        uint eth,
        uint salt,
        address token,
        uint amount,
        uint nft,
        uint[2] calldata pubKey,
        uint fee
    ) external payable;

    /**
     * @notice Users can withdraw a note when your withdrawal tx is finalized
     * @param eth Amount of Ether to withdraw out
     * @param token Token address of ERC20 or ERC721. It can be undefined.
     * @param amount Amount of ERC20 when the token param is defined and it is an ERC20
     * @param nft NFT id when the token param is defined and it is an ERC721
     * @param fee Amount of fee to give to the coordinator
     * @param rootIndex Withdrawer should submit inclusion proof. Submit which withdrawal root to use.
     *                  withdrawables[0]: daily snapshot of withdrawable tree
     *                  withdrawables[latest]: the latest withdrawal tree
     *                  withdrawables[1~latest-1]: finalized tree
     * @param leafIndex The index of your withdrawal note's leaf in the given tree.
     * @param siblings Inclusion proof data
     */
    function withdraw(
        uint eth,
        address token,
        uint amount,
        uint nft,
        uint fee,
        uint rootIndex,
        uint leafIndex,
        uint[] calldata siblings
    ) external;

    /**
     * @notice Others can execute the withdrawal instead of the recipient account using ECDSA.
     * @param to Address of the ECDSA signer
     * @param eth Amount of Ether to withdraw out
     * @param token Token address of ERC20 or ERC721. It can be undefined.
     * @param amount Amount of ERC20 when the token param is defined and it is an ERC20
     * @param nft NFT id when the token param is defined and it is an ERC721
     * @param amount Amount to withdraw out.
     * @param fee Amount of fee to give to the coordinator
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
        address to,
        uint eth,
        address token,
        uint amount,
        uint nft,
        uint fee,
        uint rootIndex,
        uint leafIndex,
        uint[] calldata siblings,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
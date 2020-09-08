pragma solidity = 0.6.12;

import { Pairing, G1Point, G2Point } from "./Pairing.sol";
import { Proof } from "./Types.sol";

library SNARKsVerifier {
    using Pairing for *;
    struct VerifyingKey {
        G1Point alfa1;
        G2Point beta2;
        G2Point gamma2;
        G2Point delta2;
        G1Point[] ic;
    }

    function verifySnarkProof(VerifyingKey memory vk, uint256[] memory input, Proof memory proof) internal view returns (bool) {
        uint256 SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        require(input.length + 1 == vk.ic.length,"verifier-bad-input");
        // Compute the linear combination vkX
        G1Point memory vkX = G1Point(0, 0);
        for (uint256 i = 0; i < input.length; i++) {
            require(input[i] < SNARK_SCALAR_FIELD,"verifier-gte-snark-scalar-field");
            vkX = Pairing.addition(vkX, Pairing.scalar_mul(vk.ic[i + 1], input[i]));
        }
        vkX = Pairing.addition(vkX, vk.ic[0]);
        if (
            !Pairing.pairingProd4(
                Pairing.negate(proof.a), proof.b,
                vk.alfa1, vk.beta2,
                vkX, vk.gamma2,
                proof.c, vk.delta2
            )
        ) {
            return true;
        }
        return false;
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Pairing, G1Point, G2Point } from "./Pairing.sol";
import { Proof } from "./Types.sol";

library SNARK {
    using Pairing for *;
    
    struct VerifyingKey {
        G1Point alfa1;
        G2Point beta2;
        G2Point gamma2;
        G2Point delta2;
        G1Point[] ic;
    }

    uint256 constant SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant PRIME_Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;    

    function verifySnarkProof(VerifyingKey memory vk, uint256[] memory input, Proof memory proof) internal view returns (bool) {
        require(input.length + 1 == vk.ic.length,"verifier-bad-input");
        // Compute the linear combination vkX
        G1Point memory vkX = G1Point(0, 0);

        // Make sure that proof.A, B, and C are each less than the prime q
        require(proof.a.X < PRIME_Q, "verifier-aX-gte-prime-q");
        require(proof.a.Y < PRIME_Q, "verifier-aY-gte-prime-q");

        require(proof.b.X[0] < PRIME_Q, "verifier-bX0-gte-prime-q");
        require(proof.b.Y[0] < PRIME_Q, "verifier-bY0-gte-prime-q");

        require(proof.b.X[1] < PRIME_Q, "verifier-bX1-gte-prime-q");
        require(proof.b.Y[1] < PRIME_Q, "verifier-bY1-gte-prime-q");

        require(proof.c.X < PRIME_Q, "verifier-cX-gte-prime-q");
        require(proof.c.Y < PRIME_Q, "verifier-cY-gte-prime-q");

        for (uint256 i = 0; i < input.length; i++) {
            require(input[i] < SNARK_SCALAR_FIELD,"verifier-gte-snark-scalar-field");
            vkX = Pairing.plus(vkX, Pairing.scalar_mul(vk.ic[i + 1], input[i]));
        }
        vkX = Pairing.plus(vkX, vk.ic[0]);
        return Pairing.pairing(
            Pairing.negate(proof.a),
            proof.b,
            vk.alfa1,
            vk.beta2,
            vkX,
            vk.gamma2,
            proof.c,
            vk.delta2
        );
    }
}

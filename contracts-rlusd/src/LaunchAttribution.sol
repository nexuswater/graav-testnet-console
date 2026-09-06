// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library SignatureOps {
    function recover(bytes32 digest, bytes memory signature) internal pure returns (address signer) {
        require(signature.length == 65, "BAD_SIGNATURE");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        signer = ecrecover(digest, v, r, s);
    }

    function ethSigned(bytes32 digest) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
    }
}

contract LaunchAuthorizer {
    bytes32 public constant TYPEHASH = keccak256(
        "Launch(bytes32 sourcePostId,address issuer,bytes32 nameHash,bytes32 symbolHash,uint256 curveTokens,uint256 lpTokens,uint256 threshold,uint256 virtualX,uint256 virtualY,uint256 nonce,uint256 deadline)"
    );
    uint256 public immutable chainId;
    address public immutable admin;
    address public immutable signer;
    mapping(bytes32 => bool) public usedDigest;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    event LaunchConsumed(
        bytes32 indexed digest, bytes32 indexed sourcePostId, address indexed issuer, uint256 nonce, uint256 deadline
    );

    constructor(uint256 c, address s) {
        require(s != address(0), "SIGNER");
        chainId = c;
        admin = msg.sender;
        signer = s;
    }

    struct Launch {
        bytes32 sourcePostId;
        address issuer;
        bytes32 nameHash;
        bytes32 symbolHash;
        uint256 curveTokens;
        uint256 lpTokens;
        uint256 threshold;
        uint256 virtualX;
        uint256 virtualY;
        uint256 nonce;
        uint256 deadline;
    }

    function digest(Launch calldata a) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                TYPEHASH,
                block.chainid,
                address(this),
                a.sourcePostId,
                a.issuer,
                a.nameHash,
                a.symbolHash,
                a.curveTokens,
                a.lpTokens,
                a.threshold,
                a.virtualX,
                a.virtualY,
                a.nonce,
                a.deadline
            )
        );
    }

    function consume(Launch calldata a, bytes calldata signature) external returns (bytes32 d) {
        require(block.chainid == chainId && a.deadline >= block.timestamp, "AUTH_EXPIRED");
        require(!usedNonce[a.issuer][a.nonce], "AUTH_NONCE");
        d = digest(a);
        require(!usedDigest[d], "AUTH_REPLAY");
        require(SignatureOps.recover(SignatureOps.ethSigned(d), signature) == signer, "AUTH_SIGNER");
        usedDigest[d] = true;
        usedNonce[a.issuer][a.nonce] = true;
        emit LaunchConsumed(d, a.sourcePostId, a.issuer, a.nonce, a.deadline);
    }
}

contract AttributionGuard {
    bytes32 public constant TYPEHASH = keccak256(
        "Touch(bytes32 sourcePostId,address coin,address buyer,address referrer,uint256 nonce,uint256 deadline)"
    );
    uint256 public immutable chainId;
    address public immutable signer;

    struct Touch {
        bytes32 sourcePostId;
        address referrer;
        uint256 expiresAt;
    }
    mapping(address => mapping(address => Touch)) public lastTouch;
    mapping(bytes32 => bool) public usedDigest;
    event TouchRecorded(
        bytes32 indexed sourcePostId, address indexed coin, address indexed buyer, address referrer, uint256 expiresAt
    );

    constructor(uint256 c, address s) {
        require(s != address(0), "SIGNER");
        chainId = c;
        signer = s;
    }

    function digest(
        bytes32 sourcePostId,
        address coin,
        address buyer,
        address referrer,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(TYPEHASH, block.chainid, address(this), sourcePostId, coin, buyer, referrer, nonce, deadline)
        );
    }

    function recordTouch(
        bytes32 sourcePostId,
        address coin,
        address buyer,
        address referrer,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(
            block.chainid == chainId && coin != address(0) && buyer != address(0) && referrer != address(0),
            "TOUCH_INPUT"
        );
        require(deadline >= block.timestamp, "TOUCH_EXPIRED");
        bytes32 d = digest(sourcePostId, coin, buyer, referrer, nonce, deadline);
        require(!usedDigest[d] && SignatureOps.recover(SignatureOps.ethSigned(d), signature) == signer, "TOUCH_SIGNER");
        usedDigest[d] = true;
        lastTouch[coin][buyer] = Touch(sourcePostId, referrer, deadline);
        emit TouchRecorded(sourcePostId, coin, buyer, referrer, deadline);
    }

    function eligible(address coin, address buyer, address referrer) external view returns (bool) {
        Touch memory t = lastTouch[coin][buyer];
        return referrer != address(0) && t.referrer == referrer && t.expiresAt >= block.timestamp;
    }
}

interface IAttributionGuard {
    function eligible(address coin, address buyer, address referrer) external view returns (bool);
}

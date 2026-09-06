// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface Vm {
    function envAddress(string calldata key) external returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Script {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
}
import {MomentToken, FeeEscrow, CreatorVault, TokenFactory} from "../src/RLUSDCoinV1.sol";
import {LaunchAuthorizer, AttributionGuard} from "../src/LaunchAttribution.sol";

contract DeployRlusdTestnetClone is Script {
    event Deployment(
        uint256 chainId,
        address deployer,
        address mockRlusd,
        address feeEscrow,
        address creatorVault,
        address authorizer,
        address attributionGuard,
        address factory,
        bytes32 policy
    );
    uint256 internal constant CHAIN_ID = 1449000;
    uint256 internal constant UNIT = 1e18;
    bytes32 internal constant POLICY = keccak256("GRAAV_RLUSD_V1_40_35_20_5");

    function run()
        external
        returns (
            address mockRlusd,
            address feeEscrow,
            address creatorVault,
            address authorizer,
            address attributionGuard,
            address factory
        )
    {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        require(block.chainid == CHAIN_ID, "WRONG_CHAIN");
        vm.startBroadcast();
        MomentToken quote = new MomentToken("MockRLUSD", "mRLUSD", deployer, 1_000_000_000 * UNIT);
        FeeEscrow escrow = new FeeEscrow(quote, deployer);
        CreatorVault vault = new CreatorVault(quote, deployer, 0, 30 days);
        LaunchAuthorizer launchAuthorizer = new LaunchAuthorizer(CHAIN_ID, deployer);
        AttributionGuard guard = new AttributionGuard(CHAIN_ID, deployer);
        TokenFactory tokenFactory = new TokenFactory(quote, POLICY, launchAuthorizer, guard);
        vm.stopBroadcast();

        mockRlusd = address(quote);
        feeEscrow = address(escrow);
        creatorVault = address(vault);
        authorizer = address(launchAuthorizer);
        attributionGuard = address(guard);
        factory = address(tokenFactory);
        emit Deployment(
            CHAIN_ID, deployer, mockRlusd, feeEscrow, creatorVault, authorizer, attributionGuard, factory, POLICY
        );
    }
}

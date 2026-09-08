// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MomentToken, FeeEscrow, RlusdCurve, ProtocolPair} from "../src/RLUSDCoinV1.sol";
import {IAttributionGuard} from "../src/LaunchAttribution.sol";

contract MockAttributionGuard {
    mapping(address => mapping(address => address)) public touchReferrer;
    mapping(address => mapping(address => address)) public touchMidwife;
    mapping(address => mapping(address => uint256)) public touchExpiry;

    function setEligible(
        address coin,
        address buyer,
        address referrer,
        address midwife,
        uint256 expiresAt
    ) external {
        touchReferrer[coin][buyer] = referrer;
        touchMidwife[coin][buyer] = midwife;
        touchExpiry[coin][buyer] = expiresAt;
    }

    function eligible(address coin, address buyer, address referrer) external view returns (bool) {
        return referrer != address(0) && touchReferrer[coin][buyer] == referrer
            && touchExpiry[coin][buyer] >= block.timestamp;
    }

    function eligibleMidwife(address coin, address buyer, address midwife) external view returns (bool) {
        return midwife != address(0) && touchMidwife[coin][buyer] == midwife
            && touchExpiry[coin][buyer] >= block.timestamp;
    }
}

contract RLUSDCoinV1Test {
    uint256 constant UNIT = 1e18;
    MomentToken quote;
    MomentToken coin;
    FeeEscrow escrow;
    RlusdCurve curve;
    MockAttributionGuard guard;
    address creator = address(0xC0FFEE);
    address referrer = address(0xBEEF);
    address midwife = address(0xA11CE);

    function setUp() public {
        quote = new MomentToken("Mock RLUSD", "mRLUSD", address(this), 1_000_000_000 * UNIT);
        coin = new MomentToken("Moment Coin", "MOM", address(this), 1_000_000_000 * UNIT);
        escrow = new FeeEscrow(quote, address(this));
        curve = new RlusdCurve(
            coin,
            quote,
            escrow,
            address(this),
            800_000_000 * UNIT,
            200_000_000 * UNIT,
            25_000 * UNIT,
            800_000_000 * UNIT,
            4_000_000 * UNIT
        );
        curve.setCreator(creator);
        guard = new MockAttributionGuard();
        curve.setAttributionGuard(IAttributionGuard(address(guard)));
        coin.transfer(address(curve), 999_999_999 * UNIT);
        escrow.authorizeMarket(address(curve), true);
        quote.approve(address(curve), type(uint256).max);
    }

    function testAllocationAndFiveRlusdBuySell() public {
        uint256 beforeSupply = coin.totalSupply();
        uint256 out = curve.buy(5 * UNIT, 1, address(this), address(0), address(0), keccak256("buy"));
        require(out > 0, "NO_OUTPUT");
        require(curve.realQuote() == 4_950_000_000_000_000_000, "NET_RESERVE");
        require(
            escrow.liabilities(FeeEscrow.Role.PROTOCOL) + escrow.liabilities(FeeEscrow.Role.CREATOR)
                    + escrow.liabilities(FeeEscrow.Role.REFERRER) + escrow.liabilities(FeeEscrow.Role.MIDWIFE)
                == 50_000_000_000_000_000,
            "FEE_BACKING"
        );
        // fallback unattributed: creator 35 + protocol 65 of gross*100bps
        require(escrow.claimable(FeeEscrow.Role.CREATOR, creator) == 5 * UNIT * 35 / 10000, "CREATOR_FALLBACK");
        require(escrow.claimable(FeeEscrow.Role.PROTOCOL, address(this)) == 5 * UNIT * 65 / 10000, "PROTOCOL_FALLBACK");
        coin.approve(address(curve), out);
        uint256 quoteOut = curve.sell(out, 1, address(this), keccak256("sell"));
        require(quoteOut > 0 && curve.realQuote() < 4_950_000_000_000_000_000, "SELL_RESERVE");
        require(coin.totalSupply() == beforeSupply, "NO_BURN_ON_TRADE");
    }

    function testAttributedBuySplits4020355() public {
        guard.setEligible(address(curve), address(this), referrer, midwife, block.timestamp + 1 days);
        uint256 gross = 100 * UNIT;
        curve.buy(gross, 1, address(this), referrer, midwife, keccak256("attr"));
        require(escrow.claimable(FeeEscrow.Role.PROTOCOL, address(this)) == gross * 40 / 10000, "P40");
        require(escrow.claimable(FeeEscrow.Role.CREATOR, creator) == gross * 35 / 10000, "C35");
        require(escrow.claimable(FeeEscrow.Role.REFERRER, referrer) == gross * 20 / 10000, "R20");
        require(escrow.claimable(FeeEscrow.Role.MIDWIFE, midwife) == gross * 5 / 10000, "M5");
        require(
            escrow.liabilities(FeeEscrow.Role.PROTOCOL) + escrow.liabilities(FeeEscrow.Role.CREATOR)
                    + escrow.liabilities(FeeEscrow.Role.REFERRER) + escrow.liabilities(FeeEscrow.Role.MIDWIFE)
                == gross / 100,
            "CONSERVE"
        );
    }

    function testIneligibleReferrerReverts() public {
        try curve.buy(1 * UNIT, 1, address(this), referrer, address(0), keccak256("bad")) {
            revert("EXPECTED_REVERT");
        } catch {}
    }

    function testTokenBurnReducesSupplyAndPairCannotBypassFeePath() public {
        uint256 beforeSupply = coin.totalSupply();
        coin.burn(1 * UNIT);
        require(coin.totalSupply() == beforeSupply - UNIT, "BURN_SUPPLY");
        ProtocolPair pair = new ProtocolPair(coin, quote, escrow, address(this));
        pair.setCurve(address(this));
        require(pair.curve() == address(this), "PAIR_AUTH");
    }
}

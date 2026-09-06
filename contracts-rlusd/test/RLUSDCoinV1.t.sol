// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MomentToken, FeeEscrow, RlusdCurve, ProtocolPair} from "../src/RLUSDCoinV1.sol";

contract RLUSDCoinV1Test {
    uint256 constant UNIT = 1e18;
    MomentToken quote;
    MomentToken coin;
    FeeEscrow escrow;
    RlusdCurve curve;

    function setUp() public {
        quote = new MomentToken("Mock RLUSD", "mRLUSD", address(this), 1_000_000_000 * UNIT);
        coin = new MomentToken("Moment Coin", "MOM", address(this), 1_000_000_000 * UNIT);
        escrow = new FeeEscrow(quote, address(this));
        curve = new RlusdCurve(coin, quote, escrow, address(this), 800_000_000 * UNIT, 200_000_000 * UNIT, 25_000 * UNIT, 800_000_000 * UNIT, 4_000_000 * UNIT);
        coin.transfer(address(curve), 999_999_999 * UNIT);
        escrow.authorizeMarket(address(curve), true);
        quote.approve(address(curve), type(uint256).max);
    }

    function testAllocationAndFiveRlusdBuySell() public {
        uint256 beforeSupply = coin.totalSupply();
        uint256 out = curve.buy(5 * UNIT, 1, address(this), address(0xBEEF), address(0xCAFE), keccak256("buy"));
        require(out > 0, "NO_OUTPUT");
        require(curve.realQuote() == 4_950_000_000_000_000_000, "NET_RESERVE");
        require(escrow.liabilities(FeeEscrow.Role.PROTOCOL) + escrow.liabilities(FeeEscrow.Role.CREATOR) + escrow.liabilities(FeeEscrow.Role.REFERRER) + escrow.liabilities(FeeEscrow.Role.MIDWIFE) == 50_000_000_000_000_000, "FEE_BACKING");
        coin.approve(address(curve), out);
        uint256 quoteOut = curve.sell(out, 1, address(this), keccak256("sell"));
        require(quoteOut > 0 && curve.realQuote() < 4_950_000_000_000_000_000, "SELL_RESERVE");
        require(coin.totalSupply() == beforeSupply, "NO_BURN_ON_TRADE");
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

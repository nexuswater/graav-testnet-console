// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LaunchAuthorizer, AttributionGuard, IAttributionGuard} from "./LaunchAttribution.sol";

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

library TokenOps {
    function pull(IERC20 token, address from, address to, uint256 amount) internal returns (uint256 received) {
        uint256 beforeBal = token.balanceOf(to);
        require(token.transferFrom(from, to, amount), "TRANSFER_FROM");
        received = token.balanceOf(to) - beforeBal;
        require(received == amount, "FEE_ON_TRANSFER_QUOTE");
    }

    function push(IERC20 token, address to, uint256 amount) internal {
        require(token.transfer(to, amount), "TRANSFER");
    }
}

abstract contract ReentrancyGuard {
    uint256 private entered;
    modifier nonReentrant() {
        require(entered == 0, "REENTRANT");
        entered = 1;
        _;
        entered = 0;
    }
}

contract MomentToken is IERC20 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public override totalSupply;
    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowances;
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor(string memory n, string memory s, address allocationSink, uint256 supply) {
        require(allocationSink != address(0) && supply > 0, "BAD_ALLOCATION");
        name = n;
        symbol = s;
        totalSupply = supply;
        balances[allocationSink] = supply;
        emit Transfer(address(0), allocationSink, supply);
    }

    function balanceOf(address a) external view override returns (uint256) {
        return balances[a];
    }

    function allowance(address a, address b) external view override returns (uint256) {
        return allowances[a][b];
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 a = allowances[from][msg.sender];
        require(a >= amount, "ALLOWANCE");
        if (a != type(uint256).max) allowances[from][msg.sender] = a - amount;
        _move(from, to, amount);
        return true;
    }

    function burn(uint256 amount) external {
        _move(msg.sender, address(0), amount);
    }

    function _move(address from, address to, uint256 amount) private {
        require(to != address(0) || from != address(0), "ZERO");
        require(balances[from] >= amount, "BALANCE");
        balances[from] -= amount;
        if (to == address(0)) totalSupply -= amount;
        else balances[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract FeeEscrow {
    uint256 private claimEntered;
    enum Role {
        PROTOCOL,
        CREATOR,
        REFERRER,
        MIDWIFE
    }
    IERC20 public immutable quote;
    address public immutable admin;
    mapping(address => bool) public market;
    mapping(Role => mapping(address => uint256)) public claimable;
    mapping(Role => uint256) public liabilities;
    event MarketAuthorization(address indexed market, bool allowed);
    event FeeCredited(Role indexed role, address indexed beneficiary, uint256 amount, bytes32 indexed orderId);
    event FeeClaimed(Role indexed role, address indexed beneficiary, uint256 amount);

    constructor(IERC20 q, address a) {
        quote = q;
        admin = a;
    }

    function authorizeMarket(address m, bool allowed) external {
        require(msg.sender == admin, "ADMIN");
        market[m] = allowed;
        emit MarketAuthorization(m, allowed);
    }

    function credit(Role role, address beneficiary, uint256 amount, bytes32 orderId) external {
        require(market[msg.sender], "MARKET");
        if (amount == 0) return;
        claimable[role][beneficiary] += amount;
        liabilities[role] += amount;
        emit FeeCredited(role, beneficiary, amount, orderId);
    }

    function claim(Role role) external nonReentrantClaim {
        uint256 amount = claimable[role][msg.sender];
        require(amount > 0, "NOTHING");
        claimable[role][msg.sender] = 0;
        liabilities[role] -= amount;
        TokenOps.push(quote, msg.sender, amount);
        emit FeeClaimed(role, msg.sender, amount);
    }
    modifier nonReentrantClaim() {
        require(claimEntered == 0, "REENTRANT_CLAIM");
        claimEntered = 1;
        _;
        claimEntered = 0;
    }
}

contract ProtocolPair is ReentrancyGuard {
    using TokenOps for IERC20;
    IERC20 public immutable token;
    IERC20 public immutable quote;
    FeeEscrow public immutable escrow;
    address public immutable admin;
    address public curve;
    address public creator;
    bool public initialized;
    uint256 public reserveToken;
    uint256 public reserveQuote;
    event Initialized(uint256 tokenReserve, uint256 quoteReserve);
    event Swap(address indexed trader, bool quoteIn, uint256 gross, uint256 net, uint256 output);

    constructor(IERC20 t, IERC20 q, FeeEscrow e, address a) {
        token = t;
        quote = q;
        escrow = e;
        admin = a;
    }

    function setCurve(address c) external {
        require(msg.sender == admin && curve == address(0), "CURVE_LOCKED");
        curve = c;
    }

    function setCreator(address c) external {
        require(msg.sender == admin && creator == address(0) && c != address(0), "CREATOR_LOCKED");
        creator = c;
    }

    function initialize(uint256 tokenAmount, uint256 quoteAmount) external {
        require(msg.sender == curve && !initialized, "INIT");
        require(token.balanceOf(address(this)) >= tokenAmount && quote.balanceOf(address(this)) >= quoteAmount, "SEED");
        reserveToken = tokenAmount;
        reserveQuote = quoteAmount;
        if (creator == address(0) && curve.code.length > 0) {
            (bool ok, bytes memory data) = curve.staticcall(abi.encodeWithSignature("creator()"));
            if (ok && data.length >= 32) {
                address c = abi.decode(data, (address));
                if (c != address(0)) creator = c;
            }
        }
        initialized = true;
        emit Initialized(tokenAmount, quoteAmount);
    }

    function swapQuoteForToken(uint256 gross, uint256 minOut, address recipient, bytes32 orderId)
        external
        nonReentrant
        returns (uint256 out)
    {
        return _swapQuoteForToken(gross, minOut, recipient, address(0), address(0), orderId);
    }

    function swapQuoteForToken(
        uint256 gross,
        uint256 minOut,
        address recipient,
        address referrer,
        address midwife,
        bytes32 orderId
    ) external nonReentrant returns (uint256 out) {
        _requireAttribution(referrer, midwife);
        return _swapQuoteForToken(gross, minOut, recipient, referrer, midwife, orderId);
    }

    function _swapQuoteForToken(
        uint256 gross,
        uint256 minOut,
        address recipient,
        address referrer,
        address midwife,
        bytes32 orderId
    ) private returns (uint256 out) {
        require(initialized && gross > 0, "SWAP");
        uint256 got = quote.balanceOf(address(this));
        quote.pull(msg.sender, address(this), gross);
        got = quote.balanceOf(address(this)) - got;
        uint256 fee = got / 100;
        uint256 net = got - fee;
        out = reserveToken - (reserveToken * reserveQuote + reserveQuote + net - 1) / (reserveQuote + net);
        require(out >= minOut && out < reserveToken, "SLIPPAGE");
        reserveQuote += net;
        reserveToken -= out;
        _fees(got, fee, referrer, midwife, orderId);
        token.push(recipient, out);
        emit Swap(msg.sender, true, got, net, out);
    }

    function swapTokenForQuote(uint256 amount, uint256 minOut, address recipient, bytes32 orderId)
        external
        nonReentrant
        returns (uint256 out)
    {
        require(initialized && amount > 0, "SWAP");
        token.pull(msg.sender, address(this), amount);
        uint256 nextQuote = (reserveToken * reserveQuote + reserveToken + amount - 1) / (reserveToken + amount);
        uint256 gross = reserveQuote - nextQuote;
        uint256 fee = gross / 100;
        out = gross - fee;
        require(out >= minOut && gross <= reserveQuote, "SLIPPAGE");
        reserveToken += amount;
        reserveQuote = nextQuote;
        _fees(gross, fee, address(0), address(0), orderId);
        quote.push(recipient, out);
        emit Swap(msg.sender, false, gross, gross - fee, out);
    }

    function _requireAttribution(address referrer, address midwife) private view {
        if (referrer == address(0) && midwife == address(0)) return;
        require(curve.code.length > 0, "ATTRIBUTION_UNAVAILABLE");
        address guard;
        (bool ok, bytes memory data) = curve.staticcall(abi.encodeWithSignature("attributionGuard()"));
        if (ok && data.length >= 32) guard = abi.decode(data, (address));
        require(guard != address(0), "ATTRIBUTION_UNAVAILABLE");
        // Touch is coin-scoped to the curve address (pre-grad market id).
        if (referrer != address(0)) {
            require(IAttributionGuard(guard).eligible(curve, msg.sender, referrer), "REFERRER_INELIGIBLE");
        }
        if (midwife != address(0)) {
            require(IAttributionGuard(guard).eligibleMidwife(curve, msg.sender, midwife), "MIDWIFE_INELIGIBLE");
        }
    }

    function _fees(uint256 gross, uint256 fee, address referrer, address midwife, bytes32 orderId) private {
        quote.push(address(escrow), fee);
        uint256 creatorFee = gross * 35 / 10000;
        uint256 ref = referrer == address(0) ? 0 : gross * 20 / 10000;
        uint256 mid = midwife == address(0) ? 0 : gross * 5 / 10000;
        uint256 protocol = fee - creatorFee - ref - mid;
        address creatorBeneficiary = creator == address(0) ? admin : creator;
        escrow.credit(FeeEscrow.Role.PROTOCOL, admin, protocol, orderId);
        escrow.credit(FeeEscrow.Role.CREATOR, creatorBeneficiary, creatorFee, orderId);
        escrow.credit(FeeEscrow.Role.REFERRER, referrer, ref, orderId);
        escrow.credit(FeeEscrow.Role.MIDWIFE, midwife, mid, orderId);
    }
}

contract RlusdCurve is ReentrancyGuard {
    using TokenOps for IERC20;
    IERC20 public immutable token;
    IERC20 public immutable quote;
    FeeEscrow public immutable escrow;
    uint256 public immutable threshold;
    uint256 public immutable reservedLp;
    uint256 public virtualX;
    uint256 public virtualY;
    uint256 public realQuote;
    uint256 public curveInventory;
    bool public graduated;
    address public immutable admin;
    address public creator;
    ProtocolPair public pair;
    IAttributionGuard public attributionGuard;
    event Buy(
        address indexed buyer,
        address indexed recipient,
        uint256 gross,
        uint256 fee,
        uint256 tokensOut,
        bytes32 indexed orderId
    );
    event Sell(
        address indexed seller,
        address indexed recipient,
        uint256 tokensIn,
        uint256 gross,
        uint256 fee,
        uint256 quoteOut,
        bytes32 indexed orderId
    );
    event Graduated(address indexed pair, uint256 quoteSeed, uint256 tokenSeed, uint256 curveDust);

    constructor(
        IERC20 t,
        IERC20 q,
        FeeEscrow e,
        address a,
        uint256 inventory,
        uint256 lp,
        uint256 threshold_,
        uint256 x,
        uint256 y
    ) {
        require(x > 0 && y > 0 && threshold_ > 0, "PARAMS");
        token = t;
        quote = q;
        escrow = e;
        admin = a;
        curveInventory = inventory;
        reservedLp = lp;
        threshold = threshold_;
        virtualX = x;
        virtualY = y;
    }

    function setAttributionGuard(IAttributionGuard g) external {
        require(msg.sender == admin && address(attributionGuard) == address(0), "GUARD_LOCKED");
        attributionGuard = g;
    }

    function setCreator(address c) external {
        require(msg.sender == admin && creator == address(0) && c != address(0), "CREATOR_LOCKED");
        creator = c;
    }

    function buy(uint256 gross, uint256 minOut, address recipient, address referrer, address midwife, bytes32 orderId)
        external
        nonReentrant
        returns (uint256 out)
    {
        require(!graduated && gross > 0 && recipient != address(0), "BUY");
        if (referrer != address(0)) {
            require(
                address(attributionGuard) != address(0)
                    && attributionGuard.eligible(address(this), msg.sender, referrer),
                "REFERRER_INELIGIBLE"
            );
        }
        if (midwife != address(0)) {
            require(
                address(attributionGuard) != address(0)
                    && attributionGuard.eligibleMidwife(address(this), msg.sender, midwife),
                "MIDWIFE_INELIGIBLE"
            );
        }
        quote.pull(msg.sender, address(this), gross);
        uint256 fee = gross / 100;
        uint256 net = gross - fee;
        require(realQuote + net <= threshold, "THRESHOLD");
        uint256 nextX = (virtualX * virtualY + virtualY + net - 1) / (virtualY + net);
        out = virtualX - nextX;
        require(out >= minOut && out <= curveInventory, "OUTPUT");
        virtualX = nextX;
        virtualY += net;
        realQuote += net;
        curveInventory -= out;
        _fees(gross, fee, referrer, midwife, orderId);
        token.push(recipient, out);
        emit Buy(msg.sender, recipient, gross, fee, out, orderId);
    }

    function sell(uint256 amount, uint256 minOut, address recipient, bytes32 orderId)
        external
        nonReentrant
        returns (uint256 out)
    {
        require(!graduated && amount > 0, "SELL");
        token.pull(msg.sender, address(this), amount);
        uint256 nextY = (virtualX * virtualY + virtualX + amount - 1) / (virtualX + amount);
        uint256 gross = virtualY - nextY;
        require(gross <= realQuote, "REAL_RESERVE");
        uint256 fee = gross / 100;
        out = gross - fee;
        require(out >= minOut, "SLIPPAGE");
        virtualX += amount;
        virtualY = nextY;
        realQuote -= gross;
        curveInventory += amount;
        _fees(gross, fee, address(0), address(0), orderId);
        quote.push(recipient, out);
        emit Sell(msg.sender, recipient, amount, gross, fee, out, orderId);
    }

    function graduate(ProtocolPair p) external nonReentrant {
        require(!graduated && realQuote >= threshold, "NOT_READY");
        pair = p;
        uint256 tokenSeed = realQuote * virtualX / virtualY;
        require(tokenSeed > 0 && tokenSeed <= reservedLp, "LP_INVENTORY");
        uint256 dust = curveInventory + (reservedLp - tokenSeed);
        graduated = true;
        quote.push(address(p), realQuote);
        token.push(address(p), tokenSeed);
        if (dust > 0) MomentToken(address(token)).burn(dust);
        p.initialize(tokenSeed, realQuote);
        emit Graduated(address(p), realQuote, tokenSeed, dust);
    }

    function _fees(uint256 gross, uint256 fee, address referrer, address midwife, bytes32 orderId) private {
        quote.push(address(escrow), fee);
        uint256 creatorFee = gross * 35 / 10000;
        uint256 ref = (referrer != address(0) ? gross * 20 / 10000 : 0);
        uint256 mid = (midwife != address(0) ? gross * 5 / 10000 : 0);
        uint256 protocol = fee - creatorFee - ref - mid;
        address creatorBeneficiary = creator == address(0) ? admin : creator;
        escrow.credit(FeeEscrow.Role.PROTOCOL, admin, protocol, orderId);
        escrow.credit(FeeEscrow.Role.CREATOR, creatorBeneficiary, creatorFee, orderId);
        escrow.credit(FeeEscrow.Role.REFERRER, referrer, ref, orderId);
        escrow.credit(FeeEscrow.Role.MIDWIFE, midwife, mid, orderId);
    }
}

contract CreatorVault {
    using TokenOps for IERC20;
    IERC20 public immutable token;
    address public immutable beneficiary;
    uint256 public immutable amount;
    uint256 public immutable unlockAt;
    bool public released;

    constructor(IERC20 t, address b, uint256 a, uint256 cliff) {
        token = t;
        beneficiary = b;
        amount = a;
        unlockAt = block.timestamp + cliff;
    }

    function release() external {
        require(msg.sender == beneficiary && block.timestamp >= unlockAt && !released, "LOCKED");
        released = true;
        token.push(beneficiary, amount);
    }
}

/// @dev Testnet factory primitive with signed launch and coin-scoped attribution gates.
contract TokenFactory {
    IERC20 public immutable quote;
    bytes32 public immutable policyHash;
    LaunchAuthorizer public immutable launchAuthorizer;
    AttributionGuard public immutable attributionGuard;
    mapping(bytes32 => address) public coinBySourcePost;
    event CoinCreated(
        bytes32 indexed sourcePostId,
        address indexed token,
        address indexed curve,
        address escrow,
        address issuer,
        bytes32 policyHash
    );

    constructor(IERC20 q, bytes32 p, LaunchAuthorizer a, AttributionGuard g) {
        quote = q;
        policyHash = p;
        launchAuthorizer = a;
        attributionGuard = g;
    }

    struct CreateParams {
        bytes32 sourcePostId;
        string name_;
        string symbol_;
        address issuer;
        uint256 curveTokens;
        uint256 lpTokens;
        uint256 threshold;
        uint256 virtualX;
        uint256 virtualY;
        uint256 nonce;
        uint256 deadline;
    }

    function createCoin(CreateParams calldata p, bytes calldata signature)
        external
        returns (address token, address curve, address escrow)
    {
        require(p.sourcePostId != bytes32(0) && p.issuer != address(0), "SOURCE");
        require(coinBySourcePost[p.sourcePostId] == address(0), "DUPLICATE_SOURCE");
        require(p.curveTokens + p.lpTokens == 1_000_000_000 * 1e18, "ALLOCATION");
        LaunchAuthorizer.Launch memory a = LaunchAuthorizer.Launch(
            p.sourcePostId,
            p.issuer,
            keccak256(bytes(p.name_)),
            keccak256(bytes(p.symbol_)),
            p.curveTokens,
            p.lpTokens,
            p.threshold,
            p.virtualX,
            p.virtualY,
            p.nonce,
            p.deadline
        );
        launchAuthorizer.consume(a, signature);
        FeeEscrow e = new FeeEscrow(quote, address(this));
        MomentToken t = new MomentToken(p.name_, p.symbol_, address(this), p.curveTokens + p.lpTokens);
        RlusdCurve c =
            new RlusdCurve(t, quote, e, address(this), p.curveTokens, p.lpTokens, p.threshold, p.virtualX, p.virtualY);
        c.setCreator(p.issuer);
        t.transfer(address(c), p.curveTokens + p.lpTokens);
        e.authorizeMarket(address(c), true);
        c.setAttributionGuard(IAttributionGuard(address(attributionGuard)));
        coinBySourcePost[p.sourcePostId] = address(t);
        emit CoinCreated(p.sourcePostId, address(t), address(c), address(e), p.issuer, policyHash);
        return (address(t), address(c), address(e));
    }
}

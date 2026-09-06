#!/usr/bin/env python3
"""Create g589 on M2 factory if missing. Reads deployer key from secrets path; never prints key."""
from web3 import Web3
from eth_account import Account
from pathlib import Path
import json

RPC = "https://rpc.testnet.xrplevm.org"
FACTORY = Web3.to_checksum_address("0x72be5a300956f9dF0F4264a4211251dD17CA276B")
ZERO = "0x0000000000000000000000000000000000000000"
KEY_PATH = Path(
    "/home/box/agent-data/agents/339d0ee9-fa3e-40d1-b5b1-48ed19940e3a/secrets/graav-testnet/deployer.key"
)
OUT = Path("/workspace/sandbox-labs/graav/testnet-console/g589.created.json")

ABI = [
    {
        "inputs": [{"internalType": "string", "name": "symbol", "type": "string"}],
        "name": "getMarketBySymbol",
        "outputs": [
            {
                "components": [
                    {"internalType": "address", "name": "token", "type": "address"},
                    {"internalType": "address", "name": "market", "type": "address"},
                    {"internalType": "address", "name": "creator", "type": "address"},
                    {"internalType": "bytes32", "name": "originHash", "type": "bytes32"},
                    {"internalType": "uint64", "name": "createdAt", "type": "uint64"},
                    {"internalType": "uint32", "name": "templateVersion", "type": "uint32"},
                    {"internalType": "bool", "name": "graduated", "type": "bool"},
                ],
                "internalType": "struct IGraavFactory.MarketInfo",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "string", "name": "name", "type": "string"},
            {"internalType": "string", "name": "symbol", "type": "string"},
            {"internalType": "string", "name": "metadataURI", "type": "string"},
            {"internalType": "bytes32", "name": "originHash", "type": "bytes32"},
        ],
        "name": "createMarket",
        "outputs": [
            {"internalType": "uint256", "name": "marketId", "type": "uint256"},
            {"internalType": "address", "name": "token", "type": "address"},
            {"internalType": "address", "name": "market", "type": "address"},
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "anonymous": False,
        "type": "event",
        "name": "MarketCreated",
        "inputs": [
            {"indexed": True, "name": "marketId", "type": "uint256"},
            {"indexed": True, "name": "token", "type": "address"},
            {"indexed": True, "name": "market", "type": "address"},
            {"indexed": False, "name": "creator", "type": "address"},
            {"indexed": False, "name": "symbol", "type": "string"},
            {"indexed": False, "name": "originHash", "type": "bytes32"},
        ],
    },
]


def main() -> None:
    w3 = Web3(Web3.HTTPProvider(RPC, request_kwargs={"timeout": 60}))
    assert w3.is_connected(), "rpc not connected"
    key = KEY_PATH.read_text().strip()
    acct = Account.from_key(key)
    assert acct.address.lower() == "0x64fadf4d3fde272ee100c1d1988b84149fd08de3"
    print("deployer", acct.address)
    print("balance_wei", w3.eth.get_balance(acct.address))
    factory = w3.eth.contract(address=FACTORY, abi=ABI)

    def lookup(sym: str):
        try:
            return factory.functions.getMarketBySymbol(sym).call()
        except Exception as e:
            return f"ERR:{e}"

    for sym in ["g589", "G589", "T589"]:
        info = lookup(sym)
        if isinstance(info, str):
            print(sym, info)
        else:
            token, market, creator, origin, created_at, tmpl, graduated = info
            print(
                sym,
                "token",
                token,
                "market",
                market,
                "graduated",
                graduated,
                "zero",
                market.lower() == ZERO.lower(),
            )

    info = lookup("g589")
    exists = (not isinstance(info, str)) and info[1].lower() != ZERO.lower()
    if exists:
        payload = {
            "marketId": None,
            "token": info[0],
            "market": info[1],
            "symbol": "g589",
            "name": "GRAAV589",
            "factory": FACTORY,
            "tx": None,
            "chainId": 1449000,
            "already": True,
        }
        OUT.write_text(json.dumps(payload, indent=2) + "\n")
        print("G589_ALREADY", info[1], info[0])
        return

    print("CREATING_g589")
    origin = b"\x00" * 32
    tx = factory.functions.createMarket("GRAAV589", "g589", "", origin).build_transaction(
        {
            "from": acct.address,
            "nonce": w3.eth.get_transaction_count(acct.address),
            "chainId": 1449000,
            "gas": 3_500_000,
        }
    )
    try:
        tip = w3.eth.max_priority_fee
    except Exception:
        tip = w3.to_wei(1, "gwei")
    base = w3.eth.get_block("latest")["baseFeePerGas"]
    tx["maxPriorityFeePerGas"] = tip
    tx["maxFeePerGas"] = base * 2 + tip
    signed = acct.sign_transaction(tx)
    raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
    h = w3.eth.send_raw_transaction(raw)
    print("tx", h.hex())
    receipt = w3.eth.wait_for_transaction_receipt(h, timeout=180)
    print("status", receipt.status, "gasUsed", receipt.gasUsed)
    if receipt.status != 1:
        raise SystemExit("createMarket failed")
    logs = factory.events.MarketCreated().process_receipt(receipt)
    if logs:
        args = logs[0]["args"]
        payload = {
            "marketId": int(args["marketId"]),
            "token": args["token"],
            "market": args["market"],
            "symbol": args["symbol"],
            "name": "GRAAV589",
            "factory": FACTORY,
            "tx": h.hex(),
            "chainId": 1449000,
            "already": False,
        }
        OUT.write_text(json.dumps(payload, indent=2) + "\n")
        print(
            "CREATED",
            "marketId",
            args["marketId"],
            "token",
            args["token"],
            "market",
            args["market"],
            "symbol",
            args["symbol"],
        )
    else:
        info2 = lookup("g589")
        print("post_lookup", info2)
        raise SystemExit("no MarketCreated event")


if __name__ == "__main__":
    main()

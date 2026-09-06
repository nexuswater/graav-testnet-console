# GRAAV RLUSD Coin V1 local contracts

Local-only Foundry scaffold for chain target `1440000`. `MomentToken`, `RlusdCurve`, `ProtocolPair`, `FeeEscrow`, and `CreatorVault` keep quote/token reserves separate and charge 100 bps on the execution path. No deployment script targets a remote chain. The factory/attestation/ingress boundary remains intentionally unconnected until the signed launch and provider evidence are available.

The curve constructor receives the reserved LP tranche separately; a local fixture must fund that tranche to the curve before `graduate`. `FeeEscrow` is pull-only and has no reserve-drain method.

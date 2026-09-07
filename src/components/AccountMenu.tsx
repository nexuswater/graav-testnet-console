"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { XRPL_EVM_TESTNET_ID } from "@/lib/chain";
import {
  ensureXrplEvmTestnet,
  shortAddr,
  waitForInjectedEth,
} from "@/lib/wallet";
import { getClientXAuthHint } from "@/lib/xAuth";
import { asStatusText } from "@/lib/statusMsg";
import { metaMaskDappUrl } from "@/lib/metaMaskDeepLink";

type MeResponse = {
  bound: boolean;
  id?: string;
  username?: string;
  name?: string;
};

type Props = {
  onStatus?: (msg: unknown) => void;
};

export function AccountMenu({ onStatus }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const {
    connectAsync,
    connectors,
    isPending: isConnecting,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const onCorrectChain = chainId === XRPL_EVM_TESTNET_ID;
  const walletConnectConnector = connectors.find((c) => c.id === "walletConnect" || c.name.toLowerCase().includes("walletconnect"));

  const hint = useMemo(() => getClientXAuthHint(), []);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [metaMaskUrl, setMetaMaskUrl] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshMe = useCallback(async () => {
    if (!hint.configured) return;
    setLoadingMe(true);
    try {
      const res = await fetch("/api/auth/x/me", { credentials: "same-origin" });
      if (res.ok) {
        setMe((await res.json()) as MeResponse);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMe(false);
    }
  }, [hint.configured]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const setStatus = (msg: unknown) => {
    onStatus?.(asStatusText(msg));
  };

  const handleConnect = async () => {
    setMetaMaskUrl(null);
    setStatus(null);
    const eth = await waitForInjectedEth(3000);
    if (!eth) {
      const dappUrl = typeof window === "undefined" ? null : metaMaskDappUrl();
      setMetaMaskUrl(dappUrl);
      setStatus(
        "MetaMask not found in this browser. Open this page in the MetaMask browser to connect."
      );
      return;
    }
    try {
      await eth.request({ method: "eth_requestAccounts" });
      const connector =
        connectors.find(
          (c) =>
            c.id === "io.metamask" ||
            c.name.toLowerCase().includes("metamask")
        ) ||
        connectors.find((c) => c.id === "injected") ||
        connectors[0];
      if (connector) {
        try {
          await connectAsync({ connector });
        } catch (wagmiErr: unknown) {
          const msg =
            wagmiErr instanceof Error ? wagmiErr.message : String(wagmiErr);
          setStatus(`Wagmi connect failed: ${msg}`);
          return;
        }
      }
      setMetaMaskUrl(null);
      const chainRes = await ensureXrplEvmTestnet();
      if (!chainRes.ok) {
        setStatus(
          `Connected. Switch to XRPL EVM Testnet (${chainRes.error ?? "pending"}).`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Connect failed: ${msg}`);
    }
  };

  const handleWalletConnect = async () => {
    setStatus(null);
    if (!walletConnectConnector) {
      setStatus("WalletConnect is unavailable until NEXT_PUBLIC_WC_PROJECT_ID is configured.");
      return;
    }
    try {
      await connectAsync({ connector: walletConnectConnector });
      setMetaMaskUrl(null);
      setOpen(false);
    } catch (err: unknown) {
      setStatus(`WalletConnect failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSwitch = async () => {
    const res = await ensureXrplEvmTestnet();
    if (!res.ok) {
      setStatus(res.error ?? "Switch failed");
      return;
    }
    try {
      switchChain?.({ chainId: XRPL_EVM_TESTNET_ID });
    } catch {
      /* ensure already handled */
    }
  };

  const onSignInX = () => {
    if (!hint.configured) {
      setStatus(hint.message);
      return;
    }
    window.location.href = "/api/auth/x";
  };

  const onSignOutX = async () => {
    try {
      await fetch("/api/auth/x/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      setMe({ bound: false });
    } catch {
      window.location.href = "/api/auth/x/logout";
    }
  };

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  const xBound = Boolean(me?.bound && me.username);
  const avLetter = address ? address.slice(2, 3).toUpperCase() : "?";
  const idle = !isConnected && !xBound;

  return (
    <div className="g-account" ref={rootRef}>
      {!isConnected && (
        <button type="button" className="g-btn g-connect-wallet" disabled={isConnecting} onClick={() => void handleConnect()}>
          {isConnecting ? "Connecting…" : "Connect wallet"}
        </button>
      )}
      <button
        type="button"
        className="g-account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        {isConnected ? (
          <span className="g-av">{avLetter}</span>
        ) : (
          <span className="g-av g-av-idle">·</span>
        )}
        {xBound && (
          <span className="g-account-xmark" title={`@${me!.username}`}>
            𝕏
          </span>
        )}
        {idle && <span className="g-account-label">Account</span>}
        {!idle && !xBound && isConnected && (
          <span className="g-account-label g-account-label-short">
            {shortAddr(address)}
          </span>
        )}
        <span className="g-account-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="g-account-panel" role="menu">
          {isConnected && address ? (
            <div className="g-account-section">
              <div className="g-account-row">
                <div className="min-w-0 flex-1">
                  <div className="g-micro" style={{ color: "var(--muted)" }}>
                    Wallet
                  </div>
                  <button
                    type="button"
                    className="g-account-addr"
                    onClick={() => void copyAddress()}
                    title="Copy address"
                  >
                    {shortAddr(address)}
                    <span className="g-micro" style={{ marginLeft: 6 }}>
                      {copied ? "copied" : "copy"}
                    </span>
                  </button>
                </div>
              </div>
              {!onCorrectChain && (
                <button
                  type="button"
                  className="g-btn sm g-account-action"
                  style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
                  disabled={isSwitching}
                  onClick={() => void handleSwitch()}
                >
                  {isSwitching ? "Switching…" : "Switch to XRPL EVM Testnet"}
                </button>
              )}
              <button
                type="button"
                className="g-btn sm g-account-action"
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
              >
                Disconnect wallet
              </button>
            </div>
          ) : null}

          <div className="g-account-divider" />

          {xBound ? (
            <div className="g-account-section">
              <div className="g-account-row">
                <span className="g-av" style={{ background: "var(--x)" }}>
                  𝕏
                </span>
                <span style={{ color: "var(--text)", fontSize: 13 }}>
                  @{me!.username}
                </span>
              </div>
              <button
                type="button"
                className="g-btn sm g-account-action"
                onClick={() => void onSignOutX()}
              >
                Sign out of X
              </button>
            </div>
          ) : (
            <div className="g-account-section">
              <button
                type="button"
                className="g-btn sm g-account-action"
                style={{ borderColor: "var(--x)", color: "var(--x)" }}
                disabled={loadingMe && hint.configured}
                onClick={onSignInX}
              >
                {hint.configured ? "Sign in with X" : "Connect X"}
              </button>
              {!hint.configured && (
                <p className="g-micro" style={{ marginTop: 6 }}>
                  {hint.message}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {metaMaskUrl && !isConnected && (
        <div className="g-account-help" role="status">
          <div>MetaMask browser required for wallet injection.</div>
          <a href={metaMaskUrl}>Open this page in MetaMask</a>
          {walletConnectConnector && (
            <button type="button" className="g-btn sm g-account-action" onClick={() => void handleWalletConnect()} disabled={isConnecting}>
              {isConnecting ? "Connecting…" : "WalletConnect"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

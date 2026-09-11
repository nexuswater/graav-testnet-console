"use client";

import Link from "next/link";
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
} from "@/lib/wallet";
import { getClientXAuthHint } from "@/lib/xAuth";
import { asStatusText } from "@/lib/statusMsg";
import { WalletConnectMark } from "@/components/WalletConnectMark";
import { XMark } from "@/components/XMark";
import { XrplMark } from "@/components/XrplMark";

type MeResponse = {
  bound: boolean;
  id?: string;
  username?: string;
  name?: string;
  profileImageUrl?: string;
};

type Props = {
  onStatus?: (msg: unknown) => void;
};

function PersonMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="7.5" r="3.25" fill="currentColor" />
      <path d="M5.5 20c.45-3.55 2.72-5.5 6.5-5.5s6.05 1.95 6.5 5.5H5.5Z" fill="currentColor" />
    </svg>
  );
}

export function AccountMenu({ onStatus }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const {
    connectAsync,
    connectors,
    isPending: isConnecting,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const onCorrectChain = chainId === XRPL_EVM_TESTNET_ID;
  const walletConnectConnector = connectors.find((c) => c.id === "walletConnect" || c.name.toLowerCase().includes("walletconnect"));

  const hint = useMemo(() => getClientXAuthHint(), []);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [walletDetailsOpen, setWalletDetailsOpen] = useState(false);
  const [xDetailsOpen, setXDetailsOpen] = useState(false);
  const [xAvatarFailed, setXAvatarFailed] = useState(false);
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

  const handleWalletConnect = async () => {
    setStatus(null);
    if (!walletConnectConnector) {
      setStatus("Wallet connection isn't available on this deployment yet.");
      return;
    }
    try {
      await connectAsync({ connector: walletConnectConnector });
      setOpen(false);
    } catch (err: unknown) {
      setStatus(`WalletConnect failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Connected wallet first (works for WalletConnect); injected add/switch as the fallback.
  const handleSwitch = async () => {
    setStatus(null);
    try {
      await switchChainAsync({ chainId: XRPL_EVM_TESTNET_ID });
      return;
    } catch {
      /* wallet may not know the chain yet — try the injected add-chain path */
    }
    const res = await ensureXrplEvmTestnet();
    if (!res.ok) setStatus(res.error ?? "Could not switch network.");
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
  const walletReady = Boolean(isConnected && address);
  const avLetter = address ? address.slice(2, 3).toUpperCase() : "?";
  const xLetter = (me?.username ?? "X").slice(0, 1).toUpperCase();
  const idle = !walletReady && !xBound;

  return (
    <div className="g-account" ref={rootRef}>
      <button
        type="button"
        className="g-account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        {xBound && me?.profileImageUrl && !xAvatarFailed ? (
          <img className="g-account-trigger-avatar" src={me.profileImageUrl} alt="" onError={() => setXAvatarFailed(true)} />
        ) : walletReady ? (
          <span className="g-av">{avLetter}</span>
        ) : (
          <span className="g-av g-av-idle"><PersonMark /></span>
        )}
        {xBound && (!me?.profileImageUrl || xAvatarFailed) && <span className="g-account-xmark" title={`@${me!.username}`}><XMark /></span>}
        {idle && <span className="g-account-label">Account</span>}
        {!idle && !xBound && isConnected && <span className="g-account-label g-account-label-short">{shortAddr(address)}</span>}
        <span className="g-account-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="g-account-panel" role="menu">
      {isConnected && address && (
        <button
          type="button"
          className="g-btn g-wallet-pill g-account-provider g-account-identity"
          onClick={() => { setWalletDetailsOpen(true); void copyAddress(); }}
          title="Copy wallet address"
        >
          <XrplMark size={30} />
          <span className="g-account-provider-label">{shortAddr(address)}</span>
          <span className="g-account-chevron" aria-hidden="true">›</span>
        </button>
      )}

      {!walletReady && (
      <button
        type="button"
        className={`g-btn g-wallet-pill g-account-provider${walletConnectConnector ? "" : " is-muted"}`}
        disabled={!walletConnectConnector || isConnecting}
        onClick={() => void handleWalletConnect()}
        title={walletConnectConnector ? "Connect with WalletConnect" : "Wallet connection isn't available on this deployment yet"}
      >
        <WalletConnectMark size={24} />
        <span className="g-account-provider-label">
          {isConnecting ? "Connecting…" : "WalletConnect"}
        </span>
        <span className="g-account-chevron" aria-hidden="true">›</span>
      </button>
      )}

      {xBound ? (
        <button
          type="button"
          className="g-btn g-wallet-pill g-account-provider g-account-identity"
          onClick={() => setXDetailsOpen(true)}
          title={"profile details"}
        >
          {me?.profileImageUrl && !xAvatarFailed ? (
            <img className="g-account-avatar" src={me.profileImageUrl} alt="" onError={() => setXAvatarFailed(true)} />
          ) : (
            <span className="g-account-avatar g-account-avatar-fallback">{xLetter}</span>
          )}
          <span className="g-account-provider-label">@{me!.username}</span>
          <span className="g-account-chevron" aria-hidden="true">›</span>
        </button>
      ) : (
      <button
        type="button"
        className="g-btn g-wallet-pill g-account-provider"
        disabled={loadingMe && hint.configured}
        onClick={onSignInX}
      >
        <XMark size={24} />
        <span className="g-account-provider-label">Sign in with X</span>
        <span className="g-account-chevron" aria-hidden="true">›</span>
        </button>
      )}

      {!walletReady && !walletConnectConnector && (
        <p className="g-micro g-account-provider-hint" role="status">
          Wallet connection isn&apos;t available on this deployment yet.
        </p>
      )}
      {!xBound && !hint.configured && (
        <p className="g-micro g-account-provider-hint">
          {hint.message}
        </p>
      )}

      {(isConnected || xBound) && <div className="g-account-divider" />}

      {walletReady && walletDetailsOpen ? (
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
              {isSwitching ? "Switching…" : "Switch to XRPL EVM"}
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

      {xBound && xDetailsOpen && (
        <div className="g-account-section" style={{ marginTop: isConnected ? 10 : 0 }}>
          <div className="g-account-row">
            <span className="g-av" style={{ background: "var(--x)", color: "var(--cta-fg)" }}>
              <XMark />
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
      )}

      <div className="g-account-divider" />
      <Link
        href="/you"
        role="menuitem"
        className="g-menu-item"
        onClick={() => setOpen(false)}
      >
        Account &amp; rewards
      </Link>
        </div>
      )}
    </div>
  );
}

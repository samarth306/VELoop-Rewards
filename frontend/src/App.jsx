import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const EMPTY_WALLET = {
  ves: 0,
  sves: 0,
  gems: 0,
  tokens: 0,
  spins: 0,
};

const DEFAULT_PAYOUT_OPTIONS = [
  { id: "demo_upi", name: "UPI", type: "UPI" },
  { id: "demo_bank", name: "Bank Transfer", type: "BANK" },
  { id: "demo_qr", name: "UPI QR", type: "QR" },
];

function App() {
  const [activeTab, setActiveTab] = useState("Wallet");

  const [token, setToken] = useState(
    localStorage.getItem("veloop_token") || sessionStorage.getItem("veloop_token") || ""
  );

  const [email, setEmail] = useState(
    localStorage.getItem("veloop_email") || sessionStorage.getItem("veloop_email") || ""
  );

  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(
    localStorage.getItem("veloop_remember") !== "false"
  );

  const [wallet, setWallet] = useState(EMPTY_WALLET);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [profile, setProfile] = useState({ name: "VELOOP User", email: "" });
  const [payoutOptions, setPayoutOptions] = useState(DEFAULT_PAYOUT_OPTIONS);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [withdrawMessage, setWithdrawMessage] = useState("");

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [transactionFilter, setTransactionFilter] = useState("ALL");
  const [withdrawalFilter, setWithdrawalFilter] = useState("ALL");

  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    method: "UPI",
    upiId: "",
    accountName: "",
    accountNumber: "",
    ifsc: "",
    bankName: "",
    qrFileName: "",
  });

  useEffect(() => {
    if (!token) return;
    loadAllData();
  }, [token]);

  async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      if (response.status === 401) {
        handleSessionExpired();
      }
      throw new Error(data.detail || "Something went wrong. Please try again.");
    }

    return data;
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setWithdrawMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.detail || "Invalid email or password");
      }

      if (rememberMe) {
        localStorage.setItem("veloop_token", data.access_token);
        localStorage.setItem("veloop_email", email.trim());
        localStorage.setItem("veloop_remember", "true");
        sessionStorage.removeItem("veloop_token");
        sessionStorage.removeItem("veloop_email");
      } else {
        sessionStorage.setItem("veloop_token", data.access_token);
        sessionStorage.setItem("veloop_email", email.trim());
        localStorage.removeItem("veloop_token");
        localStorage.removeItem("veloop_email");
        localStorage.setItem("veloop_remember", "false");
      }

      setToken(data.access_token);
      setEmail(email.trim());
      setPassword("");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadAllData(showSpinner = false) {
    if (!token) return;
    if (showSpinner) setRefreshing(true);
    setError("");

    try {
      await Promise.all([loadWallet(), loadTransactions(), loadWithdrawals(), loadProfile(), loadPayoutOptions()]);
    } catch (err) {
      setError(err.message || "Unable to refresh wallet data.");
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }

  async function loadWallet() {
    const data = await apiRequest("/wallet/me");
    setWallet({
      ves: Number(data.ves || 0),
      sves: Number(data.sves || 0),
      gems: Number(data.gems || 0),
      tokens: Number(data.tokens || 0),
      spins: Number(data.spins || 0),
    });
  }

  async function loadTransactions() {
    const data = await apiRequest("/wallet/me/transactions");
    setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
  }

  async function loadWithdrawals() {
    const data = await apiRequest("/wallet/me/withdrawals");
    setWithdrawals(Array.isArray(data.withdrawals) ? data.withdrawals : []);
  }

  async function loadProfile() {
    const data = await apiRequest("/auth/me");
    setProfile({
      name: data?.name || "VELOOP User",
      email: data?.email || email || "",
    });
    if (data?.email) setEmail(data.email);
  }

  async function loadPayoutOptions() {
    const data = await apiRequest("/payout-options");
    const options = Array.isArray(data?.options) ? data.options : [];
    setPayoutOptions(options.length ? options.filter((option) => option?.active !== false) : DEFAULT_PAYOUT_OPTIONS);
  }

  function getPayoutOptionForMethod(method) {
    const typeMap = { UPI: "UPI", BANK: "BANK_TRANSFER", QR: "UPI_QR" };
    return payoutOptions.find((option) => String(option?.type || "").toUpperCase() === typeMap[method]);
  }

  function handleSessionExpired() {
    localStorage.removeItem("veloop_token");
    sessionStorage.removeItem("veloop_token");
    setToken("");
    setWallet(EMPTY_WALLET);
    setTransactions([]);
    setWithdrawals([]);
    setProfile({ name: "VELOOP User", email: "" });
    setPayoutOptions(DEFAULT_PAYOUT_OPTIONS);
    setError("Your session has expired. Please sign in again.");
  }

  function handleLogout() {
    localStorage.removeItem("veloop_token");
    localStorage.removeItem("veloop_email");
    sessionStorage.removeItem("veloop_token");
    sessionStorage.removeItem("veloop_email");

    setToken("");
    setEmail("");
    setPassword("");
    setWallet(EMPTY_WALLET);
    setTransactions([]);
    setWithdrawals([]);
    setProfile({ name: "VELOOP User", email: "" });
    setPayoutOptions(DEFAULT_PAYOUT_OPTIONS);
    setProfileOpen(false);
    setProfileModalOpen(false);
    setActiveTab("Wallet");
  }

  async function handleWithdrawal(event) {
    event.preventDefault();
    setError("");
    setWithdrawMessage("");

    const amount = Number(withdrawForm.amount);
    const method = withdrawForm.method;

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Please enter a valid withdrawal amount.");
      return;
    }

    const selectedPayoutOption = getPayoutOptionForMethod(method);
    const configuredMinimum = Number(selectedPayoutOption?.required_amount || 100);

    if (amount < configuredMinimum) {
      setError(`Minimum withdrawal for ${selectedPayoutOption?.name || "this payout method"} is ${formatNumber(configuredMinimum)} VEs.`);
      return;
    }

    if (amount > Number(wallet.ves || 0)) {
      setError(`Insufficient VEs balance. Available: ${formatNumber(wallet.ves)} VEs.`);
      return;
    }

    if (method === "UPI" || method === "QR") {
      if (!withdrawForm.upiId.trim()) {
        setError("Please enter your UPI ID.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+$/.test(withdrawForm.upiId.trim())) {
        setError("Please enter a valid UPI ID, for example name@upi.");
        return;
      }
    }

    if (method === "BANK") {
      if (!withdrawForm.accountName.trim()) {
        setError("Please enter account holder name.");
        return;
      }
      if (!withdrawForm.accountNumber.trim()) {
        setError("Please enter bank account number.");
        return;
      }
      if (!withdrawForm.ifsc.trim()) {
        setError("Please enter IFSC code.");
        return;
      }
      if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(withdrawForm.ifsc.trim())) {
        setError("Please enter a valid IFSC code.");
        return;
      }
    }

    setLoading(true);

    try {
      if (!selectedPayoutOption?.method_id) {
        throw new Error("Selected payout method is currently unavailable.");
      }

      const payoutOptionId = selectedPayoutOption.method_id;
      const payoutDetails =
        method === "BANK"
          ? {
            account_name: withdrawForm.accountName.trim(),
            account_number: withdrawForm.accountNumber.trim(),
            ifsc: withdrawForm.ifsc.trim().toUpperCase(),
            bank_name: withdrawForm.bankName.trim(),
          }
          : {
            upi_id: withdrawForm.upiId.trim(),
            payout_mode: method === "QR" ? "UPI_QR" : "UPI_ID",
            qr_file_name: withdrawForm.qrFileName || null,
          };

      await apiRequest("/wallet/me/withdrawal", {
        method: "POST",
        body: JSON.stringify({
          amount,
          payout_option_id: payoutOptionId,
          payout_details: payoutDetails,
          request_id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `web-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        }),
      });

      setWithdrawMessage(
        `Withdrawal of ${formatNumber(amount)} VEs submitted successfully. Status: PENDING.`
      );

      setWithdrawForm((previous) => ({
        ...previous,
        amount: "",
        upiId: "",
        accountName: "",
        accountNumber: "",
        ifsc: "",
        bankName: "",
        qrFileName: "",
      }));

      await loadAllData(false);
    } catch (err) {
      setError(err.message || "Withdrawal failed.");
    } finally {
      setLoading(false);
    }
  }

  function updateWithdrawForm(key, value) {
    setWithdrawForm((previous) => ({ ...previous, [key]: value }));
    setError("");
    setWithdrawMessage("");
  }

  function handleQrFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a QR image file.");
      return;
    }
    updateWithdrawForm("qrFileName", file.name);
  }

  function setTab(tab) {
    setActiveTab(tab);
    setError("");
    setWithdrawMessage("");
    setProfileOpen(false);
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-IN");
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getInitial() {
    return email ? email.trim().charAt(0).toUpperCase() : "V";
  }

  function getTransactionIsCredit(transaction) {
    const type = String(transaction?.type || "").toUpperCase();
    return type === "REWARD" || type === "CREDIT" || Number(transaction?.amount || 0) > 0;
  }

  function getStatusClass(status) {
    const normalized = String(status || "").toLowerCase();
    if (["completed", "success", "successful"].includes(normalized)) return "status completed";
    if (["failed", "rejected", "cancelled"].includes(normalized)) return "status failed";
    return "status pending";
  }

  const filteredTransactions = useMemo(() => {
    if (transactionFilter === "ALL") return transactions;
    return transactions.filter((transaction) => {
      const type = String(transaction?.type || "").toUpperCase();
      if (transactionFilter === "REWARD") return type === "REWARD" || type === "CREDIT";
      if (transactionFilter === "WITHDRAWAL") return type === "WITHDRAWAL";
      return true;
    });
  }, [transactions, transactionFilter]);

  const filteredWithdrawals = useMemo(() => {
    if (withdrawalFilter === "ALL") return withdrawals;
    return withdrawals.filter(
      (withdrawal) => String(withdrawal?.status || "PENDING").toUpperCase() === withdrawalFilter
    );
  }, [withdrawals, withdrawalFilter]);

  const completedWithdrawals = withdrawals.filter(
    (item) => String(item?.status || "").toUpperCase() === "COMPLETED"
  ).length;

  const pendingWithdrawals = withdrawals.filter(
    (item) => String(item?.status || "PENDING").toUpperCase() === "PENDING"
  ).length;

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-decoration decoration-one"></div>
        <div className="login-decoration decoration-two"></div>
        <div className="login-decoration decoration-three"></div>

        <div className="login-card">
          <div className="login-brand">
            <div className="login-logo">V</div>
            <div className="login-brand-name">VELOOP</div>
            <div className="login-brand-subtitle">REWARDS</div>
          </div>

          <div className="login-heading">
            <p className="eyebrow">VELOOP REWARDS</p>
            <h1>Welcome back</h1>
            <p className="login-subtitle">Sign in to access your rewards wallet.</p>
          </div>

          {error && (
            <div className="error-message login-error">
              <span className="error-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleLogin}>
            <div className="input-group">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                margin: "2px 0 14px",
                fontSize: "13px",
                color: "#475569",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                style={{ width: "16px", height: "16px", accentColor: "#2563eb" }}
              />
              Remember me on this device
            </label>

            <button type="submit" className="primary-btn login-btn" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <span className="button-arrow">→</span>}
            </button>
          </form>

          <div className="login-footer">
            <span>Password is never stored in the browser.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="logo">
            <div className="logo-mark"><span>V</span></div>
            <div className="logo-text">
              <h2>VELOOP</h2>
              <span>Rewards</span>
            </div>
          </div>

          <div className="sidebar-line"></div>

          <nav className="nav">
            {["Wallet", "Transactions", "Withdrawals"].map((item) => (
              <button
                key={item}
                className={activeTab === item ? "nav-item active" : "nav-item"}
                onClick={() => setTab(item)}
              >
                <span className="nav-icon">
                  {item === "Wallet" && "◈"}
                  {item === "Transactions" && "↔"}
                  {item === "Withdrawals" && "↑"}
                </span>
                <span className="nav-label">{item}</span>
                {activeTab === item && <span className="nav-active-dot"></span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar">{getInitial()}</div>
            <div className="user-mini-info">
              <strong>{profile.name || "VELOOP User"}</strong>
              <span title={email}>{email}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <span>↪</span>
            Logout
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-heading">
            <p className="eyebrow">VELOOP REWARDS</p>
            <h1>{activeTab}</h1>
            <div className="title-accent"></div>
          </div>

          <div className="profile">
            <button
              type="button"
              className="notification"
              onClick={() => setError("No new notifications.")}
              aria-label="Notifications"
              title="Notifications"
            >
              <span>•</span>
            </button>

            <button
              type="button"
              onClick={() => loadAllData(true)}
              disabled={refreshing}
              aria-label="Refresh wallet"
              title="Refresh wallet"
              style={{
                width: "44px",
                height: "44px",
                border: "1px solid #dbe4f0",
                borderRadius: "12px",
                background: "#ffffff",
                color: "#2563eb",
                display: "grid",
                placeItems: "center",
                fontSize: "20px",
                cursor: refreshing ? "wait" : "pointer",
                opacity: refreshing ? 0.65 : 1,
                transition: "0.2s ease",
              }}
            >
              <span style={{ display: "inline-block", transform: refreshing ? "rotate(180deg)" : "none", transition: "0.4s" }}>↻</span>
            </button>

            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="profile-avatar"
                onClick={() => setProfileOpen((value) => !value)}
                aria-label="Open profile menu"
                style={{
                  cursor: "pointer",
                  position: "relative",
                  zIndex: 20,
                  pointerEvents: "auto",
                  background: "#094fe7",
                  color: "#ffffff",
                  border: "2px solid #ffffff",
                  boxShadow: "0 6px 18px rgba(37,99,235,0.25)",
                }}
              >
                {getInitial()}
              </button>

              {profileOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "52px",
                    right: "0",
                    width: "250px",
                    background: "#ffffff",
                    border: "1px solid #e5eaf2",
                    borderRadius: "16px",
                    padding: "16px",
                    boxShadow: "0 18px 45px rgba(15,23,42,0.18)",
                    zIndex: 1000,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: "14px" }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#2563eb", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>{getInitial()}</div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", color: "#0f172a" }}>{profile.name || "VELOOP User"}</strong>
                      <span style={{ display: "block", fontSize: "12px", color: "#64748b", wordBreak: "break-word" }}>{email}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      setProfileModalOpen(true);
                    }}
                    style={{ width: "100%", padding: "11px", border: "none", borderRadius: "9px", background: "#2563eb", color: "#fff", fontWeight: 700, cursor: "pointer", marginBottom: "8px" }}
                  >
                    View Profile
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{ width: "100%", padding: "11px", border: "none", borderRadius: "9px", background: "#fee2e2", color: "#b91c1c", fontWeight: 700, cursor: "pointer" }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {error && (
          <div className="error-message page-error">
            <span className="error-icon">!</span>
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="error-close">×</button>
          </div>
        )}

        {activeTab === "Wallet" && (
          <div className="content-stack">
            <section className="hero-card">
              <div className="hero-content">
                <div className="hero-label">Total VEs Balance</div>
                <h2>{formatNumber(wallet.ves)}</h2>
                <span className="hero-description">Available for rewards and withdrawals</span>
              </div>
              <div className="hero-symbol"><span>VE</span></div>
              <div className="hero-shape hero-shape-one"></div>
              <div className="hero-shape hero-shape-two"></div>
            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Your Rewards</h2>
                  <p>Current balances from your VELOOP wallet</p>
                </div>
                <button
                  type="button"
                  onClick={() => loadAllData(true)}
                  style={{ border: "none", background: "#eff6ff", color: "#2563eb", borderRadius: "10px", padding: "9px 12px", fontWeight: 700, cursor: "pointer" }}
                >
                  {refreshing ? "Refreshing..." : "↻ Refresh"}
                </button>
              </div>

              <div className="currency-grid">
                <CurrencyCard name="VEs" value={wallet.ves} label="Reward Points" primary />
                <CurrencyCard name="SVEs" value={wallet.sves} label="Special VEs" />
                <CurrencyCard name="Gems" value={wallet.gems} label="Gems" />
                <CurrencyCard name="Tokens" value={wallet.tokens} label="Tokens" />
                <CurrencyCard name="Spins" value={wallet.spins} label="Game Spins" />
              </div>
            </section>

            <section className="quick-actions">
              <div className="quick-content">
                <h2>Quick Actions</h2>
                <p>Manage your rewards wallet</p>
              </div>
              <div className="action-buttons">
                <button onClick={() => setTab("Withdrawals")} className="primary-btn">
                  Withdraw VEs <span>→</span>
                </button>
                <button onClick={() => setTab("Transactions")} className="secondary-btn">
                  View Transactions <span>→</span>
                </button>
              </div>
            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Recent Activity</h2>
                  <p>Your latest wallet transactions</p>
                </div>
                <button className="text-btn" onClick={() => setTab("Transactions")}>View all →</button>
              </div>
              <TransactionList transactions={transactions.slice(0, 5)} formatDate={formatDate} />
            </section>
          </div>
        )}

        {activeTab === "Transactions" && (
          <div className="content-stack">
            <section className="page-card">
              <div className="page-card-header">
                <div>
                  <span className="card-kicker">WALLET ACTIVITY</span>
                  <h2>Transaction History</h2>
                  <p>Complete wallet activity from your account.</p>
                </div>
                <div className="card-count">
                  <strong>{transactions.length}</strong>
                  <span>Transactions</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "4px 0 18px" }}>
                {["ALL", "REWARD", "WITHDRAWAL"].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTransactionFilter(filter)}
                    style={{ border: "1px solid #dbe4f0", borderRadius: "999px", padding: "8px 13px", background: transactionFilter === filter ? "#2563eb" : "#fff", color: transactionFilter === filter ? "#fff" : "#475569", fontWeight: 700, cursor: "pointer" }}
                  >
                    {filter === "ALL" ? "All" : filter === "REWARD" ? "Rewards" : "Withdrawals"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => loadAllData(true)}
                  disabled={refreshing}
                  style={{ marginLeft: "auto", border: "none", borderRadius: "10px", padding: "8px 13px", background: "#eff6ff", color: "#2563eb", fontWeight: 700, cursor: "pointer" }}
                >
                  ↻ Refresh
                </button>
              </div>

              <TransactionList transactions={filteredTransactions} formatDate={formatDate} />
            </section>
          </div>
        )}

        {activeTab === "Withdrawals" && (
          <div className="content-stack">
            <section className="page-card withdrawal-page-card">
              <div className="page-card-header">
                <div>
                  <span className="card-kicker">PAYOUT CENTER</span>
                  <h2>Withdraw VEs</h2>
                  <p>Submit a secure withdrawal request using your available VEs.</p>
                </div>
                <div className="withdraw-balance-badge">
                  <span>Available</span>
                  <strong>{formatNumber(wallet.ves)} VEs</strong>
                </div>
              </div>

              {withdrawMessage && (
                <div className="success-message">
                  <span className="success-icon">✓</span>
                  <span>{withdrawMessage}</span>
                </div>
              )}

              <form className="withdraw-box" onSubmit={handleWithdrawal}>
                <div className="form-section-title">Withdrawal details</div>

                <div className="form-grid">
                  <div className="input-group">
                    <label>Withdrawal Amount</label>
                    <div className="input-with-suffix">
                      <input
                        type="number"
                        min="100"
                        placeholder="Minimum 100 VEs"
                        value={withdrawForm.amount}
                        onChange={(event) => updateWithdrawForm("amount", event.target.value)}
                      />
                      <span>VEs</span>
                    </div>
                    <small>Minimum withdrawal: 100 VEs</small>
                  </div>

                  <div className="input-group">
                    <label>Payout Method</label>
                    <select
                      value={withdrawForm.method}
                      onChange={(event) => updateWithdrawForm("method", event.target.value)}
                    >
                      {payoutOptions.map((option) => {
                        const type = String(option?.type || "").toUpperCase();
                        const value = type === "BANK_TRANSFER" ? "BANK" : type === "UPI_QR" ? "QR" : "UPI";
                        return (
                          <option key={option.method_id} value={value}>
                            {option.name || value}{option.required_amount ? ` • ${formatNumber(option.required_amount)} VEs min` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {(withdrawForm.method === "UPI" || withdrawForm.method === "QR") && (
                  <div className="input-group">
                    <label>UPI ID</label>
                    <input
                      type="text"
                      placeholder="example@upi"
                      value={withdrawForm.upiId}
                      onChange={(event) => updateWithdrawForm("upiId", event.target.value)}
                      autoComplete="off"
                    />
                    <small>Enter the UPI ID linked to your payout account.</small>
                  </div>
                )}

                {withdrawForm.method === "QR" && (
                  <div style={{ marginTop: "14px", padding: "16px", border: "1px dashed #cbd5e1", borderRadius: "14px", background: "#f8fafc" }}>
                    <strong style={{ display: "block", marginBottom: "5px", color: "#0f172a" }}>UPI QR code</strong>
                    <span style={{ display: "block", color: "#64748b", fontSize: "13px", marginBottom: "12px" }}>Add your QR image for reference. The payout request is securely submitted through the configured UPI option.</span>
                    <input type="file" accept="image/*" onChange={handleQrFile} />
                    {withdrawForm.qrFileName && (
                      <div style={{ marginTop: "9px", fontSize: "13px", color: "#2563eb", fontWeight: 700 }}>✓ {withdrawForm.qrFileName}</div>
                    )}
                  </div>
                )}

                {withdrawForm.method === "BANK" && (
                  <div style={{ marginTop: "14px" }}>
                    <div className="form-grid">
                      <div className="input-group">
                        <label>Account Holder Name</label>
                        <input
                          type="text"
                          placeholder="Full name as per bank"
                          value={withdrawForm.accountName}
                          onChange={(event) => updateWithdrawForm("accountName", event.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label>Bank Name</label>
                        <input
                          type="text"
                          placeholder="Bank name"
                          value={withdrawForm.bankName}
                          onChange={(event) => updateWithdrawForm("bankName", event.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label>Account Number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Enter account number"
                          value={withdrawForm.accountNumber}
                          onChange={(event) => updateWithdrawForm("accountNumber", event.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      <div className="input-group">
                        <label>IFSC Code</label>
                        <input
                          type="text"
                          placeholder="ABCD0123456"
                          value={withdrawForm.ifsc}
                          onChange={(event) => updateWithdrawForm("ifsc", event.target.value.toUpperCase())}
                          maxLength={11}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="withdraw-summary">
                  <div>
                    <span>Available balance</span>
                    <strong>{formatNumber(wallet.ves)} VEs</strong>
                  </div>
                  <div>
                    <span>Requested amount</span>
                    <strong>{withdrawForm.amount ? formatNumber(withdrawForm.amount) : "0"} VEs</strong>
                  </div>
                  <div>
                    <span>Payout method</span>
                    <strong>{withdrawForm.method === "BANK" ? "Bank Transfer" : withdrawForm.method === "QR" ? "UPI QR" : "UPI"}</strong>
                  </div>
                </div>

                <button type="submit" className="primary-btn withdraw-submit-btn" disabled={loading}>
                  {loading ? "Processing..." : "Submit Withdrawal"}
                  {!loading && <span>→</span>}
                </button>
              </form>
            </section>

            <section className="page-card">
              <div className="page-card-header compact">
                <div>
                  <span className="card-kicker">PAYOUT ACTIVITY</span>
                  <h2>Withdrawal History</h2>
                  <p>Track every submitted withdrawal request and its status.</p>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>{pendingWithdrawals} pending</span>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>{completedWithdrawals} completed</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "4px 0 18px" }}>
                {["ALL", "PENDING", "COMPLETED", "FAILED"].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setWithdrawalFilter(filter)}
                    style={{ border: "1px solid #dbe4f0", borderRadius: "999px", padding: "8px 13px", background: withdrawalFilter === filter ? "#2563eb" : "#fff", color: withdrawalFilter === filter ? "#fff" : "#475569", fontWeight: 700, cursor: "pointer" }}
                  >
                    {filter === "ALL" ? "All" : filter}
                  </button>
                ))}
              </div>

              <WithdrawalList withdrawals={filteredWithdrawals} formatDate={formatDate} />
            </section>
          </div>
        )}
      </main>

      {profileModalOpen && (
        <div
          onClick={() => setProfileModalOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", padding: "20px", zIndex: 2000 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(500px, 100%)", background: "#fff", borderRadius: "22px", boxShadow: "0 25px 70px rgba(15,23,42,0.25)", overflow: "hidden" }}
          >
            <div style={{ padding: "22px 24px", background: "linear-gradient(135deg,#2563eb,#4f46e5)", color: "#fff", display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "58px", height: "58px", borderRadius: "17px", background: "rgba(255,255,255,0.18)", display: "grid", placeItems: "center", fontSize: "24px", fontWeight: 800 }}>{getInitial()}</div>
              <div>
                <div style={{ fontSize: "12px", opacity: 0.8, letterSpacing: "1.5px" }}>ACCOUNT PROFILE</div>
                <h2 style={{ margin: "4px 0 0", fontSize: "23px" }}>{profile.name || "VELOOP User"}</h2>
              </div>
              <button type="button" onClick={() => setProfileModalOpen(false)} style={{ marginLeft: "auto", border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", width: "36px", height: "36px", borderRadius: "10px", cursor: "pointer", fontSize: "20px" }}>×</button>
            </div>

            <div style={{ padding: "24px" }}>
              <ProfileRow label="Email address" value={email} />
              <ProfileRow label="Account access" value="Authenticated" />
              <ProfileRow label="Wallet VEs" value={`${formatNumber(wallet.ves)} VEs`} />
              <ProfileRow label="Security" value="JWT protected session" />

              <div style={{ marginTop: "18px", padding: "14px", borderRadius: "13px", background: "#f8fafc", color: "#64748b", fontSize: "13px", lineHeight: 1.55 }}>
                Your password is not displayed or stored in this profile panel. Login session data is managed through browser storage according to your Remember Me selection.
              </div>

              <button type="button" onClick={() => setProfileModalOpen(false)} className="primary-btn" style={{ width: "100%", marginTop: "18px" }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "18px", padding: "13px 0", borderBottom: "1px solid #eef2f7" }}>
      <span style={{ color: "#64748b", fontSize: "13px" }}>{label}</span>
      <strong style={{ color: "#0f172a", fontSize: "13px", textAlign: "right", wordBreak: "break-word" }}>{value}</strong>
    </div>
  );
}

function TransactionList({ transactions, formatDate }) {
  if (!transactions.length) {
    return (
      <div className="transaction-list">
        <div className="empty-state">
          <div className="empty-icon">↔</div>
          <strong>No transactions found</strong>
          <span>Your wallet activity will appear here.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      {transactions.map((transaction, index) => {
        const isCredit =
          String(transaction?.type || "").toUpperCase() === "REWARD" ||
          String(transaction?.type || "").toUpperCase() === "CREDIT" ||
          Number(transaction?.amount || 0) > 0;

        return (
          <div className="transaction" key={transaction.transaction_id || index}>
            <div className={isCredit ? "transaction-icon reward-icon" : "transaction-icon withdrawal-icon"}>
              {isCredit ? "+" : "↑"}
            </div>

            <div className="transaction-info">
              <strong>{transaction.description || transaction.type || "Wallet transaction"}</strong>
              <span>{transaction.type || "TRANSACTION"} • {formatDate(transaction.created_at)}</span>
              {transaction.reference_id && (
                <small style={{ color: "#94a3b8", marginTop: "3px" }}>Ref: {String(transaction.reference_id).slice(0, 18)}...</small>
              )}
            </div>

            <div className="transaction-right">
              <strong className={isCredit ? "amount-positive" : "amount-negative"}>
                {isCredit ? "+" : "-"}{formatAmount(transaction.amount)} VEs
              </strong>
              <span className={getLocalStatusClass(transaction.status)}>{transaction.status || "PENDING"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WithdrawalList({ withdrawals, formatDate }) {
  if (!withdrawals.length) {
    return (
      <div className="withdrawal-history-empty">
        <div className="empty-icon">↑</div>
        <strong>No withdrawals yet</strong>
        <span>Your withdrawal requests will appear here.</span>
      </div>
    );
  }

  return (
    <div className="withdrawal-list">
      {withdrawals.map((withdrawal, index) => {
        const method = getPayoutLabel(withdrawal.payout_option_id, withdrawal.payout_details);
        const details = withdrawal.payout_details || {};
        const detailText = details.upi_id || details.account_number || "Payout details saved";

        return (
          <div className="withdrawal-row" key={withdrawal.withdrawal_id || index}>
            <div className="withdrawal-icon">↑</div>
            <div className="withdrawal-info">
              <strong>{formatAmount(withdrawal.amount)} VEs</strong>
              <span>{method} • {formatDate(withdrawal.created_at)}</span>
              <small style={{ color: "#94a3b8", marginTop: "3px" }}>{maskSensitive(detailText)}</small>
            </div>
            <div className="withdrawal-right">
              <span className={getLocalStatusClass(withdrawal.status)}>{withdrawal.status || "PENDING"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CurrencyCard({ name, value, label, primary }) {
  return (
    <div className={primary ? "currency-card primary-card" : "currency-card"}>
      <div className="currency-top">
        <span>{name}</span>
        <div className="currency-dot">{name.charAt(0)}</div>
      </div>
      <h3>{formatAmount(value)}</h3>
      <p>{label}</p>
    </div>
  );
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function getLocalStatusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "success", "successful"].includes(normalized)) return "status completed";
  if (["failed", "rejected", "cancelled"].includes(normalized)) return "status failed";
  return "status pending";
}

function getPayoutLabel(optionId, details = {}) {
  if (details.payout_mode === "UPI_QR") return "UPI QR";
  if (optionId === "demo_bank") return "Bank Transfer";
  return "UPI";
}

function maskSensitive(value) {
  const text = String(value || "");
  if (text.includes("@")) {
    const [name, domain] = text.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  if (text.length > 6) return `••••${text.slice(-4)}`;
  return text;
}

export default App;



import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const EMPTY_WALLET = {
  ves: 0,
  sves: 0,
  gems: 0,
  tokens: 0,
  spins: 0,
};

const DEFAULT_PAYOUT_OPTIONS = [
  {
    method_id: "upi",
    name: "UPI",
    type: "UPI",
    currency: "ves",
    active: true,
    denominations: [
      { payout_value: 10, required_amount: 2400 },
      { payout_value: 25, required_amount: 5800 },
      { payout_value: 50, required_amount: 10000 },
      { payout_value: 100, required_amount: 19500 },
      { payout_value: 150, required_amount: 28500 },
      { payout_value: 300, required_amount: 52500 },
      { payout_value: 500, required_amount: 80500 },
      { payout_value: 1000, required_amount: 150000 },
    ],
  },
];

function App() {
  const [activeTab, setActiveTab] = useState("Wallet");

  const [token, setToken] = useState(
    localStorage.getItem("veloop_token") ||
    sessionStorage.getItem("veloop_token") ||
    ""
  );

  const [email, setEmail] = useState(
    localStorage.getItem("veloop_email") ||
    sessionStorage.getItem("veloop_email") ||
    ""
  );

  const [password, setPassword] = useState("");

  const [showRegister, setShowRegister] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] =
    useState("");

  const [showForgotPassword, setShowForgotPassword] =
    useState(false);

  const [showLoginPassword, setShowLoginPassword] =
    useState(false);

  const [forgotEmail, setForgotEmail] = useState("");

  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] =
    useState("");

  const [showResetPassword, setShowResetPassword] =
    useState(false);

  const [rememberMe, setRememberMe] = useState(
    localStorage.getItem("veloop_remember") !== "false"
  );

  const [wallet, setWallet] = useState(EMPTY_WALLET);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);

  const [profile, setProfile] = useState({
    name: "VELOOP User",
    email: "",
  });

  const [payoutOptions, setPayoutOptions] = useState(
    DEFAULT_PAYOUT_OPTIONS
  );

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [withdrawMessage, setWithdrawMessage] = useState("");

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] =
    useState(false);

  const [transactionFilter, setTransactionFilter] =
    useState("ALL");

  const [withdrawalFilter, setWithdrawalFilter] =
    useState("ALL");

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

  /*
   * Detect a password reset link.
   *
   * Backend sends:
   * /reset-password?token=...
   */
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const tokenFromUrl = params.get("token");

    if (
      window.location.pathname === "/reset-password" &&
      tokenFromUrl
    ) {
      setResetToken(tokenFromUrl);
    }
  }, []);

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

      throw new Error(
        data.detail ||
        data.message ||
        "Something went wrong. Please try again."
      );
    }

    return data;
  }

  async function handleForgotPassword() {
    setError("");
    setWithdrawMessage("");

    const targetEmail = (
      forgotEmail.trim() || email.trim()
    ).trim();

    if (!targetEmail) {
      setError("Please enter your email address first.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: targetEmail,
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Unable to process password reset request."
        );
      }

      setShowForgotPassword(false);
      setForgotEmail("");

      setError(
        data.message ||
        "If an account exists for this email, a password reset link has been sent."
      );
    } catch (err) {
      setError(
        err.message ||
        "Unable to process password reset request."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();

    setError("");
    setWithdrawMessage("");

    if (!resetToken) {
      setError(
        "Invalid or missing password reset link."
      );
      return;
    }

    if (!resetPassword) {
      setError("Please enter your new password.");
      return;
    }

    if (resetPassword.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: resetToken,
            new_password: resetPassword,
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Unable to reset your password."
        );
      }

      setResetPassword("");
      setResetConfirmPassword("");

      setError(
        data.message ||
        "Password reset successfully. You can now sign in."
      );

      /*
       * Remove token from URL and return to normal login.
       */
      window.history.replaceState({}, "", "/");
      setResetToken("");
    } catch (err) {
      setError(
        err.message ||
        "Unable to reset your password."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setWithdrawMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.detail || "Invalid email or password"
        );
      }

      if (rememberMe) {
        localStorage.setItem(
          "veloop_token",
          data.access_token
        );

        localStorage.setItem(
          "veloop_email",
          email.trim()
        );

        localStorage.setItem(
          "veloop_remember",
          "true"
        );

        sessionStorage.removeItem("veloop_token");
        sessionStorage.removeItem("veloop_email");
      } else {
        sessionStorage.setItem(
          "veloop_token",
          data.access_token
        );

        sessionStorage.setItem(
          "veloop_email",
          email.trim()
        );

        localStorage.removeItem("veloop_token");
        localStorage.removeItem("veloop_email");

        localStorage.setItem(
          "veloop_remember",
          "false"
        );
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

  async function handleRegister(event) {
    event.preventDefault();

    setError("");
    setWithdrawMessage("");

    if (!registerName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!registerEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (registerPassword.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: registerName.trim(),
            email: registerEmail.trim(),
            password: registerPassword,
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
          data.message ||
          "Unable to create your account."
        );
      }

      setEmail(registerEmail.trim());
      setPassword("");
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
      setShowRegister(false);

      setError(
        "Account created successfully. Please sign in."
      );
    } catch (err) {
      setError(
        err.message ||
        "Unable to create your account."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAllData(showSpinner = false) {
    if (!token) return;

    if (showSpinner) {
      setRefreshing(true);
    }

    setError("");

    try {
      await Promise.all([
        loadWallet(),
        loadTransactions(),
        loadWithdrawals(),
        loadProfile(),
        loadPayoutOptions(),
      ]);
    } catch (err) {
      setError(
        err.message ||
        "Unable to refresh wallet data."
      );
    } finally {
      if (showSpinner) {
        setRefreshing(false);
      }
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
    const data = await apiRequest(
      "/wallet/me/transactions"
    );

    setTransactions(
      Array.isArray(data.transactions)
        ? data.transactions
        : []
    );
  }

  async function loadWithdrawals() {
    const data = await apiRequest(
      "/wallet/me/withdrawals"
    );

    setWithdrawals(
      Array.isArray(data.withdrawals)
        ? data.withdrawals
        : []
    );
  }

  async function loadProfile() {
    const data = await apiRequest("/auth/me");

    setProfile({
      name: data?.name || "VELOOP User",
      email: data?.email || email || "",
    });

    if (data?.email) {
      setEmail(data.email);
    }
  }

  async function loadPayoutOptions() {
    const data = await apiRequest(
      "/payout-options"
    );

    const options = Array.isArray(data?.options)
      ? data.options
      : [];

    setPayoutOptions(
      options.length
        ? options.filter(
          (option) => option?.active !== false
        )
        : DEFAULT_PAYOUT_OPTIONS
    );
  }
  function getPayoutOptionForMethod(method) {
    return payoutOptions.find(
      (option) =>
        String(option?.type || "").toUpperCase() ===
        String(method || "").toUpperCase()
    );
  }

  function getPayoutDenominations(option) {
    if (!Array.isArray(option?.denominations)) {
      return [];
    }

    return option.denominations
      .filter(
        (denomination) =>
          Number(denomination?.payout_value) > 0 &&
          Number(denomination?.required_amount) > 0
      )
      .sort(
        (a, b) =>
          Number(a.payout_value) -
          Number(b.payout_value)
      );
  }

  function getSelectedPayoutDenomination(
    option,
    payoutValue
  ) {
    const value = Number(payoutValue);

    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return (
      getPayoutDenominations(option).find(
        (denomination) =>
          Number(denomination.payout_value) ===
          value
      ) || null
    );
  }
  function handleSessionExpired() {
    localStorage.removeItem("veloop_token");
    sessionStorage.removeItem("veloop_token");

    setToken("");

    setWallet(EMPTY_WALLET);
    setTransactions([]);
    setWithdrawals([]);

    setProfile({
      name: "VELOOP User",
      email: "",
    });

    setPayoutOptions(
      DEFAULT_PAYOUT_OPTIONS
    );

    setError(
      "Your session has expired. Please sign in again."
    );
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

    setProfile({
      name: "VELOOP User",
      email: "",
    });

    setPayoutOptions(
      DEFAULT_PAYOUT_OPTIONS
    );

    setProfileOpen(false);
    setProfileModalOpen(false);
    setActiveTab("Wallet");
  }

  async function handleWithdrawal(event) {
    event.preventDefault();

    setError("");
    setWithdrawMessage("");

    const payoutValue = Number(
      withdrawForm.amount
    );

    const method = withdrawForm.method;

    if (
      !Number.isFinite(payoutValue) ||
      payoutValue <= 0
    ) {
      setError(
        "Please select a valid payout amount."
      );
      return;
    }

    const selectedPayoutOption =
      getPayoutOptionForMethod(method);

    if (!selectedPayoutOption?.method_id) {
      setError(
        "Selected payout method is currently unavailable."
      );
      return;
    }

    const selectedDenomination =
      getSelectedPayoutDenomination(
        selectedPayoutOption,
        payoutValue
      );

    if (!selectedDenomination) {
      setError(
        "Please select a valid payout denomination."
      );
      return;
    }

    const requiredVes = Number(
      selectedDenomination.required_amount
    );

    if (
      !Number.isFinite(requiredVes) ||
      requiredVes <= 0
    ) {
      setError(
        "The selected payout option is not configured correctly."
      );
      return;
    }

    if (
      requiredVes >
      Number(wallet.ves || 0)
    ) {
      setError(
        `Insufficient VEs balance. Required: ${formatNumber(
          requiredVes
        )} VEs. Available: ${formatNumber(
          wallet.ves
        )} VEs.`
      );
      return;
    }

    if (
      method === "UPI" ||
      method === "QR"
    ) {
      if (!withdrawForm.upiId.trim()) {
        setError("Please enter your UPI ID.");
        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+$/.test(
          withdrawForm.upiId.trim()
        )
      ) {
        setError(
          "Please enter a valid UPI ID, for example name@upi."
        );
        return;
      }
    }

    if (method === "BANK") {
      if (!withdrawForm.accountName.trim()) {
        setError(
          "Please enter account holder name."
        );
        return;
      }

      if (!withdrawForm.accountNumber.trim()) {
        setError(
          "Please enter bank account number."
        );
        return;
      }

      if (!withdrawForm.ifsc.trim()) {
        setError("Please enter IFSC code.");
        return;
      }

      if (
        !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(
          withdrawForm.ifsc.trim()
        )
      ) {
        setError(
          "Please enter a valid IFSC code."
        );
        return;
      }
    }

    setLoading(true);

    try {
      const payoutOptionId =
        selectedPayoutOption.method_id;

      const payoutDetails =
        method === "BANK"
          ? {
            account_name:
              withdrawForm.accountName.trim(),
            account_number:
              withdrawForm.accountNumber.trim(),
            ifsc:
              withdrawForm.ifsc
                .trim()
                .toUpperCase(),
            bank_name:
              withdrawForm.bankName.trim(),
          }
          : {
            upi_id:
              withdrawForm.upiId.trim(),
            payout_mode:
              method === "QR"
                ? "UPI_QR"
                : "UPI_ID",
            qr_file_name:
              withdrawForm.qrFileName ||
              null,
          };

      await apiRequest(
        "/wallet/me/withdrawal",
        {
          method: "POST",
          body: JSON.stringify({
            /*
             * Backend expects the payout denomination
             * (for example ₹10 or ₹25), not the VEs cost.
             * The server resolves and validates the
             * corresponding required VEs.
             */
            amount: payoutValue,
            payout_option_id:
              payoutOptionId,
            payout_details:
              payoutDetails,
            request_id:
              typeof crypto !==
                "undefined" &&
              crypto.randomUUID
                ? crypto.randomUUID()
                : `web-${Date.now()}-${Math.random()
                  .toString(16)
                  .slice(2)}`,
          }),
        }
      );

      setWithdrawMessage(
        `₹${formatNumber(
          payoutValue
        )} payout submitted successfully. ${formatNumber(
          requiredVes
        )} VEs reserved. Status: PENDING.`
      );

      setWithdrawForm(
        (previous) => ({
          ...previous,
          amount: "",
          upiId: "",
          accountName: "",
          accountNumber: "",
          ifsc: "",
          bankName: "",
          qrFileName: "",
        })
      );

      await loadAllData(false);
    } catch (err) {
      setError(
        err.message ||
        "Withdrawal failed."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateWithdrawForm(
    key,
    value
  ) {
    setWithdrawForm(
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );

    setError("");
    setWithdrawMessage("");
  }

  function handleQrFile(event) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(
        "Please select a QR image file."
      );
      return;
    }

    updateWithdrawForm(
      "qrFileName",
      file.name
    );
  }

  function setTab(tab) {
    setActiveTab(tab);
    setError("");
    setWithdrawMessage("");
    setProfileOpen(false);
  }

  function formatNumber(value) {
    return Number(
      value || 0
    ).toLocaleString("en-IN");
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  function getInitial() {
    return email
      ? email
        .trim()
        .charAt(0)
        .toUpperCase()
      : "V";
  }

  function getTransactionIsCredit(
    transaction
  ) {
    const type = String(
      transaction?.type || ""
    ).toUpperCase();

    return (
      type === "REWARD" ||
      type === "CREDIT" ||
      Number(transaction?.amount || 0) >
      0
    );
  }

  function getStatusClass(status) {
    const normalized =
      String(status || "").toLowerCase();

    if (
      [
        "completed",
        "success",
        "successful",
      ].includes(normalized)
    ) {
      return "status completed";
    }

    if (
      [
        "failed",
        "rejected",
        "cancelled",
      ].includes(normalized)
    ) {
      return "status failed";
    }

    return "status pending";
  }

  const filteredTransactions =
    useMemo(() => {
      if (
        transactionFilter ===
        "ALL"
      ) {
        return transactions;
      }

      return transactions.filter(
        (transaction) => {
          const type = String(
            transaction?.type || ""
          ).toUpperCase();

          if (
            transactionFilter ===
            "REWARD"
          ) {
            return (
              type === "REWARD" ||
              type === "CREDIT"
            );
          }

          if (
            transactionFilter ===
            "WITHDRAWAL"
          ) {
            return (
              type === "WITHDRAWAL"
            );
          }

          return true;
        }
      );
    }, [
      transactions,
      transactionFilter,
    ]);

  const filteredWithdrawals =
    useMemo(() => {
      if (
        withdrawalFilter ===
        "ALL"
      ) {
        return withdrawals;
      }

      return withdrawals.filter(
        (withdrawal) =>
          String(
            withdrawal?.status ||
            "PENDING"
          ).toUpperCase() ===
          withdrawalFilter
      );
    }, [
      withdrawals,
      withdrawalFilter,
    ]);

  const completedWithdrawals =
    withdrawals.filter(
      (item) =>
        String(
          item?.status || ""
        ).toUpperCase() ===
        "APPROVED"
    ).length;

  const pendingWithdrawals =
    withdrawals.filter(
      (item) =>
        String(
          item?.status ||
          "PENDING"
        ).toUpperCase() ===
        "PENDING"
    ).length;

  /*
   * PASSWORD RESET SCREEN
   *
   * This uses the same overall VELOOP visual language.
   * It does not affect the dashboard design.
   */
  if (resetToken) {
    return (
      <div className="login-page">
        <div className="login-decoration decoration-one"></div>
        <div className="login-decoration decoration-two"></div>
        <div className="login-decoration decoration-three"></div>

        <div className="login-card">
          <div className="login-brand">
            <div className="login-logo">
              V
            </div>

            <div className="login-brand-name">
              VELOOP
            </div>

            <div className="login-brand-subtitle">
              REWARDS
            </div>
          </div>

          <div className="login-heading">
            <p className="eyebrow">
              ACCOUNT SECURITY
            </p>

            <h1>Reset password</h1>

            <p className="login-subtitle">
              Create a new password for your
              VELOOP account.
            </p>
          </div>

          {error && (
            <div className="error-message login-error">
              <span className="error-icon">
                !
              </span>

              <span>{error}</span>
            </div>
          )}

          <form
            className="login-form"
            onSubmit={handleResetPassword}
          >
            <div className="input-group">
              <label htmlFor="reset-password">
                New password
              </label>

              <div
                style={{
                  position:
                    "relative",
                }}
              >
                <input
                  id="reset-password"
                  type={
                    showResetPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter new password"
                  value={resetPassword}
                  onChange={(event) =>
                    setResetPassword(
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  required
                  style={{
                    paddingRight:
                      "72px",
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowResetPassword(
                      (value) =>
                        !value
                    )
                  }
                  style={{
                    position:
                      "absolute",
                    right: "10px",
                    top: "50%",
                    transform:
                      "translateY(-50%)",
                    border: "none",
                    background:
                      "transparent",
                    color: "#2563eb",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor:
                      "pointer",
                    padding: "5px",
                  }}
                >
                  {showResetPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="reset-confirm-password">
                Confirm password
              </label>

              <input
                id="reset-confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={
                  resetConfirmPassword
                }
                onChange={(event) =>
                  setResetConfirmPassword(
                    event.target.value
                  )
                }
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              className="primary-btn login-btn"
              disabled={loading}
            >
              {loading
                ? "Updating..."
                : "Update password"}

              {!loading && (
                <span className="button-arrow">
                  →
                </span>
              )}
            </button>
          </form>

          <div className="login-footer">
            <button
              type="button"
              onClick={() => {
                setResetToken("");
                setError("");
                window.history.replaceState(
                  {},
                  "",
                  "/"
                );
              }}
              style={{
                border: "none",
                background:
                  "transparent",
                color: "#2563eb",
                fontWeight: 700,
                cursor:
                  "pointer",
                fontSize: "13px",
              }}
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-decoration decoration-one"></div>
        <div className="login-decoration decoration-two"></div>
        <div className="login-decoration decoration-three"></div>

        <div className="login-card">
          <div className="login-brand">
            <div className="login-logo">
              V
            </div>

            <div className="login-brand-name">
              VELOOP
            </div>

            <div className="login-brand-subtitle">
              REWARDS
            </div>
          </div>

          <div className="login-heading">
            <p className="eyebrow">
              VELOOP REWARDS
            </p>

            <h1>Welcome back</h1>

            <p className="login-subtitle">
              Sign in to access your rewards wallet.
            </p>
          </div>

          {error && (
            <div className="error-message login-error">
              <span className="error-icon">
                !
              </span>

              <span>{error}</span>
            </div>
          )}

          <form
            className="login-form"
            onSubmit={handleLogin}
          >
            <div className="input-group">
              <label htmlFor="login-email">
                Email address
              </label>

              <input
                id="login-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                autoComplete="email"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="login-password">
                Password
              </label>

              <div
                style={{
                  position:
                    "relative",
                }}
              >
                <input
                  id="login-password"
                  type={
                    showLoginPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  autoComplete="current-password"
                  required
                  style={{
                    paddingRight:
                      "72px",
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowLoginPassword(
                      (value) =>
                        !value
                    )
                  }
                  style={{
                    position:
                      "absolute",
                    right: "10px",
                    top: "50%",
                    transform:
                      "translateY(-50%)",
                    border: "none",
                    background:
                      "transparent",
                    color: "#2563eb",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor:
                      "pointer",
                    padding: "5px",
                  }}
                >
                  {showLoginPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>
            </div>

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: "10px",
                margin:
                  "2px 0 14px",
                flexWrap:
                  "wrap",
              }}
            >
              <label
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap:
                    "9px",
                  fontSize:
                    "13px",
                  color:
                    "#475569",
                  cursor:
                    "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    rememberMe
                  }
                  onChange={(
                    event
                  ) =>
                    setRememberMe(
                      event
                        .target
                        .checked
                    )
                  }
                  style={{
                    width:
                      "16px",
                    height:
                      "16px",
                    accentColor:
                      "#2563eb",
                  }}
                />

                Remember me
              </label>

              <button
                type="button"
                onClick={() => {
                  setForgotEmail(
                    email
                  );
                  setShowForgotPassword(
                    true
                  );
                  setError("");
                }}
                style={{
                  border:
                    "none",
                  background:
                    "transparent",
                  color:
                    "#2563eb",
                  fontSize:
                    "13px",
                  fontWeight:
                    700,
                  cursor:
                    "pointer",
                  padding:
                    "2px 0",
                }}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="primary-btn login-btn"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign in"}

              {!loading && (
                <span className="button-arrow">
                  →
                </span>
              )}
            </button>
          </form>

          <div className="login-footer">
            <span>
              Password is never stored in the browser.
            </span>

            <button
              type="button"
              onClick={() => {
                setShowRegister(true);
                setError("");
                setWithdrawMessage("");
              }}
              style={{
                marginTop: "12px",
                border: "none",
                background: "transparent",
                color: "#2563eb",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                padding: "2px 0",
              }}
            >
              Don't have an account? Create account
            </button>
          </div>
        </div>

        {showForgotPassword && (
          <div
            onClick={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowForgotPassword(
                  false
                );
              }
            }}
            style={{
              position:
                "fixed",
              inset: 0,
              background:
                "rgba(15,23,42,0.48)",
              display:
                "grid",
              placeItems:
                "center",
              padding:
                "20px",
              zIndex: 3000,
              backdropFilter:
                "blur(5px)",
            }}
          >
            <div
              onClick={(event) =>
                event.stopPropagation()
              }
              style={{
                width:
                  "min(430px, 100%)",
                background:
                  "#ffffff",
                borderRadius:
                  "20px",
                padding:
                  "28px",
                boxShadow:
                  "0 25px 70px rgba(15,23,42,0.24)",
                position:
                  "relative",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowForgotPassword(
                    false
                  )
                }
                style={{
                  position:
                    "absolute",
                  top:
                    "14px",
                  right:
                    "14px",
                  width:
                    "34px",
                  height:
                    "34px",
                  border:
                    "none",
                  borderRadius:
                    "10px",
                  background:
                    "#f1f5f9",
                  color:
                    "#475569",
                  fontSize:
                    "20px",
                  cursor:
                    "pointer",
                }}
              >
                ×
              </button>

              <div
                style={{
                  width:
                    "48px",
                  height:
                    "48px",
                  borderRadius:
                    "14px",
                  background:
                    "#eff6ff",
                  color:
                    "#2563eb",
                  display:
                    "grid",
                  placeItems:
                    "center",
                  fontSize:
                    "23px",
                  fontWeight:
                    800,
                  marginBottom:
                    "17px",
                }}
              >
                ↻
              </div>

              <p className="eyebrow">
                ACCOUNT RECOVERY
              </p>

              <h2
                style={{
                  margin:
                    "5px 0 8px",
                  color:
                    "#0f172a",
                  fontSize:
                    "24px",
                }}
              >
                Forgot your password?
              </h2>

              <p
                style={{
                  margin:
                    "0 0 20px",
                  color:
                    "#64748b",
                  fontSize:
                    "14px",
                  lineHeight:
                    1.6,
                }}
              >
                Enter your registered email and
                we'll send you a secure password
                reset link.
              </p>

              <div className="input-group">
                <label htmlFor="forgot-email">
                  Email address
                </label>

                <input
                  id="forgot-email"
                  type="email"
                  placeholder="Enter your email"
                  value={forgotEmail}
                  onChange={(event) =>
                    setForgotEmail(
                      event.target.value
                    )
                  }
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button
                type="button"
                className="primary-btn login-btn"
                onClick={
                  handleForgotPassword
                }
                disabled={loading}
                style={{
                  marginTop:
                    "8px",
                  width:
                    "100%",
                }}
              >
                {loading
                  ? "Sending..."
                  : "Send reset link"}

                {!loading && (
                  <span className="button-arrow">
                    →
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowForgotPassword(
                    false
                  )
                }
                style={{
                  width:
                    "100%",
                  marginTop:
                    "10px",
                  padding:
                    "10px",
                  border:
                    "none",
                  background:
                    "transparent",
                  color:
                    "#64748b",
                  fontWeight:
                    600,
                  cursor:
                    "pointer",
                }}
              >
                Back to sign in
              </button>
            </div>
          </div>
        )}

        {showRegister && (
          <div
            onClick={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowRegister(false);
                setError("");
              }
            }}
            style={{
              position: "fixed",
              inset: 0,
              background:
                "rgba(15,23,42,0.48)",
              display: "grid",
              placeItems: "center",
              padding: "20px",
              zIndex: 3000,
              backdropFilter:
                "blur(5px)",
            }}
          >
            <div
              onClick={(event) =>
                event.stopPropagation()
              }
              style={{
                width:
                  "min(450px, 100%)",
                maxHeight:
                  "calc(100vh - 40px)",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: "20px",
                padding: "28px",
                boxShadow:
                  "0 25px 70px rgba(15,23,42,0.24)",
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowRegister(false);
                  setError("");
                }}
                style={{
                  position: "absolute",
                  top: "14px",
                  right: "14px",
                  width: "34px",
                  height: "34px",
                  border: "none",
                  borderRadius: "10px",
                  background: "#f1f5f9",
                  color: "#475569",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>

              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "22px",
                  fontWeight: 800,
                  marginBottom: "17px",
                }}
              >
                V
              </div>

              <p className="eyebrow">
                CREATE ACCOUNT
              </p>

              <h2
                style={{
                  margin: "5px 0 8px",
                  color: "#0f172a",
                  fontSize: "24px",
                }}
              >
                Join VELOOP
              </h2>

              <p
                style={{
                  margin: "0 0 20px",
                  color: "#64748b",
                  fontSize: "14px",
                  lineHeight: 1.6,
                }}
              >
                Create your VELOOP account
                and start managing your
                rewards wallet.
              </p>

              <div className="input-group">
                <label htmlFor="register-name">
                  Full name
                </label>

                <input
                  id="register-name"
                  type="text"
                  placeholder="Enter your full name"
                  value={registerName}
                  onChange={(event) =>
                    setRegisterName(
                      event.target.value
                    )
                  }
                  autoComplete="name"
                  required
                />
              </div>

              <div
                className="input-group"
                style={{
                  marginTop: "14px",
                }}
              >
                <label htmlFor="register-email">
                  Email address
                </label>

                <input
                  id="register-email"
                  type="email"
                  placeholder="Enter your email"
                  value={registerEmail}
                  onChange={(event) =>
                    setRegisterEmail(
                      event.target.value
                    )
                  }
                  autoComplete="email"
                  required
                />
              </div>

              <div
                className="input-group"
                style={{
                  marginTop: "14px",
                }}
              >
                <label htmlFor="register-password">
                  Password
                </label>

                <input
                  id="register-password"
                  type="password"
                  placeholder="Create a password"
                  value={registerPassword}
                  onChange={(event) =>
                    setRegisterPassword(
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  required
                />
              </div>

              <div
                className="input-group"
                style={{
                  marginTop: "14px",
                }}
              >
                <label htmlFor="register-confirm-password">
                  Confirm password
                </label>

                <input
                  id="register-confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  value={
                    registerConfirmPassword
                  }
                  onChange={(event) =>
                    setRegisterConfirmPassword(
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  required
                />
              </div>

              <button
                type="button"
                className="primary-btn login-btn"
                onClick={handleRegister}
                disabled={loading}
                style={{
                  marginTop: "20px",
                  width: "100%",
                }}
              >
                {loading
                  ? "Creating account..."
                  : "Create account"}

                {!loading && (
                  <span className="button-arrow">
                    →
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRegister(false);
                  setRegisterName("");
                  setRegisterEmail("");
                  setRegisterPassword("");
                  setRegisterConfirmPassword("");
                  setError("");
                }}
                style={{
                  width: "100%",
                  marginTop: "10px",
                  padding: "10px",
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ← Back to sign in
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="logo">
            <div className="logo-mark">
              <span>V</span>
            </div>

            <div className="logo-text">
              <h2>VELOOP</h2>
              <span>Rewards</span>
            </div>
          </div>

          <div className="sidebar-line"></div>

          <nav className="nav">
            {[
              "Wallet",
              "Transactions",
              "Withdrawals",
            ].map((item) => (
              <button
                key={item}
                className={
                  activeTab === item
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  setTab(item)
                }
              >
                <span className="nav-icon">
                  {item ===
                    "Wallet" &&
                    "◈"}

                  {item ===
                    "Transactions" &&
                    "↔"}

                  {item ===
                    "Withdrawals" &&
                    "↑"}
                </span>

                <span className="nav-label">
                  {item}
                </span>

                {activeTab ===
                  item && (
                    <span className="nav-active-dot"></span>
                  )}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar">
              {getInitial()}
            </div>

            <div className="user-mini-info">
              <strong>
                {profile.name ||
                  "VELOOP User"}
              </strong>

              <span title={email}>
                {email}
              </span>
            </div>
          </div>

          <button
            className="logout-btn"
            onClick={
              handleLogout
            }
          >
            <span>↪</span>
            Logout
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-heading">
            <p className="eyebrow">
              VELOOP REWARDS
            </p>

            <h1>{activeTab}</h1>

            <div className="title-accent"></div>
          </div>

          <div className="profile">
            <button
              type="button"
              className="notification"
              onClick={() =>
                setError(
                  "No new notifications."
                )
              }
              aria-label="Notifications"
              title="Notifications"
            >
              <span>•</span>
            </button>

            <button
              type="button"
              onClick={() =>
                loadAllData(true)
              }
              disabled={refreshing}
              aria-label="Refresh wallet"
              title="Refresh wallet"
              style={{
                width:
                  "44px",
                height:
                  "44px",
                border:
                  "1px solid #dbe4f0",
                borderRadius:
                  "12px",
                background:
                  "#ffffff",
                color:
                  "#2563eb",
                display:
                  "grid",
                placeItems:
                  "center",
                fontSize:
                  "20px",
                cursor:
                  refreshing
                    ? "wait"
                    : "pointer",
                opacity:
                  refreshing
                    ? 0.65
                    : 1,
                transition:
                  "0.2s ease",
              }}
            >
              <span
                style={{
                  display:
                    "inline-block",
                  transform:
                    refreshing
                      ? "rotate(180deg)"
                      : "none",
                  transition:
                    "0.4s",
                }}
              >
                ↻
              </span>
            </button>

            <div
              style={{
                position:
                  "relative",
              }}
            >
              <button
                type="button"
                className="profile-avatar"
                onClick={() =>
                  setProfileOpen(
                    (value) =>
                      !value
                  )
                }
                aria-label="Open profile menu"
                style={{
                  cursor:
                    "pointer",
                  position:
                    "relative",
                  zIndex: 20,
                  pointerEvents:
                    "auto",
                  background:
                    "#094fe7",
                  color:
                    "#ffffff",
                  border:
                    "2px solid #ffffff",
                  boxShadow:
                    "0 6px 18px rgba(37,99,235,0.25)",
                }}
              >
                {getInitial()}
              </button>

              {profileOpen && (
                <div
                  style={{
                    position:
                      "absolute",
                    top:
                      "52px",
                    right:
                      "0",
                    width:
                      "250px",
                    background:
                      "#ffffff",
                    border:
                      "1px solid #e5eaf2",
                    borderRadius:
                      "16px",
                    padding:
                      "16px",
                    boxShadow:
                      "0 18px 45px rgba(15,23,42,0.18)",
                    zIndex:
                      1000,
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap:
                        "11px",
                      marginBottom:
                        "14px",
                    }}
                  >
                    <div
                      style={{
                        width:
                          "42px",
                        height:
                          "42px",
                        borderRadius:
                          "12px",
                        background:
                          "#2563eb",
                        color:
                          "#fff",
                        display:
                          "grid",
                        placeItems:
                          "center",
                        fontWeight:
                          800,
                      }}
                    >
                      {getInitial()}
                    </div>

                    <div
                      style={{
                        minWidth:
                          0,
                      }}
                    >
                      <strong
                        style={{
                          display:
                            "block",
                          color:
                            "#0f172a",
                        }}
                      >
                        {profile.name ||
                          "VELOOP User"}
                      </strong>

                      <span
                        style={{
                          display:
                            "block",
                          fontSize:
                            "12px",
                          color:
                            "#64748b",
                          wordBreak:
                            "break-word",
                        }}
                      >
                        {email}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(
                        false
                      );
                      setProfileModalOpen(
                        true
                      );
                    }}
                    style={{
                      width:
                        "100%",
                      padding:
                        "11px",
                      border:
                        "none",
                      borderRadius:
                        "9px",
                      background:
                        "#2563eb",
                      color:
                        "#fff",
                      fontWeight:
                        700,
                      cursor:
                        "pointer",
                      marginBottom:
                        "8px",
                    }}
                  >
                    View Profile
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleLogout
                    }
                    style={{
                      width:
                        "100%",
                      padding:
                        "11px",
                      border:
                        "none",
                      borderRadius:
                        "9px",
                      background:
                        "#fee2e2",
                      color:
                        "#b91c1c",
                      fontWeight:
                        700,
                      cursor:
                        "pointer",
                    }}
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
            <span className="error-icon">
              !
            </span>

            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="error-close"
            >
              ×
            </button>
          </div>
        )}

        {activeTab === "Wallet" && (
          <div className="content-stack">
            <section className="hero-card">
              <div className="hero-content">
                <div className="hero-label">
                  Total VEs Balance
                </div>

                <h2>
                  {formatNumber(
                    wallet.ves
                  )}
                </h2>

                <span className="hero-description">
                  Available for rewards and withdrawals
                </span>
              </div>

              <div className="hero-symbol">
                <span>VE</span>
              </div>

              <div className="hero-shape hero-shape-one"></div>
              <div className="hero-shape hero-shape-two"></div>
            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Your Rewards</h2>

                  <p>
                    Current balances from your VELOOP wallet
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    loadAllData(
                      true
                    )
                  }
                  style={{
                    border:
                      "none",
                    background:
                      "#eff6ff",
                    color:
                      "#2563eb",
                    borderRadius:
                      "10px",
                    padding:
                      "9px 12px",
                    fontWeight:
                      700,
                    cursor:
                      "pointer",
                  }}
                >
                  {refreshing
                    ? "Refreshing..."
                    : "↻ Refresh"}
                </button>
              </div>

              <div className="currency-grid">
                <CurrencyCard
                  name="VEs"
                  value={
                    wallet.ves
                  }
                  label="Reward Points"
                  primary
                />

                <CurrencyCard
                  name="SVEs"
                  value={
                    wallet.sves
                  }
                  label="Special VEs"
                />

                <CurrencyCard
                  name="Gems"
                  value={
                    wallet.gems
                  }
                  label="Gems"
                />

                <CurrencyCard
                  name="Tokens"
                  value={
                    wallet.tokens
                  }
                  label="Tokens"
                />

                <CurrencyCard
                  name="Spins"
                  value={
                    wallet.spins
                  }
                  label="Game Spins"
                />
              </div>
            </section>

            <section className="quick-actions">
              <div className="quick-content">
                <h2>Quick Actions</h2>

                <p>
                  Manage your rewards wallet
                </p>
              </div>

              <div className="action-buttons">
                <button
                  onClick={() =>
                    setTab(
                      "Withdrawals"
                    )
                  }
                  className="primary-btn"
                >
                  Withdraw VEs{" "}
                  <span>→</span>
                </button>

                <button
                  onClick={() =>
                    setTab(
                      "Transactions"
                    )
                  }
                  className="secondary-btn"
                >
                  View Transactions{" "}
                  <span>→</span>
                </button>
              </div>
            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Recent Activity</h2>

                  <p>
                    Your latest wallet transactions
                  </p>
                </div>

                <button
                  className="text-btn"
                  onClick={() =>
                    setTab(
                      "Transactions"
                    )
                  }
                >
                  View all →
                </button>
              </div>

              <TransactionList
                transactions={transactions.slice(
                  0,
                  5
                )}
                formatDate={
                  formatDate
                }
              />
            </section>
          </div>
        )}

        {activeTab ===
          "Transactions" && (
            <div className="content-stack">
              <section className="page-card">
                <div className="page-card-header">
                  <div>
                    <span className="card-kicker">
                      WALLET ACTIVITY
                    </span>

                    <h2>
                      Transaction History
                    </h2>

                    <p>
                      Complete wallet activity from your account.
                    </p>
                  </div>

                  <div className="card-count">
                    <strong>
                      {
                        transactions.length
                      }
                    </strong>

                    <span>
                      Transactions
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    gap:
                      "8px",
                    flexWrap:
                      "wrap",
                    margin:
                      "4px 0 18px",
                  }}
                >
                  {[
                    "ALL",
                    "REWARD",
                    "WITHDRAWAL",
                  ].map(
                    (filter) => (
                      <button
                        key={
                          filter
                        }
                        type="button"
                        onClick={() =>
                          setTransactionFilter(
                            filter
                          )
                        }
                        style={{
                          border:
                            "1px solid #dbe4f0",
                          borderRadius:
                            "999px",
                          padding:
                            "8px 13px",
                          background:
                            transactionFilter ===
                              filter
                              ? "#2563eb"
                              : "#fff",
                          color:
                            transactionFilter ===
                              filter
                              ? "#fff"
                              : "#475569",
                          fontWeight:
                            700,
                          cursor:
                            "pointer",
                        }}
                      >
                        {filter ===
                          "ALL"
                          ? "All"
                          : filter ===
                            "REWARD"
                            ? "Rewards"
                            : "Withdrawals"}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      loadAllData(
                        true
                      )
                    }
                    disabled={
                      refreshing
                    }
                    style={{
                      marginLeft:
                        "auto",
                      border:
                        "none",
                      borderRadius:
                        "10px",
                      padding:
                        "8px 13px",
                      background:
                        "#eff6ff",
                      color:
                        "#2563eb",
                      fontWeight:
                        700,
                      cursor:
                        "pointer",
                    }}
                  >
                    ↻ Refresh
                  </button>
                </div>

                <TransactionList
                  transactions={
                    filteredTransactions
                  }
                  formatDate={
                    formatDate
                  }
                />
              </section>
            </div>
          )}

        {activeTab ===
          "Withdrawals" && (
            <div className="content-stack">
              <section className="page-card withdrawal-page-card">
                <div className="page-card-header">
                  <div>
                    <span className="card-kicker">
                      PAYOUT CENTER
                    </span>

                    <h2>
                      Withdraw VEs
                    </h2>

                    <p>
                      Submit a secure withdrawal request using your available VEs.
                    </p>
                  </div>

                  <div className="withdraw-balance-badge">
                    <span>
                      Available
                    </span>

                    <strong>
                      {formatNumber(
                        wallet.ves
                      )}{" "}
                      VEs
                    </strong>
                  </div>
                </div>

                {withdrawMessage && (
                  <div className="success-message">
                    <span className="success-icon">
                      ✓
                    </span>

                    <span>
                      {withdrawMessage}
                    </span>
                  </div>
                )}

                <form
                  className="withdraw-box"
                  onSubmit={
                    handleWithdrawal
                  }
                >
                  <div className="form-section-title">
                    Withdrawal details
                  </div>

                  <div className="form-grid">
                    <div className="input-group">
                      <label>
                        Payout Amount
                      </label>

                      <select
                        value={
                          withdrawForm.amount
                        }
                        onChange={(
                          event
                        ) =>
                          updateWithdrawForm(
                            "amount",
                            event.target.value
                          )
                        }
                        disabled={
                          !getPayoutDenominations(
                            getPayoutOptionForMethod(
                              withdrawForm.method
                            )
                          ).length
                        }
                      >
                        <option value="">
                          Select payout amount
                        </option>

                        {getPayoutDenominations(
                          getPayoutOptionForMethod(
                            withdrawForm.method
                          )
                        ).map(
                          (denomination) => (
                            <option
                              key={
                                denomination.payout_value
                              }
                              value={
                                denomination.payout_value
                              }
                            >
                              ₹{formatNumber(
                                denomination.payout_value
                              )} • {formatNumber(
                                denomination.required_amount
                              )} VEs
                            </option>
                          )
                        )}
                      </select>

                      <small>
                        Choose a payout denomination configured by the backend.
                      </small>
                    </div>

                    <div className="input-group">
                      <label>
                        Payout Method
                      </label>

                      <select
                        value={
                          withdrawForm.method
                        }
                        onChange={(
                          event
                        ) => {
                          updateWithdrawForm(
                            "method",
                            event.target.value
                          );

                          updateWithdrawForm(
                            "amount",
                            ""
                          );
                        }}
                      >
                        {payoutOptions.map(
                          (option) => {
                            const type =
                              String(
                                option?.type ||
                                ""
                              ).toUpperCase();

                            const value =
                              type ===
                                "BANK_TRANSFER"
                                ? "BANK"
                                : type ===
                                  "UPI_QR"
                                  ? "QR"
                                  : type;

                            return (
                              <option
                                key={
                                  option.method_id
                                }
                                value={
                                  value
                                }
                              >
                                {option.name ||
                                  value}
                              </option>
                            );
                          }
                        )}
                      </select>

                      <small>
                        Only active payout methods supplied by the backend are shown.
                      </small>
                    </div>
                  </div>

                  {(() => {
                    const selectedPayoutOption =
                      getPayoutOptionForMethod(
                        withdrawForm.method
                      );

                    const selectedDenomination =
                      getSelectedPayoutDenomination(
                        selectedPayoutOption,
                        withdrawForm.amount
                      );

                    if (!selectedDenomination) {
                      return null;
                    }

                    return (
                      <div
                        style={{
                          marginTop: "2px",
                          marginBottom: "14px",
                          padding: "14px 16px",
                          border: "1px solid #dbeafe",
                          borderRadius: "14px",
                          background:
                            "linear-gradient(135deg,#f8fbff,#eff6ff)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "16px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <span
                            style={{
                              display: "block",
                              fontSize: "11px",
                              fontWeight: 800,
                              letterSpacing: "0.08em",
                              color: "#64748b",
                              textTransform: "uppercase",
                              marginBottom: "4px",
                            }}
                          >
                            Payout value
                          </span>

                          <strong
                            style={{
                              color: "#0f172a",
                              fontSize: "18px",
                            }}
                          >
                            ₹{formatNumber(
                              selectedDenomination.payout_value
                            )}
                          </strong>
                        </div>

                        <div
                          style={{
                            textAlign: "right",
                          }}
                        >
                          <span
                            style={{
                              display: "block",
                              fontSize: "11px",
                              fontWeight: 800,
                              letterSpacing: "0.08em",
                              color: "#64748b",
                              textTransform: "uppercase",
                              marginBottom: "4px",
                            }}
                          >
                            Required VEs
                          </span>

                          <strong
                            style={{
                              color: "#2563eb",
                              fontSize: "18px",
                            }}
                          >
                            {formatNumber(
                              selectedDenomination.required_amount
                            )} VEs
                          </strong>
                        </div>
                      </div>
                    );
                  })()}

                  {(withdrawForm.method ===
                    "UPI" ||
                    withdrawForm.method ===
                    "QR") && (
                      <div className="input-group">
                        <label>
                          UPI ID
                        </label>

                        <input
                          type="text"
                          placeholder="example@upi"
                          value={
                            withdrawForm.upiId
                          }
                          onChange={(
                            event
                          ) =>
                            updateWithdrawForm(
                              "upiId",
                              event.target
                                .value
                            )
                          }
                          autoComplete="off"
                        />

                        <small>
                          Enter the UPI ID linked to your payout account.
                        </small>
                      </div>
                    )}

                  {withdrawForm.method ===
                    "QR" && (
                      <div
                        style={{
                          marginTop:
                            "14px",
                          padding:
                            "16px",
                          border:
                            "1px dashed #cbd5e1",
                          borderRadius:
                            "14px",
                          background:
                            "#f8fafc",
                        }}
                      >
                        <strong
                          style={{
                            display:
                              "block",
                            marginBottom:
                              "5px",
                            color:
                              "#0f172a",
                          }}
                        >
                          UPI QR code
                        </strong>

                        <span
                          style={{
                            display:
                              "block",
                            color:
                              "#64748b",
                            fontSize:
                              "13px",
                            marginBottom:
                              "12px",
                          }}
                        >
                          Add your QR image for reference. The payout request is securely submitted through the configured UPI option.
                        </span>

                        <input
                          type="file"
                          accept="image/*"
                          onChange={
                            handleQrFile
                          }
                        />

                        {withdrawForm.qrFileName && (
                          <div
                            style={{
                              marginTop:
                                "9px",
                              fontSize:
                                "13px",
                              color:
                                "#2563eb",
                              fontWeight:
                                700,
                            }}
                          >
                            ✓{" "}
                            {
                              withdrawForm.qrFileName
                            }
                          </div>
                        )}
                      </div>
                    )}

                  {withdrawForm.method ===
                    "BANK" && (
                      <div
                        style={{
                          marginTop:
                            "14px",
                        }}
                      >
                        <div className="form-grid">
                          <div className="input-group">
                            <label>
                              Account Holder Name
                            </label>

                            <input
                              type="text"
                              placeholder="Full name as per bank"
                              value={
                                withdrawForm.accountName
                              }
                              onChange={(
                                event
                              ) =>
                                updateWithdrawForm(
                                  "accountName",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </div>

                          <div className="input-group">
                            <label>
                              Bank Name
                            </label>

                            <input
                              type="text"
                              placeholder="Bank name"
                              value={
                                withdrawForm.bankName
                              }
                              onChange={(
                                event
                              ) =>
                                updateWithdrawForm(
                                  "bankName",
                                  event.target
                                    .value
                                )
                              }
                            />
                          </div>

                          <div className="input-group">
                            <label>
                              Account Number
                            </label>

                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Enter account number"
                              value={
                                withdrawForm.accountNumber
                              }
                              onChange={(
                                event
                              ) =>
                                updateWithdrawForm(
                                  "accountNumber",
                                  event.target.value.replace(
                                    /\D/g,
                                    ""
                                  )
                                )
                              }
                            />
                          </div>

                          <div className="input-group">
                            <label>
                              IFSC Code
                            </label>

                            <input
                              type="text"
                              placeholder="ABCD0123456"
                              value={
                                withdrawForm.ifsc
                              }
                              onChange={(
                                event
                              ) =>
                                updateWithdrawForm(
                                  "ifsc",
                                  event.target.value.toUpperCase()
                                )
                              }
                              maxLength={
                                11
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}

                  <div className="withdraw-summary">
                    <div>
                      <span>
                        Available balance
                      </span>

                      <strong>
                        {formatNumber(
                          wallet.ves
                        )}{" "}
                        VEs
                      </strong>
                    </div>

                    <div>
                      <span>
                        Payout value
                      </span>

                      <strong>
                        {withdrawForm.amount
                          ? `₹${formatNumber(
                            withdrawForm.amount
                          )}`
                          : "₹0"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        VEs required
                      </span>

                      <strong>
                        {(() => {
                          const denomination =
                            getSelectedPayoutDenomination(
                              getPayoutOptionForMethod(
                                withdrawForm.method
                              ),
                              withdrawForm.amount
                            );

                          return denomination
                            ? `${formatNumber(
                              denomination.required_amount
                            )} VEs`
                            : "0 VEs";
                        })()}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Payout method
                      </span>

                      <strong>
                        {withdrawForm.method ===
                          "BANK"
                          ? "Bank Transfer"
                          : withdrawForm.method ===
                            "QR"
                            ? "UPI QR"
                            : "UPI"}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="primary-btn withdraw-submit-btn"
                    disabled={loading}
                  >
                    {loading
                      ? "Processing..."
                      : "Submit Withdrawal"}

                    {!loading && (
                      <span>→</span>
                    )}
                  </button>
                </form>
              </section>

              <section className="page-card">
                <div className="page-card-header compact">
                  <div>
                    <span className="card-kicker">
                      PAYOUT ACTIVITY
                    </span>

                    <h2>
                      Withdrawal History
                    </h2>

                    <p>
                      Track every submitted withdrawal request and its status.
                    </p>
                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      gap:
                        "8px",
                      alignItems:
                        "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize:
                          "12px",
                        color:
                          "#64748b",
                      }}
                    >
                      {
                        pendingWithdrawals
                      }{" "}
                      pending
                    </span>

                    <span
                      style={{
                        fontSize:
                          "12px",
                        color:
                          "#64748b",
                      }}
                    >
                      {
                        completedWithdrawals
                      }{" "}
                      completed
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    gap:
                      "8px",
                    flexWrap:
                      "wrap",
                    margin:
                      "4px 0 18px",
                  }}
                >
                  {[
                    "ALL",
                    "PENDING",
                    "PROCESSING",
                    "APPROVED",
                    "FAILED",
                  ].map(
                    (filter) => (
                      <button
                        key={
                          filter
                        }
                        type="button"
                        onClick={() =>
                          setWithdrawalFilter(
                            filter
                          )
                        }
                        style={{
                          border:
                            "1px solid #dbe4f0",
                          borderRadius:
                            "999px",
                          padding:
                            "8px 13px",
                          background:
                            withdrawalFilter ===
                              filter
                              ? "#2563eb"
                              : "#fff",
                          color:
                            withdrawalFilter ===
                              filter
                              ? "#fff"
                              : "#475569",
                          fontWeight:
                            700,
                          cursor:
                            "pointer",
                        }}
                      >
                        {filter ===
                          "ALL"
                          ? "All"
                          : filter}
                      </button>
                    )
                  )}
                </div>

                <WithdrawalList
                  withdrawals={
                    filteredWithdrawals
                  }
                  formatDate={
                    formatDate
                  }
                />
              </section>
            </div>
          )}
      </main>

      {profileModalOpen && (
        <div
          onClick={() =>
            setProfileModalOpen(
              false
            )
          }
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,0.45)",
            display:
              "grid",
            placeItems:
              "center",
            padding:
              "20px",
            zIndex:
              2000,
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width:
                "min(500px, 100%)",
              background:
                "#fff",
              borderRadius:
                "22px",
              boxShadow:
                "0 25px 70px rgba(15,23,42,0.25)",
              overflow:
                "hidden",
            }}
          >
            <div
              style={{
                padding:
                  "22px 24px",
                background:
                  "linear-gradient(135deg,#2563eb,#4f46e5)",
                color:
                  "#fff",
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  "14px",
              }}
            >
              <div
                style={{
                  width:
                    "58px",
                  height:
                    "58px",
                  borderRadius:
                    "17px",
                  background:
                    "rgba(255,255,255,0.18)",
                  display:
                    "grid",
                  placeItems:
                    "center",
                  fontSize:
                    "24px",
                  fontWeight:
                    800,
                }}
              >
                {getInitial()}
              </div>

              <div>
                <div
                  style={{
                    fontSize:
                      "12px",
                    opacity:
                      0.8,
                    letterSpacing:
                      "1.5px",
                  }}
                >
                  ACCOUNT PROFILE
                </div>

                <h2
                  style={{
                    margin:
                      "4px 0 0",
                    fontSize:
                      "23px",
                  }}
                >
                  {profile.name ||
                    "VELOOP User"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setProfileModalOpen(
                    false
                  )
                }
                style={{
                  marginLeft:
                    "auto",
                  border:
                    "none",
                  background:
                    "rgba(255,255,255,0.15)",
                  color:
                    "#fff",
                  width:
                    "36px",
                  height:
                    "36px",
                  borderRadius:
                    "10px",
                  cursor:
                    "pointer",
                  fontSize:
                    "20px",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding:
                  "24px",
              }}
            >
              <ProfileRow
                label="Email address"
                value={email}
              />

              <ProfileRow
                label="Account access"
                value="Authenticated"
              />

              <ProfileRow
                label="Wallet VEs"
                value={`${formatNumber(
                  wallet.ves
                )} VEs`}
              />

              <ProfileRow
                label="Security"
                value="JWT protected session"
              />

              <div
                style={{
                  marginTop:
                    "18px",
                  padding:
                    "14px",
                  borderRadius:
                    "13px",
                  background:
                    "#f8fafc",
                  color:
                    "#64748b",
                  fontSize:
                    "13px",
                  lineHeight:
                    1.55,
                }}
              >
                Your password is not displayed or
                stored in this profile panel. Login
                session data is managed through browser
                storage according to your Remember Me
                selection.
              </div>

              <button
                type="button"
                onClick={() =>
                  setProfileModalOpen(
                    false
                  )
                }
                className="primary-btn"
                style={{
                  width:
                    "100%",
                  marginTop:
                    "18px",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileRow({
  label,
  value,
}) {
  return (
    <div
      style={{
        display:
          "flex",
        justifyContent:
          "space-between",
        gap:
          "18px",
        padding:
          "13px 0",
        borderBottom:
          "1px solid #eef2f7",
      }}
    >
      <span
        style={{
          color:
            "#64748b",
          fontSize:
            "13px",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color:
            "#0f172a",
          fontSize:
            "13px",
          textAlign:
            "right",
          wordBreak:
            "break-word",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function TransactionList({
  transactions,
  formatDate,
}) {
  if (!transactions.length) {
    return (
      <div className="transaction-list">
        <div className="empty-state">
          <div className="empty-icon">
            ↔
          </div>

          <strong>
            No transactions found
          </strong>

          <span>
            Your wallet activity will appear here.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      {transactions.map(
        (transaction, index) => {
          const isCredit =
            String(
              transaction?.type || ""
            ).toUpperCase() ===
            "REWARD" ||
            String(
              transaction?.type || ""
            ).toUpperCase() ===
            "CREDIT" ||
            Number(
              transaction?.amount || 0
            ) > 0;

          return (
            <div
              className="transaction"
              key={
                transaction.transaction_id ||
                index
              }
            >
              <div
                className={
                  isCredit
                    ? "transaction-icon reward-icon"
                    : "transaction-icon withdrawal-icon"
                }
              >
                {isCredit
                  ? "+"
                  : "↑"}
              </div>

              <div className="transaction-info">
                <strong>
                  {transaction.description ||
                    transaction.type ||
                    "Wallet transaction"}
                </strong>

                <span>
                  {transaction.type ||
                    "TRANSACTION"}{" "}
                  •{" "}
                  {formatDate(
                    transaction.created_at
                  )}
                </span>

                {transaction.reference_id && (
                  <small
                    style={{
                      color:
                        "#94a3b8",
                      marginTop:
                        "3px",
                    }}
                  >
                    Ref:{" "}
                    {String(
                      transaction.reference_id
                    ).slice(
                      0,
                      18
                    )}
                    ...
                  </small>
                )}
              </div>

              <div className="transaction-right">
                <strong
                  className={
                    isCredit
                      ? "amount-positive"
                      : "amount-negative"
                  }
                >
                  {isCredit
                    ? "+"
                    : "-"}
                  {formatAmount(
                    transaction.amount
                  )}{" "}
                  VEs
                </strong>

                <span
                  className={getLocalStatusClass(
                    transaction.status
                  )}
                >
                  {transaction.status ||
                    "PENDING"}
                </span>
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

function WithdrawalList({
  withdrawals,
  formatDate,
}) {
  if (!withdrawals.length) {
    return (
      <div className="withdrawal-history-empty">
        <div className="empty-icon">
          ↑
        </div>

        <strong>
          No withdrawals yet
        </strong>

        <span>
          Your withdrawal requests will appear here.
        </span>
      </div>
    );
  }

  return (
    <div className="withdrawal-list">
      {withdrawals.map(
        (withdrawal, index) => {
          const method =
            getPayoutLabel(
              withdrawal.payout_option_id,
              withdrawal.payout_details
            );

          const details =
            withdrawal.payout_details ||
            {};

          const detailText =
            details.upi_id ||
            details.account_number ||
            "Payout details saved";

          return (
            <div
              className="withdrawal-row"
              key={
                withdrawal.withdrawal_id ||
                index
              }
            >
              <div className="withdrawal-icon">
                ↑
              </div>

              <div className="withdrawal-info">
                <strong>
                  {withdrawal.payout_value
                    ? `₹${formatAmount(
                      withdrawal.payout_value
                    )}`
                    : `${formatAmount(
                      withdrawal.amount
                    )} VEs`}
                </strong>

                <span>
                  {method} •{" "}
                  {formatAmount(
                    withdrawal.amount
                  )} VEs •{" "}
                  {formatDate(
                    withdrawal.created_at
                  )}
                </span>

                <small
                  style={{
                    color:
                      "#94a3b8",
                    marginTop:
                      "3px",
                  }}
                >
                  {maskSensitive(
                    detailText
                  )}
                </small>
              </div>

              <div className="withdrawal-right">
                <span
                  className={getLocalStatusClass(
                    withdrawal.status
                  )}
                >
                  {withdrawal.status ||
                    "PENDING"}
                </span>
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

function CurrencyCard({
  name,
  value,
  label,
  primary,
}) {
  return (
    <div
      className={
        primary
          ? "currency-card primary-card"
          : "currency-card"
      }
    >
      <div className="currency-top">
        <span>{name}</span>

        <div className="currency-dot">
          {name.charAt(0)}
        </div>
      </div>

      <h3>
        {formatAmount(value)}
      </h3>

      <p>{label}</p>
    </div>
  );
}

function formatAmount(value) {
  return Number(
    value || 0
  ).toLocaleString("en-IN");
}

function getLocalStatusClass(
  status
) {
  const normalized =
    String(
      status || ""
    ).toLowerCase();

  if (
    [
      "approved",
      "completed",
      "success",
      "successful",
    ].includes(normalized)
  ) {
    return "status completed";
  }

  if (
    [
      "rejected",
      "cancelled",
      "failed",
    ].includes(normalized)
  ) {
    return "status failed";
  }

  return "status pending";
}

function getPayoutLabel(
  optionId,
  details = {}
) {
  if (
    details.payout_mode ===
    "UPI_QR"
  ) {
    return "UPI QR";
  }

  if (
    optionId ===
    "demo_bank" ||
    optionId ===
    "bank_transfer"
  ) {
    return "Bank Transfer";
  }

  if (
    optionId ===
    "upi"
  ) {
    return "UPI";
  }

  return optionId || "Payout";
}

function maskSensitive(value) {
  const text = String(
    value || ""
  );

  if (text.includes("@")) {
    const [
      name,
      domain,
    ] = text.split("@");

    return `${name.slice(
      0,
      2
    )}***@${domain}`;
  }

  if (text.length > 6) {
    return `••••${text.slice(
      -4
    )}`;
  }

  return text;
}

export default App;



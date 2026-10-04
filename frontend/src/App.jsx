import { useEffect, useMemo, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import "./App.css";

const API_URL = "https://veloop-rewards-jj94.onrender.com";

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

const NAV_ITEMS = [
  { key: "Wallet", icon: "wallet", label: "Wallet" },
  { key: "Transactions", icon: "activity", label: "Transactions" },
  { key: "Withdrawals", icon: "arrow-up", label: "Withdrawals" },
];

const CURRENCY_META = {
  ves: {
    name: "VEs",
    label: "Reward Points",
    icon: "V",
    accent: "cyan",
  },
  sves: {
    name: "SVEs",
    label: "Special VEs",
    icon: "S",
    accent: "indigo",
  },
  gems: {
    name: "Gems",
    label: "Reward Gems",
    icon: "G",
    accent: "gold",
  },
  tokens: {
    name: "Tokens",
    label: "Reward Tokens",
    icon: "T",
    accent: "green",
  },
  spins: {
    name: "Spins",
    label: "Game Spins",
    icon: "S",
    accent: "pink",
  },
};

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

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] =
    useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] =
    useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

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
  const [success, setSuccess] = useState("");

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [withdrawalConfirmation, setWithdrawalConfirmation] =
    useState(null);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("token");

    if (
      window.location.pathname === "/reset-password" &&
      tokenFromUrl
    ) {
      setResetToken(tokenFromUrl);
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadAllData();
    }
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
    setSuccess("");

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

      setForgotOpen(false);
      setForgotEmail("");

      setSuccess(
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
    setSuccess("");

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

      setSuccess(
        data.message ||
        "Password reset successfully. You can now sign in."
      );

      window.history.replaceState(
        {},
        "",
        "/"
      );

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
    setSuccess("");
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
          data.detail ||
          "Invalid email or password"
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

        sessionStorage.removeItem(
          "veloop_token"
        );

        sessionStorage.removeItem(
          "veloop_email"
        );
      } else {
        sessionStorage.setItem(
          "veloop_token",
          data.access_token
        );

        sessionStorage.setItem(
          "veloop_email",
          email.trim()
        );

        localStorage.removeItem(
          "veloop_token"
        );

        localStorage.removeItem(
          "veloop_email"
        );

        localStorage.setItem(
          "veloop_remember",
          "false"
        );
      }

      setToken(data.access_token);
      setEmail(email.trim());
      setPassword("");
    } catch (err) {
      setError(
        err.message || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!registerName.trim()) {
      setError(
        "Please enter your full name."
      );
      return;
    }

    if (!registerEmail.trim()) {
      setError(
        "Please enter your email address."
      );
      return;
    }

    if (registerPassword.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (
      registerPassword !==
      registerConfirmPassword
    ) {
      setError(
        "Passwords do not match."
      );
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

      setEmail(
        registerEmail.trim()
      );

      setPassword("");

      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
      setRegisterOpen(false);

      setSuccess(
        data.message ||
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

  async function loadAllData(
    showSpinner = false
  ) {
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
    const data =
      await apiRequest(
        "/wallet/me"
      );

    setWallet({
      ves: Number(data.ves || 0),
      sves: Number(data.sves || 0),
      gems: Number(data.gems || 0),
      tokens: Number(data.tokens || 0),
      spins: Number(data.spins || 0),
    });
  }

  async function loadTransactions() {
    const data =
      await apiRequest(
        "/wallet/me/transactions"
      );

    setTransactions(
      Array.isArray(data.transactions)
        ? data.transactions
        : []
    );
  }

  async function loadWithdrawals() {
    const data =
      await apiRequest(
        "/wallet/me/withdrawals"
      );

    setWithdrawals(
      Array.isArray(data.withdrawals)
        ? data.withdrawals
        : []
    );
  }

  async function loadProfile() {
    const data =
      await apiRequest(
        "/auth/me"
      );

    setProfile({
      name:
        data?.name ||
        "VELOOP User",

      email:
        data?.email ||
        email ||
        "",
    });

    if (data?.email) {
      setEmail(data.email);
    }
  }

  async function loadPayoutOptions() {
    const data =
      await apiRequest(
        "/payout-options"
      );

    const options =
      Array.isArray(data?.options)
        ? data.options
        : [];

    setPayoutOptions(
      options.length
        ? options.filter(
          (option) =>
            option?.active !== false
        )
        : DEFAULT_PAYOUT_OPTIONS
    );
  }

  function getPayoutOptionForMethod(
    method
  ) {
    const normalized =
      String(
        method || ""
      ).toUpperCase();

    const typeMap = {
      UPI: "UPI",
      BANK: "BANK_TRANSFER",
      QR: "UPI_QR",
    };

    const expected =
      typeMap[normalized] ||
      normalized;

    return payoutOptions.find(
      (option) => {
        const type =
          String(
            option?.type || ""
          ).toUpperCase();

        const methodId =
          String(
            option?.method_id || ""
          ).toLowerCase();

        return (
          type === expected ||
          methodId ===
          normalized.toLowerCase()
        );
      }
    );
  }

  function getPayoutDenominations(
    option
  ) {
    if (
      !Array.isArray(
        option?.denominations
      )
    ) {
      return [];
    }

    return [...option.denominations]
      .filter(
        (item) =>
          Number(
            item?.payout_value
          ) > 0 &&
          Number(
            item?.required_amount
          ) > 0
      )
      .sort(
        (a, b) =>
          Number(
            a.payout_value
          ) -
          Number(
            b.payout_value
          )
      );
  }

  function getSelectedDenomination(
    option,
    payoutValue
  ) {
    const value =
      Number(payoutValue);

    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return null;
    }

    return (
      getPayoutDenominations(
        option
      ).find(
        (item) =>
          Number(
            item.payout_value
          ) === value
      ) || null
    );
  }

  function getMethodValue(
    option
  ) {
    const type =
      String(
        option?.type || ""
      ).toUpperCase();

    const methodId =
      String(
        option?.method_id || ""
      ).toUpperCase();

    if (
      type === "BANK_TRANSFER" ||
      methodId.includes("BANK")
    ) {
      return "BANK";
    }

    if (
      type === "UPI_QR" ||
      methodId.includes("QR")
    ) {
      return "QR";
    }

    if (
      type === "UPI" ||
      methodId === "UPI"
    ) {
      return "UPI";
    }

    return type || methodId;
  }

  function getMethodDisplayName(
    method
  ) {
    if (method === "BANK") {
      return "Bank Transfer";
    }

    if (method === "QR") {
      return "UPI QR";
    }

    if (method === "UPI") {
      return "UPI";
    }

    return method || "Payout";
  }

  function availableMethods() {
    const result = [];
    const seen = new Set();

    for (
      const option of payoutOptions || []
    ) {
      const value =
        getMethodValue(option);

      if (
        !value ||
        seen.has(value)
      ) {
        continue;
      }

      seen.add(value);

      result.push({
        value,
        name:
          option?.name ||
          getMethodDisplayName(
            value
          ),

        icon:
          value === "BANK"
            ? "bank"
            : value === "QR"
              ? "qr"
              : "wallet",

        description:
          value === "BANK"
            ? "Direct bank payout"
            : value === "QR"
              ? "UPI QR payout"
              : "UPI payout",
      });
    }

    return result;
  }

  function setTab(tab) {
    setActiveTab(tab);
    setError("");
    setSuccess("");
    setProfileOpen(false);
  }

  function updateWithdrawForm(
    key,
    value
  ) {
    setWithdrawForm(
      (prev) => ({
        ...prev,
        [key]: value,
      })
    );

    setError("");
    setSuccess("");
  }

  function handleSessionExpired() {
    localStorage.removeItem(
      "veloop_token"
    );

    sessionStorage.removeItem(
      "veloop_token"
    );

    setToken("");
    setWallet(EMPTY_WALLET);
    setTransactions([]);
    setWithdrawals([]);

    setProfile({
      name: "VELOOP User",
      email: "",
    });

    setError(
      "Your session has expired. Please sign in again."
    );
  }

  function handleLogout() {
    localStorage.removeItem(
      "veloop_token"
    );

    localStorage.removeItem(
      "veloop_email"
    );

    sessionStorage.removeItem(
      "veloop_token"
    );

    sessionStorage.removeItem(
      "veloop_email"
    );

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

  function buildWithdrawalPayload() {
    const method =
      withdrawForm.method;

    if (method === "BANK") {
      return {
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
      };
    }

    return {
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
  }

  function validateWithdrawalForm() {
    const payoutValue =
      Number(
        withdrawForm.amount
      );

    const method =
      withdrawForm.method;

    const selectedOption =
      getPayoutOptionForMethod(
        method
      );

    const denomination =
      getSelectedDenomination(
        selectedOption,
        payoutValue
      );

    if (
      !Number.isFinite(
        payoutValue
      ) ||
      payoutValue <= 0
    ) {
      return {
        error:
          "Please select a valid payout amount.",
      };
    }

    if (
      !selectedOption?.method_id
    ) {
      return {
        error:
          "Selected payout method is currently unavailable.",
      };
    }

    if (!denomination) {
      return {
        error:
          "Please select a valid payout denomination.",
      };
    }

    const requiredVes =
      Number(
        denomination.required_amount
      );

    if (
      !Number.isFinite(
        requiredVes
      ) ||
      requiredVes <= 0
    ) {
      return {
        error:
          "The selected payout option is not configured correctly.",
      };
    }

    if (
      requiredVes >
      Number(wallet.ves || 0)
    ) {
      return {
        error:
          `Insufficient VEs balance. Required: ${formatAmount(
            requiredVes
          )} VEs. Available: ${formatAmount(
            wallet.ves
          )} VEs.`,
      };
    }

    if (method === "UPI" || method === "QR") {
      if (!withdrawForm.upiId.trim()) {
        return {
          error:
            method === "QR"
              ? "Please scan a UPI QR code first."
              : "Please enter your UPI ID.",
        };
      }

      if (
        !/^[^\s@]+@[^\s@]+$/.test(
          withdrawForm.upiId.trim()
        )
      ) {
        return {
          error:
            "Please use a valid UPI ID, for example name@upi.",
        };
      }
    }

    if (method === "BANK") {
      if (
        !withdrawForm.accountName.trim()
      ) {
        return {
          error:
            "Please enter account holder name.",
        };
      }

      if (
        !withdrawForm.accountNumber.trim()
      ) {
        return {
          error:
            "Please enter bank account number.",
        };
      }

      if (
        !withdrawForm.ifsc.trim()
      ) {
        return {
          error:
            "Please enter IFSC code.",
        };
      }

      if (
        !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(
          withdrawForm.ifsc.trim()
        )
      ) {
        return {
          error:
            "Please enter a valid IFSC code.",
        };
      }
    }

    return {
      payoutValue,
      method,
      selectedOption,
      denomination,
      requiredVes,
    };
  }

  function requestWithdrawalConfirmation(
    event
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validation =
      validateWithdrawalForm();

    if (validation.error) {
      setError(
        validation.error
      );
      return;
    }

    setWithdrawalConfirmation(
      validation
    );
  }

  async function confirmWithdrawal() {
    if (
      !withdrawalConfirmation
    ) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const {
        payoutValue,
        selectedOption,
        requiredVes,
      } = withdrawalConfirmation;

      await apiRequest(
        "/wallet/me/withdrawal",
        {
          method: "POST",

          body: JSON.stringify({
            amount:
              payoutValue,

            payout_option_id:
              selectedOption.method_id,

            payout_details:
              buildWithdrawalPayload(),

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

      setSuccess(
        `₹${formatAmount(
          payoutValue
        )} payout submitted successfully. ${formatAmount(
          requiredVes
        )} VEs reserved. Status: PENDING.`
      );

      setWithdrawForm(
        (prev) => ({
          ...prev,
          amount: "",
          upiId: "",
          accountName: "",
          accountNumber: "",
          ifsc: "",
          bankName: "",
          qrFileName: "",
        })
      );

      setWithdrawalConfirmation(
        null
      );

      await loadAllData(false);
    } catch (err) {
      setError(
        err.message ||
        "Withdrawal failed."
      );

      setWithdrawalConfirmation(
        null
      );
    } finally {
      setLoading(false);
    }
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
        (tx) => {
          const type =
            String(
              tx?.type || ""
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

          return (
            type ===
            "WITHDRAWAL"
          );
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
        (item) =>
          String(
            item?.status ||
            "PENDING"
          ).toUpperCase() ===
          withdrawalFilter
      );
    }, [
      withdrawals,
      withdrawalFilter,
    ]);

  const availablePayoutCurrencies =
    useMemo(() => {
      const currencies =
        new Set();

      for (
        const option of payoutOptions || []
      ) {
        if (
          option?.active === false
        ) {
          continue;
        }

        const currency =
          String(
            option?.currency ||
            ""
          ).toLowerCase();

        if (currency) {
          currencies.add(
            currency
          );
        }
      }

      return currencies;
    }, [payoutOptions]);

  const pendingWithdrawals =
    withdrawals.filter(
      (item) =>
        String(
          item?.status ||
          "PENDING"
        ).toUpperCase() ===
        "PENDING"
    ).length;

  const completedWithdrawals =
    withdrawals.filter(
      (item) =>
        [
          "APPROVED",
          "COMPLETED",
          "SUCCESS",
          "SUCCESSFUL",
        ].includes(
          String(
            item?.status || ""
          ).toUpperCase()
        )
    ).length;

  if (resetToken) {
    return (
      <AuthShell
        eyebrow="ACCOUNT SECURITY"
        title="Reset password"
        subtitle="Create a new password for your VELOOP account."
      >
        {error && (
          <Alert
            type="error"
            message={error}
          />
        )}

        {success && (
          <Alert
            type="success"
            message={success}
          />
        )}

        <form
          className="auth-form"
          onSubmit={
            handleResetPassword
          }
        >
          <Field label="New password">
            <div className="password-field">
              <input
                type={
                  showResetPassword
                    ? "text"
                    : "password"
                }
                placeholder="Enter new password"
                value={
                  resetPassword
                }
                onChange={(e) =>
                  setResetPassword(
                    e.target.value
                  )
                }
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowResetPassword(
                    (value) =>
                      !value
                  )
                }
              >
                {showResetPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>
          </Field>

          <Field label="Confirm password">
            <input
              type="password"
              placeholder="Confirm new password"
              value={
                resetConfirmPassword
              }
              onChange={(e) =>
                setResetConfirmPassword(
                  e.target.value
                )
              }
              autoComplete="new-password"
              required
            />
          </Field>

          <button
            className="primary-btn auth-submit"
            disabled={loading}
          >
            {loading
              ? "Updating…"
              : "Update password"}

            <Icon name="arrow-right" />
          </button>
        </form>

        <div className="auth-footer">
          <button
            className="link-btn"
            type="button"
            onClick={() => {
              setResetToken("");
              window.history.replaceState(
                {},
                "",
                "/"
              );
            }}
          >
            ← Back to sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell
        eyebrow="VELOOP REWARDS"
        title="Welcome back"
        subtitle="Sign in to access your rewards wallet."
      >
        {error && (
          <Alert
            type="error"
            message={error}
          />
        )}

        {success && (
          <Alert
            type="success"
            message={success}
          />
        )}

        <form
          className="auth-form"
          onSubmit={
            handleLogin
          }
        >
          <Field label="Email address">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              autoComplete="email"
              required
            />
          </Field>

          <Field
            label="Password"
            action={
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setForgotEmail(
                    email
                  );

                  setForgotOpen(
                    true
                  );
                }}
              >
                Forgot password?
              </button>
            }
          >
            <div className="password-field">
              <input
                type={
                  showLoginPassword
                    ? "text"
                    : "password"
                }
                placeholder="Enter your password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowLoginPassword(
                    (value) =>
                      !value
                  )
                }
              >
                {showLoginPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>
          </Field>

          <label className="remember-row">
            <input
              type="checkbox"
              checked={
                rememberMe
              }
              onChange={(e) =>
                setRememberMe(
                  e.target.checked
                )
              }
            />

            <span>
              Remember me
            </span>
          </label>

          <button
            className="primary-btn auth-submit"
            disabled={loading}
          >
            {loading
              ? "Signing in…"
              : "Sign in"}

            <Icon name="arrow-right" />
          </button>
        </form>

        <div className="auth-footer">
          <span>
            Password is never stored in
            the browser.
          </span>

          <button
            type="button"
            className="link-btn footer-action"
            onClick={() => {
              setRegisterOpen(
                true
              );

              setError("");
              setSuccess("");
            }}
          >
            Create account
          </button>
        </div>

        {forgotOpen && (
          <ForgotModal
            email={forgotEmail}
            setEmail={setForgotEmail}
            loading={loading}
            onClose={() =>
              setForgotOpen(
                false
              )
            }
            onSubmit={
              handleForgotPassword
            }
          />
        )}

        {registerOpen && (
          <RegisterModal
            state={{
              registerName,
              registerEmail,
              registerPassword,
              registerConfirmPassword,
            }}
            setState={{
              setRegisterName,
              setRegisterEmail,
              setRegisterPassword,
              setRegisterConfirmPassword,
            }}
            loading={loading}
            onClose={() =>
              setRegisterOpen(
                false
              )
            }
            onSubmit={
              handleRegister
            }
          />
        )}
      </AuthShell>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={
          activeTab
        }
        setTab={setTab}
        profile={profile}
        email={email}
        getInitial={
          getInitial(email)
        }
        onLogout={
          handleLogout
        }
      />

      <main className="main-shell">
        <header className="topbar">
          <div className="page-title-block">
            <div className="eyebrow">
              VELOOP REWARDS
            </div>

            <h1>
              {activeTab}
            </h1>

            <div className="title-line" />
          </div>

          <div className="topbar-actions">
            <button
              className="icon-btn"
              onClick={() =>
                setError(
                  "No new notifications."
                )
              }
              aria-label="Notifications"
              title="Notifications"
            >
              <Icon name="bell" />
              <span className="notification-dot" />
            </button>

            <button
              className={
                refreshing
                  ? "icon-btn is-spinning"
                  : "icon-btn"
              }
              onClick={() =>
                loadAllData(
                  true
                )
              }
              disabled={
                refreshing
              }
              aria-label="Refresh"
              title="Refresh"
            >
              <Icon name="refresh" />
            </button>

            <div className="profile-menu-wrap">
              <button
                className="profile-avatar"
                onClick={() =>
                  setProfileOpen(
                    (value) =>
                      !value
                  )
                }
                aria-label="Open profile"
                aria-expanded={
                  profileOpen
                }
              >
                {getInitial(email)}
              </button>

              {profileOpen && (
                <ProfileDropdown
                  profile={
                    profile
                  }
                  email={
                    email
                  }
                  getInitial={
                    getInitial(
                      email
                    )
                  }
                  onViewProfile={() => {
                    setProfileOpen(
                      false
                    );

                    setProfileModalOpen(
                      true
                    );
                  }}
                  onLogout={
                    handleLogout
                  }
                />
              )}
            </div>
          </div>
        </header>

        {error && (
          <Alert
            type="error"
            message={error}
            onClose={() =>
              setError("")
            }
          />
        )}

        {success && (
          <Alert
            type="success"
            message={success}
            onClose={() =>
              setSuccess("")
            }
          />
        )}

        {activeTab ===
          "Wallet" && (
            <WalletPage
              wallet={
                wallet
              }
              transactions={
                transactions
              }
              payoutCurrencies={
                availablePayoutCurrencies
              }
              onRefresh={() =>
                loadAllData(
                  true
                )
              }
              refreshing={
                refreshing
              }
              onWithdraw={() =>
                setTab(
                  "Withdrawals"
                )
              }
              onTransactions={() =>
                setTab(
                  "Transactions"
                )
              }
            />
          )}

        {activeTab ===
          "Transactions" && (
            <TransactionsPage
              transactions={
                filteredTransactions
              }
              total={
                transactions.length
              }
              filter={
                transactionFilter
              }
              setFilter={
                setTransactionFilter
              }
              onRefresh={() =>
                loadAllData(
                  true
                )
              }
              refreshing={
                refreshing
              }
            />
          )}

        {activeTab ===
          "Withdrawals" && (
            <WithdrawalsPage
              wallet={
                wallet
              }
              payoutOptions={
                payoutOptions
              }
              form={
                withdrawForm
              }
              updateForm={
                updateWithdrawForm
              }
              onSubmit={
                requestWithdrawalConfirmation
              }
              withdrawals={
                filteredWithdrawals
              }
              filter={
                withdrawalFilter
              }
              setFilter={
                setWithdrawalFilter
              }
              pending={
                pendingWithdrawals
              }
              completed={
                completedWithdrawals
              }
            />
          )}
      </main>

      {profileModalOpen && (
        <ProfileModal
          profile={
            profile
          }
          email={
            email
          }
          wallet={
            wallet
          }
          getInitial={
            getInitial(email)
          }
          onClose={() =>
            setProfileModalOpen(
              false
            )
          }
        />
      )}

      {withdrawalConfirmation && (
        <ConfirmationModal
          confirmation={
            withdrawalConfirmation
          }
          method={getMethodDisplayName(
            withdrawalConfirmation.method
          )}
          loading={
            loading
          }
          onClose={() =>
            setWithdrawalConfirmation(
              null
            )
          }
          onConfirm={
            confirmWithdrawal
          }
        />
      )}
    </div>
  );
}

function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}) {
  return (
    <div className="auth-page">
      <div className="auth-orbit orbit-one" />
      <div className="auth-orbit orbit-two" />
      <div className="auth-grid" />

      <div className="auth-card">
        <div className="brand-lockup">
          <div className="brand-mark">
            V
          </div>

          <div>
            <strong>
              VELOOP
            </strong>

            <span>
              REWARDS
            </span>
          </div>
        </div>

        <div className="auth-heading">
          <div className="eyebrow">
            {eyebrow}
          </div>

          <h1>
            {title}
          </h1>

          <p>
            {subtitle}
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}

function Sidebar({
  activeTab,
  setTab,
  profile,
  email,
  getInitial,
  onLogout,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-main">
        <div className="brand-row">
          <div className="brand-mark">
            V
          </div>

          <div className="brand-copy">
            <strong>
              VELOOP
            </strong>

            <span>
              Rewards
            </span>
          </div>
        </div>

        <div className="sidebar-divider" />

        <nav className="nav-list">
          {NAV_ITEMS.map(
            (item) => (
              <button
                key={
                  item.key
                }
                className={
                  activeTab ===
                    item.key
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  setTab(
                    item.key
                  )
                }
              >
                <span className="nav-icon">
                  <Icon
                    name={
                      item.icon
                    }
                  />
                </span>

                <span>
                  {
                    item.label
                  }
                </span>

                {activeTab ===
                  item.key && (
                    <span className="nav-indicator" />
                  )}
              </button>
            )
          )}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">
            {
              getInitial
            }
          </div>

          <div className="sidebar-user-copy">
            <strong>
              {
                profile.name ||
                "VELOOP User"
              }
            </strong>

            <span
              title={
                email
              }
            >
              {
                email
              }
            </span>
          </div>
        </div>

        <button
          className="logout-btn"
          onClick={
            onLogout
          }
        >
          <Icon name="logout" />
          Logout
        </button>
      </div>
    </aside>
  );
}

function ProfileDropdown({
  profile,
  email,
  getInitial,
  onViewProfile,
  onLogout,
}) {
  return (
    <div className="profile-dropdown">
      <div className="profile-summary">
        <div className="avatar large">
          {
            getInitial
          }
        </div>

        <div>
          <strong>
            {
              profile.name ||
              "VELOOP User"
            }
          </strong>

          <span>
            {
              email
            }
          </span>
        </div>
      </div>

      <button
        className="dropdown-primary"
        onClick={
          onViewProfile
        }
      >
        <Icon name="user" />
        View profile
      </button>

      <button
        className="dropdown-danger"
        onClick={
          onLogout
        }
      >
        <Icon name="logout" />
        Logout
      </button>
    </div>
  );
}

function WalletPage({
  wallet,
  transactions,
  payoutCurrencies,
  onRefresh,
  refreshing,
  onWithdraw,
  onTransactions,
}) {
  return (
    <div className="content-stack">
      <section className="wallet-hero">
        <div className="hero-glow" />
        <div className="hero-ring ring-a" />
        <div className="hero-ring ring-b" />

        <div className="hero-copy">
          <span className="hero-overline">
            AVAILABLE REWARD BALANCE
          </span>

          <h2>
            {
              formatAmount(
                wallet.ves
              )
            }
          </h2>

          <p>
            VEs ready for supported rewards
            and withdrawals.
          </p>

          <div className="hero-badges">
            <span>
              <Icon name="shield" />
              Backend verified
            </span>

            <span>
              <Icon name="lock" />
              Secure wallet
            </span>
          </div>
        </div>

        <div className="hero-side">
          <div className="hero-token">
            <span>
              VE
            </span>
          </div>

          <button
            className="hero-cta"
            onClick={
              onWithdraw
            }
          >
            Withdraw VEs
            <Icon name="arrow-right" />
          </button>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <div className="section-kicker">
              REWARD ASSETS
            </div>

            <h2>
              Your rewards
            </h2>

            <p>
              Live balances received directly
              from your VELOOP wallet.
            </p>
          </div>

          <button
            className="soft-btn"
            onClick={
              onRefresh
            }
            disabled={
              refreshing
            }
          >
            {refreshing ? (
              <span className="btn-spinner" />
            ) : (
              <Icon name="refresh" />
            )}

            {refreshing
              ? "Refreshing"
              : "Refresh"}
          </button>
        </div>

        <div className="currency-grid">
          {Object.entries(
            CURRENCY_META
          ).map(
            (
              [
                key,
                meta,
              ],
              index
            ) => (
              <CurrencyCard
                key={
                  key
                }
                currencyKey={
                  key
                }
                meta={
                  meta
                }
                value={
                  wallet[
                  key
                  ]
                }
                featured={
                  index ===
                  0
                }
                redeemable={payoutCurrencies.has(
                  key
                )}
              />
            )
          )}
        </div>
      </section>

      <section className="quick-grid">
        <button
          className="action-card primary-action"
          onClick={
            onWithdraw
          }
        >
          <div className="action-icon">
            <Icon name="arrow-up" />
          </div>

          <div>
            <span>
              Redeem rewards
            </span>

            <strong>
              Withdraw supported VEs
            </strong>

            <small>
              Select payout method and denomination.
            </small>
          </div>

          <Icon name="arrow-right" />
        </button>

        <button
          className="action-card"
          onClick={
            onTransactions
          }
        >
          <div className="action-icon">
            <Icon name="activity" />
          </div>

          <div>
            <span>
              Wallet activity
            </span>

            <strong>
              Review transactions
            </strong>

            <small>
              See credits, debits and wallet status.
            </small>
          </div>

          <Icon name="arrow-right" />
        </button>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <div className="section-kicker">
              LATEST ACTIVITY
            </div>

            <h2>
              Recent transactions
            </h2>

            <p>
              Latest entries recorded in
              the wallet ledger.
            </p>
          </div>

          <button
            className="text-btn"
            onClick={
              onTransactions
            }
          >
            View all
            <Icon name="arrow-right" />
          </button>
        </div>

        <div className="panel">
          <TransactionList
            transactions={
              transactions.slice(
                0,
                5
              )
            }
          />
        </div>
      </section>

      <section className="wallet-note">
        <div className="note-icon">
          <Icon name="shield" />
        </div>

        <div>
          <strong>
            Withdrawal eligibility
          </strong>

          <p>
            Only payout currencies and
            denominations supplied by the
            backend are redeemable. Other
            wallet assets remain available
            for their supported VELOOP
            reward use cases.
          </p>
        </div>
      </section>
    </div>
  );
}

function CurrencyCard({
  currencyKey,
  meta,
  value,
  featured,
  redeemable,
}) {
  return (
    <article
      className={`currency-card ${featured
          ? "featured"
          : ""
        } accent-${meta.accent
        }`}
    >
      <div className="currency-card-top">
        <div className="currency-label">
          <span className="asset-icon">
            {
              meta.icon
            }
          </span>

          <div>
            <span className="asset-name">
              {
                meta.name
              }
            </span>

            <small>
              {
                meta.label
              }
            </small>
          </div>
        </div>

        <span
          className={
            redeemable
              ? "asset-status redeemable"
              : "asset-status utility"
          }
        >
          {redeemable
            ? "Redeemable"
            : "Utility"}
        </span>
      </div>

      <div className="currency-value">
        {
          formatAmount(
            value
          )
        }
      </div>

      <div className="currency-foot">
        <span>
          Backend balance
        </span>

        {
          currencyKey ===
          "ves" && (
            <span className="primary-asset">
              Primary payout currency
            </span>
          )
        }
      </div>
    </article>
  );
}

function TransactionsPage({
  transactions,
  total,
  filter,
  setFilter,
  onRefresh,
  refreshing,
}) {
  return (
    <div className="content-stack">
      <section className="panel page-panel">
        <div className="page-head">
          <div>
            <div className="section-kicker">
              WALLET LEDGER
            </div>

            <h2>
              Transaction history
            </h2>

            <p>
              Auditable activity recorded
              against your authenticated wallet.
            </p>
          </div>

          <div className="stat-pill">
            <strong>
              {total}
            </strong>

            <span>
              Total entries
            </span>
          </div>
        </div>

        <div className="toolbar">
          <div className="filter-group">
            {[
              "ALL",
              "REWARD",
              "WITHDRAWAL",
            ].map(
              (item) => (
                <button
                  key={
                    item
                  }
                  className={
                    filter ===
                      item
                      ? "filter-btn active"
                      : "filter-btn"
                  }
                  onClick={() =>
                    setFilter(
                      item
                    )
                  }
                >
                  {item ===
                    "ALL"
                    ? "All"
                    : item ===
                      "REWARD"
                      ? "Rewards"
                      : "Withdrawals"}
                </button>
              )
            )}
          </div>

          <button
            className="soft-btn"
            onClick={
              onRefresh
            }
            disabled={
              refreshing
            }
          >
            {refreshing ? (
              <span className="btn-spinner" />
            ) : (
              <Icon name="refresh" />
            )}

            {refreshing
              ? "Refreshing"
              : "Refresh"}
          </button>
        </div>

        <TransactionList
          transactions={
            transactions
          }
        />
      </section>
    </div>
  );
}

function TransactionList({
  transactions,
}) {
  if (
    !transactions.length
  ) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Icon name="activity" />
        </div>

        <strong>
          No transactions found
        </strong>

        <span>
          Your wallet activity will appear
          here.
        </span>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      {transactions.map(
        (
          transaction,
          index
        ) => {
          const credit =
            isCredit(
              transaction
            );

          return (
            <div
              className="transaction-row"
              key={
                transaction.transaction_id ||
                index
              }
            >
              <div
                className={`transaction-icon ${credit
                    ? "credit"
                    : "debit"
                  }`}
              >
                <Icon
                  name={
                    credit
                      ? "plus"
                      : "arrow-up"
                  }
                />
              </div>

              <div className="transaction-main">
                <strong>
                  {
                    transaction.description ||
                    transaction.type ||
                    "Wallet transaction"
                  }
                </strong>

                <span>
                  {
                    transaction.type ||
                    "TRANSACTION"
                  }

                  <i>
                    •
                  </i>

                  {
                    formatDate(
                      transaction.created_at
                    )
                  }
                </span>

                {
                  transaction.reference_id && (
                    <small>
                      Ref ·{" "}
                      {String(
                        transaction.reference_id
                      ).slice(
                        0,
                        18
                      )}
                      …
                    </small>
                  )
                }
              </div>

              <div className="transaction-meta">
                <strong
                  className={
                    credit
                      ? "amount-positive"
                      : "amount-negative"
                  }
                >
                  {
                    credit
                      ? "+"
                      : "-"
                  }

                  {
                    formatAmount(
                      transaction.amount
                    )
                  }{" "}
                  VEs
                </strong>

                <span
                  className={getStatusClass(
                    transaction.status
                  )}
                >
                  {
                    transaction.status ||
                    "PENDING"
                  }
                </span>
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

function QrPayoutScanner({ form, updateForm }) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scanSource, setScanSource] = useState("");

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  function extractUpiId(decodedText) {
    const value = String(decodedText || "").trim();
    if (!value) return "";

    if (/^[^\s@]+@[^\s@]+$/.test(value)) {
      return value;
    }

    try {
      const parsed = new URL(value);
      const upiId =
        parsed.searchParams.get("pa") ||
        parsed.searchParams.get("upi_id") ||
        parsed.searchParams.get("vpa");

      if (upiId && /^[^\s@]+@[^\s@]+$/.test(upiId.trim())) {
        return upiId.trim();
      }
    } catch {
      // Some QR scanners return non-URL text; fall through to regex parsing.
    }

    const match = value.match(/(?:^|[?&])(?:pa|upi_id|vpa)=([^&\s]+)/i);
    return match?.[1] && /^[^\s@]+@[^\s@]+$/.test(match[1])
      ? decodeURIComponent(match[1])
      : "";
  }

  async function startScanner() {
    setScannerError("");
    setScannerOpen(true);
    setScanning(true);

    const scanner = new Html5Qrcode("upi-qr-reader");

    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          const upiId = extractUpiId(decodedText);

          if (!upiId) {
            setScannerError(
              "This QR code does not contain a valid UPI payment address."
            );
            return;
          }

          updateForm("upiId", upiId);
          setScanSource("Camera scan");
          await stopScanner(scanner);
          setScannerOpen(false);
        },
        () => {}
      );

      window.__veloopQrScanner = scanner;
    } catch (err) {
      setScanning(false);
      setScannerError(
        err?.message?.includes("Permission")
          ? "Camera permission was denied. Please allow camera access and try again."
          : "Unable to open the camera. Please use HTTPS/localhost and allow camera access."
      );
      try {
        await scanner.clear();
      } catch {
        // Ignore scanner cleanup errors.
      }
    }
  }

  async function stopScanner(scannerInstance = window.__veloopQrScanner) {
    const scanner = scannerInstance;
    setScanning(false);

    if (!scanner) return;

    try {
      const state = scanner.getState?.();
      if (state === 2 || state === 3) {
        await scanner.stop();
      }
    } catch {
      // Ignore scanner stop errors.
    }

    try {
      await scanner.clear();
    } catch {
      // Ignore scanner cleanup errors.
    }

    if (window.__veloopQrScanner === scanner) {
      window.__veloopQrScanner = null;
    }
  }

  async function handleQrImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setScannerError("Please select a valid QR image.");
      return;
    }

    setScannerError("");
    const scanner = new Html5Qrcode("upi-qr-file-reader");

    try {
      const decodedText = await scanner.scanFile(file, true);
      const upiId = extractUpiId(decodedText);

      if (!upiId) {
        setScannerError(
          "No valid UPI ID was found in this QR image. Please choose a UPI payment QR."
        );
        return;
      }

      updateForm("upiId", upiId);
      updateForm("qrFileName", file.name);
      setScanSource("QR image");
    } catch {
      setScannerError(
        "Unable to read this QR image. Please upload a clear UPI QR code."
      );
    } finally {
      try {
        await scanner.clear();
      } catch {
        // Ignore scanner cleanup errors.
      }
    }
  }

  return (
    <div className="form-grid single">
      <div className="input-group">
        <label>UPI QR code</label>

        <div
          style={{
            display: "grid",
            gap: "12px",
            padding: "18px",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: "16px",
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <div>
            <strong style={{ display: "block", marginBottom: "5px" }}>
              Scan your UPI QR
            </strong>
            <small>
              Camera se QR scan karein. UPI ID automatically detect ho jayegi;
              manually type karne ki zarurat nahi hai.
            </small>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="primary-btn"
              onClick={startScanner}
            >
              <Icon name="qr" />
              Scan with camera
            </button>

            <label
              className="soft-btn"
              style={{ cursor: "pointer" }}
            >
              Upload QR image
              <input
                type="file"
                accept="image/*"
                onChange={handleQrImage}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {form.upiId && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.18)",
              }}
            >
              <small style={{ display: "block", marginBottom: "4px" }}>
                Detected UPI ID
              </small>
              <strong>{form.upiId}</strong>
              {scanSource && (
                <small style={{ display: "block", marginTop: "4px" }}>
                  Source: {scanSource}
                </small>
              )}
            </div>
          )}

          {scannerError && (
            <small style={{ color: "#ff8d8d" }}>
              {scannerError}
            </small>
          )}
        </div>

        <div id="upi-qr-file-reader" style={{ display: "none" }} />
      </div>

      {scannerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            background: "rgba(3,7,18,0.88)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              width: "min(440px, 100%)",
              padding: "20px",
              borderRadius: "22px",
              background: "#0d1424",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <div>
                <strong style={{ display: "block" }}>
                  Scan UPI QR
                </strong>
                <small>
                  Camera ko QR code ke saamne rakhein.
                </small>
              </div>

              <button
                type="button"
                className="soft-btn"
                onClick={() => {
                  stopScanner();
                  setScannerOpen(false);
                }}
              >
                Close
              </button>
            </div>

            <div
              id="upi-qr-reader"
              style={{
                width: "100%",
                overflow: "hidden",
                borderRadius: "16px",
              }}
            />

            {scanning && (
              <small style={{ display: "block", marginTop: "12px" }}>
                Searching for a UPI QR code…
              </small>
            )}

            {scannerError && (
              <small style={{ display: "block", marginTop: "10px", color: "#ff8d8d" }}>
                {scannerError}
              </small>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WithdrawalsPage({
  wallet,
  payoutOptions,
  form,
  updateForm,
  onSubmit,
  withdrawals,
  filter,
  setFilter,
  pending,
  completed,
}) {
  const methods =
    getMethodsForDisplay(
      payoutOptions
    );

  const selectedOption =
    findMethodOption(
      payoutOptions,
      form.method
    );

  const denominations =
    getDenominations(
      selectedOption
    );

  const selectedDenomination =
    findDenomination(
      selectedOption,
      form.amount
    );

  return (
    <div className="content-stack">
      <section className="panel payout-panel">
        <div className="page-head">
          <div>
            <div className="section-kicker">
              PAYOUT CENTER
            </div>

            <h2>
              Withdraw your VEs
            </h2>

            <p>
              Choose a backend-configured
              payout method and submit a
              secure withdrawal request.
            </p>
          </div>

          <div className="balance-chip">
            <span>
              Available
            </span>

            <strong>
              {
                formatAmount(
                  wallet.ves
                )
              }{" "}
              VEs
            </strong>
          </div>
        </div>

        <form
          className="withdraw-form"
          onSubmit={
            onSubmit
          }
        >
          <div className="payout-section">
            <div className="form-title">
              <span>
                01
              </span>

              <div>
                <strong>
                  Choose payout method
                </strong>

                <small>
                  Available methods are loaded from the backend.
                </small>
              </div>
            </div>

            <div className="method-grid">
              {methods.map(
                (method) => (
                  <button
                    type="button"
                    key={
                      method.value
                    }
                    className={
                      form.method ===
                        method.value
                        ? "method-card active"
                        : "method-card"
                    }
                    onClick={() => {
                      updateForm(
                        "method",
                        method.value
                      );

                      updateForm(
                        "amount",
                        ""
                      );
                    }}
                  >
                    <span className="method-icon">
                      <Icon
                        name={
                          method.icon
                        }
                      />
                    </span>

                    <span>
                      <strong>
                        {
                          method.name
                        }
                      </strong>

                      <small>
                        {
                          method.description
                        }
                      </small>
                    </span>

                    {
                      form.method ===
                      method.value && (
                        <span className="selected-mark">
                          ✓
                        </span>
                      )
                    }
                  </button>
                )
              )}
            </div>
          </div>

          <div className="payout-section">
            <div className="form-title">
              <span>
                02
              </span>

              <div>
                <strong>
                  Choose redemption amount
                </strong>

                <small>
                  Required VEs are calculated
                  from the selected backend option.
                </small>
              </div>
            </div>

            <div className="denomination-grid">
              {denominations.map(
                (denomination) => {
                  const insufficient =
                    Number(
                      denomination.required_amount
                    ) >
                    Number(
                      wallet.ves || 0
                    );

                  return (
                    <button
                      type="button"
                      key={
                        denomination.payout_value
                      }
                      className={
                        Number(
                          form.amount
                        ) ===
                          Number(
                            denomination.payout_value
                          )
                          ? "denomination-card active"
                          : "denomination-card"
                      }
                      onClick={() =>
                        updateForm(
                          "amount",
                          String(
                            denomination.payout_value
                          )
                        )
                      }
                      disabled={
                        insufficient
                      }
                    >
                      <strong>
                        ₹
                        {formatAmount(
                          denomination.payout_value
                        )}
                      </strong>

                      <span>
                        {
                          formatAmount(
                            denomination.required_amount
                          )
                        }{" "}
                        VEs
                      </span>

                      <small>
                        {insufficient
                          ? "Insufficient VEs"
                          : "Available"}
                      </small>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {
            selectedDenomination && (
              <div className="payout-preview">
                <div>
                  <span>
                    Payout value
                  </span>

                  <strong>
                    ₹
                    {formatAmount(
                      selectedDenomination.payout_value
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Required VEs
                  </span>

                  <strong>
                    {
                      formatAmount(
                        selectedDenomination.required_amount
                      )
                    }{" "}
                    VEs
                  </strong>
                </div>

                <div>
                  <span>
                    Remaining VEs
                  </span>

                  <strong>
                    {
                      formatAmount(
                        Math.max(
                          0,
                          Number(
                            wallet.ves ||
                            0
                          ) -
                          Number(
                            selectedDenomination.required_amount
                          )
                        )
                      )
                    }{" "}
                    VEs
                  </strong>
                </div>
              </div>
            )
          }

          <div className="payout-section">
            <div className="form-title">
              <span>
                03
              </span>

              <div>
                <strong>
                  Payout details
                </strong>

                <small>
                  Details are validated before the
                  request is submitted.
                </small>
              </div>
            </div>

            {form.method === "BANK" ? (
              <div className="form-grid">
                <Field label="Account holder name">
                  <input
                    value={form.accountName}
                    onChange={(e) =>
                      updateForm("accountName", e.target.value)
                    }
                    placeholder="Full name as per bank"
                    autoComplete="name"
                  />
                </Field>

                <Field label="Bank name">
                  <input
                    value={form.bankName}
                    onChange={(e) =>
                      updateForm("bankName", e.target.value)
                    }
                    placeholder="Bank name"
                  />
                </Field>

                <Field label="Account number">
                  <input
                    value={form.accountNumber}
                    onChange={(e) =>
                      updateForm(
                        "accountNumber",
                        e.target.value.replace(/\D/g, "")
                      )
                    }
                    placeholder="Account number"
                    inputMode="numeric"
                  />
                </Field>

                <Field label="IFSC code">
                  <input
                    value={form.ifsc}
                    onChange={(e) =>
                      updateForm(
                        "ifsc",
                        e.target.value.toUpperCase()
                      )
                    }
                    placeholder="ABCD0123456"
                    maxLength={11}
                  />
                </Field>
              </div>
            ) : form.method === "UPI" ? (
              <div className="form-grid single">
                <Field label="UPI ID">
                  <input
                    value={form.upiId}
                    onChange={(e) =>
                      updateForm("upiId", e.target.value)
                    }
                    placeholder="example@upi"
                    autoComplete="off"
                  />

                  <small>
                    Enter the UPI ID linked to your payout account.
                  </small>
                </Field>
              </div>
            ) : (
              <QrPayoutScanner
                form={form}
                updateForm={updateForm}
              />
            )}
          </div>

          <div className="review-bar">
            <div>
              <span>
                Selected payout
              </span>

              <strong>
                {selectedDenomination
                  ? `₹${formatAmount(
                    selectedDenomination.payout_value
                  )}`
                  : "Not selected"}
              </strong>
            </div>

            <div>
              <span>
                Method
              </span>

              <strong>
                {displayMethod(
                  form.method
                )}
              </strong>
            </div>

            <div>
              <span>
                VEs required
              </span>

              <strong>
                {selectedDenomination
                  ? `${formatAmount(
                    selectedDenomination.required_amount
                  )} VEs`
                  : "—"}
              </strong>
            </div>

            <button
              className="primary-btn withdraw-submit"
              disabled={
                !selectedDenomination
              }
            >
              <Icon name="lock" />
              Review & submit
            </button>
          </div>
        </form>
      </section>

      <section className="panel page-panel">
        <div className="page-head compact">
          <div>
            <div className="section-kicker">
              PAYOUT ACTIVITY
            </div>

            <h2>
              Withdrawal history
            </h2>

            <p>
              Track every request and its current status.
            </p>
          </div>

          <div className="mini-stats">
            <span>
              <strong>
                {pending}
              </strong>{" "}
              pending
            </span>

            <span>
              <strong>
                {completed}
              </strong>{" "}
              completed
            </span>
          </div>
        </div>

        <div className="toolbar">
          <div className="filter-group">
            {[
              "ALL",
              "PENDING",
              "PROCESSING",
              "APPROVED",
              "FAILED",
            ].map(
              (item) => (
                <button
                  key={
                    item
                  }
                  className={
                    filter ===
                      item
                      ? "filter-btn active"
                      : "filter-btn"
                  }
                  onClick={() =>
                    setFilter(
                      item
                    )
                  }
                >
                  {item}
                </button>
              )
            )}
          </div>
        </div>

        <WithdrawalList
          withdrawals={
            withdrawals
          }
        />
      </section>
    </div>
  );
}

function WithdrawalList({
  withdrawals,
}) {
  if (
    !withdrawals.length
  ) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Icon name="arrow-up" />
        </div>

        <strong>
          No withdrawals yet
        </strong>

        <span>
          Your payout requests will appear here.
        </span>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      {withdrawals.map(
        (
          withdrawal,
          index
        ) => {
          const details =
            withdrawal?.payout_details ||
            {};

          const detailText =
            details.upi_id ||
            details.account_number ||
            "Payout details saved";

          return (
            <div
              className="transaction-row"
              key={
                withdrawal.withdrawal_id ||
                index
              }
            >
              <div className="transaction-icon debit">
                <Icon name="arrow-up" />
              </div>

              <div className="transaction-main">
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
                  {
                    getPayoutLabel(
                      withdrawal.payout_option_id,
                      details
                    )
                  }

                  <i>
                    •
                  </i>

                  {
                    formatAmount(
                      withdrawal.amount
                    )
                  }{" "}
                  VEs

                  <i>
                    •
                  </i>

                  {
                    formatDate(
                      withdrawal.created_at
                    )
                  }
                </span>

                <small>
                  {
                    maskSensitive(
                      detailText
                    )
                  }
                </small>
              </div>

              <div className="transaction-meta">
                <span
                  className={getStatusClass(
                    withdrawal.status
                  )}
                >
                  {
                    withdrawal.status ||
                    "PENDING"
                  }
                </span>
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

function ConfirmationModal({
  confirmation,
  method,
  loading,
  onClose,
  onConfirm,
}) {
  return (
    <div className="modal-backdrop">
      <div className="confirm-modal">
        <div className="confirm-icon">
          <Icon name="shield" />
        </div>

        <div className="section-kicker">
          CONFIRM WITHDRAWAL
        </div>

        <h2>
          Ready to redeem your
          rewards?
        </h2>

        <p>
          Review the server-validated
          payout details before
          submitting the request.
        </p>

        <div className="confirm-summary">
          <div>
            <span>
              Payout
            </span>

            <strong>
              ₹
              {formatAmount(
                confirmation.payoutValue
              )}
            </strong>
          </div>

          <div>
            <span>
              Required
            </span>

            <strong>
              {
                formatAmount(
                  confirmation.requiredVes
                )
              }{" "}
              VEs
            </strong>
          </div>

          <div>
            <span>
              Method
            </span>

            <strong>
              {
                method
              }
            </strong>
          </div>
        </div>

        <div className="confirm-actions">
          <button
            className="secondary-btn"
            onClick={
              onClose
            }
            disabled={
              loading
            }
          >
            Cancel
          </button>

          <button
            className="primary-btn"
            onClick={
              onConfirm
            }
            disabled={
              loading
            }
          >
            {
              loading
                ? "Submitting…"
                : "Confirm withdrawal"
            }

            <Icon name="arrow-right" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileModal({
  profile,
  email,
  wallet,
  getInitial,
  onClose,
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={
        onClose
      }
    >
      <div
        className="profile-modal"
        onMouseDown={(e) =>
          e.stopPropagation()
        }
      >
        <div className="profile-modal-head">
          <div className="avatar xl">
            {
              getInitial
            }
          </div>

          <div>
            <div className="section-kicker">
              ACCOUNT PROFILE
            </div>

            <h2>
              {
                profile.name ||
                "VELOOP User"
              }
            </h2>

            <span>
              {
                email
              }
            </span>
          </div>

          <button
            className="modal-close"
            onClick={
              onClose
            }
          >
            ×
          </button>
        </div>

        <div className="profile-details">
          <ProfileRow
            label="Email address"
            value={
              email
            }
          />

          <ProfileRow
            label="Account access"
            value="Authenticated"
          />

          <ProfileRow
            label="Wallet VEs"
            value={`${formatAmount(
              wallet.ves
            )} VEs`}
          />

          <ProfileRow
            label="Security"
            value="JWT protected session"
          />
        </div>

        <div className="profile-note">
          <Icon name="shield" />

          <span>
            Your password is never
            displayed here. Wallet
            balances are loaded from
            the authenticated backend.
          </span>
        </div>

        <button
          className="primary-btn full-btn"
          onClick={
            onClose
          }
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ProfileRow({
  label,
  value,
}) {
  return (
    <div className="profile-row">
      <span>
        {
          label
        }
      </span>

      <strong>
        {
          value
        }
      </strong>
    </div>
  );
}

function ForgotModal({
  email,
  setEmail,
  loading,
  onClose,
  onSubmit,
}) {
  return (
    <div className="modal-backdrop">
      <div className="auth-modal">
        <button
          className="modal-close"
          onClick={
            onClose
          }
        >
          ×
        </button>

        <div className="modal-symbol">
          <Icon name="refresh" />
        </div>

        <div className="section-kicker">
          ACCOUNT RECOVERY
        </div>

        <h2>
          Forgot your password?
        </h2>

        <p>
          Enter your registered email
          and we’ll send a secure reset
          link.
        </p>

        <Field label="Email address">
          <input
            type="email"
            placeholder="Enter your email"
            value={
              email
            }
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
            autoFocus
          />
        </Field>

        <button
          className="primary-btn full-btn"
          onClick={
            onSubmit
          }
          disabled={
            loading
          }
        >
          {
            loading
              ? "Sending…"
              : "Send reset link"
          }

          <Icon name="arrow-right" />
        </button>

        <button
          className="modal-link"
          onClick={
            onClose
          }
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}

function RegisterModal({
  state,
  setState,
  loading,
  onClose,
  onSubmit,
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={
        onClose
      }
    >
      <div
        className="auth-modal register-modal"
        onMouseDown={(e) =>
          e.stopPropagation()
        }
      >
        <button
          className="modal-close"
          onClick={
            onClose
          }
        >
          ×
        </button>

        <div className="modal-symbol">
          V
        </div>

        <div className="section-kicker">
          CREATE ACCOUNT
        </div>

        <h2>
          Join VELOOP
        </h2>

        <p>
          Create your account and
          manage your rewards wallet
          securely.
        </p>

        <Field label="Full name">
          <input
            value={
              state.registerName
            }
            onChange={(e) =>
              setState.setRegisterName(
                e.target.value
              )
            }
            placeholder="Enter your full name"
            autoComplete="name"
          />
        </Field>

        <Field label="Email address">
          <input
            type="email"
            value={
              state.registerEmail
            }
            onChange={(e) =>
              setState.setRegisterEmail(
                e.target.value
              )
            }
            placeholder="Enter your email"
            autoComplete="email"
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            value={
              state.registerPassword
            }
            onChange={(e) =>
              setState.setRegisterPassword(
                e.target.value
              )
            }
            placeholder="Create a password"
            autoComplete="new-password"
          />
        </Field>

        <Field label="Confirm password">
          <input
            type="password"
            value={
              state.registerConfirmPassword
            }
            onChange={(e) =>
              setState.setRegisterConfirmPassword(
                e.target.value
              )
            }
            placeholder="Confirm your password"
            autoComplete="new-password"
          />
        </Field>

        <button
          className="primary-btn full-btn"
          onClick={
            onSubmit
          }
          disabled={
            loading
          }
        >
          {
            loading
              ? "Creating account…"
              : "Create account"
          }

          <Icon name="arrow-right" />
        </button>

        <button
          className="modal-link"
          onClick={
            onClose
          }
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  action,
  children,
}) {
  return (
    <label className="field">
      <span className="field-label">
        <strong>
          {
            label
          }
        </strong>

        {
          action
        }
      </span>

      {
        children
      }
    </label>
  );
}

function Alert({
  type,
  message,
  onClose,
}) {
  return (
    <div
      className={`alert ${type}`}
    >
      <span className="alert-symbol">
        {
          type ===
            "success"
            ? "✓"
            : "!"
        }
      </span>

      <span>
        {
          message
        }
      </span>

      {
        onClose && (
          <button
            onClick={
              onClose
            }
          >
            ×
          </button>
        )
      }
    </div>
  );
}

function isCredit(
  transaction
) {
  const type =
    String(
      transaction?.type ||
      ""
    ).toUpperCase();

  return (
    type ===
    "REWARD" ||
    type ===
    "CREDIT" ||
    Number(
      transaction?.amount ||
      0
    ) > 0
  );
}

function getStatusClass(
  status
) {
  const value =
    String(
      status ||
      "PENDING"
    ).toLowerCase();

  if (
    [
      "approved",
      "completed",
      "success",
      "successful",
    ].includes(
      value
    )
  ) {
    return "status completed";
  }

  if (
    [
      "rejected",
      "cancelled",
      "failed",
    ].includes(
      value
    )
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

  const id =
    String(
      optionId || ""
    ).toLowerCase();

  if (
    id.includes("bank")
  ) {
    return "Bank Transfer";
  }

  if (
    id.includes("upi")
  ) {
    return "UPI";
  }

  return (
    optionId ||
    "Payout"
  );
}

function maskSensitive(
  value
) {
  const text =
    String(
      value || ""
    );

  if (
    text.includes("@")
  ) {
    const [
      name,
      domain,
    ] = text.split("@");

    return `${name.slice(
      0,
      2
    )}***@${domain}`;
  }

  return text.length > 6
    ? `••••${text.slice(
      -4
    )}`
    : text;
}

function formatAmount(
  value
) {
  return Number(
    value || 0
  ).toLocaleString(
    "en-IN"
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
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

function findMethodOption(
  options,
  method
) {
  const upper =
    String(
      method || ""
    ).toUpperCase();

  const map = {
    UPI: "UPI",
    BANK: "BANK_TRANSFER",
    QR: "UPI_QR",
  };

  const expected =
    map[upper] ||
    upper;

  return (
    options || []
  ).find(
    (option) => {
      const type =
        String(
          option?.type ||
          ""
        ).toUpperCase();

      const id =
        String(
          option?.method_id ||
          ""
        ).toLowerCase();

      return (
        type ===
        expected ||
        id ===
        upper.toLowerCase()
      );
    }
  );
}

function getMethodsForDisplay(
  options
) {
  const methods = [];
  const seen =
    new Set();

  for (
    const option of
    options || []
  ) {
    const value =
      methodValue(
        option
      );

    if (
      !value ||
      seen.has(value)
    ) {
      continue;
    }

    seen.add(value);

    methods.push({
      value,

      name:
        option?.name ||
        displayMethod(
          value
        ),

      description:
        value ===
          "BANK"
          ? "Direct bank payout"
          : value ===
            "QR"
            ? "UPI QR payout"
            : "UPI payout",

      icon:
        value ===
          "BANK"
          ? "bank"
          : value === "QR"
            ? "qr"
            : "wallet",
    });
  }

  return methods;
}

function methodValue(
  option
) {
  const type =
    String(
      option?.type ||
      ""
    ).toUpperCase();

  const id =
    String(
      option?.method_id ||
      ""
    ).toUpperCase();

  if (
    type ===
    "BANK_TRANSFER" ||
    id.includes("BANK")
  ) {
    return "BANK";
  }

  if (
    type ===
    "UPI_QR" ||
    id.includes("QR")
  ) {
    return "QR";
  }

  if (
    type === "UPI" ||
    id === "UPI"
  ) {
    return "UPI";
  }

  return (
    type || id
  );
}

function displayMethod(
  method
) {
  if (
    method === "BANK"
  ) {
    return "Bank Transfer";
  }

  if (
    method === "QR"
  ) {
    return "UPI QR";
  }

  if (
    method === "UPI"
  ) {
    return "UPI";
  }

  return (
    method || "Payout"
  );
}

function getDenominations(
  option
) {
  if (
    !Array.isArray(
      option?.denominations
    )
  ) {
    return [];
  }

  return [
    ...option.denominations,
  ]
    .filter(
      (item) =>
        Number(
          item?.payout_value
        ) > 0 &&
        Number(
          item?.required_amount
        ) > 0
    )
    .sort(
      (a, b) =>
        Number(
          a.payout_value
        ) -
        Number(
          b.payout_value
        )
    );
}

function findDenomination(
  option,
  value
) {
  const n =
    Number(value);

  if (
    !Number.isFinite(n) ||
    n <= 0
  ) {
    return null;
  }

  return (
    getDenominations(
      option
    ).find(
      (item) =>
        Number(
          item.payout_value
        ) === n
    ) || null
  );
}

function getInitial(
  email
) {
  return email
    ? String(
      email
    )
      .trim()
      .charAt(0)
      .toUpperCase()
    : "V";
}

function Icon({
  name,
}) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke:
      "currentColor",
    strokeWidth: 1.8,
    strokeLinecap:
      "round",
    strokeLinejoin:
      "round",
    "aria-hidden": true,
  };

  const icons = {
    wallet: (
      <>
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H6.5A2.5 2.5 0 0 1 4 16.5z" />
        <path d="M4 8h13.5A3.5 3.5 0 0 1 21 11.5v1H17a2.5 2.5 0 0 0 0 5h4" />
        <circle
          cx="17.5"
          cy="15"
          r=".8"
          fill="currentColor"
        />
      </>
    ),

    activity: (
      <path d="M4 12h4l2.1-6 3.2 12 2.1-6H20" />
    ),

    "arrow-up": (
      <>
        <path d="M12 19V5" />
        <path d="m6 11 6-6 6 6" />
      </>
    ),

    "arrow-right": (
      <>
        <path d="M5 12h13" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),

    plus: (
      <path d="M12 5v14M5 12h14" />
    ),

    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4" />
        <path d="M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4" />
      </>
    ),

    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),

    user: (
      <>
        <circle
          cx="12"
          cy="8"
          r="3.5"
        />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),

    logout: (
      <>
        <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
        <path d="m13 16 4-4-4-4" />
        <path d="M17 12H9" />
      </>
    ),

    shield: (
      <>
        <path d="M12 3 19 6v5.4c0 4.4-2.7 7.8-7 9.6-4.3-1.8-7-5.2-7-9.6V6z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),

    lock: (
      <>
        <rect
          x="5"
          y="10"
          width="14"
          height="10"
          rx="2"
        />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),

    bank: (
      <>
        <path d="M3 10 12 4l9 6" />
        <path d="M5 10v8M9 10v8M15 10v8M19 10v8" />
        <path d="M3 20h18M4 10h16" />
      </>
    ),

    qr: (
      <>
        <rect
          x="4"
          y="4"
          width="6"
          height="6"
        />
        <rect
          x="14"
          y="4"
          width="6"
          height="6"
        />
        <rect
          x="4"
          y="14"
          width="6"
          height="6"
        />
        <path d="M14 14h3v3h-3zM18 18h2v2h-2zM14 18v2h2" />
      </>
    ),
  };

  return (
    <svg {...common}>
      {
        icons[
        name
        ] || null
      }
    </svg>
  );
}

export default App;


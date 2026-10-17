"use strict";

const STORAGE_KEY = "smartbank-demo-v1";
const STARTING_BALANCE = 250000;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function createInitialState() {
  return {
    balance: STARTING_BALANCE,
    transactions: [
      {
        id: "seed-1",
        name: "Demo salary",
        note: "Monthly demo income",
        amount: 350000,
        type: "income",
        date: new Date(Date.now() - 86400000 * 1).toISOString()
      },
      {
        id: "seed-2",
        name: "Alex Johnson",
        note: "Demo transfer",
        amount: 75000,
        type: "expense",
        date: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: "seed-3",
        name: "Demo shop",
        note: "Shopping",
        amount: 25000,
        type: "expense",
        date: new Date(Date.now() - 86400000 * 3).toISOString()
      }
    ]
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      const validState =
        parsed &&
        Number.isFinite(parsed.balance) &&
        parsed.balance >= 0 &&
        Array.isArray(parsed.transactions) &&
        parsed.transactions.every((transaction) =>
          transaction &&
          typeof transaction.id === "string" &&
          typeof transaction.name === "string" &&
          typeof transaction.note === "string" &&
          Number.isFinite(transaction.amount) &&
          transaction.amount > 0 &&
          ["income", "expense"].includes(transaction.type) &&
          typeof transaction.date === "string"
        );

      if (validState) return parsed;
    }
  } catch (error) {
    console.warn("Could not load demo data:", error);
  }

  return createInitialState();
}

let state = loadState();
let balanceHidden = false;
let toastTimeout;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Could not save demo data:", error);
    showToast("Browser storage is unavailable. Your changes may not persist.");
    return false;
  }
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function getTotals() {
  return state.transactions.reduce(
    (totals, transaction) => {
      if (transaction.type === "income") {
        totals.income += transaction.amount;
      } else {
        totals.expense += transaction.amount;
      }

      return totals;
    },
    { income: 0, expense: 0 }
  );
}

function displayBalance(amount) {
  return balanceHidden ? "RWF ••••••" : formatMoney(amount);
}

function renderStats() {
  const totals = getTotals();

  $("#balanceValue").textContent = displayBalance(state.balance);
  $("#incomeValue").textContent = displayBalance(totals.income);
  $("#expenseValue").textContent = displayBalance(totals.expense);
  $("#transferBalance").textContent = displayBalance(state.balance);

  $("#toggleBalance").textContent = balanceHidden ? "◎" : "◉";
  $("#toggleBalance").setAttribute(
    "aria-label",
    balanceHidden ? "Show balance" : "Hide balance"
  );
}

function renderTransactions(container, transactions) {
  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No transactions found. Try another search or filter.
      </div>
    `;
    return;
  }

  const list = document.createElement("div");
  list.className = "transaction-list";

  list.innerHTML = transactions.map((transaction) => {
    const isIncome = transaction.type === "income";
    const sign = isIncome ? "+" : "−";
    const icon = isIncome ? "↓" : "↗";
    const amountClass = isIncome ? "income-amount" : "expense-amount";

    return `
      <div class="transaction-row">
        <div class="transaction-person">
          <div class="transaction-avatar ${transaction.type}">
            ${icon}
          </div>
          <div>
            <strong>${escapeHTML(transaction.name)}</strong>
            <small>${escapeHTML(transaction.note || "Demo transaction")}</small>
          </div>
        </div>

        <div class="transaction-date">
          ${formatDate(transaction.date)}
        </div>

        <div class="transaction-amount">
          <strong class="${amountClass}">
            ${sign}${balanceHidden ? "••••••" : formatMoney(transaction.amount)}
          </strong>
          <small>${isIncome ? "Received" : "Sent"}</small>
        </div>
      </div>
    `;
  }).join("");

  container.replaceChildren(list);
}

function renderRecentTransactions() {
  const recent = [...state.transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  renderTransactions($("#recentTransactions"), recent);
}

function renderAllTransactions() {
  const searchTerm = $("#searchTransactions").value
    .trim()
    .toLowerCase();

  const typeFilter = $("#filterType").value;

  const filtered = [...state.transactions]
    .filter((transaction) => {
      const matchesSearch = [
        transaction.name,
        transaction.note,
        transaction.type
      ].some((value) => value.toLowerCase().includes(searchTerm));

      const matchesType =
        typeFilter === "all" || transaction.type === typeFilter;

      return matchesSearch && matchesType;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  renderTransactions($("#allTransactions"), filtered);
}

function renderApp() {
  renderStats();
  renderRecentTransactions();
  renderAllTransactions();
}

function showToast(message) {
  const toast = $("#toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

const pageTitles = {
  overview: "Dashboard",
  transactions: "Transactions",
  transfer: "Transfer money"
};

function navigateTo(viewName) {
  const target = document.getElementById(viewName);

  if (!target || !pageTitles[viewName]) return;

  $$(".view").forEach((view) => view.classList.add("hidden"));
  target.classList.remove("hidden");

  $$(".nav-link[data-view]").forEach((link) => {
    const active = link.dataset.view === viewName;

    link.classList.toggle("active", active);

    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  $("#pageTitle").textContent = pageTitles[viewName];
  $("#sidebar").classList.remove("open");

  if (viewName === "transactions") {
    renderAllTransactions();
  }

  if (viewName === "transfer") {
    $("#transferBalance").textContent = displayBalance(state.balance);
  }

  window.location.hash = viewName;
}

$$("[data-view]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo(link.dataset.view);
  });
});

$$("[data-go]").forEach((button) => {
  button.addEventListener("click", () => {
    navigateTo(button.dataset.go);
  });
});

$("#menuButton").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

$("#toggleBalance").addEventListener("click", () => {
  balanceHidden = !balanceHidden;
  renderApp();
});

$("#searchTransactions").addEventListener("input", renderAllTransactions);
$("#filterType").addEventListener("change", renderAllTransactions);

function clearErrors() {
  ["recipient", "account", "amount"].forEach((field) => {
    $("#" + field + "Error").textContent = "";
    $("#" + field).removeAttribute("aria-invalid");
  });
}

function setFieldError(field, message) {
  $("#" + field + "Error").textContent = message;
  $("#" + field).setAttribute("aria-invalid", "true");
}

function validateTransfer(recipient, account, amount) {
  let valid = true;

  clearErrors();

  if (recipient.trim().length < 2) {
    setFieldError("recipient", "Enter a recipient name with at least 2 characters.");
    valid = false;
  }

  if (!/^[a-zA-Z0-9-]{4,30}$/.test(account.trim())) {
    setFieldError("account", "Use 4–30 letters, numbers or hyphens.");
    valid = false;
  }

  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000) {
    setFieldError("amount", "Enter a whole amount between RWF 100 and RWF 100,000,000.");
    valid = false;
  } else if (amount > state.balance) {
    setFieldError("amount", "Insufficient demo balance.");
    valid = false;
  }

  return valid;
}

$("#transferForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const recipient = $("#recipient").value.trim();
  const account = $("#account").value.trim();
  const amount = Number($("#amount").value);
  const note = $("#note").value.trim() || "Demo transfer";

  if (!validateTransfer(recipient, account, amount)) {
    showToast("Please correct the highlighted fields.");
    return;
  }

  const transaction = {
    id: window.crypto?.randomUUID?.() ||
      `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: recipient,
    note: `${note} · ${account}`,
    amount,
    type: "expense",
    date: new Date().toISOString()
  };

  state.balance -= amount;
  state.transactions.push(transaction);
  saveState();
  renderApp();

  $("#transferForm").reset();
  clearErrors();

  showToast(`Demo transfer of ${formatMoney(amount)} recorded successfully.`);
  navigateTo("transactions");
});

$("#depositButton").addEventListener("click", () => {
  const amount = 50000;

  state.balance += amount;
  state.transactions.push({
    id: window.crypto?.randomUUID?.() || `tx-${Date.now()}`,
    name: "Demo deposit",
    note: "Sample funds added",
    amount,
    type: "income",
    date: new Date().toISOString()
  });

  saveState();
  renderApp();

  showToast(`${formatMoney(amount)} in demo money added to your balance.`);
});

$("#resetDemo").addEventListener("click", () => {
  const confirmed = window.confirm(
    "Reset all SmartBank demo transactions and restore the starting balance?"
  );

  if (!confirmed) return;

  state = createInitialState();
  saveState();
  renderApp();
  navigateTo("overview");

  showToast("Demo account restored to its starting data.");
});

$("#currentYear").textContent = new Date().getFullYear();

renderApp();

const initialView = window.location.hash.slice(1);

if (pageTitles[initialView]) {
  navigateTo(initialView);
}
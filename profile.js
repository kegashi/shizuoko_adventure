const PROFILE_STORAGE_KEY = "shizudigiProfile";
const PROFILE_CACHE_KEY = "shizudigiProfileCsv";
const PROFILE_ROW_KEY = "shizudigiProfileRow";
const FREE_MATCH_KEY = "shizudigiFreeMatches";
const EMBEDDED_PROFILE_ROWS = window.SHIZUDIGI_PROFILE_ROWS || null;

const setupEl = document.querySelector("#profileSetup");
const statusEl = document.querySelector("#profileStatus");
const teamSelect = document.querySelector("#teamSelect");
const userSelect = document.querySelector("#userSelect");
const saveButton = document.querySelector("#saveProfile");
const cardEl = document.querySelector("#profileCard");
const changeButton = document.querySelector("#changeProfile");
const opponentSearchEl = document.querySelector("#opponentSearch");
const addOpponentButton = document.querySelector("#addOpponent");
const opponentResultsEl = document.querySelector("#opponentResults");
const matchListEl = document.querySelector("#matchList");

let profileRows = [];
let profileColumns = [];
let teamColumn = "";
let nameColumn = "";
let userIdColumn = "";
let selectedOpponentKey = "";
let currentProfileKey = "";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted && char === "\"" && next === "\"") {
      cell += "\"";
      i += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function pickColumn(columns, candidates, fallbackIndex) {
  return columns.find((column) => candidates.some((candidate) => column.includes(candidate))) || columns[fallbackIndex] || columns[0];
}

function normalizeRows(csvRows) {
  profileColumns = csvRows[0].map((column) => column.trim());
  teamColumn = pickColumn(profileColumns, ["チーム", "team", "Team"], 0);
  nameColumn = pickColumn(profileColumns, ["名前", "ユーザー", "プレイヤー", "name", "Name"], 1);
  userIdColumn = profileColumns.find((column) => column.toLowerCase() === "userid") || "";
  return csvRows.slice(1).map((values) => Object.fromEntries(profileColumns.map((column, index) => [column, values[index]?.trim() || ""])));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function profileKey(row) {
  const userId = userIdColumn ? row[userIdColumn] : "";
  return userId || row[nameColumn] || String(profileRows.indexOf(row));
}

function profileLabel(row) {
  const name = row[nameColumn] || "名前未設定";
  const userId = userIdColumn ? row[userIdColumn].replace(/^@/, "") : "";
  return userId ? `${name} @${userId}` : name;
}

function fillTeams() {
  const teams = unique(profileRows.map((row) => row[teamColumn]));
  teamSelect.replaceChildren(new Option("選択してください", ""), ...teams.map((team) => new Option(team, team)));
  teamSelect.disabled = false;
}

function fillUsers(team) {
  const users = profileRows.filter((row) => row[teamColumn] === team);
  userSelect.replaceChildren(new Option("選択してください", ""), ...users.map((row, index) => new Option(row[nameColumn] || `ユーザー${index + 1}`, String(profileRows.indexOf(row)))));
  userSelect.disabled = !team;
  saveButton.disabled = true;
}

function renderProfile(row) {
  setupEl.hidden = true;
  cardEl.hidden = false;
  currentProfileKey = profileKey(row);
  localStorage.setItem(PROFILE_ROW_KEY, JSON.stringify(row));
  cardEl.querySelector(".profile-team").textContent = row[teamColumn] || "チーム未設定";
  cardEl.querySelector("h2").textContent = row[nameColumn] || "名前未設定";
  const dl = cardEl.querySelector("dl");
  const userId = userIdColumn ? row[userIdColumn].replace(/^@/, "") : "";
  const handle = userId ? `@${userId}` : "";
  dl.replaceChildren(
    ...(handle ? createProfileDetail("", handle) : []),
    ...profileColumns
      .filter((column) => column !== teamColumn && column !== nameColumn && column !== userIdColumn && row[column])
      .filter((column) => column.toLowerCase() !== "bonuspoint")
      .flatMap((column) => {
        return createProfileDetail(column, row[column]);
      }),
  );
  renderMatchList();
  renderOpponentResults("");
}

function createProfileDetail(label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  if (!label) dt.className = "profile-empty-label";
  const dd = document.createElement("dd");
  dd.textContent = value;
  return [dt, dd];
}

function readMatches() {
  return readJson(FREE_MATCH_KEY, []);
}

function writeMatches(matches) {
  localStorage.setItem(FREE_MATCH_KEY, JSON.stringify(matches));
}

function renderMatchList() {
  const matches = readMatches();
  matchListEl.replaceChildren(
    ...matches.map((match) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const remove = document.createElement("button");
      label.textContent = match.label;
      remove.type = "button";
      remove.textContent = "削除";
      remove.dataset.matchKey = match.key;
      item.append(label, remove);
      return item;
    }),
  );
}

function renderOpponentResults(query) {
  const normalizedQuery = query.trim().toLowerCase().replace(/^@/, "");
  const matches = readMatches();
  selectedOpponentKey = "";
  addOpponentButton.disabled = true;
  if (!normalizedQuery) {
    opponentResultsEl.replaceChildren();
    return;
  }

  const candidates = profileRows
    .filter((row) => {
      const key = profileKey(row);
      const userId = userIdColumn ? row[userIdColumn].toLowerCase().replace(/^@/, "") : "";
      const name = (row[nameColumn] || "").toLowerCase();
      return key !== currentProfileKey && !matches.some((match) => match.key === key) && `${name} ${userId}`.includes(normalizedQuery);
    })
    .slice(0, 6);

  opponentResultsEl.replaceChildren(
    ...candidates.map((row) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = profileLabel(row);
      button.dataset.opponentKey = profileKey(row);
      return button;
    }),
  );
}

async function loadProfiles() {
  const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
  const cachedCsv = localStorage.getItem(PROFILE_CACHE_KEY);
  const rows = EMBEDDED_PROFILE_ROWS || (cachedCsv ? parseCsv(cachedCsv) : null);
  if (!rows) throw new Error("プロフィール情報を読み込めませんでした");

  profileRows = normalizeRows(rows);
  fillTeams();
  statusEl.textContent = "チーム名とユーザーを選択してください。";

  if (saved) {
    const row = profileRows[Number(saved)];
    if (row) renderProfile(row);
  }
}

teamSelect.addEventListener("change", () => fillUsers(teamSelect.value));
userSelect.addEventListener("change", () => {
  saveButton.disabled = !userSelect.value;
});
saveButton.addEventListener("click", () => {
  localStorage.setItem(PROFILE_STORAGE_KEY, userSelect.value);
  renderProfile(profileRows[Number(userSelect.value)]);
});
changeButton.addEventListener("click", () => {
  localStorage.removeItem(PROFILE_STORAGE_KEY);
  localStorage.removeItem(PROFILE_ROW_KEY);
  cardEl.hidden = true;
  setupEl.hidden = false;
});

opponentSearchEl.addEventListener("input", () => {
  renderOpponentResults(opponentSearchEl.value);
});

opponentResultsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-opponent-key]");
  if (!button) return;
  selectedOpponentKey = button.dataset.opponentKey;
  opponentSearchEl.value = button.textContent;
  addOpponentButton.disabled = false;
});

addOpponentButton.addEventListener("click", () => {
  if (!selectedOpponentKey) return;
  const row = profileRows.find((profileRow) => profileKey(profileRow) === selectedOpponentKey);
  if (!row) return;
  const matches = readMatches();
  if (matches.some((match) => match.key === selectedOpponentKey)) return;
  matches.push({ key: selectedOpponentKey, label: profileLabel(row) });
  writeMatches(matches);
  opponentSearchEl.value = "";
  renderOpponentResults("");
  renderMatchList();
});

matchListEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-match-key]");
  if (!button) return;
  writeMatches(readMatches().filter((match) => match.key !== button.dataset.matchKey));
  renderMatchList();
});

loadProfiles().catch((error) => {
  statusEl.textContent = error.message;
});

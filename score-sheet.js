const SCORE_PROFILE_KEY = "shizudigiProfileRow";
const SCORE_MATCH_KEY = "shizudigiFreeMatches";
const SCORE_GAME_KEY = "superShizuoRecords";
const SCORE_TSUME_KEY = "shizudigiTsumeClears";
const SCORE_PRIZE_KEY = "shizudigiPrizeClaimed";
const SCORE_FLAGS_KEY = "shizudigiProfileFlags";
const SCORE_LOG_URL = window.SHIZUDIGI_SCORE_LOG_URL || "";
const SCORE_LOG_CSV_URL = window.SHIZUDIGI_SCORE_LOG_CSV_URL || "";
const MAIN_EVENT_POINTS = 6;

const ownerEl = document.querySelector("#scoreOwner");
const totalEl = document.querySelector("#scoreTotal");
const stampsEl = document.querySelector("#scoreStamps");
const breakdownEl = document.querySelector("#scoreBreakdown");
const claimButton = document.querySelector("#claimPrize");
const claimStatusEl = document.querySelector("#claimStatus");
const profileLinkEl = document.querySelector("#scoreProfileLink");

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function findField(row, candidates) {
  const key = Object.keys(row || {}).find((column) => candidates.some((candidate) => column.toLowerCase() === candidate));
  return key ? row[key] : "";
}

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

function tsumePoints(count) {
  return count + (count >= 4 ? 1 : 0);
}

function renderBreakdown(items) {
  breakdownEl.replaceChildren(
    ...items.flatMap((item) => {
      const dt = item.href ? document.createElement("a") : document.createElement("dt");
      const dd = document.createElement("dd");
      if (item.href) {
        dt.href = item.href;
        dt.className = "score-breakdown-link";
      }
      dt.textContent = item.label;
      dd.textContent = `${item.points}pt`;
      if (Array.isArray(item.detailLines)) {
        const detail = document.createElement("span");
        detail.className = "score-breakdown-detail";
        detail.replaceChildren(
          ...item.detailLines.map((line) => {
            const row = document.createElement("span");
            row.textContent = line;
            return row;
          }),
        );
        dd.append(detail);
      } else if (item.detail) {
        dd.dataset.detail = item.detail;
      }
      return [dt, dd];
    }),
  );
}

function renderStamps(total) {
  stampsEl.replaceChildren(
    ...Array.from({ length: 15 }, (_, index) => {
      const stamp = document.createElement("span");
      const number = index + 1;
      stamp.textContent = number % 3 === 0 ? "" : String(number);
      stamp.className = index < total ? "is-filled" : "";
      if (number % 3 === 0) stamp.classList.add("is-prize");
      return stamp;
    }),
  );
}

function renderClaimStatus() {
  const claimed = localStorage.getItem(SCORE_PRIZE_KEY) === "true";
  claimButton.hidden = false;
  claimButton.textContent = claimed ? "受取済み" : "景品受取(スタッフ操作)";
  claimButton.disabled = claimed;
  claimStatusEl.textContent = claimed ? "受取済み" : "";
}

function collectScoreState() {
  const profile = readJson(SCORE_PROFILE_KEY, null);
  const matches = readJson(SCORE_MATCH_KEY, []);
  const gameRecords = readJson(SCORE_GAME_KEY, {});
  const tsumeClears = readJson(SCORE_TSUME_KEY, {});
  const flags = readJson(SCORE_FLAGS_KEY, { posted: false, purchased: false });
  const bonus = numberValue(findField(profile, ["bonuspoint"]));
  const freeMatchPoints = matches.length;
  const normalClearPoint = gameRecords["2"]?.completed ? 1 : 0;
  const hardClearPoint = gameRecords["3"]?.completed ? 1 : 0;
  const tsumeClearCount = Object.values(tsumeClears).filter(Boolean).length;
  const tsumeClearPoints = tsumePoints(tsumeClearCount);
  const purchasePoints = flags.purchased ? 1 : 0;
  const postedPoints = flags.posted ? 2 : 0;
  const points = Math.min(15, MAIN_EVENT_POINTS + bonus + freeMatchPoints + normalClearPoint + hardClearPoint + tsumeClearPoints + purchasePoints + postedPoints);
  return { bonus, flags, freeMatchPoints, gameRecords, hardClearPoint, matches, normalClearPoint, points, postedPoints, profile, purchasePoints, tsumeClearCount, tsumeClearPoints, tsumeClears };
}

function buildScoreLogPayload() {
  const { gameRecords, matches, points, profile, tsumeClears } = collectScoreState();
  return {
    date: new Date().toLocaleString("ja-JP"),
    username: findField(profile, ["username", "name", "名前", "ユーザー", "プレイヤー"]),
    userid: findField(profile, ["userid"]).replace(/^@/, ""),
    points: String(points),
    opponents: matches.map((match) => match.label.replace(/\s*@\S+$/, "")).join(" "),
    opponentCount: String(matches.length),
    stage1HighScore: String(gameRecords["1"]?.bestScore ?? ""),
    stage2HighScore: String(gameRecords["2"]?.bestScore ?? ""),
    stage3HighScore: String(gameRecords["3"]?.bestScore ?? ""),
    puzzle1: tsumeClears["1"] ? "クリア済み" : "",
    puzzle2: tsumeClears["2"] ? "クリア済み" : "",
    puzzle3: tsumeClears["3"] ? "クリア済み" : "",
    puzzle4: tsumeClears["4"] ? "クリア済み" : "",
  };
}

function sendScoreLog(payload) {
  if (!SCORE_LOG_URL) return Promise.resolve(false);
  return fetch(SCORE_LOG_URL, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    method: "POST",
    mode: "no-cors",
  }).then(() => true);
}

async function fetchClaimedRows() {
  if (!SCORE_LOG_CSV_URL) return [];
  const url = `${SCORE_LOG_CSV_URL}${SCORE_LOG_CSV_URL.includes("?") ? "&" : "?"}_=${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("受取済みCSVを読み込めませんでした");
  const rows = parseCsv(await response.text());
  const headers = rows[0]?.map((header) => header.trim()) || [];
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""])));
}

function isClaimedByCsv(rows, profile) {
  const username = findField(profile, ["username", "name", "名前", "ユーザー", "プレイヤー"]);
  const userid = findField(profile, ["userid"]).replace(/^@/, "");
  return rows.some((row) => {
    const loggedUserName = findField(row, ["username", "name", "名前", "ユーザー", "プレイヤー"]);
    const loggedUserId = findField(row, ["userid"]).replace(/^@/, "");
    return (userid && loggedUserId === userid) || (username && loggedUserName === username);
  });
}

function renderScoreSheet() {
  const { bonus, freeMatchPoints, hardClearPoint, matches, normalClearPoint, points, postedPoints, profile, purchasePoints, tsumeClearCount, tsumeClearPoints } = collectScoreState();
  if (!profile) {
    document.querySelector(".score-sheet-panel").hidden = true;
    document.querySelector(".score-actions").hidden = true;
    profileLinkEl.hidden = false;
    return;
  }
  document.querySelector(".score-sheet-panel").hidden = false;
  document.querySelector(".score-actions").hidden = false;
  profileLinkEl.hidden = true;

  const matchNames = matches.map((match) => match.label.replace(/\s*@\S+$/, ""));
  const items = [
    { label: "メインイベント参加", points: MAIN_EVENT_POINTS },
    { label: "追加点", points: bonus },
    { label: "フリー対戦", points: freeMatchPoints, detailLines: matchNames.length ? matchNames : ["未登録"], href: "./profile.html" },
    { label: "スーパーしずオコ", points: normalClearPoint + hardClearPoint, detail: `ふつう ${normalClearPoint}pt / むずかしい ${hardClearPoint}pt`, href: "./game.html" },
    { label: "詰めデジカ", points: tsumeClearPoints, detail: `${tsumeClearCount}問クリア`, href: "./tsume-digica.html" },
    { label: "買い物", points: purchasePoints, href: "./profile.html" },
    { label: "#しずデジ投稿", points: postedPoints, href: "./profile.html" },
  ];
  const name = findField(profile, ["username", "name", "名前", "ユーザー", "プレイヤー"]) || "プロフィール未選択";
  const userId = findField(profile, ["userid"]).replace(/^@/, "");
  ownerEl.textContent = userId ? `${name} @${userId}` : name;
  totalEl.textContent = points;
  renderStamps(points);
  renderBreakdown(items);
  renderClaimStatus();
}

async function updateClaimVisibility() {
  const profile = readJson(SCORE_PROFILE_KEY, null);
  if (!profile) {
    claimButton.hidden = true;
    claimStatusEl.textContent = "プロフィールを登録してください。";
    return;
  }

  if (localStorage.getItem(SCORE_PRIZE_KEY) === "true") {
    renderClaimStatus();
    return;
  }

  try {
    const rows = await fetchClaimedRows();
    if (isClaimedByCsv(rows, profile)) {
      claimButton.hidden = true;
      claimStatusEl.textContent = "受取済み";
    }
  } catch {
    // CSVの公開設定やCORSで読めない場合はローカルの受取状態だけで判定する。
  }
}

claimButton.addEventListener("click", async () => {
  if (!window.confirm("ステータスを受取完了に変更してよいですか")) return;
  claimButton.disabled = true;
  claimButton.textContent = "送信中";
  await sendScoreLog(buildScoreLogPayload());
  localStorage.setItem(SCORE_PRIZE_KEY, "true");
  renderClaimStatus();
});

renderScoreSheet();
updateClaimVisibility();

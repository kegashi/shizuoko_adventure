const CARD_BASE_URL = "https://digimon-cg-guide.com/wp-content/uploads/";
const TSUME_CLEAR_KEY = "shizudigiTsumeClears";
const TSUME_COOLDOWN_KEY = "shizudigiTsumeCooldowns";
const COOLDOWN_MS = 90 * 1000;
const TSUME_QUIZZES = {
  1: {
    questions: [
      {
        label: "ゲーム勝利時のメモリーは？",
        options: [
          "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "0",
          "相手側1", "相手側2", "相手側3", "相手側4", "相手側5", "相手側6", "相手側7", "相手側8", "相手側9", "相手側10"],
        answer: "相手側7",
      },
      {
        label: "レオルモンから進化したLv.4デジモンは？",
        options: ["クーガモン", "ウルヴァモン", "STアルマリザモン", "BTアルマリザモン"],
        answer: "ウルヴァモン",
      },
    ],
  },
  2: {
    questions: [
      {
        label: "1枚目をチェックしたときのメモリーは？",
        options: [
          "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "0",
          "相手側1", "相手側2", "相手側3", "相手側4", "相手側5", "相手側6", "相手側7", "相手側8", "相手側9", "相手側10"],
        answer: "3",
      },
      {
        label: "ゲーム勝利時のメモリーは？",
        options: [
          "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "0",
          "相手側1", "相手側2", "相手側3", "相手側4", "相手側5", "相手側6", "相手側7", "相手側8", "相手側9", "相手側10"],
        answer: "相手側7",
      },
    ],
  },
  3: {
    questions: [
      {
        label: "「カオスモン:ヴァロドゥルアーム」に進化/登場する直前のメモリーは？",
        options: [
          "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "0",
          "相手側1", "相手側2", "相手側3", "相手側4", "相手側5", "相手側6", "相手側7", "相手側8", "相手側9", "相手側10"],
        answer: "相手側2",
      },
      {
        label: "最後にアタックするデジモンは？",
        options: ["プテロモン", "ゲイルモン", "グランゲイルモン", "デラモン", "ゼファーガモン", "ヴァロドゥルモン", "ヴォルテクスドラモン", "カオスモン:ヴァロドゥルアーム"],
        answer: "ヴォルテクスドラモン",
      },
    ],
  },
  4: {
    questions: [
      {
        label: "最後に「4コスト明日奈」の【メイン】を使用したときに破棄したカードは？",
        options: ["イグニッションフレア", "タイダルストリーム", "神の両腕・バージョンΩ", "ファクトリアル・エリア", "ベルスターモン/フライバレット"],
        answer: "ファクトリアル・エリア",
      },
      {
        label: "最後に「4コスト明日奈」の【メイン】を使用したときの進化先として選択したデジモンカードは？",
        options: ["ベアモン", "アイギオモン", "ブラックテイルモン", "グラップレオモン", "ダゴモン", "ウルカヌスモン", "マルスモン", "ベルスターモン"],
        answer: "ベルスターモン",
      },
    ],
  },
};
const zoomDialog = document.querySelector("#cardZoom");
const zoomImage = zoomDialog?.querySelector("img");

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function readClears() {
  return readJson(TSUME_CLEAR_KEY, {});
}

function writeClears(clears) {
  localStorage.setItem(TSUME_CLEAR_KEY, JSON.stringify(clears));
}

function readCooldowns() {
  return readJson(TSUME_COOLDOWN_KEY, {});
}

function writeCooldowns(cooldowns) {
  localStorage.setItem(TSUME_COOLDOWN_KEY, JSON.stringify(cooldowns));
}

function cooldownLeft(id) {
  return Math.max(0, (readCooldowns()[id] || 0) - Date.now());
}

function formatCooldown(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function renderQuizzes() {
  const clears = readClears();
  const feedbacks = readJson("shizudigiTsumeFeedbacks", {});
  document.querySelectorAll(".puzzle-quiz[data-puzzle-id]").forEach((container) => {
    const id = container.dataset.puzzleId;
    const quiz = TSUME_QUIZZES[id];
    const cleared = Boolean(clears[id]);
    const remaining = cooldownLeft(id);
    if (!quiz) {
      container.replaceChildren();
      return;
    }

    const form = document.createElement("form");
    form.dataset.quizId = id;

    const title = document.createElement("strong");
    title.textContent = cleared ? "正解済み" : "回答チェック";
    form.append(title);

    quiz.questions.forEach((question, index) => {
      const label = document.createElement("label");
      const text = document.createElement("span");
      const select = document.createElement("select");
      text.textContent = question.label;
      select.name = `q${index}`;
      select.disabled = cleared || remaining > 0;
      select.dataset.quizSelect = "true";
      select.replaceChildren(
        new Option("選択してください", ""),
        ...question.options.map((option) => new Option(option, option)),
      );
      label.append(text, select);
      form.append(label);
    });

    const status = document.createElement("p");
    status.className = "quiz-status";
    if (cleared) {
      status.textContent = feedbacks[id] || "正解！ポイントに反映しました。";
      status.classList.add("is-correct");
    } else if (remaining > 0) {
      status.textContent = `${feedbacks[id] || "不正解。"} 再回答まで ${formatCooldown(remaining)}`;
      status.classList.add("is-wrong");
    } else {
      status.textContent = feedbacks[id] || "";
    }

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.disabled = cleared || remaining > 0 || quiz.questions.length > 0;
    submit.textContent = cleared ? "クリア済み" : "回答する";

    form.append(status, submit);
    container.replaceChildren(form);
  });
  syncQuizButtons();
}

function syncQuizButtons() {
  document.querySelectorAll("[data-quiz-id]").forEach((form) => {
    const submit = form.querySelector("button[type='submit']");
    const selects = [...form.querySelectorAll("[data-quiz-select]")];
    if (!submit || submit.textContent === "クリア済み") return;
    submit.disabled = selects.some((select) => !select.value) || selects.some((select) => select.disabled);
  });
}

document.querySelectorAll("[data-card-file]").forEach((button) => {
  const fileName = button.dataset.cardFile;
  const label = button.textContent;
  button.replaceChildren();
  const image = document.createElement("img");
  image.src = `${CARD_BASE_URL}${fileName}`;
  image.alt = label;
  image.loading = "lazy";
  button.append(image);
});

function openZoom(src, alt = "") {
  if (!zoomDialog || !zoomImage) return;
  zoomImage.src = src;
  zoomImage.alt = alt;
  zoomDialog.showModal();
}

document.addEventListener("click", (event) => {
  const boardButton = event.target.closest("[data-zoom-src]");
  if (boardButton) {
    openZoom(boardButton.dataset.zoomSrc, boardButton.querySelector("img")?.alt || "");
    return;
  }

  const cardButton = event.target.closest("[data-card-file]");
  if (cardButton) {
    const fileName = cardButton.dataset.cardFile;
    openZoom(`${CARD_BASE_URL}${fileName}`, fileName);
    return;
  }

  if (event.target.matches(".zoom-close") || event.target === zoomDialog) {
    zoomDialog?.close();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") zoomDialog?.close();
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-quiz-id]");
  if (!form) return;
  event.preventDefault();

  const id = form.dataset.quizId;
  const quiz = TSUME_QUIZZES[id];
  const answers = new FormData(form);
  const isCorrect = quiz.questions.every((question, index) => answers.get(`q${index}`) === question.answer);

  if (isCorrect) {
    const clears = readClears();
    clears[id] = true;
    writeClears(clears);
    const feedbacks = readJson("shizudigiTsumeFeedbacks", {});
    feedbacks[id] = "正解！ポイントに反映しました。";
    localStorage.setItem("shizudigiTsumeFeedbacks", JSON.stringify(feedbacks));
  } else {
    const cooldowns = readCooldowns();
    cooldowns[id] = Date.now() + COOLDOWN_MS;
    writeCooldowns(cooldowns);
    const feedbacks = readJson("shizudigiTsumeFeedbacks", {});
    feedbacks[id] = "不正解。1分30秒後に再回答できます。";
    localStorage.setItem("shizudigiTsumeFeedbacks", JSON.stringify(feedbacks));
  }

  renderQuizzes();
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-quiz-select]")) syncQuizButtons();
});

renderQuizzes();
setInterval(() => {
  if (Object.values(readCooldowns()).some((expiresAt) => expiresAt > Date.now())) renderQuizzes();
}, 1000);

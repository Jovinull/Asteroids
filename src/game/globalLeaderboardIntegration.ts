import {
  fetchTopScores,
  formatTimeMMSS,
  getStoredPlayerName,
  isValidPlayerName,
  sanitizePlayerNameClient,
  setStoredPlayerName,
  submitScore,
  type GlobalLeaderboardEntry,
} from "./globalLeaderboard";

type PrevOverlayState = {
  overlayWasHidden: boolean;
  prevPanelId: string | null;
};

function el<T extends Element = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado no DOM.`);
  return node as unknown as T;
}

function findVisiblePanelId(overlay: HTMLElement): string | null {
  const panels = Array.from(overlay.querySelectorAll<HTMLElement>(".panel"));
  const visible = panels.find((p) => !p.classList.contains("hidden"));
  return visible?.id ?? null;
}

function ensureGlobalLeaderboardPanel(): {
  panel: HTMLDivElement;
  btnClose: HTMLButtonElement;
  btnRefresh: HTMLButtonElement;
  btnSaveName: HTMLButtonElement;
  inpName: HTMLInputElement;
  stateEl: HTMLDivElement;
  listEl: HTMLOListElement;
} {
  const overlay = el<HTMLDivElement>("overlay");

  let panel = document.getElementById(
    "panelGlobalLeaderboard"
  ) as HTMLDivElement | null;
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "panel hidden";
    panel.id = "panelGlobalLeaderboard";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Ranking Global");

    // usa só classes que você já tem + estilos inline mínimos (sem mexer no CSS)
    panel.innerHTML = `
      <div class="panel__title">RANKING GLOBAL</div>
      <div class="panel__subtitle">
        TOP 100 global (Google Sheets). Atualiza ao abrir.
      </div>

      <div class="panel__grid">
        <label class="field">
          <span class="field__label">Seu nome (3–20)</span>
          <input class="select" id="glbName" type="text" maxlength="20" autocomplete="nickname" />
        </label>

        <div class="field">
          <span class="field__label">Ações</span>
          <div class="panel__row" style="margin:0">
            <button class="btn btn--primary" id="glbSaveName" type="button">SALVAR</button>
            <button class="btn" id="glbRefresh" type="button">ATUALIZAR</button>
          </div>
        </div>
      </div>

      <div class="leaderboard" style="margin-top:12px;">
        <div class="leaderboard__title">TOP 100</div>
        <div class="panel__subtitle" id="glbState" style="margin: 8px 0 10px 0;">—</div>
        <ol class="leaderboard__list" id="glbList" style="max-height:52vh; overflow:auto; padding-right:8px;"></ol>
      </div>

      <div class="panel__row" style="margin-top:12px;">
        <button class="btn" id="glbClose" type="button">FECHAR</button>
      </div>

      <small class="muted">
        Ordenação: score desc, tempo asc, mais antigo acima. O servidor mantém só TOP 100.
      </small>
    `;

    overlay.appendChild(panel);
  }

  const btnClose = panel.querySelector<HTMLButtonElement>("#glbClose")!;
  const btnRefresh = panel.querySelector<HTMLButtonElement>("#glbRefresh")!;
  const btnSaveName = panel.querySelector<HTMLButtonElement>("#glbSaveName")!;
  const inpName = panel.querySelector<HTMLInputElement>("#glbName")!;
  const stateEl = panel.querySelector<HTMLDivElement>("#glbState")!;
  const listEl = panel.querySelector<HTMLOListElement>("#glbList")!;

  return { panel, btnClose, btnRefresh, btnSaveName, inpName, stateEl, listEl };
}

function injectGameOverRankingButton(): {
  btn: HTMLButtonElement | null;
  statusEl: HTMLElement | null;
} {
  const panelGameOver = el<HTMLDivElement>("panelGameOver");
  const row = panelGameOver.querySelector<HTMLDivElement>(".panel__row");
  if (!row) return { btn: null, statusEl: null };

  let btn = document.getElementById(
    "btnShowGlobalLeaderboardGameOver"
  ) as HTMLButtonElement | null;
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "btnShowGlobalLeaderboardGameOver";
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = "RANKING";
    row.appendChild(btn);
  }

  let statusEl = document.getElementById("globalSubmitStatus");
  if (!statusEl) {
    statusEl = document.createElement("small");
    statusEl.id = "globalSubmitStatus";
    statusEl.className = "muted";
    statusEl.style.display = "block";
    statusEl.style.marginTop = "10px";

    const stats = document.getElementById("gameOverStats");
    if (stats && stats.parentElement)
      stats.parentElement.insertBefore(statusEl, stats.nextSibling);
  }

  return { btn, statusEl: statusEl as HTMLElement | null };
}

function parseScoreFromGameOverStats(): number | null {
  const stats = document.getElementById("gameOverStats");
  const txt = (stats?.textContent ?? "").trim();
  // esperado: "Score 123 | BEST 456 | Acc 78% | ..."
  const m = txt.match(/Score\s+(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function bestEffortPlayerName(): string {
  const stored = sanitizePlayerNameClient(getStoredPlayerName());
  if (isValidPlayerName(stored)) return stored;

  // evita prompt obrigatório (pode ser bloqueado em alguns browsers sem gesto)
  // ainda assim garante nome válido pro server
  return "Anon";
}

export function initGlobalLeaderboardIntegration(): void {
  const overlay = el<HTMLDivElement>("overlay");

  // -------- painel global (criado via JS, sem mexer no seu HTML) --------
  const glb = ensureGlobalLeaderboardPanel();
  const { btn: btnGameOverRanking, statusEl: gameOverStatusEl } =
    injectGameOverRankingButton();

  let prev: PrevOverlayState | null = null;
  let lastTop: GlobalLeaderboardEntry[] = [];

  function showPanel(panel: HTMLElement): void {
    // salva estado atual
    prev = {
      overlayWasHidden: overlay.classList.contains("hidden"),
      prevPanelId: findVisiblePanelId(overlay),
    };

    overlay.classList.remove("hidden");

    // esconde todos os panels do overlay
    const panels = Array.from(overlay.querySelectorAll<HTMLElement>(".panel"));
    for (const p of panels) p.classList.add("hidden");

    // mostra o nosso
    panel.classList.remove("hidden");
  }

  function closePanel(): void {
    if (!prev) {
      // fallback
      glb.panel.classList.add("hidden");
      overlay.classList.add("hidden");
      return;
    }

    glb.panel.classList.add("hidden");

    if (prev.overlayWasHidden) {
      overlay.classList.add("hidden");
      prev = null;
      return;
    }

    // restaura o painel anterior, se existir
    if (prev.prevPanelId) {
      const p = document.getElementById(prev.prevPanelId);
      if (p) p.classList.remove("hidden");
    }
    prev = null;
  }

  function renderTop(entries: GlobalLeaderboardEntry[]): void {
    glb.listEl.innerHTML = "";

    if (!entries || entries.length === 0) {
      glb.stateEl.textContent = "Sem registros ainda.";
      const li = document.createElement("li");
      li.textContent = "Seja o primeiro a marcar um score!";
      glb.listEl.appendChild(li);
      return;
    }

    glb.stateEl.textContent = `Carregado: ${entries.length} registros`;

    entries.forEach((e, idx) => {
      const pos = idx + 1;
      const name = sanitizePlayerNameClient(e.playerName) || "—";
      const score = Number(e.score) || 0;
      const t = formatTimeMMSS(Number(e.playTimeSeconds) || 0);

      // data opcional (se parse falhar, só não mostra)
      let date = "";
      const d = new Date(String(e.createdAt || ""));
      if (!Number.isNaN(d.getTime())) {
        date = d.toLocaleDateString("pt-BR");
      }

      const li = document.createElement("li");
      li.textContent = `${pos}. ${name} — ${score} pts — ${t}${
        date ? ` — ${date}` : ""
      }`;
      glb.listEl.appendChild(li);
    });
  }

  async function refreshTop(): Promise<void> {
    glb.stateEl.textContent = "Carregando...";
    glb.listEl.innerHTML = "";

    const res = await fetchTopScores();
    if (!res.ok) {
      glb.stateEl.textContent = `Erro: ${res.error}`;
      const li = document.createElement("li");
      li.textContent = "Não foi possível carregar agora. Tente novamente.";
      glb.listEl.appendChild(li);
      return;
    }

    lastTop = Array.isArray(res.data) ? res.data : [];
    renderTop(lastTop);
  }

  function syncNameInput(): void {
    glb.inpName.value = getStoredPlayerName() || "";
  }

  function openGlobalLeaderboard(): void {
    // sempre que abrir, sincroniza nome e recarrega
    syncNameInput();
    showPanel(glb.panel);
    void refreshTop();
  }

  // botão do menu já existe: intercepta o click e troca pra ranking global
  const btnMenuRanking = el<HTMLButtonElement>("btnShowLeaderboard");
  btnMenuRanking.addEventListener(
    "click",
    (ev) => {
      ev.preventDefault();
      ev.stopImmediatePropagation(); // impede o toggle do leaderboard local do seu engine
      openGlobalLeaderboard();
    },
    true
  );

  // ranking no GameOver (injetado)
  if (btnGameOverRanking) {
    btnGameOverRanking.addEventListener("click", (ev) => {
      ev.preventDefault();
      openGlobalLeaderboard();
    });
  }

  glb.btnClose.addEventListener("click", closePanel);
  glb.btnRefresh.addEventListener("click", () => void refreshTop());

  glb.btnSaveName.addEventListener("click", () => {
    const s = sanitizePlayerNameClient(glb.inpName.value);
    if (!isValidPlayerName(s)) {
      glb.stateEl.textContent =
        "Nome inválido. Use 3–20 caracteres (sem caracteres perigosos).";
      return;
    }
    setStoredPlayerName(s);
    glb.stateEl.textContent = "Nome salvo!";
    glb.inpName.value = s;
  });

  // ESC fecha o painel global; Space/Enter não deve iniciar o jogo enquanto o painel está aberto
  document.addEventListener(
    "keydown",
    (ev) => {
      const open = !glb.panel.classList.contains("hidden");
      if (!open) return;

      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        closePanel();
        return;
      }

      if (ev.code === "Space" || ev.key === "Enter") {
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
    },
    true
  );

  // -------- timer da run + submit automático no Game Over --------
  let runActive = false;
  let runPaused = false;
  let runElapsedMs = 0;
  let runTickStart = 0;
  let resetOnNextStart = false;
  let lastSubmittedKey = "";

  function startRun(): void {
    runActive = true;
    runPaused = false;
    runElapsedMs = 0;
    runTickStart = performance.now();
  }

  function pauseRun(): void {
    if (!runActive || runPaused) return;
    runElapsedMs += performance.now() - runTickStart;
    runPaused = true;
  }

  function resumeRun(): void {
    if (!runActive) {
      startRun();
      return;
    }
    if (!runPaused) return;
    runPaused = false;
    runTickStart = performance.now();
  }

  function endRun(): number {
    if (runActive && !runPaused)
      runElapsedMs += performance.now() - runTickStart;
    const secs = Math.max(0, Math.floor(runElapsedMs / 1000));
    runActive = false;
    runPaused = false;
    return secs;
  }

  function panelIsVisible(id: string): boolean {
    const p = document.getElementById(id);
    return !!p && !p.classList.contains("hidden");
  }

  function updateOverlayState(): void {
    const overlayHidden = overlay.classList.contains("hidden");

    // overlay escondido => gameplay/contagem rodando
    if (overlayHidden) {
      if (!runActive || resetOnNextStart) {
        resetOnNextStart = false;
        startRun();
      } else if (runPaused) {
        resumeRun();
      }
      return;
    }

    // overlay visível
    if (panelIsVisible("panelMenu")) {
      // voltou pro menu => encerra run (se estava ativa)
      endRun();
      return;
    }

    if (panelIsVisible("panelPause")) {
      pauseRun();
      return;
    }

    if (panelIsVisible("panelGameOver")) {
      const playTimeSeconds = endRun();
      const score = parseScoreFromGameOverStats();

      if (score === null) return;

      const playerName = bestEffortPlayerName();
      const submitKey = `${playerName}|${score}|${playTimeSeconds}`;

      // evita duplicar submit se o DOM “piscar”
      if (submitKey === lastSubmittedKey) return;
      lastSubmittedKey = submitKey;

      if (gameOverStatusEl)
        gameOverStatusEl.textContent = "Enviando score global...";

      void (async () => {
        const res = await submitScore({ playerName, score, playTimeSeconds });

        if (!res.ok) {
          if (gameOverStatusEl) {
            gameOverStatusEl.textContent = `Falha ao enviar score global: ${res.error}`;
          }
          return;
        }

        if (gameOverStatusEl) {
          gameOverStatusEl.textContent =
            playerName === "Anon"
              ? "Score global enviado! (Dica: defina seu nome no Ranking)"
              : "Score global enviado!";
        }

        // se o painel estiver aberto, atualiza o TOP
        const open = !glb.panel.classList.contains("hidden");
        if (open) void refreshTop();
      })();

      return;
    }

    // settings/skills visíveis durante jogo: não pausa (o jogo continua no seu engine)
  }

  // Se usuário clicar pra iniciar/reiniciar, garantimos reset na próxima vez que o overlay esconder
  const btnPlay = document.getElementById("btnPlay");
  const btnAgain = document.getElementById("btnAgain");
  const btnRestart = document.getElementById("btnRestart");

  const markReset = () => {
    resetOnNextStart = true;
    lastSubmittedKey = "";
  };

  btnPlay?.addEventListener("click", markReset);
  btnAgain?.addEventListener("click", markReset);
  btnRestart?.addEventListener("click", markReset);

  // Observa mudanças no overlay (hidden/mostra painéis)
  const mo = new MutationObserver(() => updateOverlayState());
  mo.observe(overlay, { attributes: true, attributeFilter: ["class"] });

  // e observa visibilidade dos painéis (quando engine troca panel sem mexer na class do overlay em alguns casos)
  const panels = [
    "panelMenu",
    "panelPause",
    "panelGameOver",
    "panelSettings",
    "panelSkills",
  ];
  for (const id of panels) {
    const p = document.getElementById(id);
    if (!p) continue;
    mo.observe(p, { attributes: true, attributeFilter: ["class"] });
  }

  // init
  updateOverlayState();

  // também deixa o nome sincronizado quando abrir o painel
  glb.inpName.addEventListener("blur", () => {
    const s = sanitizePlayerNameClient(glb.inpName.value);
    if (isValidPlayerName(s)) setStoredPlayerName(s);
  });

  // se já tinha nome, pré-preenche
  syncNameInput();
}

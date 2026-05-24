const STORE_KEY = "noon-casting-v2";

const page = document.body.dataset.page;
const seed = window.NoonSeed || {};

const uiState = {
  selectedRole: "su-jinyu",
  selectedCandidate: "c-luo-su",
  statusFilter: "all",
  query: "",
  profileTab: "资料",
  profileExpanded: false,
  bottomTab: "schedule",
  adminView: "overview",
};

let store = loadStore();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadStore() {
  const fallback = {
    users: clone(seed.users || []),
    projects: clone(seed.projects || []),
    roles: clone(seed.roles || []),
    talents: clone(seed.talents || []),
    candidates: clone(seed.candidates || []),
    auditions: clone(seed.auditions || []),
    auditionReviews: clone(seed.auditionReviews || []),
    combinationTests: clone(seed.combinationTests || []),
    castPlans: clone(seed.castPlans || []),
    risks: clone(seed.risks || []),
    timelineEvents: clone(seed.timelineEvents || []),
  };

  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (!stored) return fallback;
    return { ...fallback, ...JSON.parse(stored) };
  } catch {
    return fallback;
  }
}

function saveStore() {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char];
  });
}

function projectById(id) {
  return store.projects.find((item) => item.id === id) || store.projects[0];
}

function roleById(id) {
  return store.roles.find((item) => item.id === id) || store.roles[0];
}

function talentById(id) {
  return store.talents.find((item) => item.id === id) || store.talents[0];
}

function candidateById(id) {
  return store.candidates.find((item) => item.id === id) || store.candidates[0];
}

function auditionsForCandidate(candidateId) {
  return store.auditions.filter((item) => item.candidateId === candidateId);
}

function reviewsForCandidate(candidateId) {
  const auditionIds = auditionsForCandidate(candidateId).map((item) => item.id);
  return store.auditionReviews.filter((item) => auditionIds.includes(item.auditionId));
}

function risksForCandidate(candidate) {
  return store.risks.filter((item) => item.talentId === candidate.talentId && item.roleId === candidate.roleId);
}

function timelineForCandidate(candidate) {
  return store.timelineEvents.filter((item) => item.talentId === candidate.talentId && item.roleId === candidate.roleId);
}

function candidateStatusClass(status) {
  if (["已定", "复试", "待导演确认", "待制片确认"].includes(status)) return "green";
  if (["系统推荐", "初筛", "待试镜", "备用"].includes(status)) return "gold";
  if (["淘汰", "已拒绝"].includes(status)) return "red";
  return "";
}

function riskClass(level) {
  if (level === "高" || level === "不可用") return "red";
  if (level === "中") return "gold";
  return "green";
}

function scoreLabel(score) {
  if (score >= 88) return "强";
  if (score >= 75) return "稳";
  return "待看";
}

function profileCompletion(talent) {
  return Number(talent.profileCompletion || 0);
}

function setRole(role) {
  localStorage.setItem("noon-casting-role", role);
}

function makeStat(label, value, note) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function renderScoreRows(scores) {
  const labels = {
    temperament: "气质适配",
    ageFit: "年龄感",
    acting: "表演能力",
    realism: "生活质感",
    relationshipFit: "人物关系",
    schedule: "档期",
    market: "市场",
    risk: "风险",
  };

  return Object.entries(labels)
    .map(([key, label]) => {
      const value = scores[key] ?? 0;
      const width = key === "risk" ? Math.max(8, 100 - value) : value;
      const display = key === "risk" ? `${value} 风险` : value;
      return `
        <div class="fit-row compact">
          <span>${label}</span>
          <span class="meter"><span style="width: ${width}%"></span></span>
          <strong>${display}</strong>
        </div>
      `;
    })
    .join("");
}

function initLogin() {
  document.querySelectorAll("[data-login-role]").forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.dataset.loginRole;
      setRole(role);
      const target = {
        actor: "actor.html",
        agent: "agent.html",
        admin: "admin-workspace.html",
      }[role];
      window.location.href = target;
    });
  });
}

function initAdmin() {
  ensureAdminSelection();
  bindAdminEvents();
  renderAdmin();
}

function ensureAdminSelection() {
  if (!store.roles.some((role) => role.id === uiState.selectedRole)) {
    uiState.selectedRole = store.roles[0]?.id;
  }
  const selected = candidateById(uiState.selectedCandidate);
  if (!selected || selected.roleId !== uiState.selectedRole) {
    uiState.selectedCandidate = store.candidates.find((item) => item.roleId === uiState.selectedRole)?.id || store.candidates[0]?.id;
  }
}

function filteredCandidates() {
  const query = uiState.query.trim().toLowerCase();
  return store.candidates
    .filter((candidate) => {
      if (candidate.roleId !== uiState.selectedRole) return false;
      if (uiState.statusFilter !== "all" && candidate.status !== uiState.statusFilter) return false;
      if (!query) return true;
      const talent = talentById(candidate.talentId);
      const searchable = [
        talent.name,
        talent.city,
        talent.agency,
        talent.tags.join(" "),
        talent.works.join(" "),
        candidate.status,
        candidate.fitReason,
        candidate.riskReason,
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

function renderAdmin() {
  ensureAdminSelection();
  renderAdminStats();
  renderAdminHome();
  renderProjectSummary();
  renderRoles();
  renderCandidateList();
  renderProfileTabs();
  renderCandidateProfile();
  renderLowerPanel();
  renderCandidatePool();
  renderCombinationPanel();
  renderCastPlans();
  renderRisks();
  renderReport();
  renderArchive();
  setAdminView(uiState.adminView, { scroll: false });
}

function renderAdminHome() {
  const tasks = [
    {
      title: "确认苏锦渔复试方向",
      note: "罗清弦 / 梁玥需要导演组二选一",
      action: "进入工作台",
      view: "workspace",
    },
    {
      title: "处理陈述高风险档期",
      note: "沈洲 6 月档期冲突需 48 小时内确认",
      action: "查看风险",
      view: "riskPanel",
    },
    {
      title: "补齐何燕燕试镜素材",
      note: "江闻溪缺少表演片段，先发初试任务",
      action: "看候选池",
      view: "candidatePool",
    },
  ];

  const todayTasks = document.querySelector("#todayTasks");
  if (todayTasks) {
    todayTasks.innerHTML = tasks
      .map((task) => `
        <article class="task-card simple-task">
          <div>
            <h4>${escapeHtml(task.title)}</h4>
            <p>${escapeHtml(task.note)}</p>
          </div>
          <button class="ghost-button small-action" type="button" data-admin-open="${task.view}">${escapeHtml(task.action)}</button>
        </article>
      `)
      .join("");
  }

  const roleProgress = document.querySelector("#roleProgress");
  if (roleProgress) {
    roleProgress.innerHTML = store.roles
      .map((role) => {
        const candidates = store.candidates.filter((item) => item.roleId === role.id);
        const best = [...candidates].sort((a, b) => b.totalScore - a.totalScore)[0];
        return `
          <button class="progress-row" type="button" data-admin-role-open="${role.id}">
            <span>
              <strong>${escapeHtml(role.name)}</strong>
              <small>${escapeHtml(role.status)} · ${candidates.length} 位候选</small>
            </span>
            <span class="tag ${candidateStatusClass(role.status)}">${best ? `${best.totalScore}%` : "待推荐"}</span>
          </button>
        `;
      })
      .join("");
  }
}

function setAdminView(view, options = {}) {
  uiState.adminView = view || "overview";
  const scroll = options.scroll !== false;
  const groups = {
    overview: "#adminHome",
    projectCenter: ".project-detail",
    workspace: ".workspace-detail",
    roles: ".workspace-detail",
    talents: ".workspace-detail",
    auditionManagement: ".workspace-detail",
    candidatePool: ".decision-detail",
    combinationPanel: ".decision-detail",
    castPlanPanel: ".decision-detail",
    riskPanel: ".decision-detail",
    reportPanel: ".report-detail",
    archivePanel: ".report-detail",
  };
  const selector = groups[uiState.adminView] || "#adminHome";
  document.querySelector("#adminHome").hidden = uiState.adminView !== "overview";
  document.querySelectorAll(".admin-detail").forEach((item) => {
    item.hidden = true;
  });
  if (uiState.adminView !== "overview") {
    document.querySelectorAll(selector).forEach((item) => {
      item.hidden = false;
    });
  }
  document.body.classList.toggle("admin-detail-mode", uiState.adminView !== "overview");
  document.querySelectorAll("[data-admin-anchor]").forEach((item) => {
    const anchor = item.dataset.adminAnchor;
    const active =
      anchor === uiState.adminView ||
      (uiState.adminView === "workspace" && ["roles", "talents", "auditionManagement"].includes(anchor));
    item.classList.toggle("active", active);
  });
  if (scroll) {
    const scrollTarget =
      uiState.adminView === "overview"
        ? document.querySelector("#overview")
        : document.querySelector(`#${uiState.adminView}`) || document.querySelector(selector);
    scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderAdminStats() {
  const root = document.querySelector("#adminStats");
  const currentRoleCandidates = store.candidates.filter((item) => item.roleId === uiState.selectedRole);
  const avg = Math.round(store.candidates.reduce((sum, item) => sum + item.totalScore, 0) / Math.max(store.candidates.length, 1));
  const pendingAuditions = store.auditions.filter((item) => ["已邀请", "已接受", "待提交"].includes(item.status)).length;
  const callbackCount = store.candidates.filter((item) => ["复试", "待导演确认", "待制片确认"].includes(item.status)).length;
  const casted = store.candidates.filter((item) => item.status === "已定").length;
  const highRisk = store.risks.filter((item) => item.level === "高" && !item.resolved).length;

  root.innerHTML = [
    makeStat("待定角色", store.roles.length * 4, "含主线、重要配角与功能角色"),
    makeStat("候选演员", currentRoleCandidates.length, "按当前角色动态筛选"),
    makeStat("待试镜", pendingAuditions, "外部端可接收任务"),
    makeStat("复试名单", callbackCount, "需导演组确认"),
    makeStat("已定角色", casted, "进入锁定或合同阶段"),
    makeStat("高风险项", highRisk, "仅内部后台可见"),
    makeStat("平均适配", `${avg}%`, "多维适配综合均值"),
  ].join("");
}

function renderProjectSummary() {
  const project = projectById("jianghe");
  const root = document.querySelector("#projectSummary");
  root.innerHTML = `
    <article>
      <span>项目名称</span>
      <strong>${escapeHtml(project.title)}</strong>
      <small>${escapeHtml(project.genre)} · ${escapeHtml(project.episodeCount)}集</small>
    </article>
    <article>
      <span>开机窗口</span>
      <strong>${escapeHtml(project.startDate)}</strong>
      <small>${escapeHtml(project.location)} · ${escapeHtml(project.shootingPeriod)}</small>
    </article>
    <article>
      <span>选角策略</span>
      <div class="tag-row">${project.castingStrategy.map((item) => `<span class="tag red">${escapeHtml(item)}</span>`).join("")}</div>
    </article>
    <article>
      <span>上线版升级</span>
      <small>React/Vite、数据库、账号权限、文件上传、审计日志与正式部署。</small>
    </article>
  `;
}

function renderRoles() {
  const tabs = document.querySelector("#roleTabs");
  tabs.innerHTML = store.roles
    .map((role) => {
      const active = role.id === uiState.selectedRole ? " active" : "";
      return `
        <button class="role-tab${active}" type="button" data-role="${role.id}" role="tab" aria-selected="${role.id === uiState.selectedRole}">
          <strong>${escapeHtml(role.name)}</strong>
          <span>${escapeHtml(role.type)} / ${escapeHtml(role.ageRange)} · ${escapeHtml(role.roleLevel)}级</span>
          <span class="tag ${candidateStatusClass(role.status)}">${escapeHtml(role.status)}</span>
        </button>
      `;
    })
    .join("");

  const role = roleById(uiState.selectedRole);
  document.querySelector("#roleDetail").innerHTML = `
    <div class="role-mood">
      <div class="mood-frame" aria-hidden="true"></div>
      <div class="tag-row">${role.traits.map((trait) => `<span class="tag red">${escapeHtml(trait)}</span>`).join("")}</div>
    </div>
    <p>${escapeHtml(role.tone)}</p>
    <dl class="detail-list">
      <div><dt>角色身份</dt><dd>${escapeHtml(role.identity)}</dd></div>
      <div><dt>人物起点</dt><dd>${escapeHtml(role.startState)}</dd></div>
      <div><dt>中途变化</dt><dd>${escapeHtml(role.middleChange)}</dd></div>
      <div><dt>终点状态</dt><dd>${escapeHtml(role.endState)}</dd></div>
      <div><dt>人物动机</dt><dd>${escapeHtml(role.motivation)}</dd></div>
      <div><dt>核心关系</dt><dd>${role.relationships.map(escapeHtml).join("；")}</dd></div>
      <div><dt>表演难点</dt><dd>${role.performanceChallenges.map(escapeHtml).join("、")}</dd></div>
      <div><dt>高光场面</dt><dd>${role.keyScenes.map(escapeHtml).join("、")}</dd></div>
      <div><dt>试镜重点</dt><dd>${role.auditionFocus.map(escapeHtml).join("、")}</dd></div>
      <div><dt>不可妥协项</dt><dd>${role.mustHave.map(escapeHtml).join("、")}</dd></div>
      <div><dt>可调整项</dt><dd>${role.flexible.map(escapeHtml).join("、")}</dd></div>
    </dl>
  `;
}

function renderCandidateList() {
  const list = filteredCandidates();
  if (!list.some((item) => item.id === uiState.selectedCandidate)) {
    uiState.selectedCandidate = list[0]?.id || store.candidates.find((item) => item.roleId === uiState.selectedRole)?.id || store.candidates[0]?.id;
  }

  document.querySelector("#resultCount").textContent = `${list.length} 人`;
  document.querySelector("#talentList").innerHTML = list.length
    ? list
        .map((candidate) => {
          const talent = talentById(candidate.talentId);
          const active = candidate.id === uiState.selectedCandidate ? " active" : "";
          return `
            <button class="talent-card${active}" type="button" data-candidate="${candidate.id}">
              <span class="portrait"><img src="${escapeHtml(talent.portrait)}" alt="${escapeHtml(talent.name)}档案照" /></span>
              <span class="talent-main">
                <span class="talent-name-line">
                  <strong>${escapeHtml(talent.name)}</strong>
                  <span class="tag ${candidateStatusClass(candidate.status)}">${escapeHtml(candidate.status)}</span>
                  <span class="tag">${escapeHtml(candidate.recommendationType)}</span>
                </span>
                <p class="talent-meta">${talent.age}岁 · ${escapeHtml(talent.city)} · ${escapeHtml(talent.agency)}</p>
                <span class="tag-row">${talent.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</span>
              </span>
              <span class="score-pill" style="--score: ${candidate.totalScore}">
                <span>${candidate.totalScore}</span>
              </span>
              ${candidate.id === uiState.selectedCandidate ? `<span class="match-breakdown"><small>${escapeHtml(candidate.fitReason)}</small></span>` : ""}
            </button>
          `;
        })
        .join("")
    : `<div class="empty-state">没有找到匹配候选。可以清空搜索，或新增一个候选。</div>`;
}

function renderProfileTabs() {
  const tabs = ["资料", "作品", "试镜", "评价", "风险", "推进记录"];
  const root = document.querySelector("#profileTabs");
  root.hidden = !uiState.profileExpanded;
  root.innerHTML = tabs
    .map((tab) => `<button class="${uiState.profileTab === tab ? "active" : ""}" type="button" data-profile-tab="${tab}">${tab}</button>`)
    .join("");
}

function renderCandidateProfile() {
  const root = document.querySelector("#profilePanel");
  const candidate = candidateById(uiState.selectedCandidate);
  if (!candidate) {
    root.innerHTML = `<div class="empty-state">请选择一位候选演员。</div>`;
    return;
  }

  const talent = talentById(candidate.talentId);
  const role = roleById(candidate.roleId);
  const header = `
    <div class="profile-hero">
      <span class="portrait"><img src="${escapeHtml(talent.portrait)}" alt="${escapeHtml(talent.name)}档案照" /></span>
      <div>
        <h4>${escapeHtml(talent.name)}</h4>
        <p class="profile-meta">${talent.age}岁 · ${escapeHtml(talent.city)}<br />${escapeHtml(talent.agency)} · ${escapeHtml(talent.scheduleStatus)}</p>
        <div class="tag-row">
          <span class="tag ${candidateStatusClass(candidate.status)}">${escapeHtml(candidate.status)}</span>
          <span class="tag gold">${escapeHtml(role.name)} ${candidate.totalScore}%</span>
          <span class="tag ${riskClass(riskLevelForCandidate(candidate))}">风险 ${escapeHtml(riskLevelForCandidate(candidate))}</span>
        </div>
      </div>
    </div>
  `;

  const actions = `
    <div class="profile-actions">
      <button class="status-action primary" type="button" data-schedule="${candidate.id}">安排试镜</button>
      <button class="status-action" type="button" data-advance="${candidate.id}">推进状态</button>
      <button class="status-action" type="button" data-set-status="备用" data-candidate-id="${candidate.id}">设为备用</button>
      <button class="status-action" type="button" data-set-status="淘汰" data-candidate-id="${candidate.id}">淘汰</button>
    </div>
  `;

  if (!uiState.profileExpanded) {
    const auditions = auditionsForCandidate(candidate.id);
    const nextAction = auditions.length ? auditions[0].status : "待安排试镜";
    root.innerHTML = `
      ${header}
      <div class="summary-panel">
        <div>
          <span>总适配</span>
          <strong>${candidate.totalScore}%</strong>
          <small>${escapeHtml(candidate.fitReason)}</small>
        </div>
        <div>
          <span>当前阶段</span>
          <strong>${escapeHtml(candidate.status)}</strong>
          <small>下一步：${escapeHtml(nextAction)}</small>
        </div>
      </div>
      <div class="profile-actions">
        <button class="status-action primary" type="button" data-view-candidate-detail="${candidate.id}">查看详情</button>
        <button class="status-action" type="button" data-schedule="${candidate.id}">安排试镜</button>
        <button class="status-action" type="button" data-advance="${candidate.id}">推进状态</button>
      </div>
    `;
    return;
  }

  const tab = uiState.profileTab;
  let body = "";
  if (tab === "资料") {
    body = `
      ${header}
      <div class="fit-block">${renderScoreRows(candidate.scores)}</div>
      <p class="profile-note">${escapeHtml(candidate.fitReason)}<br />风险理由：${escapeHtml(candidate.riskReason)}</p>
      ${actions}
    `;
  } else if (tab === "作品") {
    body = `
      ${header}
      <ul class="credit-list">
        ${talent.works.map((work, index) => `<li><span>${escapeHtml(work)}</span><small>${index === 0 ? "重点参考" : "参考"}</small></li>`).join("")}
      </ul>
      <div class="material-block">
        <div class="tag-row"><span class="tag">资料完整度</span><span class="tag green">${profileCompletion(talent)}%</span></div>
        <div class="material-grid">
          ${["表演片段", "生活照", "台词音频", "档期表", "合同信息"].map((item) => {
            const done = talent.materials.includes(item);
            return `<div class="material-item${done ? " done" : ""}"><span class="material-dot">${done ? "✓" : ""}</span>${escapeHtml(item)}</div>`;
          }).join("")}
        </div>
      </div>
    `;
  } else if (tab === "试镜") {
    const auditions = auditionsForCandidate(candidate.id);
    body = `
      ${header}
      <div class="schedule-list">
        ${auditions.length ? auditions.map(renderAuditionItem).join("") : `<div class="empty-state">暂无试镜任务。</div>`}
      </div>
      ${actions}
    `;
  } else if (tab === "评价") {
    const reviews = reviewsForCandidate(candidate.id);
    body = `
      ${header}
      <div class="review-block">
        <h4>内部评价</h4>
        <p class="profile-note">${escapeHtml(candidate.internalNotes || "暂无内部备注。")}</p>
        <dl class="detail-list">
          <div><dt>导演意见</dt><dd>${escapeHtml(candidate.directorOpinion || "待确认")}</dd></div>
          <div><dt>制片意见</dt><dd>${escapeHtml(candidate.producerOpinion || "待确认")}</dd></div>
          <div><dt>选角意见</dt><dd>${escapeHtml(candidate.castingOpinion || "待确认")}</dd></div>
        </dl>
        ${reviews.map((review) => `<p class="profile-note">试镜评价：${escapeHtml(review.comment)} · 决策 ${escapeHtml(review.decision)}</p>`).join("")}
      </div>
      ${actions}
    `;
  } else if (tab === "风险") {
    const risks = risksForCandidate(candidate);
    body = `
      ${header}
      ${risks.length ? risks.map(renderRiskItem).join("") : `<div class="empty-state">暂无风险记录。</div>`}
      <p class="profile-note">风险备注仅内部后台可见，不能展示给演员端或经纪端，也不能作为未经证实的黑名单。</p>
    `;
  } else {
    const timeline = timelineForCandidate(candidate);
    body = `
      ${header}
      <div class="timeline">
        ${timeline.length ? timeline.map(renderTimelineItem).join("") : `<div class="empty-state">暂无推进记录。</div>`}
      </div>
      ${actions}
    `;
  }

  root.innerHTML = body;
}

function riskLevelForCandidate(candidate) {
  const risks = risksForCandidate(candidate);
  if (risks.some((item) => item.level === "高")) return "高";
  if (risks.some((item) => item.level === "中")) return "中";
  return "低";
}

function renderAuditionItem(item) {
  const talent = talentById(item.talentId);
  const role = roleById(item.roleId);
  const deadline = new Date(item.deadline);
  const date = Number.isNaN(deadline.getTime())
    ? item.deadline
    : deadline.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `
    <article class="schedule-item">
      <span class="date-chip">${escapeHtml(date)}</span>
      <div>
        <h4>${escapeHtml(talent.name)} · ${escapeHtml(role.name)}</h4>
        <p>${escapeHtml(item.type)} · ${escapeHtml(item.location)} · ${escapeHtml(item.status)}</p>
        <small>${escapeHtml(item.requirement)}</small>
      </div>
      <span class="tag ${candidateStatusClass(item.status)}">${escapeHtml(item.status)}</span>
    </article>
  `;
}

function renderTimelineItem(item) {
  return `
    <article class="timeline-item">
      <strong>${escapeHtml(item.text)}</strong>
      <small>${escapeHtml(item.at)} · ${escapeHtml(item.actor)}</small>
    </article>
  `;
}

function renderRiskItem(item) {
  const talent = talentById(item.talentId);
  const role = roleById(item.roleId);
  return `
    <article class="risk-item">
      <div>
        <h4>${escapeHtml(item.type)} · ${escapeHtml(talent.name)} / ${escapeHtml(role.name)}</h4>
        <p>${escapeHtml(item.description)}</p>
        <small>证据：${escapeHtml(item.evidence)} · 建议：${escapeHtml(item.suggestion)}</small>
      </div>
      <span class="tag ${riskClass(item.level)}">${escapeHtml(item.level)}</span>
    </article>
  `;
}

function renderLowerPanel() {
  const root = document.querySelector("#lowerPanel");
  if (uiState.bottomTab === "schedule") {
    root.innerHTML = store.auditions.sort((a, b) => a.deadline.localeCompare(b.deadline)).map(renderAuditionItem).join("");
  } else if (uiState.bottomTab === "combinations") {
    root.innerHTML = renderCombinationCards(store.combinationTests);
  } else {
    root.innerHTML = `<div class="timeline">${store.timelineEvents.map(renderTimelineItem).join("")}</div>`;
  }
}

function renderCandidatePool() {
  const root = document.querySelector("#candidatePoolList");
  root.innerHTML = `
    <div class="table-like">
      <div class="table-row table-head"><span>角色</span><span>演员</span><span>状态</span><span>来源</span><span>适配</span><span>动作</span></div>
      ${store.candidates.map((candidate) => {
        const role = roleById(candidate.roleId);
        const talent = talentById(candidate.talentId);
        return `
          <div class="table-row">
            <span>${escapeHtml(role.name)}</span>
            <span>${escapeHtml(talent.name)}</span>
            <span><span class="tag ${candidateStatusClass(candidate.status)}">${escapeHtml(candidate.status)}</span></span>
            <span>${escapeHtml(candidate.source)}</span>
            <span>${candidate.totalScore}% · ${scoreLabel(candidate.totalScore)}</span>
            <span><button class="ghost-button small-action" type="button" data-advance="${candidate.id}">推进</button></span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderCombinationPanel() {
  document.querySelector("#combinationList").innerHTML = renderCombinationCards(store.combinationTests);
}

function renderCombinationCards(items) {
  return items.length
    ? `
      <div class="combo-grid">
        ${items.map((item) => {
          const roles = item.roleIds.map((id) => roleById(id).name).join(" + ");
          const talents = item.talentIds.map((id) => talentById(id).name).join(" + ");
          const avg = Math.round(Object.values(item.scores).reduce((sum, value) => sum + value, 0) / Object.values(item.scores).length);
          return `
            <article class="combo-card">
              <div class="combo-head">
                <span class="tag red">${escapeHtml(item.relationshipType)}</span>
                <strong>${avg}%</strong>
              </div>
              <h4>${escapeHtml(roles)}</h4>
              <p>${escapeHtml(talents)}</p>
              <small>${escapeHtml(item.testScene)} · 结论：${escapeHtml(item.conclusion)}</small>
              <div class="mini-metrics">
                <span>可信 ${item.scores.credibility}</span>
                <span>张力 ${item.scores.tension}</span>
                <span>生活 ${item.scores.realism}</span>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `
    : `<div class="empty-state">暂无组合测试。</div>`;
}

function renderCastPlans() {
  const root = document.querySelector("#castPlanList");
  root.innerHTML = `
    <div class="cast-plan-grid">
      ${store.castPlans.map((plan) => `
        <article class="cast-plan-card">
          <div class="combo-head">
            <span class="tag gold">${escapeHtml(plan.type)}</span>
            <strong>${escapeHtml(plan.budgetEstimate)}</strong>
          </div>
          <h4>${escapeHtml(plan.name)}</h4>
          <ul class="cast-lines">
            ${plan.cast.map((line) => `<li><span>${escapeHtml(roleById(line.roleId).name)}</span><strong>${escapeHtml(talentById(line.talentId).name)}</strong></li>`).join("")}
          </ul>
          <div class="mini-metrics">
            <span>档期 ${plan.scheduleFeasibility}</span>
            <span>风格 ${plan.styleConsistency}</span>
            <span>关系 ${plan.relationshipScore}</span>
          </div>
          <p>${escapeHtml(plan.recommendation)}</p>
          <small>最大风险：${escapeHtml(plan.biggestRisk)}</small>
        </article>
      `).join("")}
    </div>
  `;
}

function renderRisks() {
  document.querySelector("#riskList").innerHTML = store.risks.map(renderRiskItem).join("");
}

function renderReport() {
  const root = document.querySelector("#reportPreview");
  const decided = store.candidates.filter((item) => item.status === "已定");
  const callbacks = store.candidates.filter((item) => ["复试", "待导演确认", "待制片确认"].includes(item.status));
  root.innerHTML = `
    <div class="report-grid">
      <article><span>主要角色进度</span><strong>${store.roles.length} 个角色</strong><small>${callbacks.length} 人在复试或确认中</small></article>
      <article><span>最终建议</span><strong>${store.castPlans[1]?.name || "方案待定"}</strong><small>以组合测试和风险降低为前置条件</small></article>
      <article><span>已定角</span><strong>${decided.length}</strong><small>进入合同或锁定阶段</small></article>
    </div>
    <p class="profile-note">报告将包含项目概况、角色候选名单、推荐和不推荐理由、试镜评价、组合测试结论、风险提示、阵容方案对比和待确认事项。</p>
  `;
}

function renderArchive() {
  document.querySelector("#archivePreview").innerHTML = `
    <dl class="detail-list">
      <div><dt>归档目标</dt><dd>记录最终定角、拍摄表现、判断准确度、有效标签和低估风险。</dd></div>
      <div><dt>长期价值</dt><dd>沉淀正午合作演员资产，让系统越用越准。</dd></div>
      <div><dt>当前状态</dt><dd>项目仍在选角中，归档复盘为后续阶段。</dd></div>
    </dl>
  `;
}

function bindAdminEvents() {
  document.querySelector("#roleTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-role]");
    if (!button) return;
    uiState.selectedRole = button.dataset.role;
    uiState.selectedCandidate = store.candidates.find((item) => item.roleId === uiState.selectedRole)?.id;
    uiState.profileExpanded = false;
    renderAdmin();
  });

  document.querySelector("#talentList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-candidate]");
    if (!button) return;
    uiState.selectedCandidate = button.dataset.candidate;
    uiState.profileExpanded = false;
    renderAdmin();
  });

  document.querySelector("#searchInput").addEventListener("input", (event) => {
    uiState.query = event.target.value;
    renderCandidateList();
    renderCandidateProfile();
  });

  document.querySelector(".segmented").addEventListener("click", (event) => {
    const button = event.target.closest("[data-status]");
    if (!button) return;
    uiState.statusFilter = button.dataset.status;
    document.querySelectorAll(".segmented button").forEach((item) => item.classList.toggle("active", item === button));
    renderCandidateList();
    renderCandidateProfile();
  });

  document.querySelector("#profileTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-profile-tab]");
    if (!button) return;
    uiState.profileExpanded = true;
    uiState.profileTab = button.dataset.profileTab;
    renderProfileTabs();
    renderCandidateProfile();
  });

  document.querySelector("#bottomTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-bottom-tab]");
    if (!button) return;
    uiState.bottomTab = button.dataset.bottomTab;
    document.querySelectorAll("#bottomTabs button").forEach((item) => item.classList.toggle("active", item === button));
    renderLowerPanel();
  });

  document.body.addEventListener("click", (event) => {
    const schedule = event.target.closest("[data-schedule]");
    const advance = event.target.closest("[data-advance]");
    const setStatus = event.target.closest("[data-set-status]");
    const close = event.target.closest("[data-close]");
    const anchor = event.target.closest("[data-admin-anchor]");
    const opener = event.target.closest("[data-admin-open]");
    const roleOpener = event.target.closest("[data-admin-role-open]");
    const detailOpener = event.target.closest("[data-view-candidate-detail]");

    if (schedule) openAuditionDialog(schedule.dataset.schedule);
    if (advance) advanceCandidate(advance.dataset.advance);
    if (setStatus) setCandidateStatus(setStatus.dataset.candidateId, setStatus.dataset.setStatus);
    if (close) document.querySelector(`#${close.dataset.close}`).close();
    if (opener) setAdminView(opener.dataset.adminOpen);
    if (roleOpener) {
      uiState.selectedRole = roleOpener.dataset.adminRoleOpen;
      uiState.selectedCandidate = store.candidates.find((item) => item.roleId === uiState.selectedRole)?.id;
      uiState.profileExpanded = false;
      renderAdmin();
      setAdminView("workspace");
    }
    if (detailOpener) {
      uiState.selectedCandidate = detailOpener.dataset.viewCandidateDetail;
      uiState.profileExpanded = true;
      renderProfileTabs();
      renderCandidateProfile();
    }
    if (anchor) {
      const target = anchor.dataset.adminAnchor === "overview" ? "overview" : anchor.dataset.adminAnchor;
      setAdminView(target);
    }
  });

  document.querySelector("#newCandidateBtn").addEventListener("click", () => {
    document.querySelector("#candidateForm").reset();
    document.querySelector("#candidateDialog").showModal();
  });

  document.querySelector("#candidateForm").addEventListener("submit", handleNewCandidate);
  document.querySelector("#auditionForm").addEventListener("submit", handleNewAudition);
  document.querySelector("#addCombinationBtn").addEventListener("click", addCombinationTest);
  document.querySelector("#addCastPlanBtn").addEventListener("click", addCastPlan);
  document.querySelector("#exportBtn").addEventListener("click", exportShortlistCsv);
}

function openAuditionDialog(candidateId) {
  const candidate = candidateById(candidateId);
  const talent = talentById(candidate.talentId);
  const role = roleById(candidate.roleId);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const form = document.querySelector("#auditionForm");
  form.candidateId.value = candidate.id;
  form.date.value = tomorrow.toISOString().slice(0, 10);
  form.time.value = "10:00";
  form.type.value = "现场试镜";
  form.location.value = "A 棚";
  form.requirement.value = role.auditionFocus.join("、");
  document.querySelector("#auditionTarget").innerHTML = `<strong>${escapeHtml(talent.name)}</strong> 将试镜 <strong>${escapeHtml(role.name)}</strong><br />${escapeHtml(talent.scheduleStatus)}`;
  document.querySelector("#auditionDialog").showModal();
}

function advanceCandidate(candidateId) {
  const candidate = candidateById(candidateId);
  if (!candidate) return;
  const flow = seed.candidateStatusFlow || [];
  const index = flow.indexOf(candidate.status);
  if (index >= 0 && index < flow.length - 1) {
    candidate.status = flow[index + 1];
  } else if (!["已定", "备用", "淘汰"].includes(candidate.status)) {
    candidate.status = "初筛";
  }
  addTimeline(candidate, `候选状态推进为「${candidate.status}」。`, "选角导演组");
  saveStore();
  renderAdmin();
}

function setCandidateStatus(candidateId, status) {
  const candidate = candidateById(candidateId);
  if (!candidate) return;
  candidate.status = status;
  addTimeline(candidate, `候选状态被设置为「${status}」。`, "选角导演组");
  saveStore();
  renderAdmin();
}

function addTimeline(candidate, text, actor) {
  store.timelineEvents.unshift({
    id: `t-${Date.now()}`,
    projectId: candidate.projectId,
    roleId: candidate.roleId,
    talentId: candidate.talentId,
    text,
    at: new Date().toLocaleString("zh-CN", { hour12: false }),
    actor,
  });
}

function handleNewCandidate(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const tags = String(form.get("tags") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const talentId = `talent-${Date.now()}`;
  const candidateId = `candidate-${Date.now()}`;
  const talent = {
    id: talentId,
    name: String(form.get("name")),
    gender: "",
    age: Number(form.get("age")),
    perceivedAge: "待评估",
    height: "",
    hometown: "",
    city: String(form.get("city")),
    agency: String(form.get("agency")),
    agentName: "待补充",
    contact: "待补充",
    education: "待补充",
    scheduleStatus: "待确认",
    feeRange: "待确认",
    profileCompletion: 28,
    auditStatus: "资料待完善",
    riskLevel: "low",
    portrait: "assets/portrait-new.png",
    tags: tags.length ? tags : ["待评估"],
    skills: [],
    dialects: [],
    works: ["待补充代表作品"],
    materials: [],
    note: "新建档案，建议补充表演片段、档期和经纪联系人。",
  };
  const candidate = {
    id: candidateId,
    projectId: "jianghe",
    roleId: uiState.selectedRole,
    talentId,
    source: "manual",
    recommendationType: "newcomer",
    totalScore: 72,
    scores: { temperament: 72, ageFit: 70, acting: 68, realism: 74, relationshipFit: 66, schedule: 60, market: 50, risk: 22 },
    fitReason: "人工新增候选，需补充资料后进入正式初筛。",
    riskReason: "资料不完整，档期和素材待确认。",
    evidence: ["新建档案"],
    status: "初筛",
    internalNotes: "补齐素材后再安排初试。",
    directorOpinion: "待看",
    producerOpinion: "待看",
    castingOpinion: "资料待完善。",
  };
  store.talents.unshift(talent);
  store.candidates.unshift(candidate);
  addTimeline(candidate, "新增候选并加入候选池。", "选角导演组");
  uiState.selectedCandidate = candidateId;
  saveStore();
  document.querySelector("#candidateDialog").close();
  renderAdmin();
}

function handleNewAudition(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const candidate = candidateById(String(form.get("candidateId")));
  if (!candidate) return;
  const audition = {
    id: `a-${Date.now()}`,
    projectId: candidate.projectId,
    roleId: candidate.roleId,
    talentId: candidate.talentId,
    candidateId: candidate.id,
    type: String(form.get("type")),
    script: `${roleById(candidate.roleId).name}试镜片段`,
    requirement: String(form.get("requirement")),
    deadline: `${form.get("date")}T${form.get("time")}`,
    location: String(form.get("location")),
    status: "已邀请",
    videoUrl: "",
    submittedAt: "",
  };
  store.auditions.push(audition);
  candidate.status = "待试镜";
  addTimeline(candidate, `已安排${audition.type}：${audition.deadline}。`, "试镜统筹");
  saveStore();
  document.querySelector("#auditionDialog").close();
  renderAdmin();
}

function addCombinationTest() {
  const roleCandidates = store.candidates.filter((item) => ["复试", "待评价", "待导演确认", "已提交"].includes(item.status));
  const first = roleCandidates[0] || store.candidates[0];
  const second = roleCandidates.find((item) => item.roleId !== first.roleId) || store.candidates[1];
  if (!first || !second) return;
  store.combinationTests.unshift({
    id: `ct-${Date.now()}`,
    projectId: "jianghe",
    relationshipType: "主线关系",
    roleIds: [first.roleId, second.roleId],
    talentIds: [first.talentId, second.talentId],
    testScene: "项目组新增组合试戏片段",
    videoUrl: "待上传",
    scores: { credibility: 78, tension: 80, intimacy: 68, pressure: 76, realism: 82, conflict: 74, balance: 77, rhythm: 79 },
    conclusion: "待导演确认",
    notes: "新增组合测试，等待视频素材。",
  });
  saveStore();
  renderAdmin();
}

function addCastPlan() {
  const selectedCast = store.roles.map((role) => {
    const candidate = [...store.candidates].filter((item) => item.roleId === role.id).sort((a, b) => b.totalScore - a.totalScore)[0];
    return { roleId: role.id, talentId: candidate?.talentId || store.talents[0]?.id };
  });
  store.castPlans.unshift({
    id: `cp-${Date.now()}`,
    projectId: "jianghe",
    name: `方案${String.fromCharCode(65 + store.castPlans.length)}：自动草案`,
    type: "director_preference",
    cast: selectedCast,
    budgetEstimate: "待估",
    scheduleFeasibility: 76,
    styleConsistency: 82,
    relationshipScore: 78,
    marketValue: "待评估",
    biggestRisk: "需补组合测试和档期确认",
    backupPlan: "按候选池第二顺位替换",
    recommendation: "作为导演讨论草案。",
  });
  saveStore();
  renderAdmin();
}

function exportShortlistCsv() {
  const role = roleById(uiState.selectedRole);
  const rows = [["角色", "演员", "状态", "适配分", "推荐理由", "风险理由"]];
  filteredCandidates().forEach((candidate) => {
    const talent = talentById(candidate.talentId);
    rows.push([role.name, talent.name, candidate.status, candidate.totalScore, candidate.fitReason, candidate.riskReason]);
  });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${role.name}-候选短名单.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function initPortal(kind) {
  refreshPortal(kind);

  document.querySelectorAll("[data-portal-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-portal-tab]").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".portal-section").forEach((section) => section.classList.toggle("active", section.id === button.dataset.portalTab));
    });
  });

  document.body.addEventListener("click", (event) => {
    const submit = event.target.closest("[data-submit-audition]");
    const accept = event.target.closest("[data-accept-audition]");
    if (submit) externalSubmitAudition(submit.dataset.submitAudition, kind);
    if (accept) externalAcceptAudition(accept.dataset.acceptAudition, kind);
  });
}

function refreshPortal(kind) {
  if (kind === "actor") renderActorPortal();
  if (kind === "agent") renderAgentPortal();
}

function renderActorPortal() {
  const talent = talentById("luo-qingxian");
  const tasks = store.auditions.filter((item) => item.talentId === talent.id);
  document.querySelector("#actorPortal").innerHTML = `
    <section class="portal-section active" id="actorHome">
      <div class="stats-grid">${makeStat("资料完整度", `${talent.profileCompletion}%`, "照片、视频、档期和联系方式综合计算")}${makeStat("待提交试镜", tasks.filter((item) => item.status !== "已提交").length, "只展示自己的任务")}${makeStat("已提交试镜", tasks.filter((item) => item.status === "已提交").length, "后台判断不可见")}${makeStat("档期状态", talent.scheduleStatus, "可随时更新")}</div>
      <div class="portal-grid">${renderActorAuditions(tasks)}${renderActorProfileCard(talent)}</div>
    </section>
    <section class="portal-section" id="actorProfile">${renderActorProfileCard(talent)}</section>
    <section class="portal-section" id="actorPhotos">${renderUploadGrid(["头像照", "半身照", "全身照", "生活照", "定妆照", "无妆照", "古装照", "现代装照"])}</section>
    <section class="portal-section" id="actorVideos">${renderUploadGrid(["自我介绍", "表演片段", "生活流片段", "情绪戏片段", "台词片段", "动作片段", "方言片段", "试镜视频"])}</section>
    <section class="portal-section" id="actorWorks">${renderWorksBlock(talent)}</section>
    <section class="portal-section" id="actorSkills">${renderSkillsBlock(talent)}</section>
    <section class="portal-section" id="actorSchedule">${renderScheduleForm(talent)}</section>
    <section class="portal-section" id="actorAuditions">${renderActorAuditions(tasks)}</section>
    <section class="portal-section" id="actorSubmissions">${renderSubmissionList(tasks)}</section>
    <section class="portal-section" id="actorAuth">${renderAuthorizationBlock()}</section>
  `;
}

function renderActorProfileCard(talent) {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">My Profile</p><h3>我的档案</h3></div><span class="tag green">${talent.auditStatus}</span></div>
      <div class="profile-panel">
        <div class="profile-hero">
          <span class="portrait"><img src="${escapeHtml(talent.portrait)}" alt="${escapeHtml(talent.name)}档案照" /></span>
          <div>
            <h4>${escapeHtml(talent.name)}</h4>
            <p class="profile-meta">${talent.age}岁 · ${escapeHtml(talent.city)} · ${escapeHtml(talent.agency)}<br />经纪人：${escapeHtml(talent.agentName)} · ${escapeHtml(talent.contact)}</p>
            <div class="tag-row">${talent.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          </div>
        </div>
        <dl class="detail-list">
          <div><dt>年龄感</dt><dd>${escapeHtml(talent.perceivedAge)}</dd></div>
          <div><dt>毕业院校</dt><dd>${escapeHtml(talent.education)}</dd></div>
          <div><dt>可进组时间</dt><dd>${escapeHtml(talent.scheduleStatus)}</dd></div>
          <div><dt>普通话 / 方言</dt><dd>${talent.dialects.map(escapeHtml).join("、")}</dd></div>
        </dl>
      </div>
    </section>
  `;
}

function renderActorAuditions(tasks) {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Audition Tasks</p><h3>试镜任务</h3></div></div>
      <div class="task-list">
        ${tasks.map((task) => {
          const role = roleById(task.roleId);
          const project = projectById(task.projectId);
          return `
            <article class="task-card">
              <div>
                <h4>${escapeHtml(project.title)} · ${escapeHtml(role.name)}</h4>
                <p>${escapeHtml(role.ageRange)} · ${escapeHtml(role.tone)}</p>
                <small>片段：${escapeHtml(task.script)} · 要求：${escapeHtml(task.requirement)} · 截止：${escapeHtml(task.deadline)}</small>
              </div>
              <div class="task-actions">
                <span class="tag ${candidateStatusClass(task.status)}">${escapeHtml(task.status)}</span>
                <button class="ghost-button small-action" type="button" data-accept-audition="${task.id}">确认档期</button>
                <button class="primary-button small-action" type="button" data-submit-audition="${task.id}">提交视频</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderUploadGrid(items) {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Materials</p><h3>资料上传</h3></div><span class="tag">演示占位</span></div>
      <div class="upload-grid">
        ${items.map((item, index) => `<article class="upload-card"><strong>${escapeHtml(item)}</strong><small>${index < 3 ? "已上传示例" : "待上传"}</small><button class="ghost-button small-action" type="button">选择文件</button></article>`).join("")}
      </div>
    </section>
  `;
}

function renderWorksBlock(talent) {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Works</p><h3>作品经历</h3></div></div>
      <ul class="credit-list">${talent.works.map((work) => `<li><span>${escapeHtml(work)}</span><small>可编辑</small></li>`).join("")}</ul>
    </section>
  `;
}

function renderSkillsBlock(talent) {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Skills</p><h3>技能与方言</h3></div></div>
      <div class="profile-panel">
        <div class="tag-row">${talent.skills.concat(talent.dialects).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
      </div>
    </section>
  `;
}

function renderScheduleForm(talent) {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Schedule</p><h3>档期管理</h3></div></div>
      <div class="profile-panel">
        <dl class="detail-list">
          <div><dt>当前是否有档期</dt><dd>有档期，可协调</dd></div>
          <div><dt>可进组日期</dt><dd>${escapeHtml(talent.scheduleStatus)}</dd></div>
          <div><dt>可拍摄城市</dt><dd>北京、山东、江苏</dd></div>
          <div><dt>长期驻组</dt><dd>可接受 90 天以内驻组</dd></div>
        </dl>
      </div>
    </section>
  `;
}

function renderSubmissionList(tasks) {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Submissions</p><h3>提交记录</h3></div></div>
      <div class="schedule-list">${tasks.map(renderAuditionItem).join("")}</div>
    </section>
  `;
}

function renderAuthorizationBlock() {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Authorization</p><h3>授权管理</h3></div></div>
      <div class="profile-panel">
        <p class="permission-note">当前授权：允许正午阳光选角团队在项目选角期内查看个人资料、试镜视频和档期信息。演员端只保留任务、提交和授权相关信息。</p>
        <div class="material-grid">
          <div class="material-item done"><span class="material-dot">✓</span>资料查看授权</div>
          <div class="material-item done"><span class="material-dot">✓</span>视频查看授权</div>
          <div class="material-item"><span class="material-dot"></span>AI 标签辅助授权</div>
          <div class="material-item"><span class="material-dot"></span>长期人才库授权</div>
        </div>
      </div>
    </section>
  `;
}

function renderAgentPortal() {
  const agent = store.users.find((item) => item.role === "agent");
  const talents = store.talents.filter((talent) => agent.talentIds.includes(talent.id));
  const tasks = store.auditions.filter((item) => agent.talentIds.includes(item.talentId));
  document.querySelector("#agentPortal").innerHTML = `
    <section class="portal-section active" id="agentHome">
      <div class="stats-grid">${makeStat("旗下演员", talents.length, "当前演示账号")}${makeStat("资料未完善", talents.filter((item) => item.profileCompletion < 90).length, "低于90%需补充")}${makeStat("待回复邀约", tasks.filter((item) => item.status === "已邀请").length, "需确认档期")}${makeStat("待提交试镜", tasks.filter((item) => item.status !== "已提交").length, "不展示后台判断")}</div>
      <div class="portal-grid">${renderAgentTalents(talents)}${renderAgentInvitations(tasks)}</div>
    </section>
    <section class="portal-section" id="agentTalents">${renderAgentTalents(talents)}</section>
    <section class="portal-section" id="agentCompletion">${renderAgentCompletion(talents)}</section>
    <section class="portal-section" id="agentInvitations">${renderAgentInvitations(tasks)}</section>
    <section class="portal-section" id="agentAuditions">${renderAgentInvitations(tasks)}</section>
    <section class="portal-section" id="agentSchedules">${renderAgentSchedules(talents)}</section>
    <section class="portal-section" id="agentSubmissions">${renderSubmissionList(tasks)}</section>
    <section class="portal-section" id="agentMessages">${renderAgentMessages()}</section>
  `;
}

function renderAgentTalents(talents) {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Managed Talents</p><h3>旗下演员</h3></div><button class="ghost-button" type="button">添加演员</button></div>
      <div class="table-like">
        <div class="table-row table-head"><span>演员</span><span>城市</span><span>资料</span><span>档期</span><span>操作</span></div>
        ${talents.map((talent) => `
          <div class="table-row">
            <span>${escapeHtml(talent.name)}</span>
            <span>${escapeHtml(talent.city)}</span>
            <span>${talent.profileCompletion}%</span>
            <span>${escapeHtml(talent.scheduleStatus)}</span>
            <span><button class="ghost-button small-action" type="button">编辑资料</button></span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAgentCompletion(talents) {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Completion</p><h3>资料完整度</h3></div></div>
      <div class="profile-panel">
        ${talents.map((talent) => `
          <div class="fit-row">
            <span>${escapeHtml(talent.name)}</span>
            <span class="meter"><span style="width: ${talent.profileCompletion}%"></span></span>
            <strong>${talent.profileCompletion}%</strong>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAgentInvitations(tasks) {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Invitations</p><h3>项目邀约 / 试镜任务</h3></div></div>
      <div class="task-list">
        ${tasks.map((task) => {
          const talent = talentById(task.talentId);
          const role = roleById(task.roleId);
          const project = projectById(task.projectId);
          return `
            <article class="task-card">
              <div>
                <h4>${escapeHtml(talent.name)} · ${escapeHtml(project.title)} · ${escapeHtml(role.name)}</h4>
                <p>${escapeHtml(task.type)} · ${escapeHtml(task.requirement)}</p>
                <small>截止：${escapeHtml(task.deadline)} · 地点：${escapeHtml(task.location)}</small>
              </div>
              <div class="task-actions">
                <span class="tag ${candidateStatusClass(task.status)}">${escapeHtml(task.status)}</span>
                <button class="ghost-button small-action" type="button" data-accept-audition="${task.id}">接受邀约</button>
                <button class="primary-button small-action" type="button" data-submit-audition="${task.id}">代提交</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderAgentSchedules(talents) {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Schedules</p><h3>档期管理</h3></div></div>
      <div class="table-like">
        <div class="table-row table-head"><span>演员</span><span>当前档期</span><span>可拍摄城市</span><span>状态</span></div>
        ${talents.map((talent) => `<div class="table-row"><span>${escapeHtml(talent.name)}</span><span>${escapeHtml(talent.scheduleStatus)}</span><span>北京 / 山东 / 江苏</span><span><span class="tag green">可协调</span></span></div>`).join("")}
      </div>
    </section>
  `;
}

function renderAgentMessages() {
  return `
    <section class="work-module">
      <div class="module-heading"><div><p class="eyebrow">Messages</p><h3>沟通消息</h3></div></div>
      <div class="timeline">
        <article class="timeline-item"><strong>请确认罗清弦 5月28日复试档期。</strong><small>试镜统筹 · 今日 10:20</small></article>
        <article class="timeline-item"><strong>梁玥档期已进入锁定，等待导演最终确认。</strong><small>制片中心 · 昨日 18:40</small></article>
      </div>
    </section>
  `;
}

function externalAcceptAudition(auditionId, kind) {
  const audition = store.auditions.find((item) => item.id === auditionId);
  if (!audition) return;
  audition.status = "已接受";
  const candidate = candidateById(audition.candidateId);
  if (candidate) addTimeline(candidate, `${kind === "agent" ? "经纪端" : "演员端"}确认试镜邀约。`, kind === "agent" ? "经纪端" : "演员端");
  saveStore();
  refreshPortal(kind);
}

function externalSubmitAudition(auditionId, kind) {
  const audition = store.auditions.find((item) => item.id === auditionId);
  if (!audition) return;
  audition.status = "已提交";
  audition.videoUrl = "已上传";
  audition.submittedAt = new Date().toISOString();
  const candidate = candidateById(audition.candidateId);
  if (candidate) {
    candidate.status = "已提交";
    addTimeline(candidate, `${kind === "agent" ? "经纪端代提交" : "演员端提交"}试镜视频。`, kind === "agent" ? "经纪端" : "演员端");
  }
  saveStore();
  refreshPortal(kind);
}

if (page === "login") initLogin();
if (page === "admin") initAdmin();
if (page === "actor") initPortal("actor");
if (page === "agent") initPortal("agent");

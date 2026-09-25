/**
 * 平台大廳核心互動邏輯 (Portal Logic)
 */
document.addEventListener("DOMContentLoaded", () => {
  const gamesGrid = document.getElementById("gamesGrid");
  const searchInput = document.getElementById("searchInput");
  const filterTabs = document.querySelectorAll(".filter-tab");
  const gameCountLabel = document.getElementById("gameCount");

  let currentCategory = "all";
  let searchQuery = "";

  // 渲染所有遊戲卡片
  function renderGames() {
    if (!gamesGrid || !Array.isArray(GAMES_DATA)) return;

    // 依據分類與關鍵字篩選
    const filteredGames = GAMES_DATA.filter(game => {
      const matchCategory = (currentCategory === "all") || (game.category === currentCategory);
      const queryLower = searchQuery.toLowerCase().trim();
      const matchSearch = !queryLower || 
        game.title.toLowerCase().includes(queryLower) ||
        game.subtitle.toLowerCase().includes(queryLower) ||
        game.description.toLowerCase().includes(queryLower) ||
        game.tags.some(t => t.toLowerCase().includes(queryLower));
      return matchCategory && matchSearch;
    });

    // 更新計數
    if (gameCountLabel) {
      gameCountLabel.textContent = `共展示 ${filteredGames.length} 款遊戲`;
    }

    // 查無資料時的友善提示
    if (filteredGames.length === 0) {
      gamesGrid.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">🛸</div>
          <h3>未找到相關遊戲</h3>
          <p>請嘗試更換分類或清除搜尋關鍵字重新尋找。</p>
        </div>
      `;
      return;
    }

    // 組合 HTML 卡片
    gamesGrid.innerHTML = filteredGames.map(game => {
      const isPlayable = game.status === "playable";
      const badgeClass = isPlayable ? "badge-playable" : "badge-coming";
      const btnClass = isPlayable ? "active-play" : "disabled-play";
      const btnText = isPlayable ? "立即遊玩 ➔" : "開發中";
      const playHref = isPlayable ? game.path : "javascript:void(0);";

      const tagsHtml = game.tags.map(tag => `<span class="tag-item">#${tag}</span>`).join("");

      return `
        <article class="game-card" data-id="${game.id}">
          <div class="card-header-thumb" style="background: ${game.thumbnailGradient};">
            <span class="card-thumb-icon">${game.icon}</span>
            <span class="card-badge ${badgeClass}">${game.badge}</span>
          </div>
          <div class="card-body">
            <div class="card-category">${game.categoryName}</div>
            <h3 class="card-title">${game.title}</h3>
            <div class="card-subtitle">${game.subtitle}</div>
            <p class="card-desc">${game.description}</p>
            <div class="card-tags">
              ${tagsHtml}
            </div>
            <div class="card-footer">
              <span class="card-meta">${game.version}</span>
              <a href="${playHref}" class="btn-card ${btnClass}">${btnText}</a>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  // 分類標籤點擊事件
  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      filterTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentCategory = tab.dataset.category || "all";
      renderGames();
    });
  });

  // 搜尋欄位即時監聽
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderGames();
    });
  }

  // 遊玩指南彈窗開關
  const guideModal = document.getElementById("guideModal");
  const btnOpenGuide = document.getElementById("btnOpenGuide");
  const btnCloseGuide = document.getElementById("btnCloseGuide");

  if (btnOpenGuide && guideModal) {
    btnOpenGuide.addEventListener("click", () => {
      guideModal.classList.add("active");
    });
  }

  if (btnCloseGuide && guideModal) {
    btnCloseGuide.addEventListener("click", () => {
      guideModal.classList.remove("active");
    });
  }

  if (guideModal) {
    guideModal.addEventListener("click", (e) => {
      if (e.target === guideModal) {
        guideModal.classList.remove("active");
      }
    });
  }

  // 初次渲染
  renderGames();
});

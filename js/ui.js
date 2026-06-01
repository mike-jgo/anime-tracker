/* ============================================
   ui.js — rendering cards, genre pills, modal
   ============================================ */

const UI = (() => {
  const grid = document.getElementById("animeGrid");
  const emptyState = document.getElementById("emptyState");
  const genreFilter = document.getElementById("genreFilter");
  const drawerGenreFilter = document.getElementById("drawerGenreFilter");
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modalBody");
  let modalRequest = 0;
  let modalTrigger = null;

  // ---- title language: "romaji" (default) | "english" ----
  let titleLang = "romaji";
  function setTitleLang(lang) { titleLang = lang; }

  // pick the right title, falling back gracefully
  function getTitle(anime) {
    if (titleLang === "english") {
      return anime.title_english || anime.title || "Untitled";
    }
    return anime.title || anime.title_english || "Untitled";
  }

  function getEpisodeLabel(anime) {
    if (Number.isInteger(anime.airedEpisodes)) {
      return anime.episodes
        ? `${anime.airedEpisodes}/${anime.episodes} ep`
        : `${anime.airedEpisodes} ep`;
    }
    return anime.episodes ? `${anime.episodes} ep` : "TBA";
  }

  function getStatusLabel(status) {
    return {
      watching: "Watching",
      completed: "Completed",
      planned: "Plan to Watch",
    }[status] || "Not tracked";
  }

  function formatEpisodeDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  async function loadEpisodes(id, request) {
    const list = document.getElementById("episodeList");
    if (!list) return;

    try {
      const { episodes, total, truncated } = await API.getAnimeEpisodes(id);
      if (request !== modalRequest || modal.hidden) return;

      const count = document.getElementById("episodeCount");
      if (count) count.textContent = `${total} aired`;

      if (!episodes.length) {
        list.innerHTML = `<p class="modal__episodes-note">No aired episodes listed yet.</p>`;
        return;
      }

      const note = truncated
        ? `<p class="modal__episodes-note">Showing the first ${episodes.length} episodes to keep loading light.</p>`
        : "";
      const items = episodes.map((episode) => {
        const date = formatEpisodeDate(episode.aired);
        const flags = [
          episode.filler ? "Filler" : "",
          episode.recap ? "Recap" : "",
        ].filter(Boolean).join(" · ");

        return `
          <li class="episode-list__item">
            <span class="episode-list__number">EP ${episode.mal_id}</span>
            <div>
              <p class="episode-list__title">${escapeHtml(episode.title || "Untitled episode")}</p>
              ${flags ? `<p class="episode-list__flags">${flags}</p>` : ""}
            </div>
            ${date ? `<time class="episode-list__date" datetime="${escapeHtml(episode.aired)}">${date}</time>` : ""}
          </li>
        `;
      }).join("");

      list.innerHTML = `${note}<ol class="episode-list">${items}</ol>`;
    } catch (err) {
      if (request === modalRequest && !modal.hidden) {
        list.innerHTML = `<p class="modal__episodes-note">Couldn't load episodes.</p>`;
      }
    }
  }

  // ---- skeleton loaders while fetching ----
  function renderSkeletons(count = 12) {
    grid.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const sk = document.createElement("div");
      sk.className = "card skeleton";
      sk.innerHTML = `<div class="card__img-wrap skeleton__box"></div>
                      <div class="card__body">
                        <div class="skeleton__line"></div>
                        <div class="skeleton__line skeleton__line--short"></div>
                      </div>`;
      grid.appendChild(sk);
    }
  }

  // ---- anime cards ----
  function renderCards(list) {
    grid.innerHTML = "";
    emptyState.hidden = list.length > 0;

    list.forEach((anime, i) => {
      const card = document.createElement("article");
      card.className = "card";
      card.style.animationDelay = `${i * 0.03}s`;

      const status = Store.getStatus(anime.mal_id);
      if (status) card.dataset.status = status;

      const score = anime.score ? anime.score.toFixed(1) : "—";
      const eps = getEpisodeLabel(anime);
      const img = safeUrl(anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url);
      const title = getTitle(anime);
      const statusLabel = getStatusLabel(status);

      card.dataset.animeId = anime.mal_id;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.innerHTML = `
        <div class="card__img-wrap">
          <img class="card__img" src="${escapeHtml(img)}" alt="${escapeHtml(title)}" loading="lazy" />
          <span class="card__badge card__badge--score">★ ${score}</span>
          <span class="card__badge card__badge--eps">${eps}</span>
        </div>
        <div class="card__body">
          <h3 class="card__title">${escapeHtml(title)}</h3>
          <div class="card__compact-meta">
            <span>★ ${score}</span>
            <span class="card__compact-eps">${eps}</span>
          </div>
          <p class="card__status${status ? " is-tracked" : ""}">${statusLabel}</p>
        </div>
      `;

      card.addEventListener("click", () => openModal(anime.mal_id));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(anime.mal_id);
        }
      });
      grid.appendChild(card);
    });
  }

  function updateEpisodeBadge(anime) {
    const badge = grid.querySelector(`.card[data-anime-id="${anime.mal_id}"] .card__badge--eps`);
    if (badge) badge.textContent = getEpisodeLabel(anime);
    const compactEpisode = grid.querySelector(`.card[data-anime-id="${anime.mal_id}"] .card__compact-eps`);
    if (compactEpisode) compactEpisode.textContent = getEpisodeLabel(anime);
  }

  // ---- genre pills ----
  function renderGenreGroup(target, genres, activeGenre, onSelect) {
    target.innerHTML = "";
    const all = document.createElement("button");
    all.className = "pill" + (!activeGenre ? " is-active" : "");
    all.textContent = "All";
    all.addEventListener("click", () => onSelect(null));
    target.appendChild(all);

    genres.forEach((g) => {
      const pill = document.createElement("button");
      pill.className = "pill" + (activeGenre === g ? " is-active" : "");
      pill.textContent = g;
      pill.addEventListener("click", () => onSelect(g));
      target.appendChild(pill);
    });
  }

  function renderGenres(genres, activeGenre, onSelect) {
    renderGenreGroup(genreFilter, genres, activeGenre, onSelect);
    renderGenreGroup(drawerGenreFilter, genres, activeGenre, onSelect);
  }

  // ---- modal ----
  async function openModal(id) {
    const request = ++modalRequest;
    modalTrigger = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modalBody.innerHTML = `<p class="modal__loading">Loading…</p>`;
    const closeBtn = modal.querySelector(".modal__close");
    if (closeBtn && typeof closeBtn.focus === "function") closeBtn.focus();

    try {
      const a = await API.getAnime(id);
      if (request !== modalRequest || modal.hidden) return;
      const img = safeUrl(a.images?.jpg?.large_image_url);
      const genres = (a.genres || []).map((g) => g.name).join(", ") || "—";
      const studio = (a.studios || []).map((s) => s.name).join(", ") || "Unknown";
      const trailer = safeUrl(a.trailer?.url);
      const status = Store.getStatus(id);

      const primaryTitle = getTitle(a);
      // show the "other" title as subtitle when it exists and differs
      const otherTitle = titleLang === "english"
        ? a.title            // show romaji underneath English
        : a.title_english;   // show English underneath romaji
      const subtitle = otherTitle && otherTitle !== primaryTitle ? otherTitle : a.title_japanese;

      modalBody.innerHTML = `
        <div class="modal__hero" id="modalHero"></div>
        <div class="modal__content">
          <h2 id="modalTitle" class="modal__title">${escapeHtml(primaryTitle)}</h2>
          ${subtitle ? `<p class="modal__subtitle">${escapeHtml(subtitle)}</p>` : ""}
          <div class="modal__meta">
            <span>★ ${a.score ? a.score.toFixed(1) : "—"}</span>
            <span>${a.episodes ? a.episodes + " episodes" : "Episodes TBA"}</span>
            <span>${a.year || a.status || ""}</span>
          </div>
          <p class="modal__synopsis">${escapeHtml(a.synopsis || "No synopsis available.")}</p>
          <p class="modal__studio"><strong>Studio:</strong> ${escapeHtml(studio)}</p>
          <p class="modal__genres"><strong>Genres:</strong> ${escapeHtml(genres)}</p>
          <div class="modal__actions">
            <select class="modal__status" id="statusSelect">
              <option value="">Add to list…</option>
              <option value="watching"  ${status === "watching" ? "selected" : ""}>Watching</option>
              <option value="completed" ${status === "completed" ? "selected" : ""}>Completed</option>
              <option value="planned"   ${status === "planned" ? "selected" : ""}>Plan to Watch</option>
            </select>
            ${trailer ? `<a class="modal__trailer" href="${escapeHtml(trailer)}" target="_blank" rel="noopener">▶ Trailer</a>` : ""}
          </div>
          <section class="modal__episodes" aria-labelledby="episodeListTitle">
            <div class="modal__episodes-heading">
              <h3 class="modal__episodes-title" id="episodeListTitle">Episodes</h3>
              <span class="modal__episodes-count" id="episodeCount">Loading…</span>
            </div>
            <div id="episodeList">
              <p class="modal__episodes-note">Loading episodes…</p>
            </div>
          </section>
        </div>
      `;

      const hero = document.getElementById("modalHero");
      if (hero && img) hero.style.backgroundImage = `url("${img}")`;

      document.getElementById("statusSelect").addEventListener("change", (e) => {
        Store.setStatus(id, e.target.value || null);
        document.dispatchEvent(new CustomEvent("statusChanged"));
      });
      loadEpisodes(id, request);
    } catch (err) {
      if (request === modalRequest && !modal.hidden) {
        modalBody.innerHTML = `<p class="modal__loading">Couldn't load details. Try again.</p>`;
      }
    }
  }

  function closeModal() {
    modalRequest++;
    modal.hidden = true;
    document.body.style.overflow = "";
    if (modalTrigger && typeof modalTrigger.focus === "function") modalTrigger.focus();
  }

  function keepModalFocus(e) {
    if (e.key !== "Tab" || modal.hidden) return;
    const focusable = [...modal.querySelectorAll("button:not([disabled]), select:not([disabled]), a[href]")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // wire up modal close
  modal.addEventListener("click", (e) => {
    if (e.target.dataset.close !== undefined) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
    keepModalFocus(e);
  });

  // only allow http(s) URLs through to src/href/background — blocks javascript: etc.
  function safeUrl(url) {
    return /^https?:\/\//i.test(url || "") ? url : "";
  }

  // tiny xss guard for titles/synopsis
  function escapeHtml(str = "") {
    return str.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  return { renderSkeletons, renderCards, renderGenres, openModal, closeModal, setTitleLang, updateEpisodeBadge };
})();

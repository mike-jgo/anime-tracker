/* ============================================
api.js — Jikan API v4 calls
Docs: https://docs.api.jikan.moe/
No API key required.
============================================ */

const API = (() => {
const BASE = "https://api.jikan.moe/v4";
const episodePageCache = new Map();

// fetch JSON, retrying once on a 429 while honouring Retry-After
async function fetchJson(url) {
    let res = await fetch(url);
    if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After")) || 1;
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        res = await fetch(url);
    }
    if (!res.ok) throw new Error(`Jikan error ${res.status}`);
    return res.json();
}

async function get(path) {
    const json = await fetchJson(`${BASE}${path}`);
    return json.data;
}

function getEpisodePage(id, page = 1) {
    const key = `${id}:${page}`;

    if (!episodePageCache.has(key)) {
        const request = fetchJson(`${BASE}/anime/${id}/episodes?page=${page}`)
            .catch((err) => {
                episodePageCache.delete(key);
                throw err;
            });
        episodePageCache.set(key, request);
    }

    return episodePageCache.get(key);
}

async function getEpisodeCount(id, firstPage) {
    const total = firstPage.pagination?.items?.total;
    const lastPage = firstPage.pagination?.last_visible_page || 1;
    if (Number.isInteger(total) || lastPage === 1) {
        return total ?? firstPage.data.length;
    }

    // Fallback when items.total is missing: assumes every page but the last is
    // full, which holds for Jikan's fixed 100-episodes-per-page responses.
    const finalPage = await getEpisodePage(id, lastPage);
    return (lastPage - 1) * firstPage.data.length + finalPage.data.length;
}

async function getAiredEpisodeCount(id) {
    const firstPage = await getEpisodePage(id);
    return getEpisodeCount(id, firstPage);
}

async function getAnimeEpisodes(id) {
    const firstPage = await getEpisodePage(id);
    const total = await getEpisodeCount(id, firstPage);
    return {
        episodes: firstPage.data,
        total,
        truncated: total > firstPage.data.length,
    };
}

return {
    getCurrentSeason: () => get("/seasons/now"),
    getUpcoming: () => get("/seasons/upcoming"),
    getAiredEpisodeCount,
    getAnimeEpisodes,

    // full details for one anime 
    getAnime: (id) => get(`/anime/${id}/full`),
};
})();

// OSS Opportunity Radar — 前端逻辑（无构建步骤，数据驱动）
"use strict";

var DATA_URL = "data/opportunities.json";
var SAVED_KEY = "or_saved_v1";

function $(id) { return document.getElementById(id); }

var state = {
  data: null,
  topic: null,
  search: "",
  sort: "score",
  minScore: 0,
  savedOnly: false,
  saved: new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"))
};

function escapeHtml(s) {
  var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  map[String.fromCharCode(96)] = "&#96;";
  return String(s == null ? "" : s).replace(/[&<>"'\x60]/g, function (c) { return map[c]; });
}

function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function daysAgo(iso) {
  if (!iso) return "?";
  var t = Date.parse(iso);
  if (isNaN(t)) return "?";
  var d = Math.max(0, Math.round((Date.now() - t) / 86400000));
  return d + " 天前";
}

function ringColor(score) {
  if (score >= 65) return "var(--score-a)";
  if (score >= 45) return "var(--score-b)";
  if (score >= 25) return "var(--score-c)";
  return "var(--score-d)";
}

function saveCard(fullName, btn) {
  if (state.saved.has(fullName)) state.saved.delete(fullName);
  else state.saved.add(fullName);
  localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(state.saved)));
  btn.textContent = state.saved.has(fullName) ? "★ 已保存" : "☆ 保存";
  btn.classList.toggle("saved", state.saved.has(fullName));
  $("savedCount").textContent = state.saved.size;
  if (state.savedOnly) render();
}

function cardHtml(card) {
  var r = card.repo;
  var isSaved = state.saved.has(r.fullName);
  var license = r.license ? escapeHtml(r.license.key) : "无";
  var chips = (card.factors || []).map(function (f) {
    var cls = f.points > 0 ? " chip hit" : "";
    var tip = f.detail ? ' <i title="' + escapeHtml(f.detail) + '">*</i>' : "";
    return '<span class="chip' + cls + '">' + escapeHtml(f.label) + " <b>" + f.points + "</b>" + tip + "</span>";
  }).join("");
  var commPill = card.commercialized
    ? '<span class="pill comm">⚠️ 已有商业化（官网/云/托管）</span>'
    : '<span class="pill gap">✅ 商业化空白</span>';
  var html = '<article class="card">';
  html += '<div class="pill-row">' + commPill + '<span class="pill gapval">商业化空白 ' + card.gap + '/40</span></div>';
  html += '<div class="card-top">';
  html += '<div class="ring" style="--pct:' + card.score + ';--ring-color:' + ringColor(card.score) + '"><div class="ring-inner">' + card.score + "</div></div>";
  html += '<div class="card-title">';
  html += '<h3><a href="' + escapeHtml(r.htmlUrl) + '" target="_blank" rel="noopener">' + escapeHtml(r.fullName) + "</a></h3>";
  html += '<div class="meta-row">';
  html += '<span>⭐ <span class="num">' + fmt(r.stars) + "</span></span>";
  html += '<span>🐛 <span class="num">' + fmt(r.openIssues) + "</span></span>";
  html += "<span>📜 " + license + "</span>";
  html += "<span>🕒 " + daysAgo(r.pushedAt) + "</span>";
  html += "</div></div>";
  html += '<span class="badge ' + card.grade.code + '">' + card.grade.code + " " + escapeHtml(card.grade.label) + "</span>";
  html += "</div>";
  if (r.description) {
    html += '<p class="desc">' + escapeHtml(r.description) + "</p>";
  }
  html += '<div class="factors">' + chips + "</div>";
  html += '<div class="card-actions">';
  html += '<button class="save-btn' + (isSaved ? " saved" : "") + '" data-name="' + escapeHtml(r.fullName) + '">' + (isSaved ? "★ 已保存" : "☆ 保存") + "</button>";
  html += '<span class="card-grade">机会分 ' + card.score + "/100</span>";
  html += "</div></article>";
  return html;
}

function visibleCards() {
  if (!state.data) return [];
  var q = state.search.trim().toLowerCase();
  var cards = state.data.topics[state.topic] || [];
  return cards.filter(function (c) {
    if (c.score < state.minScore) return false;
    if (state.savedOnly && !state.saved.has(c.repo.fullName)) return false;
    if (q) {
      var hay = (c.repo.fullName + " " + (c.repo.description || "")).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}

function sorted(list) {
  var s = state.sort;
  return list.slice().sort(function (a, b) {
    if (s === "stars") return b.repo.stars - a.repo.stars;
    if (s === "issues") return b.repo.openIssues - a.repo.openIssues;
    if (s === "name") return a.repo.fullName.localeCompare(b.repo.fullName);
    return (b.score - a.score) || (b.repo.stars - a.repo.stars);
  });
}

function render() {
  if (!state.data) return;
  var list = sorted(visibleCards());
  var el = $("cards");
  if (list.length === 0) {
    el.innerHTML = '<div class="empty">没有符合条件的机会 — 试试调整筛选或切换 topic</div>';
  } else {
    var out = "";
    for (var i = 0; i < list.length; i++) out += cardHtml(list[i]);
    el.innerHTML = out;
  }
  $("status").textContent = list.length + " 个机会 · topic: " + state.topic;
  var btns = el.querySelectorAll(".save-btn");
  for (var j = 0; j < btns.length; j++) {
    (function (btn) {
      btn.addEventListener("click", function () { saveCard(btn.getAttribute("data-name"), btn); });
    })(btns[j]);
  }
}

function renderTopics() {
  var topics = Object.keys(state.data.topics);
  var nav = $("topics");
  var out = "";
  for (var i = 0; i < topics.length; i++) {
    var t = topics[i];
    out += '<button class="topic-btn' + (t === state.topic ? " active" : "") + '" data-topic="' + escapeHtml(t) + '">' + escapeHtml(t) + "</button>";
  }
  nav.innerHTML = out;
  var btns = nav.querySelectorAll(".topic-btn");
  for (var j = 0; j < btns.length; j++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        state.topic = btn.getAttribute("data-topic");
        renderTopics();
        render();
      });
    })(btns[j]);
  }
}

function init() {
  $("search").addEventListener("input", function (e) { state.search = e.target.value; render(); });
  $("sort").addEventListener("change", function (e) { state.sort = e.target.value; render(); });
  $("minScore").addEventListener("input", function (e) {
    state.minScore = Number(e.target.value);
    $("minScoreOut").textContent = state.minScore;
    render();
  });
  $("savedToggle").addEventListener("click", function () {
    state.savedOnly = !state.savedOnly;
    $("savedToggle").classList.toggle("active", state.savedOnly);
    render();
  });
  $("savedCount").textContent = state.saved.size;
  fetch(DATA_URL).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }).then(function (data) {
    state.data = data;
    var topics = Object.keys(data.topics);
    state.topic = topics[0];
    var total = 0;
    for (var i = 0; i < topics.length; i++) total += data.topics[topics[i]].length;
    $("meta").textContent = "数据快照: " + new Date(data.generatedAt).toLocaleString() + " · " + topics.length + " 个 topic · 共 " + total + " 个仓库";
    renderTopics();
    render();
  }).catch(function (err) {
    $("status").textContent = "加载数据失败: " + err.message + "（请稍后刷新，或检查数据快照是否已生成）";
    $("cards").innerHTML = '<div class="empty">⚠️ 数据加载失败</div>';
  });
}

document.addEventListener("DOMContentLoaded", init);

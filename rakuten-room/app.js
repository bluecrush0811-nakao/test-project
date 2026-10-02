const SETTINGS_KEY = "room-assistant-settings";
const POSTED_KEY = "room-assistant-posted";
const DEFAULT_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";

// type: "goods" = トラベルグッズ, "trip" = 旅行券・宿泊
const PRESETS = [
  { label: "スーツケース", keyword: "スーツケース", type: "goods" },
  { label: "キャリーバッグ", keyword: "キャリーバッグ", type: "goods" },
  { label: "トラベルポーチ", keyword: "トラベルポーチ", type: "goods" },
  { label: "ボストンバッグ", keyword: "ボストンバッグ", type: "goods" },
  { label: "ネックピロー", keyword: "ネックピロー", type: "goods" },
  { label: "圧縮袋", keyword: "旅行 圧縮袋", type: "goods" },
  { label: "折りたたみ傘", keyword: "折りたたみ傘", type: "goods" },
  { label: "旅行クーポン", keyword: "トラベルクーポン", type: "trip" },
  { label: "宿泊券", keyword: "宿泊券", type: "trip" },
  { label: "ペア宿泊", keyword: "ペア 宿泊 旅館", type: "trip" },
];

// 楽天ふるさと納税の自治体ショップは "f" + 自治体コード6桁 のショップコード
const FURUSATO_SHOP = /^f\d{6}/;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できない環境(プライベートモード等)では無視
  }
}

const settings = Object.assign(
  { appId: "", affiliateId: "", endpoint: DEFAULT_ENDPOINT },
  readJSON(SETTINGS_KEY, {})
);
const posted = readJSON(POSTED_KEY, {});
const search = { keyword: "", type: "goods", page: 0, pageCount: 0, items: [] };

const $ = (id) => document.getElementById(id);

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 2200);
}

function setStatus(message, isError = false) {
  const el = $("status");
  el.textContent = message;
  el.classList.toggle("error", isError);
}

// ---------- Settings ----------
function renderSettings() {
  $("app-id").value = settings.appId;
  $("affiliate-id").value = settings.affiliateId;
  $("endpoint").value = settings.endpoint;
  if (!settings.appId) $("settings").open = true;
}

$("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  settings.appId = $("app-id").value.trim();
  settings.affiliateId = $("affiliate-id").value.trim();
  settings.endpoint = $("endpoint").value.trim() || DEFAULT_ENDPOINT;
  writeJSON(SETTINGS_KEY, settings);
  $("settings").open = false;
  toast("設定を保存しました");
});

// ---------- Rakuten API (JSONP) ----------
function jsonp(url, params, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const cb = "roomcb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
    const script = document.createElement("script");
    const query = new URLSearchParams({ ...params, callback: cb });
    const cleanup = () => {
      delete window[cb];
      script.remove();
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("APIから応答がありません。アプリIDやエンドポイントを確認してください。"));
    }, timeoutMs);
    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("APIへの接続に失敗しました。アプリIDやエンドポイントを確認してください。"));
    };
    script.src = url + "?" + query.toString();
    document.body.appendChild(script);
  });
}

async function fetchItems(page) {
  const params = {
    applicationId: settings.appId,
    keyword: "ふるさと納税 " + search.keyword,
    format: "json",
    formatVersion: 2,
    hits: 30,
    page,
    imageFlag: 1,
    availability: 1,
  };
  const sort = $("sort").value;
  if (sort !== "standard") params.sort = sort;
  if (settings.affiliateId) params.affiliateId = settings.affiliateId;

  const data = await jsonp(settings.endpoint, params);
  if (data.error) throw new Error(`APIエラー: ${data.error_description || data.error}`);
  return data;
}

async function runSearch(page) {
  if (!settings.appId) {
    $("settings").open = true;
    setStatus("先に設定でアプリIDを入力してください。", true);
    return;
  }
  setStatus("検索中…");
  $("more").hidden = true;
  try {
    const data = await fetchItems(page);
    const items = (data.Items || []).map((it) => (it.Item ? it.Item : it));
    search.page = page;
    search.pageCount = data.pageCount || 0;
    search.items = page === 1 ? items : search.items.concat(items);
    renderResults();
  } catch (err) {
    setStatus(err.message, true);
  }
}

$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  search.keyword = $("keyword").value.trim();
  const preset = PRESETS.find((p) => p.keyword === search.keyword);
  search.type = preset ? preset.type : guessType(search.keyword);
  runSearch(1);
});

$("more").addEventListener("click", () => runSearch(search.page + 1));
$("only-furusato").addEventListener("change", renderResults);
$("hide-posted").addEventListener("change", renderResults);

function guessType(keyword) {
  return /旅行券|クーポン|宿泊|ホテル|旅館|温泉|体験|チケット/.test(keyword) ? "trip" : "goods";
}

function renderPresets() {
  const wrap = $("presets");
  PRESETS.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip " + p.type;
    btn.textContent = p.label;
    btn.addEventListener("click", () => {
      $("keyword").value = p.keyword;
      search.keyword = p.keyword;
      search.type = p.type;
      runSearch(1);
    });
    wrap.appendChild(btn);
  });
}

// ---------- Caption ----------
function stripTags(text) {
  return (text || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function shortName(name) {
  const cleaned = name.replace(/【[^】]*】/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 50 ? cleaned.slice(0, 50) + "…" : cleaned;
}

function firstSentence(caption) {
  const text = stripTags(caption);
  if (!text) return "";
  const sentence = text.split(/(?<=[。！!])/)[0];
  return sentence.length > 70 ? sentence.slice(0, 70) + "…" : sentence;
}

function toHashtag(text) {
  return "#" + text.replace(/[\s　・/]+/g, "");
}

function buildCaption(item, type) {
  const yen = Number(item.itemPrice).toLocaleString("ja-JP");
  const point = firstSentence(item.itemCaption);
  const review =
    item.reviewCount > 0 ? `\n⭐ レビュー${item.reviewAverage}（${item.reviewCount}件）` : "";

  const lines =
    type === "trip"
      ? [
          `【ふるさと納税】${shortName(item.itemName)}`,
          "",
          `${item.shopName}の返礼品で、お得に旅行へ✈️`,
          "旅先の地域を応援しながら、旅行代金の負担を減らせます。",
          point || null,
          `寄付額 ${yen}円${review}`,
          "",
          "次の旅行はふるさと納税で計画してみませんか？",
          "",
          ["#ふるさと納税", "#返礼品", "#ふるさと納税旅行", "#旅行好き", "#国内旅行", toHashtag(search.keyword), "#楽天ROOM"].join(" "),
        ]
      : [
          `【ふるさと納税】${shortName(item.itemName)}`,
          "",
          `${item.shopName}の返礼品で、旅行に役立つアイテムを見つけました🧳`,
          point || null,
          `寄付額 ${yen}円${review}`,
          "",
          "旅じたくをふるさと納税でお得にそろえよう✈️",
          "",
          ["#ふるさと納税", "#返礼品", "#旅行グッズ", "#トラベルグッズ", "#旅行準備", toHashtag(search.keyword), "#楽天ROOM"].join(" "),
        ];
  return lines.filter((l) => l !== null).join("\n");
}

// ---------- Results ----------
function roomUrl(item) {
  return "https://room.rakuten.co.jp/mix?itemcode=" + encodeURIComponent(item.itemCode) + "&scid=we_room_upc60";
}

function imageOf(item) {
  const img = (item.mediumImageUrls || [])[0];
  if (!img) return "";
  return typeof img === "string" ? img : img.imageUrl;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function visibleItems() {
  const onlyFurusato = $("only-furusato").checked;
  const hidePosted = $("hide-posted").checked;
  return search.items.filter(
    (it) => (!onlyFurusato || FURUSATO_SHOP.test(it.shopCode)) && (!hidePosted || !posted[it.itemCode])
  );
}

function renderResults() {
  const wrap = $("results");
  wrap.innerHTML = "";
  const items = visibleItems();

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card item";
    if (posted[item.itemCode]) card.classList.add("is-posted");

    const img = document.createElement("img");
    img.src = imageOf(item);
    img.alt = "";
    img.loading = "lazy";

    const body = document.createElement("div");
    body.className = "item-body";

    const name = document.createElement("a");
    name.className = "item-name";
    name.href = item.affiliateUrl || item.itemUrl;
    name.target = "_blank";
    name.rel = "noopener";
    name.textContent = item.itemName;

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent =
      `${item.shopName} ／ 寄付額 ${Number(item.itemPrice).toLocaleString("ja-JP")}円` +
      (item.reviewCount > 0 ? ` ／ ⭐${item.reviewAverage}（${item.reviewCount}件）` : "");

    const caption = document.createElement("textarea");
    caption.className = "caption";
    caption.rows = 9;
    caption.value = buildCaption(item, search.type);

    const actions = document.createElement("div");
    actions.className = "actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "secondary";
    copyBtn.textContent = "文章をコピー";
    copyBtn.addEventListener("click", async () => {
      toast((await copyText(caption.value)) ? "紹介文をコピーしました" : "コピーできませんでした");
    });

    const roomBtn = document.createElement("button");
    roomBtn.type = "button";
    roomBtn.textContent = "コピーしてROOMで開く";
    roomBtn.addEventListener("click", async () => {
      await copyText(caption.value);
      window.open(roomUrl(item), "_blank", "noopener");
      toast("紹介文をコピーしました。ROOMで貼り付けて投稿してください");
    });

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "ghost";
    doneBtn.textContent = posted[item.itemCode] ? "投稿済みを解除" : "投稿済みにする";
    doneBtn.addEventListener("click", () => {
      if (posted[item.itemCode]) {
        delete posted[item.itemCode];
      } else {
        posted[item.itemCode] = {
          name: item.itemName,
          url: item.affiliateUrl || item.itemUrl,
          at: new Date().toISOString(),
        };
      }
      writeJSON(POSTED_KEY, posted);
      renderResults();
      renderPosted();
    });

    actions.append(copyBtn, roomBtn, doneBtn);
    body.append(name, meta, caption, actions);
    card.append(img, body);
    wrap.appendChild(card);
  });

  const hidden = search.items.length - items.length;
  setStatus(
    search.items.length === 0
      ? "該当する返礼品が見つかりませんでした。"
      : `${items.length}件を表示中` + (hidden > 0 ? `（${hidden}件は条件により非表示）` : "")
  );
  $("more").hidden = search.page >= search.pageCount;
}

// ---------- Posted history ----------
function renderPosted() {
  const list = $("posted-list");
  list.innerHTML = "";
  const entries = Object.entries(posted).sort((a, b) => b[1].at.localeCompare(a[1].at));
  $("posted-count").textContent = `(${entries.length}件)`;

  if (entries.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "まだ投稿済みの商品はありません。";
    list.appendChild(li);
    return;
  }

  entries.forEach(([code, info]) => {
    const li = document.createElement("li");
    const date = document.createElement("span");
    date.className = "date";
    date.textContent = new Date(info.at).toLocaleDateString("ja-JP");
    const link = document.createElement("a");
    link.href = info.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = info.name;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "ghost small";
    del.textContent = "解除";
    del.addEventListener("click", () => {
      delete posted[code];
      writeJSON(POSTED_KEY, posted);
      renderPosted();
      renderResults();
    });
    li.append(date, link, del);
    list.appendChild(li);
  });
}

renderSettings();
renderPresets();
renderPosted();

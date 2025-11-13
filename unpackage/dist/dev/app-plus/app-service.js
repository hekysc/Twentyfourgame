if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  const ON_SHOW = "onShow";
  const ON_HIDE = "onHide";
  const ON_BACK_PRESS = "onBackPress";
  const ON_PULL_DOWN_REFRESH = "onPullDownRefresh";
  function formatAppLog(type, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type, filename, ...args);
    } else {
      console[type].apply(console, [...args, filename]);
    }
  }
  const createLifeCycleHook = (lifecycle, flag = 0) => (hook, target = vue.getCurrentInstance()) => {
    !vue.isInSSRComponentSetup && vue.injectHook(lifecycle, hook, target);
  };
  const onShow = /* @__PURE__ */ createLifeCycleHook(
    ON_SHOW,
    1 | 2
    /* HookFlags.PAGE */
  );
  const onHide = /* @__PURE__ */ createLifeCycleHook(
    ON_HIDE,
    1 | 2
    /* HookFlags.PAGE */
  );
  const onBackPress = /* @__PURE__ */ createLifeCycleHook(
    ON_BACK_PRESS,
    2
    /* HookFlags.PAGE */
  );
  const onPullDownRefresh = /* @__PURE__ */ createLifeCycleHook(
    ON_PULL_DOWN_REFRESH,
    2
    /* HookFlags.PAGE */
  );
  const PREFS_KEY = "tf24_prefs_v2";
  const LEGACY_PREFS_KEY = "tf24_prefs_v1";
  const RANK_MODES = {
    "jqk-1": { rankMode: "jqk-1", ranks: { A: 1, J: 1, Q: 1, K: 1 } },
    "jqk-11-12-13": { rankMode: "jqk-11-12-13", ranks: { A: 1, J: 11, Q: 12, K: 13 } }
  };
  const DEFAULT_PREFS = {
    lastMode: "basic",
    lastHintTs: 0,
    avatarMeta: {},
    rankMode: "jqk-11-12-13",
    ranks: { ...RANK_MODES["jqk-11-12-13"].ranks },
    deckSource: "regular",
    mixWeight: 50,
    haptics: true,
    sfx: true,
    reducedMotion: false,
    rankMigrationNotice: false
  };
  function readJson(key) {
    try {
      const raw = uni.getStorageSync(key);
      if (!raw)
        return null;
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch (_) {
          return null;
        }
      }
      return raw && typeof raw === "object" ? raw : null;
    } catch (_) {
      return null;
    }
  }
  function writePrefs(data) {
    try {
      uni.setStorageSync(PREFS_KEY, JSON.stringify(data || {}));
    } catch (_) {
    }
  }
  function deriveRanks(mode) {
    const info = RANK_MODES[mode];
    if (info)
      return { ...info.ranks };
    return { ...RANK_MODES["jqk-11-12-13"].ranks };
  }
  function normalizeDeckSource(value) {
    if (value === "mistakes" || value === "mix")
      return value;
    return "regular";
  }
  function normalizePrefs(raw) {
    const merged = { ...DEFAULT_PREFS, ...raw || {} };
    merged.lastMode = merged.lastMode === "pro" ? "pro" : "basic";
    merged.lastHintTs = Number.isFinite(merged.lastHintTs) ? merged.lastHintTs : 0;
    merged.avatarMeta = merged.avatarMeta && typeof merged.avatarMeta === "object" ? merged.avatarMeta : {};
    merged.rankMode = RANK_MODES[merged.rankMode] ? merged.rankMode : "jqk-11-12-13";
    merged.ranks = deriveRanks(merged.rankMode);
    merged.deckSource = normalizeDeckSource(merged.deckSource);
    merged.mixWeight = Number.isFinite(merged.mixWeight) ? Math.min(100, Math.max(0, Math.round(merged.mixWeight))) : 50;
    merged.haptics = !!merged.haptics;
    merged.sfx = !!merged.sfx;
    merged.reducedMotion = !!merged.reducedMotion;
    merged.rankMigrationNotice = !!merged.rankMigrationNotice;
    return merged;
  }
  function readLegacyFaceRanks() {
    const keys = ["tf24_face_ranks_v1", "tf24_face_ranks"];
    for (let i = 0; i < keys.length; i++) {
      const val = readJson(keys[i]);
      if (val && typeof val === "object") {
        const ranks = {
          J: Number(val.J),
          Q: Number(val.Q),
          K: Number(val.K)
        };
        const values = [ranks.J, ranks.Q, ranks.K].filter((n) => Number.isFinite(n));
        if (values.length === 3) {
          return ranks;
        }
      }
    }
    return null;
  }
  function detectLegacyRankMode() {
    try {
      const session = readJson("tf24_game_session_v1");
      if (session && typeof session.faceUseHigh === "boolean") {
        return session.faceUseHigh ? "jqk-11-12-13" : "jqk-1";
      }
    } catch (_) {
    }
    return "jqk-11-12-13";
  }
  function migrateLegacyPrefs() {
    const legacy = readJson(PREFS_KEY) || readJson(LEGACY_PREFS_KEY) || {};
    const merged = { ...DEFAULT_PREFS, ...legacy };
    const faceRanks = readLegacyFaceRanks();
    let migrationNotice = false;
    if (faceRanks) {
      const allowedSets = [
        RANK_MODES["jqk-1"].ranks,
        RANK_MODES["jqk-11-12-13"].ranks
      ];
      const matchesAllowed = allowedSets.some((set) => set.J === faceRanks.J && set.Q === faceRanks.Q && set.K === faceRanks.K);
      if (!matchesAllowed) {
        migrationNotice = true;
      }
    }
    merged.rankMode = migrationNotice ? "jqk-11-12-13" : detectLegacyRankMode();
    merged.rankMigrationNotice = migrationNotice;
    const normalized = normalizePrefs(merged);
    writePrefs(normalized);
    try {
      uni.removeStorageSync(LEGACY_PREFS_KEY);
    } catch (_) {
    }
    return normalized;
  }
  let cachedPrefs = null;
  function readPrefs() {
    if (cachedPrefs)
      return cachedPrefs;
    const stored = readJson(PREFS_KEY);
    if (stored) {
      cachedPrefs = normalizePrefs(stored);
      writePrefs(cachedPrefs);
      return cachedPrefs;
    }
    cachedPrefs = migrateLegacyPrefs();
    return cachedPrefs;
  }
  function setPrefs(data) {
    cachedPrefs = normalizePrefs(data);
    writePrefs(cachedPrefs);
    return cachedPrefs;
  }
  function updatePrefs(updater) {
    const current = readPrefs();
    const next = typeof updater === "function" ? updater({ ...current }) : { ...current, ...updater || {} };
    return setPrefs(next);
  }
  function getLastMode() {
    const prefs = readPrefs();
    return prefs.lastMode === "pro" ? "pro" : "basic";
  }
  function setLastMode(mode) {
    updatePrefs((p) => ({ ...p, lastMode: mode === "pro" ? "pro" : "basic" }));
  }
  function getLastHintTimestamp() {
    const prefs = readPrefs();
    return Number.isFinite(prefs.lastHintTs) ? prefs.lastHintTs : 0;
  }
  function setLastHintTimestamp(ts) {
    const stamp = Number.isFinite(ts) ? Math.max(0, Math.floor(ts)) : Date.now();
    updatePrefs((p) => ({ ...p, lastHintTs: stamp }));
  }
  function writeAvatarMeta(userId, meta) {
    if (!userId)
      return;
    updatePrefs((p) => {
      const avatarMeta = { ...p.avatarMeta || {} };
      if (!meta || !meta.uri) {
        delete avatarMeta[userId];
      } else {
        avatarMeta[userId] = {
          uri: meta.uri,
          lastModified: Number.isFinite(meta.lastModified) ? meta.lastModified : Date.now()
        };
      }
      return { ...p, avatarMeta };
    });
  }
  function clearAvatarMeta(userId) {
    writeAvatarMeta(userId, null);
  }
  function getGameplayPrefs() {
    const prefs = readPrefs();
    return {
      rankMode: prefs.rankMode,
      ranks: deriveRanks(prefs.rankMode),
      deckSource: prefs.deckSource,
      mixWeight: prefs.mixWeight,
      haptics: prefs.haptics,
      sfx: prefs.sfx,
      reducedMotion: prefs.reducedMotion,
      rankMigrationNotice: prefs.rankMigrationNotice
    };
  }
  function setGameplayPrefs(partial) {
    updatePrefs((p) => {
      const nextRankMode = RANK_MODES[partial == null ? void 0 : partial.rankMode] ? partial.rankMode : p.rankMode;
      return {
        ...p,
        rankMode: nextRankMode,
        ranks: deriveRanks(nextRankMode),
        deckSource: normalizeDeckSource((partial == null ? void 0 : partial.deckSource) ?? p.deckSource),
        mixWeight: Number.isFinite(partial == null ? void 0 : partial.mixWeight) ? Math.min(100, Math.max(0, Math.round(partial.mixWeight))) : p.mixWeight,
        haptics: typeof (partial == null ? void 0 : partial.haptics) === "boolean" ? partial.haptics : p.haptics,
        sfx: typeof (partial == null ? void 0 : partial.sfx) === "boolean" ? partial.sfx : p.sfx,
        reducedMotion: typeof (partial == null ? void 0 : partial.reducedMotion) === "boolean" ? partial.reducedMotion : p.reducedMotion,
        rankMigrationNotice: typeof (partial == null ? void 0 : partial.rankMigrationNotice) === "boolean" ? partial.rankMigrationNotice : p.rankMigrationNotice
      };
    });
  }
  function consumeRankMigrationNotice() {
    updatePrefs((p) => ({ ...p, rankMigrationNotice: false }));
  }
  const UKEY = "tf24_users_v1";
  const SKEY = "tf24_stats_v1";
  const STATS_VERSION = 2;
  const MAX_ROUNDS = 1e3;
  function load(key, defVal) {
    try {
      const val = uni.getStorageSync(key);
      if (!val)
        return defVal;
      return typeof val === "string" ? JSON.parse(val) : val;
    } catch (e) {
      return defVal;
    }
  }
  function save(key, val) {
    try {
      uni.setStorageSync(key, JSON.stringify(val));
    } catch (e) {
    }
  }
  function ensureInit() {
    const users = load(UKEY, null);
    if (!users || typeof users !== "object" || !Array.isArray(users.list)) {
      save(UKEY, { list: [], currentId: "" });
    } else {
      const migrated = { ...users };
      migrated.list = (users.list || []).map((u) => ({
        id: u.id || genId(),
        name: u.name || "玩家",
        avatar: u.avatar || "",
        avatarUpdatedAt: Number.isFinite(u.avatarUpdatedAt) ? u.avatarUpdatedAt : 0,
        color: u.color || randomColor(),
        createdAt: u.createdAt || Date.now(),
        lastPlayedAt: u.lastPlayedAt || 0
      }));
      const guestIds = new Set(migrated.list.filter((u) => String(u.name || "") === "Guest").map((u) => u.id));
      if (guestIds.size > 0) {
        migrated.list = migrated.list.filter((u) => !guestIds.has(u.id));
        if (guestIds.has(migrated.currentId)) {
          migrated.currentId = migrated.list[0] && migrated.list[0].id || "";
        }
      }
      if (migrated !== users)
        save(UKEY, migrated);
    }
    const stats = load(SKEY, null);
    if (!stats || typeof stats !== "object") {
      save(SKEY, { _version: STATS_VERSION });
    } else {
      if (!stats._version || stats._version < STATS_VERSION) {
        const migrated = { ...stats };
        for (const k of Object.keys(migrated)) {
          if (k.startsWith && k.startsWith("_"))
            continue;
          const rec = migrated[k];
          if (!rec || typeof rec !== "object") {
            migrated[k] = { totals: { total: 0, success: 0, fail: 0 }, days: {}, rounds: [], agg: {} };
            continue;
          }
          const totals = rec.totals && typeof rec.totals === "object" ? rec.totals : { total: 0, success: 0, fail: 0 };
          const days = rec.days && typeof rec.days === "object" ? rec.days : {};
          const rounds = Array.isArray(rec.rounds) ? rec.rounds : [];
          const agg = rec.agg && typeof rec.agg === "object" ? rec.agg : {};
          migrated[k] = { totals, days, rounds, agg };
        }
        migrated._version = STATS_VERSION;
        save(SKEY, migrated);
      }
    }
  }
  function getUsers() {
    return load(UKEY, { list: [], currentId: "" });
  }
  function setUsers(data) {
    save(UKEY, data);
  }
  function getCurrentUser() {
    const u = getUsers();
    return u.list.find((x) => x.id === u.currentId);
  }
  function switchUser(id) {
    const u = getUsers();
    if (u.list.find((x) => x.id === id)) {
      u.currentId = id;
      setUsers(u);
    }
  }
  function addUser(name, avatar = "", color) {
    var _a;
    const u = getUsers();
    const id = genId();
    const rec = {
      id,
      name: name || `玩家${(((_a = u.list) == null ? void 0 : _a.length) || 0) + 1}`,
      avatar: avatar || "",
      avatarUpdatedAt: 0,
      color: color || randomColor(),
      createdAt: Date.now(),
      lastPlayedAt: 0
    };
    u.list = (u.list || []).concat([rec]);
    if (!u.currentId)
      u.currentId = id;
    setUsers(u);
    return id;
  }
  function renameUser(id, name) {
    const u = getUsers();
    const t = u.list.find((x) => x.id === id);
    if (t) {
      t.name = name;
      setUsers(u);
    }
  }
  function removeUser(id) {
    const u = getUsers();
    u.list = u.list.filter((x) => x.id !== id);
    if (u.currentId === id)
      u.currentId = u.list[0] && u.list[0].id || "";
    setUsers(u);
  }
  function setUserAvatar(id, avatar, lastModified) {
    const u = getUsers();
    const t = (u.list || []).find((x) => x.id === id);
    if (!t)
      return;
    const uri = avatar || "";
    t.avatar = uri;
    if (uri) {
      const ts = Number.isFinite(lastModified) ? Math.max(0, Math.floor(lastModified)) : Date.now();
      t.avatarUpdatedAt = ts;
      writeAvatarMeta(id, { uri, lastModified: ts });
    } else {
      t.avatarUpdatedAt = 0;
      clearAvatarMeta(id);
    }
    setUsers(u);
  }
  function pushRound(arg) {
    var _a, _b, _c;
    const users = getUsers();
    const uid = users.currentId;
    if (!uid)
      return;
    const stats = load(SKEY, { _version: STATS_VERSION });
    if (!stats._version)
      stats._version = STATS_VERSION;
    if (!stats[uid])
      stats[uid] = { totals: { total: 0, success: 0, fail: 0 }, days: {}, rounds: [], agg: {} };
    const rec = stats[uid];
    const today = /* @__PURE__ */ new Date();
    const key = today.toISOString().slice(0, 10);
    if (!rec.days[key])
      rec.days[key] = { total: 0, success: 0, fail: 0 };
    const isBool = typeof arg === "boolean";
    const success = isBool ? !!arg : !!(arg == null ? void 0 : arg.success);
    const now = Date.now();
    const round = isBool ? null : {
      id: genId(),
      ts: now,
      success: !!(arg == null ? void 0 : arg.success),
      timeMs: Number.isFinite(arg == null ? void 0 : arg.timeMs) ? Math.max(0, Math.floor(arg.timeMs)) : void 0,
      hintUsed: !!(arg == null ? void 0 : arg.hintUsed),
      retries: Number.isFinite(arg == null ? void 0 : arg.retries) ? Math.max(0, Math.floor(arg.retries)) : void 0,
      ops: Array.isArray(arg == null ? void 0 : arg.ops) ? arg.ops.slice(0, 16) : void 0,
      exprLen: Number.isFinite(arg == null ? void 0 : arg.exprLen) ? Math.max(0, Math.floor(arg.exprLen)) : void 0,
      maxDepth: Number.isFinite(arg == null ? void 0 : arg.maxDepth) ? Math.max(0, Math.floor(arg.maxDepth)) : void 0,
      faceUseHigh: typeof (arg == null ? void 0 : arg.faceUseHigh) === "boolean" ? arg.faceUseHigh : void 0,
      hand: (arg == null ? void 0 : arg.hand) && Array.isArray(arg.hand.cards) ? { cards: arg.hand.cards.map((c) => ({ rank: +c.rank, suit: c.suit })) } : void 0,
      solutionsCount: Number.isFinite(arg == null ? void 0 : arg.solutionsCount) ? Math.max(0, Math.floor(arg.solutionsCount)) : void 0,
      expr: typeof (arg == null ? void 0 : arg.expr) === "string" ? arg.expr : void 0
    };
    rec.totals.total += 1;
    rec.days[key].total += 1;
    if (success) {
      rec.totals.success += 1;
      rec.days[key].success += 1;
    } else {
      rec.totals.fail += 1;
      rec.days[key].fail += 1;
    }
    if (round) {
      rec.rounds.push(round);
      if (rec.rounds.length > MAX_ROUNDS)
        rec.rounds.splice(0, rec.rounds.length - MAX_ROUNDS);
      if (round.success && Number.isFinite(round.timeMs)) {
        const best = (_a = rec.agg) == null ? void 0 : _a.bestTimeMs;
        rec.agg.bestTimeMs = Number.isFinite(best) ? Math.min(best, round.timeMs) : round.timeMs;
      }
      const cur = ((_b = rec.agg) == null ? void 0 : _b.currentStreak) || 0;
      rec.agg.currentStreak = success ? cur + 1 : 0;
      const longest = ((_c = rec.agg) == null ? void 0 : _c.longestStreak) || 0;
      if (rec.agg.currentStreak > longest)
        rec.agg.longestStreak = rec.agg.currentStreak;
    }
    save(SKEY, stats);
    try {
      const u = getUsers();
      const t = (u.list || []).find((x) => x.id === uid);
      if (t) {
        t.lastPlayedAt = Date.now();
        setUsers(u);
      }
    } catch (_) {
    }
  }
  function readStatsExtended(uid) {
    const s = load(SKEY, { _version: STATS_VERSION });
    const rec = s[uid] || { totals: { total: 0, success: 0, fail: 0 }, days: {}, rounds: [], agg: {} };
    if (!rec.rounds)
      rec.rounds = [];
    if (!rec.agg)
      rec.agg = {};
    return rec;
  }
  function touchLastPlayed(id) {
    try {
      const u = getUsers();
      const uid = id || u.currentId;
      if (!uid)
        return;
      const t = (u.list || []).find((x) => x.id === uid);
      if (t) {
        t.lastPlayedAt = Date.now();
        setUsers(u);
      }
    } catch (_) {
    }
  }
  function genId() {
    return Math.random().toString(36).slice(2, 10);
  }
  function randomColor() {
    const palette = ["#e2e8f0", "#fde68a", "#bbf7d0", "#bfdbfe", "#fecaca", "#f5d0fe", "#c7d2fe"];
    return palette[Math.floor(Math.random() * palette.length)];
  }
  function allUsersWithStats() {
    const users = getUsers().list || [];
    const s = load(SKEY, {});
    return users.map((u) => {
      const st = s[u.id] || { totals: { total: 0, success: 0, fail: 0 }, days: {} };
      const t = st.totals || { total: 0, success: 0, fail: 0 };
      const winRate = t.total ? Math.round(100 * (t.success / t.total)) : 0;
      const bestTimeMs = st.agg && st.agg.bestTimeMs || void 0;
      const currentStreak = st.agg && st.agg.currentStreak || 0;
      const longestStreak = st.agg && st.agg.longestStreak || 0;
      return { id: u.id, name: u.name, totals: t, winRate, bestTimeMs, currentStreak, longestStreak };
    });
  }
  function resetAllData() {
    try {
      uni.clearStorageSync();
    } catch (_) {
    }
    ensureInit();
  }
  const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
  const AVATAR_NOTICE_KEY = "tf24_avatar_restore_notice";
  function getFS() {
    try {
      if (typeof uni !== "undefined" && typeof uni.getFileSystemManager === "function") {
        return uni.getFileSystemManager();
      }
    } catch (_) {
    }
    return null;
  }
  function isPlusAvailable() {
    try {
      return typeof plus !== "undefined" && plus && plus.io;
    } catch (_) {
      return false;
    }
  }
  function extractExt(path, fallback = ".png") {
    if (!path)
      return fallback;
    const m = /\.(jpg|jpeg|png|webp)$/i.exec(path);
    return m ? `.${m[1].toLowerCase()}` : fallback;
  }
  function composeAvatarDir() {
    try {
      if (isPlusAvailable())
        return "_doc/profile";
      if (typeof uni !== "undefined" && uni.env && uni.env.USER_DATA_PATH) {
        return `${uni.env.USER_DATA_PATH}/profile`;
      }
      if (typeof wx !== "undefined" && wx.env && wx.env.USER_DATA_PATH) {
        return `${wx.env.USER_DATA_PATH}/profile`;
      }
    } catch (_) {
    }
    return "";
  }
  async function ensureDir(dirPath) {
    if (!dirPath)
      return false;
    const fs = getFS();
    if (fs && typeof fs.access === "function" && typeof fs.mkdir === "function") {
      return await new Promise((resolve) => {
        fs.access({ path: dirPath, success: () => resolve(true), fail: () => {
          fs.mkdir({ dirPath, recursive: true, success: () => resolve(true), fail: () => resolve(false) });
        } });
      });
    }
    if (fs && typeof fs.mkdirSync === "function") {
      try {
        fs.mkdirSync(dirPath, true);
        return true;
      } catch (_) {
        return false;
      }
    }
    if (isPlusAvailable()) {
      return await new Promise((resolve) => {
        try {
          plus.io.resolveLocalFileSystemURL("_doc/", (root) => {
            const rel = dirPath.replace(/^_doc\/?/, "");
            if (!rel) {
              resolve(true);
              return;
            }
            const segments = rel.split("/").filter(Boolean);
            let current = root;
            function next(i) {
              if (i >= segments.length) {
                resolve(true);
                return;
              }
              const name = segments[i];
              try {
                current.getDirectory(name, { create: true }, (dir) => {
                  current = dir;
                  next(i + 1);
                }, () => resolve(false));
              } catch (_) {
                resolve(false);
              }
            }
            next(0);
          }, () => resolve(false));
        } catch (_) {
          resolve(false);
        }
      });
    }
    return false;
  }
  async function fileExists(path) {
    if (!path)
      return false;
    const fs = getFS();
    if (fs && typeof fs.access === "function") {
      return await new Promise((resolve) => {
        fs.access({ path, success: () => resolve(true), fail: () => resolve(false) });
      });
    }
    if (fs && typeof fs.accessSync === "function") {
      try {
        fs.accessSync(path);
        return true;
      } catch (_) {
        return false;
      }
    }
    if (fs && typeof fs.stat === "function") {
      return await new Promise((resolve) => {
        fs.stat({ path, success: () => resolve(true), fail: () => resolve(false) });
      });
    }
    if (isPlusAvailable()) {
      return await new Promise((resolve) => {
        try {
          plus.io.resolveLocalFileSystemURL(path, () => resolve(true), () => resolve(false));
        } catch (_) {
          resolve(false);
        }
      });
    }
    return false;
  }
  async function removeFile(path) {
    if (!path)
      return false;
    const fs = getFS();
    if (fs && typeof fs.unlink === "function") {
      return await new Promise((resolve) => {
        fs.unlink({ filePath: path, success: () => resolve(true), fail: () => resolve(false) });
      });
    }
    if (fs && typeof fs.unlinkSync === "function") {
      try {
        fs.unlinkSync(path);
        return true;
      } catch (_) {
        return false;
      }
    }
    if (isPlusAvailable()) {
      return await new Promise((resolve) => {
        try {
          plus.io.resolveLocalFileSystemURL(path, (entry) => {
            entry.remove(() => resolve(true), () => resolve(false));
          }, () => resolve(false));
        } catch (_) {
          resolve(false);
        }
      });
    }
    return false;
  }
  async function copyFile(src, dest) {
    if (!src || !dest)
      return false;
    const fs = getFS();
    if (fs && typeof fs.copyFile === "function") {
      return await new Promise((resolve) => {
        fs.copyFile({ srcPath: src, destPath: dest, success: () => resolve(true), fail: () => resolve(false) });
      });
    }
    if (fs && typeof fs.copyFileSync === "function") {
      try {
        fs.copyFileSync(src, dest);
        return true;
      } catch (_) {
      }
    }
    if (fs && typeof fs.readFile === "function" && typeof fs.writeFile === "function") {
      const data = await new Promise((resolve) => {
        fs.readFile({ filePath: src, encoding: "binary", success: (res) => resolve(res.data), fail: () => resolve(null) });
      });
      if (data == null)
        return false;
      return await new Promise((resolve) => {
        fs.writeFile({ filePath: dest, data, encoding: "binary", success: () => resolve(true), fail: () => resolve(false) });
      });
    }
    if (isPlusAvailable()) {
      return await new Promise((resolve) => {
        try {
          plus.io.resolveLocalFileSystemURL(src, (entry) => {
            const dir = dest.substring(0, dest.lastIndexOf("/")) || "_doc";
            const name = dest.substring(dest.lastIndexOf("/") + 1);
            ensureDir(dir).then((ok) => {
              if (!ok) {
                resolve(false);
                return;
              }
              try {
                plus.io.resolveLocalFileSystemURL(dir, (dirEntry) => {
                  const attemptCopy = () => {
                    entry.copyTo(dirEntry, name, () => resolve(true), () => resolve(false));
                  };
                  dirEntry.getFile(name, { create: false }, (fileEntry) => {
                    fileEntry.remove(() => attemptCopy(), () => attemptCopy());
                  }, () => attemptCopy());
                }, () => resolve(false));
              } catch (_) {
                resolve(false);
              }
            });
          }, () => resolve(false));
        } catch (_) {
          resolve(false);
        }
      });
    }
    return false;
  }
  async function getFileInfo(path) {
    if (!path)
      return null;
    const fs = getFS();
    if (fs && typeof fs.stat === "function") {
      return await new Promise((resolve) => {
        fs.stat({ path, success: (res) => resolve({ size: res.size || 0, lastModified: res.mtime || res.lastModifiedTime || Date.now() }), fail: () => resolve(null) });
      });
    }
    if (fs && typeof fs.getFileInfo === "function") {
      return await new Promise((resolve) => {
        fs.getFileInfo({ filePath: path, success: (res) => resolve({ size: res.size || 0, lastModified: res.lastModifiedTime || Date.now() }), fail: () => resolve(null) });
      });
    }
    if (isPlusAvailable()) {
      return await new Promise((resolve) => {
        try {
          plus.io.resolveLocalFileSystemURL(path, (entry) => {
            entry.getMetadata((meta) => {
              const size = meta.size || 0;
              const lastModified = meta.modificationTime instanceof Date ? meta.modificationTime.getTime() : Date.now();
              resolve({ size, lastModified });
            }, () => resolve(null));
          }, () => resolve(null));
        } catch (_) {
          resolve(null);
        }
      });
    }
    return null;
  }
  async function saveFileFallback(tempPath) {
    if (!tempPath)
      return "";
    if (typeof uni !== "undefined" && typeof uni.saveFile === "function") {
      return await new Promise((resolve) => {
        uni.saveFile({ tempFilePath: tempPath, success: (res) => resolve(res && res.savedFilePath ? res.savedFilePath : ""), fail: () => resolve("") });
      });
    }
    return "";
  }
  async function compressImage(path, quality) {
    if (!path)
      return { ok: false, path, size: 0 };
    if (typeof uni === "undefined" || typeof uni.compressImage !== "function") {
      return { ok: false, path, size: 0 };
    }
    return await new Promise((resolve) => {
      uni.compressImage({
        src: path,
        quality,
        success: (res) => {
          const newPath = res && res.tempFilePath ? res.tempFilePath : path;
          getFileInfo(newPath).then((info) => {
            resolve({ ok: true, path: newPath, size: info ? info.size || 0 : 0 });
          });
        },
        fail: () => resolve({ ok: false, path, size: 0 })
      });
    });
  }
  function withinAvatarDir(path) {
    if (!path)
      return false;
    const dir = composeAvatarDir();
    if (!dir)
      return false;
    return path.startsWith(dir);
  }
  async function copyIntoAvatarDir(userId, sourcePath, options = {}) {
    const dir = composeAvatarDir();
    if (!dir)
      return { ok: false, path: "", lastModified: 0 };
    const ensured = await ensureDir(dir);
    if (!ensured)
      return { ok: false, path: "", lastModified: 0 };
    const ext = options.ext || extractExt(sourcePath);
    const dest = `${dir}/avatar_${userId}${ext}`;
    const copied = await copyFile(sourcePath, dest);
    if (!copied)
      return { ok: false, path: "", lastModified: 0 };
    const info = await getFileInfo(dest);
    return { ok: true, path: dest, lastModified: info ? info.lastModified || Date.now() : Date.now() };
  }
  async function prepareSource(tempPath, sizeHint) {
    if (!tempPath)
      return { path: "", size: 0 };
    let size = Number.isFinite(sizeHint) ? sizeHint : 0;
    if (!size) {
      const info = await getFileInfo(tempPath);
      size = info ? info.size || 0 : 0;
    }
    if (size > MAX_AVATAR_SIZE) {
      let currentPath = tempPath;
      for (const quality of [80, 60, 45]) {
        const res = await compressImage(currentPath, quality);
        if (res.ok && res.size > 0) {
          currentPath = res.path;
          size = res.size;
          if (size <= MAX_AVATAR_SIZE) {
            return { path: currentPath, size };
          }
        }
      }
      return { path: currentPath, size };
    }
    return { path: tempPath, size };
  }
  function legacyCandidates(user) {
    const list = [];
    if (!user)
      return list;
    const id = user.id;
    const avatar = user.avatar;
    if (avatar)
      list.push(avatar);
    const legacyBase = composeAvatarDir().replace(/profile$/, "") || "";
    if (legacyBase) {
      list.push(`${legacyBase}Documents/app/avatar_${id}.png`);
      list.push(`${legacyBase}Documents/app/avatar.png`);
    }
    list.push(`_doc/avatar_${id}.png`);
    list.push(`_doc/avatar.png`);
    return Array.from(new Set(list.filter(Boolean)));
  }
  async function saveAvatarForUser(userId, tempPath, options = {}) {
    if (!userId || !tempPath)
      return { ok: false, error: "invalid", path: "", lastModified: 0 };
    const users = getUsers();
    const user = (users.list || []).find((u) => u && u.id === userId);
    if (!user)
      return { ok: false, error: "not_found", path: "", lastModified: 0 };
    const prepared = await prepareSource(tempPath, options.size);
    if (!prepared.path)
      return { ok: false, error: "invalid", path: "", lastModified: 0 };
    let workingPath = prepared.path;
    let stored = { ok: false, path: "", lastModified: 0 };
    if (prepared.size && prepared.size <= MAX_AVATAR_SIZE) {
      stored = await copyIntoAvatarDir(userId, workingPath, { ext: extractExt(tempPath) });
    } else {
      stored = await copyIntoAvatarDir(userId, workingPath, { ext: extractExt(tempPath) });
    }
    if (!stored.ok || !stored.path) {
      const fallback = await saveFileFallback(workingPath);
      if (fallback) {
        const info = await getFileInfo(fallback);
        stored = { ok: true, path: fallback, lastModified: info ? info.lastModified || Date.now() : Date.now() };
      }
    }
    if (!stored.ok || !stored.path) {
      return { ok: false, error: "fs_failed", path: "", lastModified: 0 };
    }
    const prev = user.avatar || "";
    if (prev && prev !== stored.path) {
      await removeFile(prev);
    }
    setUserAvatar(userId, stored.path, stored.lastModified);
    writeAvatarMeta(userId, { uri: stored.path, lastModified: stored.lastModified });
    return stored;
  }
  async function removeAvatarForUser(userId) {
    if (!userId)
      return { ok: false };
    const users = getUsers();
    const user = (users.list || []).find((u) => u && u.id === userId);
    if (!user)
      return { ok: false };
    const prev = user.avatar || "";
    if (prev) {
      await removeFile(prev);
    }
    setUserAvatar(userId, "", 0);
    clearAvatarMeta(userId);
    return { ok: true };
  }
  async function ensureUserAvatars() {
    const users = getUsers();
    const list = Array.isArray(users.list) ? users.list : [];
    let changed = false;
    let fallbackCount = 0;
    for (const user of list) {
      if (!user || !user.id)
        continue;
      if (!user.avatar) {
        if (user.avatarUpdatedAt) {
          user.avatarUpdatedAt = 0;
          changed = true;
        }
        clearAvatarMeta(user.id);
        continue;
      }
      const exists = await fileExists(user.avatar);
      if (exists) {
        if (!withinAvatarDir(user.avatar)) {
          const res = await copyIntoAvatarDir(user.id, user.avatar, { ext: extractExt(user.avatar) });
          if (res.ok && res.path) {
            const prev = user.avatar;
            user.avatar = res.path;
            user.avatarUpdatedAt = res.lastModified;
            changed = true;
            writeAvatarMeta(user.id, { uri: res.path, lastModified: res.lastModified });
            if (prev && prev !== res.path) {
              await removeFile(prev);
            }
          }
        }
        continue;
      }
      let restored = false;
      for (const cand of legacyCandidates(user)) {
        if (!cand)
          continue;
        const ok = await fileExists(cand);
        if (!ok)
          continue;
        const res = await copyIntoAvatarDir(user.id, cand, { ext: extractExt(cand) });
        if (res.ok && res.path) {
          user.avatar = res.path;
          user.avatarUpdatedAt = res.lastModified;
          changed = true;
          writeAvatarMeta(user.id, { uri: res.path, lastModified: res.lastModified });
          restored = true;
          break;
        }
      }
      if (!restored) {
        user.avatar = "";
        user.avatarUpdatedAt = 0;
        clearAvatarMeta(user.id);
        fallbackCount += 1;
        changed = true;
      }
    }
    if (changed)
      setUsers(users);
    if (fallbackCount > 0) {
      try {
        uni.setStorageSync(AVATAR_NOTICE_KEY, Date.now());
      } catch (_) {
      }
    }
  }
  function consumeAvatarRestoreNotice() {
    try {
      const ts = uni.getStorageSync(AVATAR_NOTICE_KEY);
      if (!ts)
        return false;
      uni.removeStorageSync(AVATAR_NOTICE_KEY);
      return true;
    } catch (_) {
      return false;
    }
  }
  function useFloatingHint() {
    const state = vue.reactive({
      visible: false,
      text: "",
      interactive: false,
      id: 0
    });
    let timer = null;
    let lastStamp = 0;
    try {
      const persisted = getLastHintTimestamp();
      if (Number.isFinite(persisted))
        lastStamp = persisted;
    } catch (_) {
      lastStamp = 0;
    }
    function hideHint() {
      state.visible = false;
      state.text = "";
      state.interactive = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    function resolveOptions(durationOrOptions, maybeOptions) {
      if (durationOrOptions && typeof durationOrOptions === "object") {
        return { ...durationOrOptions || {} };
      }
      const base = {};
      if (Number.isFinite(durationOrOptions)) {
        base.duration = durationOrOptions;
      }
      if (maybeOptions && typeof maybeOptions === "object") {
        Object.assign(base, maybeOptions);
      }
      return base;
    }
    function showHint(text, durationOrOptions = 1800, maybeOptions = {}) {
      const now = Date.now();
      if (now - lastStamp < 300) {
        return;
      }
      lastStamp = now;
      try {
        setLastHintTimestamp(now);
      } catch (_) {
      }
      const options = resolveOptions(durationOrOptions, maybeOptions);
      const interactive = options.interactive === void 0 ? false : !!options.interactive;
      const autoDuration = Number.isFinite(options.duration) ? options.duration : Number.isFinite(durationOrOptions) ? durationOrOptions : 1800;
      const shouldAutoDismiss = options.autoDismiss === void 0 ? !interactive : !!options.autoDismiss;
      state.text = typeof text === "string" ? text : "";
      state.visible = !!state.text;
      state.interactive = interactive;
      state.id = (state.id || 0) + 1;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (shouldAutoDismiss && autoDuration > 0) {
        timer = setTimeout(() => {
          hideHint();
        }, autoDuration);
      }
    }
    vue.onUnmounted(() => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    });
    return { hintState: state, showHint, hideHint };
  }
  function getTouchPoint(e) {
    const t = e && e.touches && e.touches[0] || e && e.changedTouches && e.changedTouches[0] || {};
    const x = t.clientX ?? t.pageX ?? t.x ?? 0;
    const y = t.clientY ?? t.pageY ?? t.y ?? 0;
    return { x, y };
  }
  function useEdgeExit(options = {}) {
    const { showHint, onExit, confirmWindow = 2e3, edgeDp = 16 } = options || {};
    const sys = uni.getSystemInfoSync && uni.getSystemInfoSync() ? uni.getSystemInfoSync() : {};
    const width = sys.windowWidth || 0;
    const pixelRatio = sys.pixelRatio || 1;
    const edgePx = Math.max(12, Math.round(edgeDp * (Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1)));
    const state = {
      tracking: false,
      startX: 0,
      startY: 0,
      lastDX: 0,
      lastDY: 0,
      isEdge: false
    };
    let confirmTimer = null;
    let confirmDeadline = 0;
    function resetTracking() {
      state.tracking = false;
      state.isEdge = false;
      state.lastDX = 0;
      state.lastDY = 0;
    }
    function handleTouchStart(e) {
      const { x, y } = getTouchPoint(e);
      state.tracking = true;
      state.startX = x;
      state.startY = y;
      state.lastDX = 0;
      state.lastDY = 0;
      state.isEdge = x <= edgePx || width && x >= width - edgePx;
    }
    function handleTouchMove(e) {
      if (!state.tracking)
        return;
      const { x, y } = getTouchPoint(e);
      state.lastDX = x - state.startX;
      state.lastDY = y - state.startY;
    }
    function attemptExit() {
      const now = Date.now();
      if (confirmTimer && now <= confirmDeadline) {
        clearTimeout(confirmTimer);
        confirmTimer = null;
        confirmDeadline = 0;
        try {
          onExit && onExit();
        } catch (_) {
        }
        try {
          uni.$emit && uni.$emit("edge_exit_confirm_exit");
        } catch (_) {
        }
        return;
      }
      confirmDeadline = now + confirmWindow;
      if (confirmTimer) {
        clearTimeout(confirmTimer);
        confirmTimer = null;
      }
      confirmTimer = setTimeout(() => {
        confirmTimer = null;
        confirmDeadline = 0;
      }, confirmWindow);
      if (typeof showHint === "function") {
        try {
          uni.$emit && uni.$emit("edge_exit_hint_shown");
        } catch (_) {
        }
        showHint("再次从屏幕边缘滑动即可退出", { duration: 2e3, interactive: false });
      }
    }
    function handleTouchEnd() {
      if (!state.tracking)
        return;
      const dx = state.lastDX;
      const dy = state.lastDY;
      const edge = state.isEdge;
      resetTracking();
      if (!edge)
        return;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < 60 || absX <= absY * 1.2)
        return;
      attemptExit();
    }
    function handleTouchCancel() {
      resetTracking();
    }
    vue.onUnmounted(() => {
      if (confirmTimer) {
        clearTimeout(confirmTimer);
        confirmTimer = null;
      }
    });
    return {
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      handleTouchCancel
    };
  }
  function exitApp(options = {}) {
    const { fallback } = options || {};
    const attempts = [
      () => {
        try {
          if (typeof plus !== "undefined" && plus && plus.runtime && typeof plus.runtime.quit === "function") {
            plus.runtime.quit();
            return true;
          }
        } catch (_) {
        }
        return false;
      },
      () => {
        try {
          if (typeof uni !== "undefined" && uni && typeof uni.exit === "function") {
            uni.exit();
            return true;
          }
        } catch (_) {
        }
        return false;
      },
      () => {
        try {
          if (typeof wx !== "undefined" && wx && typeof wx.exitMiniProgram === "function") {
            wx.exitMiniProgram();
            return true;
          }
        } catch (_) {
        }
        return false;
      }
    ];
    for (const attempt of attempts) {
      if (attempt()) {
        return true;
      }
    }
    let navigated = false;
    try {
      if (typeof uni !== "undefined" && uni && typeof uni.navigateBack === "function") {
        uni.navigateBack({
          delta: 1,
          success: () => {
            navigated = true;
          },
          fail: () => {
            if (!navigated && typeof fallback === "function") {
              fallback();
            }
          },
          complete: () => {
            if (!navigated && typeof fallback === "function") {
              fallback();
            }
          }
        });
        return false;
      }
    } catch (_) {
    }
    if (typeof fallback === "function") {
      fallback();
      return false;
    }
    try {
      if (typeof window !== "undefined") {
        if (window.history && window.history.length > 1) {
          window.history.back();
          return false;
        }
        if (typeof window.close === "function") {
          window.close();
          return false;
        }
      }
    } catch (_) {
    }
    return false;
  }
  function navigateToHome(options = {}) {
    const url = "/pages/index/index";
    const afterNavigate = typeof options.afterNavigate === "function" ? options.afterNavigate : null;
    const launch = () => {
      if (afterNavigate) {
        try {
          afterNavigate();
        } catch (_) {
        }
      }
    };
    const tryReLaunch = () => {
      try {
        uni.reLaunch({
          url,
          success: launch,
          fail: (err) => {
            formatAppLog("error", "at utils/navigation.js:102", "reLaunch 失败:", err);
          }
        });
      } catch (err) {
        formatAppLog("error", "at utils/navigation.js:106", "尝试 reLaunch 失败:", err);
      }
    };
    const trySwitchTab = () => {
      try {
        uni.switchTab({
          url,
          success: launch,
          fail: (err) => {
            formatAppLog("log", "at utils/navigation.js:116", "switchTab 失败，尝试 reLaunch:", err);
            tryReLaunch();
          }
        });
      } catch (err) {
        formatAppLog("log", "at utils/navigation.js:121", "switchTab 调用异常，尝试 reLaunch:", err);
        tryReLaunch();
      }
    };
    try {
      uni.navigateTo({
        url,
        success: launch,
        fail: (err) => {
          formatAppLog("log", "at utils/navigation.js:131", "navigateTo 失败，尝试 switchTab:", err);
          trySwitchTab();
        }
      });
    } catch (err) {
      formatAppLog("log", "at utils/navigation.js:136", "navigateTo 调用异常，尝试 switchTab:", err);
      trySwitchTab();
    }
  }
  function extractSafeInsets(sys) {
    const statusHeight = Number.isFinite(sys == null ? void 0 : sys.statusBarHeight) ? sys.statusBarHeight : 0;
    const safeInsets = (sys == null ? void 0 : sys.safeAreaInsets) || (sys == null ? void 0 : sys.safeArea) || {};
    const safeTop = Number.isFinite(safeInsets == null ? void 0 : safeInsets.top) ? safeInsets.top : 0;
    const safeBottom = Number.isFinite(safeInsets == null ? void 0 : safeInsets.bottom) ? safeInsets.bottom : 0;
    return {
      safeTop: safeTop || statusHeight || 0,
      safeBottom: safeBottom || 0,
      windowHeight: Number.isFinite(sys == null ? void 0 : sys.windowHeight) ? sys.windowHeight : Number.isFinite(sys == null ? void 0 : sys.screenHeight) ? sys.screenHeight : 0
    };
  }
  function useSafeArea() {
    const safeTop = vue.ref(0);
    const safeBottom = vue.ref(0);
    const windowHeight = vue.ref(0);
    let offResize = null;
    function applyInfo(sys) {
      if (!sys || typeof sys !== "object")
        return;
      const info = extractSafeInsets(sys);
      if (Number.isFinite(info.safeTop))
        safeTop.value = info.safeTop;
      if (Number.isFinite(info.safeBottom))
        safeBottom.value = info.safeBottom;
      if (Number.isFinite(info.windowHeight))
        windowHeight.value = info.windowHeight;
    }
    function fetchSystemInfo() {
      try {
        if (typeof uni !== "undefined" && typeof uni.getSystemInfo === "function") {
          uni.getSystemInfo({ success: applyInfo });
          return;
        }
        if (typeof uni !== "undefined" && typeof uni.getSystemInfoSync === "function") {
          const sys = uni.getSystemInfoSync();
          applyInfo(sys);
        }
      } catch (_) {
      }
    }
    vue.onMounted(() => {
      fetchSystemInfo();
      try {
        if (typeof uni !== "undefined" && typeof uni.onWindowResize === "function") {
          const handler = (evt) => {
            if (evt && evt.size)
              applyInfo(evt.size);
            else
              fetchSystemInfo();
          };
          uni.onWindowResize(handler);
          offResize = () => {
            try {
              uni.offWindowResize(handler);
            } catch (_) {
            }
          };
        }
      } catch (_) {
        offResize = null;
      }
    });
    vue.onUnmounted(() => {
      if (typeof offResize === "function") {
        try {
          offResize();
        } catch (_) {
        }
        offResize = null;
      }
    });
    return { safeTop, safeBottom, windowHeight, refreshSafeArea: fetchSystemInfo };
  }
  function rpxToPx(rpx) {
    if (!Number.isFinite(rpx))
      return 0;
    try {
      if (typeof uni !== "undefined" && typeof uni.upx2px === "function") {
        const px = uni.upx2px(rpx);
        if (Number.isFinite(px))
          return px;
      }
    } catch (_) {
    }
    const scale = 0.5;
    return rpx * scale;
  }
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$9 = {
    __name: "AppNavBar",
    props: {
      title: { type: String, default: "" },
      showBack: { type: Boolean, default: false },
      withSafeTop: { type: Boolean, default: true },
      background: { type: String, default: "#ffffff" },
      backToIndex: { type: Boolean, default: true }
    },
    emits: ["back"],
    setup(__props, { expose: __expose, emit: __emit }) {
      __expose();
      const props = __props;
      const emit = __emit;
      const { safeTop } = useSafeArea();
      const navStyle = vue.computed(() => {
        const paddingTop = props.withSafeTop ? Math.max(0, safeTop.value || 0) : 0;
        return {
          paddingTop: paddingTop + "px",
          background: props.background
        };
      });
      function handleBack() {
        emit("back");
        if (props.backToIndex) {
          navigateToHome();
        } else {
          uni.navigateBack({
            delta: 1,
            fail: (err) => {
              formatAppLog("log", "at components/AppNavBar.vue:63", "navigateBack 失败，尝试返回首页:", err);
              uni.switchTab({
                url: "/pages/index/index",
                fail: () => {
                  uni.reLaunch({ url: "/pages/index/index" });
                }
              });
            }
          });
        }
      }
      const __returned__ = { props, emit, safeTop, navStyle, handleBack, computed: vue.computed, get useSafeArea() {
        return useSafeArea;
      }, get navigateToHome() {
        return navigateToHome;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$8(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: "app-nav-bar",
        style: vue.normalizeStyle($setup.navStyle)
      },
      [
        vue.createElementVNode("view", { class: "nav-inner" }, [
          vue.createElementVNode("view", { class: "nav-side nav-left" }, [
            $props.showBack ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "back-btn",
              "hover-class": "back-btn-hover",
              onClick: $setup.handleBack
            }, [
              vue.createElementVNode("text", { class: "back-icon" }, "←")
            ])) : vue.createCommentVNode("v-if", true),
            vue.renderSlot(_ctx.$slots, "left", {}, void 0, true)
          ]),
          vue.createElementVNode("view", { class: "nav-title" }, [
            vue.renderSlot(_ctx.$slots, "title", {}, () => [
              vue.createElementVNode(
                "text",
                { class: "nav-title-text" },
                vue.toDisplayString($props.title),
                1
                /* TEXT */
              )
            ], true)
          ]),
          vue.createElementVNode("view", { class: "nav-side nav-right" }, [
            vue.renderSlot(_ctx.$slots, "right", {}, void 0, true)
          ])
        ])
      ],
      4
      /* STYLE */
    );
  }
  const AppNavBar = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["render", _sfc_render$8], ["__scopeId", "data-v-ba163d00"], ["__file", "D:/heky/SWProject/Twentyfourgame/components/AppNavBar.vue"]]);
  const _sfc_main$8 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const users = vue.ref({ list: [], currentId: "" });
      const errMsg = vue.ref("");
      const { hintState, showHint, hideHint } = useFloatingHint();
      const edgeHandlers = useEdgeExit({ showHint, onExit: () => exitLoginPage() });
      let lastBackPress = 0;
      onBackPress(() => {
        const now = Date.now();
        if (now - lastBackPress < 2e3) {
          exitLoginPage();
        } else {
          lastBackPress = now;
          try {
            showHint("再按一次返回退出应用", { duration: 2e3, interactive: false });
          } catch (_) {
            uni.showToast({ title: "再按一次退出应用", icon: "none" });
          }
        }
        return true;
      });
      const { safeTop } = useSafeArea();
      const loginPageStyle = vue.computed(() => ({ paddingTop: `${Math.max(0, safeTop.value || 0)}px` }));
      vue.onMounted(() => {
        ensureInit();
        safeLoad();
        try {
          updateVHVar();
        } catch (_) {
        }
        if (uni.onWindowResize)
          uni.onWindowResize(() => {
            try {
              updateVHVar();
            } catch (_) {
            }
          });
      });
      function updateVHVar() {
        try {
          const sys = uni.getSystemInfoSync && uni.getSystemInfoSync() || {};
          const h = sys.windowHeight || (typeof window !== "undefined" ? window.innerHeight : 0) || 0;
          if (h && typeof document !== "undefined" && document.documentElement && document.documentElement.style) {
            document.documentElement.style.setProperty("--vh", h * 0.01 + "px");
          }
        } catch (_) {
        }
      }
      function safeLoad() {
        try {
          const u = getUsers();
          if (!u || !Array.isArray(u.list) || u.currentId === void 0) {
            throw new Error("本地用户数据结构无效");
          }
          users.value = u;
        } catch (e) {
          errMsg.value = e && e.message ? e.message : "本地存储损坏";
        }
      }
      const sortedUsers = vue.computed(() => {
        const list = (users.value.list || []).filter((u) => String(u.name || "") !== "Guest").slice();
        list.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0) || (b.createdAt || 0) - (a.createdAt || 0));
        return list;
      });
      function refresh() {
        safeLoad();
      }
      function go(url) {
        try {
          uni.reLaunch({ url });
        } catch (_) {
          try {
            uni.switchTab({ url });
          } catch (_2) {
          }
        }
      }
      function choose(u) {
        switchUser(u.id);
        touchLastPlayed(u.id);
        go("/pages/index/index");
      }
      function createUser() {
        uni.showModal({ title: "新建玩家", editable: true, placeholderText: "昵称（1-20字）", success(res) {
          if (!res.confirm)
            return;
          const name = String(res.content || "").trim();
          if (!name || name.length < 1 || name.length > 20) {
            uni.showToast({ title: "请输入1-20字昵称", icon: "none" });
            return;
          }
          const exists = (users.value.list || []).some((x) => String(x.name || "").toLowerCase() === name.toLowerCase());
          if (exists) {
            uni.showModal({ title: "提示", content: "已有同名玩家，是否继续创建？", success(r2) {
              if (r2.confirm)
                stepChooseAvatar(name);
              else
                createUser();
            } });
          } else {
            stepChooseAvatar(name);
          }
        } });
      }
      function stepChooseAvatar(name) {
        uni.showActionSheet({ itemList: ["请选择头像方式", "从相册选择", "随机分配", "跳过"], success(a) {
          const idx = a.tapIndex;
          if (idx === 1) {
            uni.chooseImage({ count: 1, sizeType: ["compressed"], success(sel) {
              const path = sel.tempFilePaths && sel.tempFilePaths[0] || "";
              const size = sel.tempFiles && sel.tempFiles[0] && sel.tempFiles[0].size || 0;
              finalizeCreate(name, path, size);
            }, fail() {
              finalizeCreate(name, "");
            } });
          } else if (idx === 2) {
            finalizeCreate(name, "");
          } else if (idx === 3) {
            finalizeCreate(name, "");
          }
        }, fail() {
          finalizeCreate(name, "");
        } });
      }
      function finalizeCreate(name, avatar, size) {
        const id = addUser(name, "");
        if (avatar) {
          saveAvatarForUser(id, avatar, { size }).then((res) => {
            if (!res || !res.ok) {
              try {
                uni.showToast({ title: "头像保存失败，请重试", icon: "none" });
              } catch (_) {
              }
            }
          });
        }
        switchUser(id);
        touchLastPlayed(id);
        go("/pages/login/index");
      }
      function exitLoginPage() {
        exitApp({
          fallback: () => {
            try {
              uni.navigateBack({ delta: 1 });
            } catch (_) {
              try {
                uni.reLaunch({ url: "/pages/index/index" });
              } catch (__) {
              }
            }
          }
        });
      }
      function avatarText(name) {
        if (!name)
          return "U";
        const s = String(name).trim();
        return s.length ? s[0].toUpperCase() : "U";
      }
      function lastPlayedText(ts) {
        if (!ts)
          return "从未游玩";
        try {
          const d = new Date(ts);
          const now = Date.now();
          const dd = /* @__PURE__ */ new Date();
          const isToday = d.toDateString() === dd.toDateString();
          const y = d.getFullYear(), m = (d.getMonth() + 1).toString().padStart(2, "0"), day = d.getDate().toString().padStart(2, "0");
          const hh = d.getHours().toString().padStart(2, "0"), mm = d.getMinutes().toString().padStart(2, "0");
          if (isToday)
            return `今天 ${hh}:${mm}`;
          const yesterday = new Date(now - 864e5);
          if (d.toDateString() === yesterday.toDateString())
            return `昨天 ${hh}:${mm}`;
          return `${y}-${m}-${day} ${hh}:${mm}`;
        } catch (_) {
          return "时间未知";
        }
      }
      function colorFrom(u) {
        const base = String(u.id || u.name || "");
        let hash = 0;
        for (let i = 0; i < base.length; i++) {
          hash = hash * 33 + base.charCodeAt(i) >>> 0;
        }
        const palette = ["#e2e8f0", "#fde68a", "#bbf7d0", "#bfdbfe", "#fecaca", "#f5d0fe", "#c7d2fe"];
        return palette[hash % palette.length];
      }
      function resetData() {
        uni.showModal({ title: "重置数据", content: "将清空本地所有数据，是否继续？", success(res) {
          if (res.confirm) {
            resetAllData();
            errMsg.value = "";
            refresh();
          }
        } });
      }
      const __returned__ = { users, errMsg, hintState, showHint, hideHint, edgeHandlers, get lastBackPress() {
        return lastBackPress;
      }, set lastBackPress(v) {
        lastBackPress = v;
      }, safeTop, loginPageStyle, updateVHVar, safeLoad, sortedUsers, refresh, go, choose, createUser, stepChooseAvatar, finalizeCreate, exitLoginPage, avatarText, lastPlayedText, colorFrom, resetData, ref: vue.ref, computed: vue.computed, onMounted: vue.onMounted, get onBackPress() {
        return onBackPress;
      }, get ensureInit() {
        return ensureInit;
      }, get getUsers() {
        return getUsers;
      }, get addUser() {
        return addUser;
      }, get switchUser() {
        return switchUser;
      }, get resetAllData() {
        return resetAllData;
      }, get touchLastPlayed() {
        return touchLastPlayed;
      }, get saveAvatarForUser() {
        return saveAvatarForUser;
      }, get useFloatingHint() {
        return useFloatingHint;
      }, get useEdgeExit() {
        return useEdgeExit;
      }, get exitApp() {
        return exitApp;
      }, get useSafeArea() {
        return useSafeArea;
      }, AppNavBar };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$7(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: "login-page",
        style: vue.normalizeStyle($setup.loginPageStyle),
        onTouchstart: _cache[2] || (_cache[2] = (...args) => $setup.edgeHandlers.handleTouchStart && $setup.edgeHandlers.handleTouchStart(...args)),
        onTouchmove: _cache[3] || (_cache[3] = (...args) => $setup.edgeHandlers.handleTouchMove && $setup.edgeHandlers.handleTouchMove(...args)),
        onTouchend: _cache[4] || (_cache[4] = (...args) => $setup.edgeHandlers.handleTouchEnd && $setup.edgeHandlers.handleTouchEnd(...args)),
        onTouchcancel: _cache[5] || (_cache[5] = (...args) => $setup.edgeHandlers.handleTouchCancel && $setup.edgeHandlers.handleTouchCancel(...args))
      },
      [
        vue.createVNode($setup["AppNavBar"], {
          title: "无敌24点程序·观测",
          showBack: false,
          "with-safe-top": false
        }),
        vue.createCommentVNode(" 主体 "),
        vue.createElementVNode("view", { class: "login-body" }, [
          vue.createElementVNode("view", { class: "login-heading" }, [
            vue.createElementVNode("text", { class: "h1" }, "选择玩家")
          ]),
          vue.createCommentVNode(" 错误状态 "),
          $setup.errMsg ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "error-card card section"
          }, [
            vue.createElementVNode("text", { class: "err-title" }, "数据异常"),
            vue.createElementVNode(
              "text",
              { class: "err-text" },
              vue.toDisplayString($setup.errMsg),
              1
              /* TEXT */
            ),
            vue.createElementVNode("button", {
              class: "btn danger",
              onClick: $setup.resetData
            }, "重置数据")
          ])) : $setup.sortedUsers.length === 0 ? (vue.openBlock(), vue.createElementBlock(
            vue.Fragment,
            { key: 1 },
            [
              vue.createCommentVNode(" 空状态 "),
              vue.createElementVNode("view", { class: "empty-card card section" }, [
                vue.createElementVNode("text", { class: "empty-ill" }, "🃏"),
                vue.createElementVNode("text", { class: "empty-text" }, "还没有玩家，快创建一个吧！"),
                vue.createElementVNode("button", {
                  class: "create-btn highlight",
                  onClick: $setup.createUser
                }, [
                  vue.createElementVNode("text", { class: "create-plus" }, "＋"),
                  vue.createElementVNode("text", null, "新建玩家")
                ])
              ])
            ],
            2112
            /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
          )) : (vue.openBlock(), vue.createElementBlock(
            vue.Fragment,
            { key: 2 },
            [
              vue.createCommentVNode(" 用户列表 "),
              vue.createElementVNode("view", { class: "user-list" }, [
                (vue.openBlock(true), vue.createElementBlock(
                  vue.Fragment,
                  null,
                  vue.renderList($setup.sortedUsers, (u) => {
                    return vue.openBlock(), vue.createElementBlock("button", {
                      class: "user-item card section",
                      key: u.id,
                      onClick: ($event) => $setup.choose(u)
                    }, [
                      u.avatar ? (vue.openBlock(), vue.createElementBlock("image", {
                        key: 0,
                        class: "avatar-img",
                        src: u.avatar,
                        mode: "aspectFill"
                      }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock(
                        "view",
                        {
                          key: 1,
                          class: "avatar",
                          style: vue.normalizeStyle({ backgroundColor: u.color || $setup.colorFrom(u) })
                        },
                        vue.toDisplayString($setup.avatarText(u.name)),
                        5
                        /* TEXT, STYLE */
                      )),
                      vue.createElementVNode("view", { class: "user-col" }, [
                        vue.createElementVNode(
                          "view",
                          { class: "user-name" },
                          vue.toDisplayString(u.name),
                          1
                          /* TEXT */
                        ),
                        vue.createElementVNode(
                          "view",
                          { class: "user-sub" },
                          "最近：" + vue.toDisplayString($setup.lastPlayedText(u.lastPlayedAt)),
                          1
                          /* TEXT */
                        )
                      ]),
                      vue.createElementVNode("text", { class: "chev" }, "›")
                    ], 8, ["onClick"]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                vue.createElementVNode("button", {
                  class: "create-btn",
                  onClick: $setup.createUser
                }, [
                  vue.createElementVNode("text", { class: "create-plus" }, "＋"),
                  vue.createElementVNode("text", null, "新建玩家")
                ])
              ])
            ],
            2112
            /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
          ))
        ]),
        vue.createCommentVNode(" 底部区块：原“以游客登录”入口已移除 "),
        $setup.hintState.visible ? (vue.openBlock(), vue.createElementBlock(
          "view",
          {
            key: 0,
            class: vue.normalizeClass(["floating-hint-layer", { interactive: $setup.hintState.interactive }]),
            onClick: _cache[1] || (_cache[1] = (...args) => $setup.hideHint && $setup.hideHint(...args))
          },
          [
            vue.createElementVNode(
              "view",
              {
                class: "floating-hint",
                onClick: _cache[0] || (_cache[0] = vue.withModifiers(() => {
                }, ["stop"]))
              },
              vue.toDisplayString($setup.hintState.text),
              1
              /* TEXT */
            )
          ],
          2
          /* CLASS */
        )) : vue.createCommentVNode("v-if", true)
      ],
      36
      /* STYLE, NEED_HYDRATION */
    );
  }
  const PagesLoginIndex = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["render", _sfc_render$7], ["__scopeId", "data-v-d08ef7d4"], ["__file", "D:/heky/SWProject/Twentyfourgame/pages/login/index.vue"]]);
  const _sfc_main$7 = {
    __name: "CircleActionButton",
    props: {
      icon: { type: String, default: "help" },
      label: { type: String, default: "" },
      disabled: { type: Boolean, default: false },
      danger: { type: Boolean, default: false },
      primary: { type: Boolean, default: false },
      iconColor: { type: String, default: "#111827" },
      iconSize: { type: Number, default: 28 }
    },
    emits: ["tap"],
    setup(__props, { expose: __expose, emit: __emit }) {
      __expose();
      const props = __props;
      const emit = __emit;
      const ICON_GLYPHS = {
        account_circle: "O",
        insights: "=",
        settings: "*",
        undo: "U",
        refresh: "R",
        lightbulb: "L",
        skip_next: ">",
        help: "?"
      };
      const tooltipVisible = vue.ref(false);
      let tooltipTimer = null;
      function handleTap() {
        if (props.disabled)
          return;
        emit("tap");
      }
      function showTooltip() {
        if (!props.label)
          return;
        tooltipVisible.value = true;
        clearTimer();
        tooltipTimer = setTimeout(() => {
          tooltipVisible.value = false;
        }, 1200);
      }
      function handleTouchStart() {
        clearTimer();
      }
      function handleTouchEnd() {
        clearTimer();
        tooltipVisible.value = false;
      }
      const iconGlyph = vue.computed(() => ICON_GLYPHS[props.icon] || "?");
      const iconStyle = vue.computed(() => ({ fontSize: props.iconSize + "px", color: props.iconColor }));
      function clearTimer() {
        if (tooltipTimer) {
          clearTimeout(tooltipTimer);
          tooltipTimer = null;
        }
      }
      vue.onBeforeUnmount(() => clearTimer());
      const __returned__ = { props, emit, ICON_GLYPHS, tooltipVisible, get tooltipTimer() {
        return tooltipTimer;
      }, set tooltipTimer(v) {
        tooltipTimer = v;
      }, handleTap, showTooltip, handleTouchStart, handleTouchEnd, iconGlyph, iconStyle, clearTimer, ref: vue.ref, onBeforeUnmount: vue.onBeforeUnmount, computed: vue.computed };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$6(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: vue.normalizeClass(["circle-button", { disabled: $props.disabled }])
      },
      [
        vue.createElementVNode("view", { class: "circle-button-shell" }, [
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["circle-button-core", [{ danger: $props.danger, primary: $props.primary }, $props.disabled ? "circle-button-disabled" : ""]]),
              "hover-class": "circle-button-hover",
              "hover-start-time": 20,
              "hover-stay-time": 120,
              onClick: $setup.handleTap,
              onTouchstart: $setup.handleTouchStart,
              onTouchend: $setup.handleTouchEnd,
              onTouchcancel: $setup.handleTouchEnd,
              onLongpress: $setup.showTooltip
            },
            [
              vue.createElementVNode(
                "text",
                {
                  class: "circle-icon",
                  style: vue.normalizeStyle($setup.iconStyle)
                },
                vue.toDisplayString($setup.iconGlyph),
                5
                /* TEXT, STYLE */
              )
            ],
            34
            /* CLASS, NEED_HYDRATION */
          ),
          $setup.tooltipVisible ? (vue.openBlock(), vue.createElementBlock(
            "view",
            {
              key: 0,
              class: "circle-button-tooltip"
            },
            vue.toDisplayString($props.label),
            1
            /* TEXT */
          )) : vue.createCommentVNode("v-if", true)
        ]),
        $props.label ? (vue.openBlock(), vue.createElementBlock(
          "text",
          {
            key: 0,
            class: "circle-button-label"
          },
          vue.toDisplayString($props.label),
          1
          /* TEXT */
        )) : vue.createCommentVNode("v-if", true)
      ],
      2
      /* CLASS */
    );
  }
  const CircleActionButton = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["render", _sfc_render$6], ["__scopeId", "data-v-7f5cb51a"], ["__file", "D:/heky/SWProject/Twentyfourgame/components/CircleActionButton.vue"]]);
  function mapCardRank(rank, faceUseHigh) {
    if (rank === 1)
      return 1;
    if (rank === 11 || rank === 12 || rank === 13)
      return faceUseHigh ? rank : 1;
    return rank;
  }
  function labelForRank(rank) {
    if (rank === 1)
      return "A";
    if (rank === 11)
      return "J";
    if (rank === 12)
      return "Q";
    if (rank === 13)
      return "K";
    return String(rank);
  }
  function formatFractionValue(frac) {
    if (!frac)
      return "";
    const n = typeof frac.n === "number" ? frac.n : 0;
    const d = typeof frac.d === "number" ? frac.d : 1;
    return d === 1 ? String(n) : `${n}/${d}`;
  }
  function stripOuterParens(str) {
    if (!str)
      return "";
    let text = str.trim();
    while (text.startsWith("(") && text.endsWith(")")) {
      let depth = 0;
      let balanced = true;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "(")
          depth++;
        else if (ch === ")") {
          depth--;
          if (depth < 0) {
            balanced = false;
            break;
          }
          if (depth === 0 && i < text.length - 1) {
            balanced = false;
            break;
          }
        }
      }
      if (!balanced || depth !== 0)
        break;
      text = text.slice(1, -1).trim();
    }
    return text;
  }
  function formatExpressionWithValue(expr, value) {
    const trimmed = stripOuterParens(expr || "");
    if (!trimmed)
      return "";
    const valText = value ? formatFractionValue(value) : "";
    return valText ? `${trimmed}=${valText}` : trimmed;
  }
  function statsFromExpressionString(expression) {
    if (!expression)
      return { ops: [], exprLen: 0, maxDepth: 0 };
    const ops = [];
    let exprLen = 0;
    let depth = 0;
    let maxDepth = 0;
    const tokens = expression.match(/10|11|12|13|[1-9]|[()+\-×÷]/g) || [];
    for (const tok of tokens) {
      exprLen += 1;
      if (tok === "(") {
        depth += 1;
        if (depth > maxDepth)
          maxDepth = depth;
      } else if (tok === ")") {
        depth = Math.max(0, depth - 1);
      } else if ("+-×÷".includes(tok)) {
        ops.push(tok);
      }
    }
    return { ops, exprLen, maxDepth };
  }
  function tokensToExpression(tokens, faceUseHigh) {
    return (tokens || []).map((t) => {
      if (t.type === "num") {
        const rank = typeof t.rank === "number" ? t.rank : Number(t.value);
        return String(mapCardRank(rank, faceUseHigh));
      }
      return t.value || "";
    }).join("");
  }
  function computeExprStats(tokens) {
    const arr = tokens || [];
    const ops = [];
    let depth = 0;
    let maxDepth = 0;
    for (const t of arr) {
      if (t.type === "op") {
        if (t.value === "(") {
          depth += 1;
          if (depth > maxDepth)
            maxDepth = depth;
          continue;
        }
        if (t.value === ")") {
          depth = Math.max(0, depth - 1);
          continue;
        }
        if (t.value === "+" || t.value === "-" || t.value === "×" || t.value === "÷")
          ops.push(t.value);
      }
    }
    return { exprLen: arr.length, maxDepth, ops };
  }
  function isExpressionComplete(tokens) {
    const arr = tokens || [];
    if (!arr.length)
      return false;
    let bal = 0;
    let prev = null;
    const isBin = (v) => v === "+" || v === "-" || v === "×" || v === "÷";
    for (const t of arr) {
      if (t.type === "op" && t.value === "(")
        bal += 1;
      else if (t.type === "op" && t.value === ")") {
        bal -= 1;
        if (bal < 0)
          return false;
      }
      if (!prev) {
        if (t.type === "op" && (t.value === ")" || isBin(t.value)))
          return false;
      } else {
        const pa = prev.type === "op" ? prev.value : "num";
        const pb = t.type === "op" ? t.value : "num";
        if (isBin(pa) && isBin(pb))
          return false;
        if (prev.type === "num" && t.type === "op" && t.value === "(")
          return false;
        if (prev.type === "op" && prev.value === ")" && t.type === "num")
          return false;
        if (prev.type === "num" && t.type === "num")
          return false;
      }
      prev = t;
    }
    const last = arr[arr.length - 1];
    if (last && last.type === "op" && (last.value === "(" || isBin(last.value)))
      return false;
    return bal === 0;
  }
  function formatMs(ms) {
    if (!Number.isFinite(ms))
      return "-";
    if (ms < 1e3)
      return `${ms}ms`;
    const s = ms / 1e3;
    if (s < 60)
      return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    const r = Math.round(s % 60);
    return `${m}m${r}s`;
  }
  function formatMsShort(ms) {
    if (!Number.isFinite(ms))
      return "-";
    const s = ms / 1e3;
    if (s < 120)
      return `${s.toFixed(1)}s`;
    return formatMs(ms);
  }
  function operateFractions(a, b, op) {
    if (!a || !b)
      return null;
    if (op === "+")
      return a.plus(b);
    if (op === "-")
      return a.minus(b);
    if (op === "×")
      return a.times(b);
    if (op === "÷") {
      if (b.n === 0)
        throw new Error("divide-by-zero");
      return a.div(b);
    }
    return null;
  }
  function createShuffledDeck() {
    const suits = ["S", "H", "D", "C"];
    const arr = [];
    for (const s of suits) {
      for (let r = 1; r <= 13; r++) {
        arr.push({ rank: r, suit: s });
      }
    }
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const _sfc_main$6 = {
    __name: "PlayingCard",
    props: {
      card: { type: Object, required: true },
      size: { type: String, default: "lg" },
      fill: { type: Boolean, default: false }
    },
    setup(__props, { expose: __expose }) {
      __expose();
      const SUIT_SYMBOLS = Object.freeze({
        S: "♠",
        H: "♥",
        D: "♦",
        C: "♣"
      });
      const SIZE_CLASS_MAP = Object.freeze({
        lg: "card-visual--lg",
        md: "card-visual--md",
        sm: "card-visual--sm"
      });
      const VALID_SUITS = ["S", "H", "D", "C"];
      const DEFAULT_SUIT = SUIT_SYMBOLS.S;
      const props = __props;
      const rank = vue.computed(() => {
        const source = props.card || {};
        const candidate = Number(source.rank ?? source.value ?? 1);
        if (Number.isFinite(candidate)) {
          if (candidate < 1)
            return 1;
          if (candidate > 13)
            return 13;
          return Math.round(candidate);
        }
        return 1;
      });
      const suit = vue.computed(() => {
        const source = props.card || {};
        const raw = String(source.suit || "S").toUpperCase();
        return VALID_SUITS.includes(raw) ? raw : "S";
      });
      const rankLabel = vue.computed(() => labelForRank(rank.value));
      const suitGlyph = vue.computed(() => SUIT_SYMBOLS[suit.value] || DEFAULT_SUIT);
      const colorClass = vue.computed(() => suit.value === "H" || suit.value === "D" ? "card-visual--red" : "card-visual--black");
      const sizeClass = vue.computed(() => SIZE_CLASS_MAP[props.size] || "card-visual--lg");
      const __returned__ = { SUIT_SYMBOLS, SIZE_CLASS_MAP, VALID_SUITS, DEFAULT_SUIT, props, rank, suit, rankLabel, suitGlyph, colorClass, sizeClass, computed: vue.computed, get labelForRank() {
        return labelForRank;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$5(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: vue.normalizeClass(["card-visual", [$setup.colorClass, $setup.sizeClass, $props.fill ? "card-visual--fill" : ""]])
      },
      [
        vue.createElementVNode("view", { class: "card-visual__body" }, [
          vue.createElementVNode("view", { class: "card-visual__corner card-visual__corner--top" }, [
            vue.createElementVNode(
              "text",
              { class: "card-visual__rank" },
              vue.toDisplayString($setup.rankLabel),
              1
              /* TEXT */
            ),
            vue.createElementVNode(
              "text",
              { class: "card-visual__suit" },
              vue.toDisplayString($setup.suitGlyph),
              1
              /* TEXT */
            )
          ]),
          vue.createElementVNode("view", { class: "card-visual__center" }, [
            vue.createElementVNode(
              "text",
              { class: "card-visual__center-rank" },
              vue.toDisplayString($setup.rankLabel),
              1
              /* TEXT */
            ),
            vue.createElementVNode(
              "text",
              { class: "card-visual__center-suit" },
              vue.toDisplayString($setup.suitGlyph),
              1
              /* TEXT */
            )
          ]),
          vue.createElementVNode("view", { class: "card-visual__corner card-visual__corner--bottom" }, [
            vue.createElementVNode(
              "text",
              { class: "card-visual__rank" },
              vue.toDisplayString($setup.rankLabel),
              1
              /* TEXT */
            ),
            vue.createElementVNode(
              "text",
              { class: "card-visual__suit" },
              vue.toDisplayString($setup.suitGlyph),
              1
              /* TEXT */
            )
          ])
        ])
      ],
      2
      /* CLASS */
    );
  }
  const PlayingCard = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["render", _sfc_render$5], ["__scopeId", "data-v-14f0ceae"], ["__file", "D:/heky/SWProject/Twentyfourgame/components/PlayingCard.vue"]]);
  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a === 0 ? 1 : Math.abs(a);
  }
  class Fraction {
    constructor(n, d) {
      if (d === 0)
        throw new Error("denominator 0");
      this.n = n;
      this.d = d;
      this.normSelf();
    }
    static fromInt(x) {
      return new Fraction(x, 1);
    }
    normSelf() {
      let n = this.n, d = this.d;
      if (d < 0) {
        n = -n;
        d = -d;
      }
      const g = gcd(Math.abs(n), Math.abs(d));
      this.n = n / g;
      this.d = d / g;
    }
    plus(o) {
      return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
    }
    minus(o) {
      return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
    }
    times(o) {
      return new Fraction(this.n * o.n, this.d * o.d);
    }
    div(o) {
      if (o.n === 0)
        throw new Error("divide by zero");
      return new Fraction(this.n * o.d, this.d * o.n);
    }
    equalsInt(v) {
      return this.n === v * this.d;
    }
    toString() {
      return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`;
    }
  }
  function solve24(nums) {
    if (!nums || nums.length !== 4)
      throw new Error("need 4 numbers");
    const start = nums.map((x) => ({ v: Fraction.fromInt(x), expr: String(x) }));
    const res = dfsSolve(start);
    return res ? res.expr : null;
  }
  function dfsSolve(list) {
    if (list.length === 1) {
      return list[0].v.equalsInt(24) ? list[0] : null;
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < list.length; j++) {
        if (i === j)
          continue;
        const rest = [];
        for (let k = 0; k < list.length; k++)
          if (k !== i && k !== j)
            rest.push(list[k]);
        const a = list[i], b = list[j];
        {
          const ve = { v: a.v.plus(b.v), expr: `(${a.expr}+${b.expr})` };
          const ans = dfsSolve(rest.concat([ve]));
          if (ans)
            return ans;
        }
        {
          const ve = { v: a.v.minus(b.v), expr: `(${a.expr}-${b.expr})` };
          const ans = dfsSolve(rest.concat([ve]));
          if (ans)
            return ans;
        }
        {
          const ve = { v: a.v.times(b.v), expr: `(${a.expr}×${b.expr})` };
          const ans = dfsSolve(rest.concat([ve]));
          if (ans)
            return ans;
        }
        if (b.v.n !== 0) {
          const ve = { v: a.v.div(b.v), expr: `(${a.expr}÷${b.expr})` };
          const ans = dfsSolve(rest.concat([ve]));
          if (ans)
            return ans;
        }
      }
    }
    return null;
  }
  function evaluateExprToFraction(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const c = expr[i];
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if ("()+-×÷".includes(c)) {
        tokens.push({ t: c });
        i++;
        continue;
      }
      if (/\d/.test(c)) {
        let j = i + 1;
        while (j < expr.length && /\d/.test(expr[j]))
          j++;
        tokens.push({ t: expr.slice(i, j) });
        i = j;
        continue;
      }
      return null;
    }
    const prec = (op) => op === "+" || op === "-" ? 1 : op === "×" || op === "÷" ? 2 : 0;
    const output = [];
    const stack = [];
    for (const t of tokens) {
      if (/^\d/.test(t.t))
        output.push(t);
      else if (t.t === "(")
        stack.push(t);
      else if (t.t === ")") {
        while (stack.length && stack[stack.length - 1].t !== "(")
          output.push(stack.pop());
        if (!stack.length || stack[stack.length - 1].t !== "(")
          return null;
        stack.pop();
      } else if ("+-×÷".includes(t.t)) {
        while (stack.length) {
          const top = stack[stack.length - 1].t;
          if ("+-×÷".includes(top) && prec(top) >= prec(t.t))
            output.push(stack.pop());
          else
            break;
        }
        stack.push(t);
      } else
        return null;
    }
    while (stack.length) {
      const op = stack.pop();
      if (op.t === "(")
        return null;
      output.push(op);
    }
    const st = [];
    for (const t of output) {
      if (/^\d/.test(t.t))
        st.push(Fraction.fromInt(parseInt(t.t)));
      else {
        if (st.length < 2)
          return null;
        const b = st.pop();
        const a = st.pop();
        let r;
        if (t.t === "+")
          r = a.plus(b);
        else if (t.t === "-")
          r = a.minus(b);
        else if (t.t === "×")
          r = a.times(b);
        else if (t.t === "÷") {
          if (b.n === 0)
            return null;
          r = a.div(b);
        } else
          return null;
        st.push(r);
      }
    }
    return st.length === 1 ? st[0] : null;
  }
  const CACHE_KEY = "__tf24_tab_cache__";
  function getGlobalData() {
    try {
      const app = getApp({ allowDefault: true });
      if (app) {
        app.globalData = app.globalData || {};
        app.globalData[CACHE_KEY] = app.globalData[CACHE_KEY] || {
          warmedAt: 0,
          usersState: null,
          overviewRows: null,
          statsExt: {},
          tabBarHeight: 0
        };
        return app.globalData[CACHE_KEY];
      }
    } catch (_) {
    }
    if (typeof globalThis !== "undefined") {
      globalThis.__tf24TabCache = globalThis.__tf24TabCache || {
        warmedAt: 0,
        usersState: null,
        overviewRows: null,
        statsExt: {},
        tabBarHeight: 0
      };
      return globalThis.__tf24TabCache;
    }
    return {
      warmedAt: 0,
      usersState: null,
      overviewRows: null,
      statsExt: {},
      tabBarHeight: 0
    };
  }
  function cloneUsersState(state) {
    if (!state || typeof state !== "object")
      return null;
    return {
      currentId: state.currentId || "",
      list: Array.isArray(state.list) ? state.list.map((u) => ({ ...u })) : []
    };
  }
  function cloneOverview(list) {
    if (!Array.isArray(list))
      return null;
    return list.map((item) => ({ ...item }));
  }
  function cloneStatsMap(map) {
    if (!map || typeof map !== "object")
      return {};
    const cloned = {};
    for (const key of Object.keys(map)) {
      const value = map[key];
      if (value && typeof value === "object") {
        cloned[key] = {
          totals: value.totals ? { ...value.totals } : { total: 0, success: 0, fail: 0 },
          days: value.days ? { ...value.days } : {},
          rounds: Array.isArray(value.rounds) ? value.rounds.map((r) => ({ ...r })) : [],
          agg: value.agg ? { ...value.agg } : {}
        };
      }
    }
    return cloned;
  }
  function refreshTabCaches() {
    const cache = getGlobalData();
    try {
      ensureInit();
    } catch (_) {
    }
    let usersState = null;
    try {
      usersState = getUsers();
    } catch (_) {
      usersState = { list: [], currentId: "" };
    }
    let overviewRows = null;
    try {
      overviewRows = allUsersWithStats();
    } catch (_) {
      overviewRows = [];
    }
    const statsExt = {};
    try {
      for (const item of overviewRows || []) {
        if (!item || !item.id)
          continue;
        try {
          statsExt[item.id] = readStatsExtended(item.id);
        } catch (_) {
          statsExt[item.id] = { totals: { total: 0, success: 0, fail: 0 }, days: {}, rounds: [], agg: {} };
        }
      }
    } catch (_) {
    }
    cache.usersState = cloneUsersState(usersState) || { list: [], currentId: "" };
    cache.overviewRows = cloneOverview(overviewRows) || [];
    cache.statsExt = cloneStatsMap(statsExt);
    cache.warmedAt = Date.now();
    return cache;
  }
  function scheduleTabWarmup(options = {}) {
    const { immediate = false, delay = 120 } = options || {};
    const run = () => {
      try {
        refreshTabCaches();
      } catch (_) {
      }
    };
    if (immediate) {
      run();
      return;
    }
    try {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 500 });
        return;
      }
    } catch (_) {
    }
    setTimeout(run, Number.isFinite(delay) ? Math.max(16, delay) : 120);
  }
  function getCachedUsersState() {
    const cache = getGlobalData();
    return cloneUsersState(cache.usersState);
  }
  function getCachedOverviewRows() {
    const cache = getGlobalData();
    return cloneOverview(cache.overviewRows);
  }
  function getCachedStatsExt(uid) {
    if (!uid)
      return null;
    const cache = getGlobalData();
    const ext = cache.statsExt && cache.statsExt[uid];
    if (!ext)
      return null;
    return cloneStatsMap({ [uid]: ext })[uid] || null;
  }
  function setCachedUsersState(state) {
    const cache = getGlobalData();
    cache.usersState = cloneUsersState(state) || { list: [], currentId: "" };
    cache.warmedAt = Date.now();
  }
  function setCachedOverviewRows(rows) {
    const cache = getGlobalData();
    cache.overviewRows = cloneOverview(rows) || [];
    cache.warmedAt = Date.now();
  }
  function mergeCachedStatsExt(map) {
    const cache = getGlobalData();
    const incoming = cloneStatsMap(map);
    cache.statsExt = { ...cache.statsExt || {}, ...incoming };
    cache.warmedAt = Date.now();
  }
  function createBasicState(cards, faceUseHigh) {
    const slots = [];
    for (let i = 0; i < 4; i++) {
      const card = cards && cards[i];
      if (card) {
        const mapped = mapCardRank(card.rank, faceUseHigh);
        const value = new Fraction(mapped, 1);
        slots.push({
          id: i,
          alive: true,
          value,
          expr: String(mapped),
          displayExpr: displayLabelForBasic(card, faceUseHigh),
          label: formatFractionValue(value),
          card: { rank: card.rank, suit: card.suit },
          source: "card"
        });
      } else {
        slots.push({
          id: i,
          alive: false,
          value: null,
          expr: "",
          displayExpr: "",
          label: "",
          card: null,
          source: "card"
        });
      }
    }
    return {
      slots,
      expression: "",
      displayExpression: ""
    };
  }
  function combineBasicSlots(state, firstIdx, secondIdx, op) {
    const { slots, history = [], expression = "", displayExpression = "" } = state || {};
    if (firstIdx === secondIdx) {
      return { ok: false, err: "SAME_INDEX" };
    }
    const first = slots && slots[firstIdx];
    const second = slots && slots[secondIdx];
    if (!first || !second || !first.alive || !second.alive) {
      return { ok: false, err: "INACTIVE_SLOT" };
    }
    let result;
    try {
      result = operateFractions(first.value, second.value, op);
    } catch (e) {
      if (e && e.message === "divide-by-zero") {
        return { ok: false, err: "DIVIDE_BY_ZERO" };
      }
      return { ok: false, err: "INVALID_OPERATION" };
    }
    if (!result)
      return { ok: false, err: "INVALID_OPERATION" };
    const snapshot = {
      slots: cloneSlotsForHistory(slots),
      expression,
      displayExpression
    };
    const newExpr = `(${first.expr}${op}${second.expr})`;
    const newDisplayExpr = `(${first.displayExpr}${op}${second.displayExpr})`;
    const updatedSlots = slots.map((slot, idx) => {
      if (!slot)
        return null;
      if (idx === firstIdx) {
        return { ...slot, alive: false };
      }
      if (idx === secondIdx) {
        return {
          id: slot.id,
          alive: true,
          value: result,
          expr: newExpr,
          displayExpr: newDisplayExpr,
          label: formatFractionValue(result),
          card: null,
          source: "value"
        };
      }
      if (!slot.value)
        return { ...slot };
      return {
        id: slot.id,
        alive: slot.alive,
        value: slot.value ? new Fraction(slot.value.n, slot.value.d) : null,
        expr: slot.expr,
        displayExpr: slot.displayExpr,
        label: slot.label,
        card: slot.card ? { rank: slot.card.rank, suit: slot.card.suit } : null,
        source: slot.source
      };
    });
    const alive = updatedSlots.filter((s) => s && s.alive);
    const exprForRecord = stripOuterParens(newExpr);
    const stats = statsFromExpressionString(exprForRecord);
    return {
      ok: true,
      data: {
        slots: updatedSlots,
        history: [...history, snapshot],
        expression: newExpr,
        displayExpression: formatExpressionWithValue(newDisplayExpr, result),
        result,
        aliveCount: alive.length,
        exprForRecord,
        stats,
        isSolved: alive.length === 1 && result.equalsInt && result.equalsInt(24)
      }
    };
  }
  function undoBasicHistory(history) {
    if (!history || !history.length) {
      return { ok: false, err: "EMPTY_HISTORY" };
    }
    const nextHistory = history.slice(0, history.length - 1);
    const snapshot = history[history.length - 1];
    return {
      ok: true,
      data: {
        history: nextHistory,
        slots: restoreSlotsFromHistory(snapshot.slots || []),
        expression: snapshot.expression || "",
        displayExpression: snapshot.displayExpression || ""
      }
    };
  }
  function cloneSlotsForHistory(slots) {
    return (slots || []).map((slot) => {
      if (!slot)
        return null;
      return {
        id: slot.id,
        alive: slot.alive,
        value: slot.value ? { n: slot.value.n, d: slot.value.d } : null,
        expr: slot.expr,
        displayExpression: slot.displayExpression || slot.displayExpr,
        displayExpr: slot.displayExpr,
        label: slot.label,
        card: slot.card ? { rank: slot.card.rank, suit: slot.card.suit } : null,
        source: slot.source
      };
    });
  }
  function restoreSlotsFromHistory(slots) {
    return (slots || []).map((slot) => {
      if (!slot)
        return null;
      return {
        id: slot.id,
        alive: slot.alive,
        value: slot.value ? new Fraction(slot.value.n, slot.value.d) : null,
        expr: slot.expr,
        displayExpr: slot.displayExpr || slot.displayExpression || "",
        label: slot.label,
        card: slot.card ? { rank: slot.card.rank, suit: slot.card.suit } : null,
        source: slot.source
      };
    });
  }
  function displayLabelForBasic(card, faceUseHigh) {
    if (!card)
      return "";
    const mapped = mapCardRank(card.rank, faceUseHigh);
    if ((card.rank === 11 || card.rank === 12 || card.rank === 13) && !faceUseHigh) {
      return String(mapped);
    }
    return labelForRank(card.rank);
  }
  function drawSolvableHand(deck, faceUseHigh, solve24Fn = solve24) {
    const list = Array.isArray(deck) ? deck.slice() : [];
    if (list.length < 4) {
      return { ok: false, err: "DECK_INSUFFICIENT" };
    }
    const maxTry = Math.min(200, 1 + list.length * list.length);
    for (let t = 0; t < maxTry; t++) {
      const idxs = /* @__PURE__ */ new Set();
      while (idxs.size < 4)
        idxs.add(Math.floor(Math.random() * list.length));
      const ids = Array.from(idxs);
      const cards = ids.map((i) => list[i]);
      const mapped = cards.map((c) => mapCardRank(c.rank, faceUseHigh));
      const sol = solve24Fn(mapped);
      if (sol) {
        const remaining = list.slice();
        ids.sort((a, b) => b - a);
        const hand = [];
        for (const i of ids) {
          hand.unshift(remaining[i]);
          remaining.splice(i, 1);
        }
        return { ok: true, data: { cards: hand, deck: remaining, solution: sol } };
      }
    }
    return { ok: false, err: "NO_SOLVABLE" };
  }
  function newDeck() {
    return createShuffledDeck();
  }
  const KEY_PREFIX = "mistakes:";
  function createEmptyBook() {
    return { active: {}, ledger: {} };
  }
  function toInt(val) {
    const num = Number(val);
    if (!Number.isFinite(num))
      return 0;
    return Math.max(0, Math.floor(num));
  }
  function sanitizeNums(nums, fallbackKey) {
    if (Array.isArray(nums) && nums.length) {
      return nums.map((n) => Number.isFinite(+n) ? +n : 0).sort((a, b) => a - b);
    }
    if (typeof fallbackKey === "string" && fallbackKey) {
      return fallbackKey.split(",").map((n) => Number.isFinite(+n) ? +n : 0).sort((a, b) => a - b);
    }
    return [];
  }
  function sanitizeItem(key, item) {
    const now = Date.now();
    const base = item && typeof item === "object" ? item : {};
    const nums = sanitizeNums(base.nums, key);
    const attempts = toInt(base.attempts);
    const wrong = toInt(base.wrong);
    const correct = toInt(base.correct);
    const total = attempts || wrong + correct;
    const streak = toInt(base.streakCorrect);
    const lastSeen = Number.isFinite(+base.lastSeenTs) ? +base.lastSeenTs : 0;
    const created = Number.isFinite(+base.createdTs) ? +base.createdTs : now;
    const lastResult = base.lastResult === "correct" || base.lastResult === "wrong" ? base.lastResult : null;
    return {
      key: typeof base.key === "string" && base.key ? base.key : key,
      nums,
      attempts: total,
      wrong,
      correct,
      lastSeenTs: lastSeen,
      lastResult,
      streakCorrect: streak,
      createdTs: created
    };
  }
  function normalizeKey(nums = []) {
    if (!Array.isArray(nums) || nums.length === 0)
      return "";
    return nums.map((n) => Number.isFinite(+n) ? +n : 0).sort((a, b) => a - b).join(",");
  }
  function loadMistakeBook(userId) {
    if (!userId)
      return createEmptyBook();
    try {
      const raw = uni.getStorageSync(KEY_PREFIX + userId);
      if (!raw)
        return createEmptyBook();
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data || typeof data !== "object")
        return createEmptyBook();
      const book = createEmptyBook();
      const active = data.active && typeof data.active === "object" ? data.active : {};
      const ledger = data.ledger && typeof data.ledger === "object" ? data.ledger : {};
      for (const key of Object.keys(active)) {
        book.active[key] = sanitizeItem(key, active[key]);
      }
      for (const key of Object.keys(ledger)) {
        book.ledger[key] = sanitizeItem(key, ledger[key]);
      }
      return book;
    } catch (_) {
      return createEmptyBook();
    }
  }
  function saveMistakeBook(userId, book) {
    if (!userId)
      return;
    const data = book && typeof book === "object" ? book : createEmptyBook();
    try {
      uni.setStorageSync(KEY_PREFIX + userId, JSON.stringify({
        active: data.active || {},
        ledger: data.ledger || {}
      }));
    } catch (_) {
    }
  }
  function getActivePool(userId) {
    const book = loadMistakeBook(userId);
    return Object.values(book.active || {});
  }
  function recordRoundResult({ userId, nums, success }) {
    if (!userId || !Array.isArray(nums) || nums.length === 0)
      return;
    const sortedNums = nums.map((n) => Number.isFinite(+n) ? +n : 0).sort((a, b) => a - b);
    const key = normalizeKey(sortedNums);
    if (!key)
      return;
    const now = Date.now();
    const book = loadMistakeBook(userId);
    const ledger = book.ledger || {};
    const active = book.active || {};
    const existingLedger = ledger[key] ? sanitizeItem(key, ledger[key]) : sanitizeItem(key, { key, nums: sortedNums, createdTs: now });
    const updated = { ...existingLedger };
    updated.nums = sortedNums.slice();
    updated.attempts = toInt(updated.attempts) + 1;
    updated.createdTs = Number.isFinite(+updated.createdTs) ? +updated.createdTs : now;
    updated.lastSeenTs = now;
    updated.lastResult = success ? "correct" : "wrong";
    if (success) {
      updated.correct = toInt(updated.correct) + 1;
      updated.streakCorrect = toInt(updated.streakCorrect) + 1;
    } else {
      updated.wrong = toInt(updated.wrong) + 1;
      updated.streakCorrect = 0;
    }
    ledger[key] = updated;
    const isActive = !!active[key];
    if (!success) {
      const activeItem = isActive ? sanitizeItem(key, active[key]) : sanitizeItem(key, { key, nums: sortedNums, createdTs: now });
      activeItem.nums = sortedNums.slice();
      activeItem.attempts = updated.attempts;
      activeItem.wrong = updated.wrong;
      activeItem.correct = updated.correct;
      activeItem.lastSeenTs = now;
      activeItem.lastResult = "wrong";
      activeItem.streakCorrect = 0;
      active[key] = activeItem;
    } else if (success && updated.streakCorrect >= 5) {
      if (isActive)
        delete active[key];
    } else if (isActive) {
      const activeItem = sanitizeItem(key, active[key]);
      activeItem.nums = sortedNums.slice();
      activeItem.attempts = updated.attempts;
      activeItem.wrong = updated.wrong;
      activeItem.correct = updated.correct;
      activeItem.lastSeenTs = now;
      activeItem.lastResult = "correct";
      activeItem.streakCorrect = updated.streakCorrect;
      active[key] = activeItem;
    }
    book.ledger = ledger;
    book.active = active;
    saveMistakeBook(userId, book);
  }
  function getSummary(userId) {
    var _a;
    const book = loadMistakeBook(userId);
    const ledger = book.ledger || {};
    let totalWrong = 0;
    for (const key of Object.keys(ledger)) {
      totalWrong += toInt((_a = ledger[key]) == null ? void 0 : _a.wrong);
    }
    const totalActive = Object.keys(book.active || {}).length;
    return { totalWrongCount: totalWrong, totalActiveCount: totalActive };
  }
  const BASIC_EXPR_HEIGHT_PX = 70;
  const PRO_EXPR_HEIGHT_PX = 80;
  const SESSION_KEY = "tf24_game_session_v1";
  const FALLBACK_TOP_RPX = 520;
  const FALLBACK_BOTTOM_RPX = 320;
  const MODE_CHANGE_EVENT$1 = "tf24:mode-changed";
  const _sfc_main$5 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const cards = vue.ref([{ rank: 1, suit: "S" }, { rank: 5, suit: "H" }, { rank: 5, suit: "D" }, { rank: 5, suit: "C" }]);
      const solution = vue.ref(null);
      const usedByCard = vue.ref([0, 0, 0, 0]);
      const tokens = vue.ref([]);
      let initialMode = "basic";
      try {
        const savedMode = getLastMode();
        if (savedMode === "pro" || savedMode === "basic")
          initialMode = savedMode;
      } catch (_) {
      }
      const mode = vue.ref(initialMode);
      try {
        setLastMode(initialMode);
      } catch (_) {
      }
      const basicSlots = vue.ref([]);
      const basicSelection = vue.ref({ first: null, operator: null });
      const basicHistory = vue.ref([]);
      const basicExpression = vue.ref("");
      const basicDisplayExpression = vue.ref("");
      const basicOpsMetrics = vue.ref({ totalHeight: 0, buttonHeight: 0 });
      const basicOpsStyle = vue.computed(() => {
        const metrics = basicOpsMetrics.value || {};
        const btn = Number(metrics.buttonHeight);
        const total = Number(metrics.totalHeight);
        if (!Number.isFinite(btn) || btn <= 0)
          return {};
        const style = { "--basic-ops-button-height": `${btn}px` };
        if (Number.isFinite(total) && total > 0)
          style.height = `${total}px`;
        return style;
      });
      const gameplayDefaults = (() => {
        try {
          const prefs = getGameplayPrefs();
          return {
            rankMode: prefs.rankMode || "jqk-11-12-13",
            deckSource: prefs.deckSource || "regular",
            mixWeight: Number.isFinite(prefs.mixWeight) ? prefs.mixWeight : 50,
            haptics: !!prefs.haptics,
            sfx: !!prefs.sfx,
            reducedMotion: !!prefs.reducedMotion
          };
        } catch (_) {
          return { rankMode: "jqk-11-12-13", deckSource: "regular", mixWeight: 50, haptics: true, sfx: true, reducedMotion: false };
        }
      })();
      const appliedGameplay = vue.ref({ ...gameplayDefaults });
      const pendingGameplay = vue.ref({ ...gameplayDefaults });
      const faceUseHigh = vue.ref(appliedGameplay.value.rankMode === "jqk-11-12-13");
      const hapticsEnabled = vue.ref(!!appliedGameplay.value.haptics);
      const sfxEnabled = vue.ref(!!appliedGameplay.value.sfx);
      const reducedMotion = vue.ref(!!appliedGameplay.value.reducedMotion);
      const handRecorded = vue.ref(false);
      const timeoutRecorded = vue.ref(false);
      const exprZoneHeight = vue.ref(initialMode === "pro" ? PRO_EXPR_HEIGHT_PX : BASIC_EXPR_HEIGHT_PX);
      const currentUser = vue.ref(null);
      const avatarLoadFailed = vue.ref(false);
      const currentUserName = vue.computed(() => {
        const name = currentUser.value && typeof currentUser.value.name === "string" ? currentUser.value.name.trim() : "";
        return name || "未登录";
      });
      const currentUserAvatar = vue.computed(() => currentUser.value && currentUser.value.avatar ? currentUser.value.avatar : "");
      const currentUserInitial = vue.computed(() => avatarInitial(currentUserName.value));
      const currentUserColor = vue.computed(() => colorFromUser(currentUser.value));
      const deck = vue.ref([]);
      const deckSource = vue.ref(appliedGameplay.value.deckSource || "regular");
      const mixWeight = vue.ref(appliedGameplay.value.mixWeight ?? 50);
      const mistakeRunUsed = vue.ref(/* @__PURE__ */ new Set());
      const mistakeRunStamp = vue.ref(0);
      const currentHandSource = vue.ref("regular");
      const currentMistakeKey = vue.ref("");
      const handsPlayed = vue.ref(0);
      const successCount = vue.ref(0);
      const failCount = vue.ref(0);
      const sessionOver = vue.ref(false);
      const timerPopover = vue.ref({ visible: false, left: 0, top: 0 });
      const timerPopoverStyle = vue.computed(() => ({ left: `${timerPopover.value.left}px`, top: `${timerPopover.value.top}px` }));
      const successAnimating = vue.ref(false);
      const errorAnimating = vue.ref(false);
      const exprOverrideText = vue.ref("");
      const errorValueText = vue.ref("");
      const handStartTs = vue.ref(Date.now());
      const nowTs = vue.ref(Date.now());
      const hintWasUsed = vue.ref(false);
      const attemptCount = vue.ref(0);
      const lastSuccessMs = vue.ref(null);
      const handSettled = vue.ref(false);
      const settledResult = vue.ref(null);
      const handFailedOnce = vue.ref(false);
      const { safeTop, safeBottom, windowHeight, refreshSafeArea } = useSafeArea();
      const pageInlineStyle = vue.computed(() => ({
        paddingTop: `${Math.max(0, safeTop.value || 0)}px`
      }));
      const topFixedPx = vue.ref(rpxToPx(FALLBACK_TOP_RPX));
      const bottomFixedPx = vue.ref(rpxToPx(FALLBACK_BOTTOM_RPX));
      const middleHeight = vue.ref(0);
      let layoutTimer = null;
      const { hintState, showHint, hideHint } = useFloatingHint();
      const basicErrorMessages = {
        SAME_INDEX: "请选择另一张牌",
        INACTIVE_SLOT: "请选择有效的数字",
        DIVIDE_BY_ZERO: "除数不能为 0",
        INVALID_OPERATION: "无法进行该运算，请重试"
      };
      function showBasicError(code) {
        const msg = basicErrorMessages[code] || "操作无效，请重试";
        showHint(msg, { interactive: true });
      }
      const edgeHandlers = useEdgeExit({ showHint, onExit: () => exitGamePage() });
      let lastBackPressTs = 0;
      onBackPress(() => {
        const now = Date.now();
        if (now - lastBackPressTs < 2e3) {
          exitGamePage();
        } else {
          lastBackPressTs = now;
          try {
            showHint("再按一次返回退出应用", { duration: 2e3, interactive: false });
          } catch (_) {
            uni.showToast({ title: "再按一次退出应用", icon: "none" });
          }
        }
        return true;
      });
      const fmtMs = formatMs;
      const fmtMs1 = formatMsShort;
      function normalizeRankMode(mode2) {
        return mode2 === "jqk-1" ? "jqk-1" : "jqk-11-12-13";
      }
      function normalizeDeckSourceValue(value) {
        if (value === "mistakes" || value === "mix")
          return value;
        if (value === "mistake")
          return "mistakes";
        return "regular";
      }
      function clampMixWeightValue(value) {
        return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 50;
      }
      function normalizeGameplaySnapshot(prefs) {
        const snapshot = prefs && typeof prefs === "object" ? prefs : {};
        return {
          rankMode: normalizeRankMode(snapshot.rankMode),
          deckSource: normalizeDeckSourceValue(snapshot.deckSource),
          mixWeight: clampMixWeightValue(snapshot.mixWeight),
          haptics: typeof snapshot.haptics === "boolean" ? snapshot.haptics : true,
          sfx: typeof snapshot.sfx === "boolean" ? snapshot.sfx : true,
          reducedMotion: typeof snapshot.reducedMotion === "boolean" ? snapshot.reducedMotion : false
        };
      }
      function syncPendingGameplayPrefs() {
        try {
          const prefs = getGameplayPrefs();
          if (prefs && prefs.rankMigrationNotice) {
            try {
              uni.showToast({ title: "已迁移到新规则：JQK 仅支持 1 或 11/12/13", icon: "none", duration: 2400 });
            } catch (_) {
            }
            try {
              consumeRankMigrationNotice();
            } catch (_) {
            }
            prefs.rankMigrationNotice = false;
          }
          const latest = normalizeGameplaySnapshot(prefs);
          pendingGameplay.value = { ...latest };
          try {
            const latestMode = getLastMode && getLastMode();
            if (latestMode)
              applyModeFromPreference(latestMode);
          } catch (_) {
          }
        } catch (_) {
        }
      }
      function applyPendingGameplayPrefs() {
        const latest = pendingGameplay.value || gameplayDefaults;
        appliedGameplay.value = { ...latest };
        faceUseHigh.value = appliedGameplay.value.rankMode === "jqk-11-12-13";
        deckSource.value = appliedGameplay.value.deckSource;
        mixWeight.value = appliedGameplay.value.mixWeight;
        hapticsEnabled.value = appliedGameplay.value.haptics;
        sfxEnabled.value = appliedGameplay.value.sfx;
        reducedMotion.value = appliedGameplay.value.reducedMotion;
        updateExprHeight();
      }
      function requestLayoutMeasure() {
        computeMiddleHeight();
        if (layoutTimer)
          return;
        layoutTimer = setTimeout(() => {
          layoutTimer = null;
          measureFixedSections();
        }, 16);
      }
      function measureFixedSections() {
        try {
          vue.nextTick(() => {
            var _a, _b;
            const query = uni.createSelectorQuery();
            if (query && proxy)
              query.in(proxy);
            (_a = query == null ? void 0 : query.select("#gameTopBox")) == null ? void 0 : _a.boundingClientRect((rect) => {
              if (rect && Number.isFinite(rect.height)) {
                topFixedPx.value = Math.max(rect.height, rpxToPx(FALLBACK_TOP_RPX));
              }
            });
            (_b = query == null ? void 0 : query.select("#gameBottomBox")) == null ? void 0 : _b.boundingClientRect((rect) => {
              if (rect && Number.isFinite(rect.height)) {
                bottomFixedPx.value = Math.max(rect.height, rpxToPx(FALLBACK_BOTTOM_RPX));
              }
            });
            query == null ? void 0 : query.exec(() => {
              computeMiddleHeight();
              syncBasicOpsHeight();
            });
          });
        } catch (_) {
          computeMiddleHeight();
        }
      }
      function computeMiddleHeight() {
        const fallbackWindow = (() => {
          if (typeof window !== "undefined" && Number.isFinite(window.innerHeight))
            return window.innerHeight;
          return 0;
        })();
        const wh = windowHeight.value || fallbackWindow;
        if (!wh) {
          middleHeight.value = Math.max(0, middleHeight.value || 0);
          return;
        }
        const topPx = Math.max(topFixedPx.value || 0, rpxToPx(FALLBACK_TOP_RPX));
        const bottomPx = Math.max(bottomFixedPx.value || 0, rpxToPx(FALLBACK_BOTTOM_RPX));
        const safeTopPx = Math.max(0, safeTop.value || 0);
        const safeBottomPx = Math.max(0, safeBottom.value || 0);
        const tabHeight = safeBottomPx;
        const available = wh - safeTopPx - topPx - bottomPx - tabHeight;
        middleHeight.value = Math.max(0, available);
      }
      function avatarInitial(name) {
        if (!name)
          return "U";
        const s = String(name).trim();
        return s.length ? s[0].toUpperCase() : "U";
      }
      function colorFromUser(user) {
        const base = String((user == null ? void 0 : user.id) || (user == null ? void 0 : user.name) || "");
        if (!base)
          return "#e2e8f0";
        let hash = 0;
        for (let i = 0; i < base.length; i++) {
          hash = hash * 33 + base.charCodeAt(i) >>> 0;
        }
        const palette = ["#e2e8f0", "#fde68a", "#bbf7d0", "#bfdbfe", "#fecaca", "#f5d0fe", "#c7d2fe"];
        return palette[hash % palette.length];
      }
      function onAvatarError() {
        avatarLoadFailed.value = true;
      }
      function saveSession() {
        try {
          const data = {
            deck: deck.value || [],
            cards: cards.value || [],
            tokens: (tokens.value || []).map((t) => ({ type: t.type, value: t.value, rank: t.rank, suit: t.suit })),
            usedByCard: usedByCard.value || [],
            faceUseHigh: !!faceUseHigh.value,
            rankMode: appliedGameplay.value.rankMode,
            handRecorded: !!handRecorded.value,
            timeoutRecorded: !!timeoutRecorded.value,
            handStartTs: handStartTs.value || 0,
            hintWasUsed: !!hintWasUsed.value,
            attemptCount: attemptCount.value || 0,
            handsPlayed: handsPlayed.value || 0,
            successCount: successCount.value || 0,
            failCount: failCount.value || 0,
            handFailedOnce: !!handFailedOnce.value,
            solution: solution.value || null,
            // persisted solution to avoid "暂无提示" after restore
            deckSource: deckSource.value || "regular",
            mixWeight: mixWeight.value,
            haptics: hapticsEnabled.value,
            sfx: sfxEnabled.value,
            reducedMotion: reducedMotion.value,
            mistakeRunUsed: Array.from(mistakeRunUsed.value || []),
            mistakeRunStamp: mistakeRunStamp.value || 0,
            currentHandSource: currentHandSource.value || "regular",
            currentMistakeKey: currentMistakeKey.value || "",
            mode: mode.value || "basic"
          };
          uni.setStorageSync(SESSION_KEY, JSON.stringify(data));
        } catch (_) {
        }
      }
      function loadSession() {
        try {
          const raw = uni.getStorageSync(SESSION_KEY);
          if (!raw)
            return false;
          const data = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (!data || !Array.isArray(data.deck) || !Array.isArray(data.cards))
            return false;
          if ((data.cards || []).length === 4) {
            const restoredMode = data.mode === "pro" ? "pro" : "basic";
            let preferredMode = null;
            try {
              preferredMode = getLastMode ? getLastMode() : null;
            } catch (_) {
              preferredMode = null;
            }
            if (preferredMode && preferredMode !== restoredMode) {
              applyModeFromPreference(preferredMode);
              closeTimerPopover();
              return false;
            }
            deck.value = data.deck;
            cards.value = data.cards;
            resetBasicStateFromCards();
            tokens.value = Array.isArray(data.tokens) ? data.tokens : [];
            usedByCard.value = Array.isArray(data.usedByCard) ? data.usedByCard : [0, 0, 0, 0];
            const restoredRankMode = normalizeRankMode(data.rankMode || (data.faceUseHigh ? "jqk-11-12-13" : "jqk-1"));
            const restoredGameplay = normalizeGameplaySnapshot({
              rankMode: restoredRankMode,
              deckSource: data.deckSource,
              mixWeight: data.mixWeight,
              haptics: data.haptics,
              sfx: data.sfx,
              reducedMotion: data.reducedMotion
            });
            appliedGameplay.value = { ...restoredGameplay };
            pendingGameplay.value = { ...pendingGameplay.value, ...restoredGameplay };
            faceUseHigh.value = restoredGameplay.rankMode === "jqk-11-12-13";
            deckSource.value = restoredGameplay.deckSource;
            mixWeight.value = restoredGameplay.mixWeight;
            hapticsEnabled.value = restoredGameplay.haptics;
            sfxEnabled.value = restoredGameplay.sfx;
            reducedMotion.value = restoredGameplay.reducedMotion;
            handRecorded.value = !!data.handRecorded;
            timeoutRecorded.value = !!data.timeoutRecorded;
            handStartTs.value = data.handStartTs || Date.now();
            hintWasUsed.value = !!data.hintWasUsed;
            attemptCount.value = data.attemptCount || 0;
            handsPlayed.value = data.handsPlayed || 0;
            successCount.value = data.successCount || 0;
            failCount.value = data.failCount || 0;
            handFailedOnce.value = !!data.handFailedOnce;
            solution.value = data.solution || null;
            mistakeRunUsed.value = new Set(Array.isArray(data.mistakeRunUsed) ? data.mistakeRunUsed : []);
            mistakeRunStamp.value = data.mistakeRunStamp || 0;
            currentHandSource.value = data.currentHandSource === "mistake" ? "mistake" : "regular";
            currentMistakeKey.value = typeof data.currentMistakeKey === "string" ? data.currentMistakeKey : "";
            mode.value = restoredMode;
            closeTimerPopover();
            if (!solution.value) {
              try {
                const mapped = (cards.value || []).map((c) => mapCardRank(c.rank, faceUseHigh.value));
                solution.value = mapped.length === 4 ? solve24(mapped) : null;
              } catch (_) {
                solution.value = null;
              }
            }
            vue.nextTick(() => {
              updateVHVar();
              updateExprHeight();
              updateExprScale();
            });
            return true;
          }
          return false;
        } catch (_) {
          return false;
        }
      }
      const remainingCards = vue.computed(() => {
        if (deckSource.value === "mistakes") {
          const uid = selectedUserId.value;
          if (!uid)
            return 0;
          const pool = getActivePool(uid) || [];
          if (!Array.isArray(pool) || pool.length === 0)
            return 0;
          const used = mistakeRunUsed.value instanceof Set ? mistakeRunUsed.value : /* @__PURE__ */ new Set();
          let remainingHands = 0;
          for (const item of pool) {
            if (!item || !item.key)
              continue;
            if (!used.has(item.key))
              remainingHands += 1;
          }
          return remainingHands * 4;
        }
        return Array.isArray(deck.value) ? deck.value.length : 0;
      });
      const winRate = vue.computed(() => {
        const t = successCount.value + failCount.value;
        return t ? Math.round(100 * successCount.value / t) : 0;
      });
      const handElapsedMs = vue.computed(() => {
        const start = handStartTs.value || Date.now();
        const now = nowTs.value || Date.now();
        const d = now - start;
        return d > 0 ? d : 0;
      });
      let handTimer = null;
      function startHandTimer() {
        if (handTimer)
          return;
        try {
          handTimer = setInterval(() => {
            const now = Date.now();
            nowTs.value = now;
            const start = handStartTs.value || now;
            if (!timeoutRecorded.value && now - start >= 12e4) {
              handleTimeout();
            }
          }, 100);
        } catch (_) {
          handTimer = null;
        }
      }
      function stopHandTimer() {
        if (handTimer) {
          try {
            clearInterval(handTimer);
          } catch (_) {
          }
          handTimer = null;
        }
      }
      function handleTimeout() {
        if (timeoutRecorded.value || handRecorded.value)
          return;
        timeoutRecorded.value = true;
        handRecorded.value = true;
        handFailedOnce.value = true;
        const elapsed = Date.now() - (handStartTs.value || Date.now());
        const normalizedElapsed = elapsed > 0 ? elapsed : 12e4;
        const statsData = computeExprStats(tokens.value);
        handsPlayed.value += 1;
        failCount.value += 1;
        try {
          pushRound({
            success: false,
            timeMs: normalizedElapsed,
            hintUsed: !!hintWasUsed.value,
            retries: attemptCount.value || 0,
            ops: statsData.ops,
            exprLen: statsData.exprLen,
            maxDepth: statsData.maxDepth,
            faceUseHigh: !!faceUseHigh.value,
            hand: { cards: (cards.value || []).map((c) => ({ rank: c.rank, suit: c.suit })) },
            expr: expr.value
          });
          updateLastSuccess();
        } catch (_) {
        }
        if (selectedUserId.value) {
          try {
            recordRoundResult({ userId: selectedUserId.value, nums: currentHandNums.value, success: false });
          } catch (_) {
          }
        }
        try {
          showHint("超过120秒，已记失败，可继续作答", 2e3);
        } catch (_) {
        }
      }
      const drag = vue.ref({ active: false, token: null, x: 0, y: 0, startX: 0, startY: 0, moved: false });
      const exprBox = vue.ref({ left: 0, top: 0, right: 0, bottom: 0 });
      const tokRects = vue.ref([]);
      const dragInsertIndex = vue.ref(-1);
      const lastInsertedIndex = vue.ref(-1);
      const { proxy } = vue.getCurrentInstance();
      const booted = vue.ref(false);
      const selectedUserId = vue.computed(() => currentUser.value && currentUser.value.id ? currentUser.value.id : "");
      const currentHandNums = vue.computed(() => {
        const arr = (cards.value || []).map((c) => c.rank);
        return arr.sort((a, b) => a - b);
      });
      vue.watch([safeTop, windowHeight, safeBottom], () => {
        requestLayoutMeasure();
      });
      vue.watch(selectedUserId, (newId, oldId) => {
        if (newId === oldId)
          return;
        const inMistake = deckSource.value === "mistakes";
        resetMistakeRun(inMistake ? Date.now() : 0);
        if (!newId && inMistake) {
          switchDeckSource("regular", { scheduleNext: false });
          resetMistakeRun(0);
          vue.nextTick(() => {
            nextHand();
          });
        } else if (inMistake && newId) {
          vue.nextTick(() => {
            nextHand();
          });
        }
      });
      const expr = vue.computed(() => tokensToExpression(tokens.value, faceUseHigh.value));
      const ghostStyle = vue.computed(() => `left:${drag.value.x}px; top:${drag.value.y}px;`);
      const exprScale = vue.ref(1);
      const opsDensity = vue.ref("normal");
      const opsDensityClass = vue.computed(() => opsDensity.value === "tight" ? "ops-tight" : opsDensity.value === "compact" ? "ops-compact" : "");
      function updateExprHeight() {
        exprZoneHeight.value = mode.value === "pro" ? PRO_EXPR_HEIGHT_PX : BASIC_EXPR_HEIGHT_PX;
        try {
          const sys = uni.getSystemInfoSync && uni.getSystemInfoSync() || {};
          const winH = sys.windowHeight || sys.screenHeight || 0;
          if (mode.value !== "pro") {
            opsDensity.value = "normal";
            return;
          }
          if (winH && winH < 640)
            opsDensity.value = "tight";
          else if (winH && winH < 740)
            opsDensity.value = "compact";
          else
            opsDensity.value = "normal";
        } catch (_) {
          opsDensity.value = "normal";
        }
      }
      updateExprHeight();
      function syncBasicOpsHeight() {
        if (mode.value !== "basic") {
          basicOpsMetrics.value = { totalHeight: 0, buttonHeight: 0 };
          return;
        }
        vue.nextTick(() => {
          var _a;
          try {
            const query = uni.createSelectorQuery();
            if (query && proxy)
              query.in(proxy);
            (_a = query == null ? void 0 : query.select(".basic-card")) == null ? void 0 : _a.boundingClientRect();
            query == null ? void 0 : query.exec((res) => {
              const rect = Array.isArray(res) ? res[0] : null;
              const cardHeight = rect && Number.isFinite(rect == null ? void 0 : rect.height) ? rect.height : 0;
              if (!cardHeight)
                return;
              const cardGap = Math.max(0, Number(rpxToPx ? rpxToPx(18) : 0));
              const opsGap = Math.max(0, Number(rpxToPx ? rpxToPx(12) : 0));
              const totalHeight = cardHeight * 2 + cardGap;
              const buttonHeight = (totalHeight - opsGap * 3) / 4;
              if (!Number.isFinite(buttonHeight) || buttonHeight <= 0)
                return;
              basicOpsMetrics.value = { totalHeight, buttonHeight };
            });
          } catch (_) {
          }
        });
      }
      const ghostText = vue.computed(() => {
        const t = drag.value.token;
        if (!t)
          return "";
        if (t.type === "num")
          return labelForRank(t.rank || +t.value);
        if (t.type === "tok")
          return /^(10|11|12|13|[1-9])$/.test(t.value) ? labelForRank(+t.value) : t.value;
        return t.value || "";
      });
      const placeholderSizeClass = vue.computed(() => {
        const dt = drag.value.token;
        if (!drag.value.active || !dt)
          return "op";
        if (dt.type === "num")
          return "num";
        if (dt.type === "op")
          return "op";
        if (dt.type === "tok")
          return /^(10|11|12|13|[1-9])$/.test(dt.value) ? "num" : "op";
        return "op";
      });
      function applyModeFromPreference(prefMode) {
        const normalized = prefMode === "pro" ? "pro" : "basic";
        if (mode.value !== normalized) {
          mode.value = normalized;
        }
        updateExprHeight();
        syncBasicOpsHeight();
      }
      function handleExternalModeChange(newMode) {
        applyModeFromPreference(newMode);
      }
      function applyLatestModePreference() {
        try {
          const latestMode = getLastMode ? getLastMode() : null;
          if (latestMode)
            applyModeFromPreference(latestMode);
        } catch (_) {
        }
      }
      const undoDisabled = vue.computed(() => mode.value === "pro" ? tokens.value.length === 0 : basicHistory.value.length === 0);
      const resetDisabled = vue.computed(() => mode.value === "pro" ? tokens.value.length === 0 : false);
      const submitDisabled = vue.computed(() => mode.value !== "pro" || tokens.value.length === 0);
      function clearExprOverride() {
        if (exprOverrideText.value)
          exprOverrideText.value = "";
      }
      function showExpressionErrorToast() {
        showHint("表达式不合法，请重试", 1600);
      }
      function basicCardClass(idx) {
        const slot = basicSlots.value[idx];
        return {
          hidden: !slot || !slot.alive,
          selected: basicSelection.value.first === idx,
          result: !!(slot && slot.alive && slot.source === "value")
        };
      }
      function resetBasicStateFromCards() {
        const base = createBasicState(cards.value || [], faceUseHigh.value);
        basicSlots.value = base.slots;
        basicSelection.value = { first: null, operator: null };
        basicHistory.value = [];
        basicExpression.value = base.expression;
        basicDisplayExpression.value = base.displayExpression;
      }
      function handleBasicOperator(op) {
        if (mode.value !== "basic" || handSettled.value)
          return;
        if (basicSelection.value.first === null) {
          showHint("请先选择一个数字", { interactive: true });
          return;
        }
        if (basicSelection.value.operator === op) {
          basicSelection.value.operator = null;
          return;
        }
        basicSelection.value.operator = op;
      }
      function handleBasicCardTap(idx) {
        if (mode.value !== "basic" || handSettled.value)
          return;
        const slot = basicSlots.value[idx];
        if (!slot || !slot.alive)
          return;
        const selection = basicSelection.value;
        if (selection.operator && selection.first !== null) {
          if (selection.first === idx) {
            basicSelection.value = { first: null, operator: null };
            return;
          }
          applyBasicCombination(selection.first, idx, selection.operator);
          return;
        }
        if (selection.first === idx) {
          basicSelection.value = { first: null, operator: null };
          return;
        }
        basicSelection.value = { first: idx, operator: null };
      }
      function applyBasicCombination(firstIdx, secondIdx, op) {
        const res = combineBasicSlots({
          slots: basicSlots.value,
          history: basicHistory.value,
          expression: basicExpression.value,
          displayExpression: basicDisplayExpression.value
        }, firstIdx, secondIdx, op);
        if (!res.ok) {
          basicSelection.value = { first: null, operator: null };
          if (res.err) {
            showBasicError(res.err);
          }
          return;
        }
        const data = res.data;
        basicSlots.value = data.slots;
        basicHistory.value = data.history;
        basicExpression.value = data.expression;
        basicDisplayExpression.value = data.displayExpression;
        let resultSlotIndex = null;
        for (let i = 0; i < data.slots.length; i++) {
          if (data.slots[i] && data.slots[i].alive && data.slots[i].source === "value") {
            resultSlotIndex = i;
            break;
          }
        }
        basicSelection.value = { first: resultSlotIndex, operator: null };
        errorValueText.value = "";
        if (data.aliveCount === 1) {
          settleHandResult({
            ok: !!data.isSolved,
            expression: data.exprForRecord,
            valueFraction: data.result,
            stats: data.stats,
            origin: "basic",
            allowRetry: !data.isSolved
          });
        }
        try {
          saveSession();
        } catch (_) {
        }
      }
      function undoBasicStep() {
        const res = undoBasicHistory(basicHistory.value);
        if (!res.ok)
          return;
        const data = res.data;
        basicHistory.value = data.history;
        basicSlots.value = data.slots;
        basicExpression.value = data.expression;
        basicDisplayExpression.value = data.displayExpression;
        basicSelection.value = { first: null, operator: null };
        errorValueText.value = "";
        try {
          saveSession();
        } catch (_) {
        }
      }
      function resetBasicBoard() {
        resetBasicStateFromCards();
        errorValueText.value = "";
        try {
          saveSession();
        } catch (_) {
        }
      }
      function handleUndo() {
        if (mode.value === "pro") {
          if (!tokens.value.length)
            return;
          removeTokenAt(tokens.value.length - 1);
          try {
            saveSession();
          } catch (_) {
          }
        } else {
          undoBasicStep();
        }
      }
      function handleReset() {
        if (mode.value === "pro") {
          if (!tokens.value.length && usedByCard.value.every((v) => !v))
            return;
          tokens.value = [];
          usedByCard.value = [0, 0, 0, 0];
          exprOverrideText.value = "";
          errorValueText.value = "";
          vue.nextTick(() => {
            updateExprHeight();
            updateExprScale();
          });
          try {
            saveSession();
          } catch (_) {
          }
        } else {
          resetBasicBoard();
        }
      }
      function handleSubmit() {
        if (submitDisabled.value)
          return;
        check();
      }
      function handleHint() {
        showSolution();
      }
      function refresh() {
        nextHand();
      }
      function initDeck() {
        deck.value = newDeck();
      }
      function closeTimerPopover() {
        timerPopover.value = { visible: false, left: 0, top: 0 };
      }
      function openTimerPopover() {
        try {
          const q = uni.createSelectorQuery().in(proxy);
          q.select("#timerCell").boundingClientRect().exec((res) => {
            const [rect] = res || [];
            if (!rect) {
              timerPopover.value = { visible: true, left: 0, top: 0 };
              return;
            }
            const sys = uni.getSystemInfoSync && uni.getSystemInfoSync() || {};
            let top = (rect.bottom || (rect.top || 0) + (rect.height || 0)) + 8;
            const limit = sys && Number.isFinite(sys.windowHeight) ? sys.windowHeight - 96 : 0;
            if (limit && top > limit)
              top = limit;
            const center = rect.left + rect.width / 2;
            timerPopover.value = { visible: true, left: center, top };
          });
        } catch (_) {
          timerPopover.value = { visible: true, left: 0, top: 0 };
        }
      }
      function handleTimerTap() {
        if (timerPopover.value.visible) {
          closeTimerPopover();
        } else {
          openTimerPopover();
        }
      }
      function redealHand() {
        closeTimerPopover();
        errorValueText.value = "";
        exprOverrideText.value = "";
        nextHand();
      }
      async function nextHand() {
        applyPendingGameplayPrefs();
        closeTimerPopover();
        const res = await getNextDraw();
        if (!res)
          return;
        resetHandStateForNext();
        if (Array.isArray(res.deck))
          deck.value = res.deck;
        cards.value = Array.isArray(res.cards) ? res.cards : [];
        currentHandSource.value = res.source === "mistake" ? "mistake" : "regular";
        currentMistakeKey.value = res.source === "mistake" ? res.mistakeKey || "" : "";
        solution.value = res.solution || null;
        tokens.value = [];
        usedByCard.value = [0, 0, 0, 0];
        handRecorded.value = false;
        handStartTs.value = Date.now();
        hintWasUsed.value = false;
        attemptCount.value = 0;
        vue.nextTick(() => {
          updateExprHeight();
          syncBasicOpsHeight();
        });
        try {
          saveSession();
        } catch (_) {
        }
      }
      async function getNextDraw() {
        if (deckSource.value === "mistakes") {
          const res = await drawFromMistakePool();
          if (res)
            return res;
          return await drawFromNormalDeck();
        }
        if (deckSource.value === "mix") {
          const preferMistake = Math.random() * 100 < clampMixWeightValue(mixWeight.value);
          if (preferMistake) {
            const res = await drawFromMistakePool({ silent: true });
            if (res)
              return res;
          }
          const normal = await drawFromNormalDeck();
          if (normal)
            return normal;
          return await drawFromMistakePool({ silent: true });
        }
        return await drawFromNormalDeck();
      }
      async function drawFromNormalDeck() {
        if (!Array.isArray(deck.value) || deck.value.length < 4) {
          initDeck();
        }
        if (!Array.isArray(deck.value) || deck.value.length < 4) {
          promptDeckReshuffle();
          return null;
        }
        const res = drawSolvableHand(deck.value, faceUseHigh.value, solve24);
        if (!res.ok) {
          promptDeckReshuffle();
          return null;
        }
        return { source: "normal", cards: res.data.cards, deck: res.data.deck, solution: res.data.solution };
      }
      async function drawFromMistakePool(options = {}) {
        const silent = !!options.silent;
        const uid = selectedUserId.value;
        if (!uid) {
          if (!silent) {
            showHint("请先选择用户", 1600);
            switchDeckSource("regular", { scheduleNext: false });
          }
          return null;
        }
        const pool = getActivePool(uid) || [];
        if (!Array.isArray(pool) || pool.length === 0) {
          if (silent) {
            return null;
          }
          await new Promise((resolve) => {
            const fallback = () => {
              switchDeckSource("regular");
              resolve(null);
            };
            try {
              uni.showModal({
                title: "提示",
                content: "无错题，切换到整副牌。",
                confirmText: "OK",
                showCancel: false,
                success: () => fallback(),
                fail: () => fallback()
              });
            } catch (_) {
              fallback();
            }
          });
          return null;
        }
        const used = mistakeRunUsed.value instanceof Set ? mistakeRunUsed.value : /* @__PURE__ */ new Set();
        const available = pool.filter((item2) => item2 && item2.key && !used.has(item2.key));
        if (!available.length) {
          if (silent) {
            return null;
          }
          await new Promise((resolve) => {
            const fallback = () => {
              restartMistakeRun();
              resolve(null);
            };
            try {
              uni.showActionSheet({
                title: "本轮错题已出完",
                itemList: ["重新出题", "切换整副", "去统计"],
                success: (res) => {
                  const idx = typeof (res == null ? void 0 : res.tapIndex) === "number" ? res.tapIndex : -1;
                  if (idx === 0) {
                    restartMistakeRun();
                  } else if (idx === 1) {
                    switchDeckSource("regular");
                  } else if (idx === 2) {
                    goStats();
                  } else {
                    restartMistakeRun();
                  }
                  resolve(null);
                },
                fail: () => fallback()
              });
            } catch (_) {
              fallback();
            }
          });
          return null;
        }
        const item = available[Math.floor(Math.random() * available.length)];
        const cardsFromNums = convertNumsToCards(Array.isArray(item == null ? void 0 : item.nums) ? item.nums : []);
        let sol = null;
        try {
          const mapped = cardsFromNums.map((c) => mapCardRank(c.rank, faceUseHigh.value));
          sol = mapped.length === 4 ? solve24(mapped) : null;
        } catch (_) {
          sol = null;
        }
        const updatedSet = new Set(used);
        updatedSet.add(item.key);
        mistakeRunUsed.value = updatedSet;
        try {
          saveSession();
        } catch (_) {
        }
        return { source: "mistake", cards: cardsFromNums, deck: deck.value, solution: sol, mistakeKey: item.key };
      }
      function convertNumsToCards(nums) {
        const suits = ["S", "H", "D", "C"];
        const arr = Array.isArray(nums) ? nums : [];
        return arr.map((n, idx) => {
          const rank = Number.isFinite(+n) ? Math.min(13, Math.max(1, Math.floor(+n))) : 1;
          const suit = suits[idx % suits.length];
          return { rank, suit };
        });
      }
      function resetMistakeRun(stamp = 0) {
        mistakeRunUsed.value = /* @__PURE__ */ new Set();
        mistakeRunStamp.value = stamp;
        currentMistakeKey.value = "";
      }
      function restartMistakeRun() {
        resetMistakeRun(Date.now());
        try {
          saveSession();
        } catch (_) {
        }
        vue.nextTick(() => {
          if (deckSource.value === "mistakes")
            nextHand();
        });
      }
      function switchDeckSource(target, options = {}) {
        const next = normalizeDeckSourceValue(target);
        if (deckSource.value === next)
          return;
        if (next === "mistakes" && !selectedUserId.value) {
          showHint("请先选择用户", 1600);
          return;
        }
        deckSource.value = next;
        pendingGameplay.value = { ...pendingGameplay.value, deckSource: next };
        appliedGameplay.value = { ...appliedGameplay.value, deckSource: next };
        if (next !== "mix") {
          pendingGameplay.value.mixWeight = mixWeight.value;
        }
        if (options.persist !== false) {
          try {
            setGameplayPrefs({ deckSource: next });
          } catch (_) {
          }
          syncPendingGameplayPrefs();
        }
        if (next === "regular" && (!Array.isArray(deck.value) || deck.value.length < 4))
          initDeck();
        try {
          saveSession();
        } catch (_) {
        }
        if (options.scheduleNext !== false) {
          vue.nextTick(() => {
            nextHand();
          });
        }
      }
      function promptDeckReshuffle() {
        try {
          uni.showModal({
            title: "牌库用尽",
            content: "余牌无解或整副用完，是否重新洗牌？",
            confirmText: "重洗",
            cancelText: "进入统计",
            success: (res) => {
              if (res.confirm) {
                initDeck();
                handsPlayed.value = 0;
                successCount.value = 0;
                failCount.value = 0;
                vue.nextTick(() => nextHand());
              } else {
                try {
                  uni.reLaunch({ url: "/pages/stats/index" });
                } catch (e1) {
                  try {
                    uni.navigateTo({ url: "/pages/stats/index" });
                  } catch (_) {
                  }
                }
              }
            }
          });
        } catch (_) {
          initDeck();
          handsPlayed.value = 0;
          successCount.value = 0;
          failCount.value = 0;
          vue.nextTick(() => nextHand());
        }
      }
      vue.onMounted(() => {
        syncPendingGameplayPrefs();
        try {
          if (typeof uni.$on === "function") {
            try {
              uni.$off(MODE_CHANGE_EVENT$1, handleExternalModeChange);
            } catch (_) {
            }
            uni.$on(MODE_CHANGE_EVENT$1, handleExternalModeChange);
          }
        } catch (_) {
        }
        ensureInit();
        try {
          uni.hideTabBar && uni.hideTabBar();
        } catch (_) {
        }
        try {
          const u = getUsers && getUsers();
          const list = u && Array.isArray(u.list) ? u.list : [];
          if (list.length == 0) {
            try {
              uni.showModal({
                title: "暂无用户",
                content: "请先新建用户后再开始程序。",
                confirmText: "去新建",
                showCancel: false,
                success: () => {
                  try {
                    uni.reLaunch({ url: "/pages/login/index" });
                  } catch (e1) {
                    try {
                      uni.navigateTo({ url: "/pages/login/index" });
                    } catch (_) {
                    }
                  }
                }
              });
            } catch (_) {
              try {
                uni.reLaunch({ url: "/pages/login/index" });
              } catch (e1) {
                try {
                  uni.navigateTo({ url: "/pages/login/index" });
                } catch (_2) {
                }
              }
            }
            return;
          }
        } catch (_) {
        }
        currentUser.value = getCurrentUser() || null;
        const restored = loadSession();
        applyLatestModePreference();
        if (!restored) {
          initDeck();
          nextHand();
        }
        setTimeout(() => {
          booted.value = true;
        }, 0);
        vue.nextTick(() => {
          updateVHVar();
          updateExprHeight();
          updateExprScale();
          syncBasicOpsHeight();
        });
        if (uni.onWindowResize)
          uni.onWindowResize(() => {
            updateVHVar();
            updateExprHeight();
            updateExprScale();
            syncBasicOpsHeight();
          });
        updateLastSuccess();
        startHandTimer();
        requestLayoutMeasure();
        if (consumeAvatarRestoreNotice()) {
          showHint("头像文件丢失，已为你恢复为默认头像", 2e3);
        }
      });
      onShow(() => {
        syncPendingGameplayPrefs();
        currentUser.value = getCurrentUser() || null;
        loadSession();
        applyLatestModePreference();
        startHandTimer();
        try {
          refreshSafeArea();
        } catch (_) {
        }
        requestLayoutMeasure();
        syncBasicOpsHeight();
        try {
          scheduleTabWarmup({ delay: 180 });
        } catch (_) {
        }
        if (consumeAvatarRestoreNotice()) {
          showHint("头像文件丢失，已为你恢复为默认头像", 2e3);
        }
      });
      onHide(() => {
        saveSession();
        stopHandTimer();
        closeTimerPopover();
      });
      vue.onUnmounted(() => {
        try {
          if (typeof uni.$off === "function") {
            uni.$off(MODE_CHANGE_EVENT$1, handleExternalModeChange);
          }
        } catch (_) {
        }
        stopHandTimer();
        if (layoutTimer) {
          try {
            clearTimeout(layoutTimer);
          } catch (_) {
          }
          layoutTimer = null;
        }
      });
      function updateLastSuccess() {
        try {
          const cu = getCurrentUser && getCurrentUser();
          if (!cu || !cu.id) {
            lastSuccessMs.value = null;
            return;
          }
          const ext = readStatsExtended && readStatsExtended(cu.id);
          if (ext && (cu == null ? void 0 : cu.id)) {
            try {
              mergeCachedStatsExt({ [cu.id]: ext });
            } catch (_) {
            }
          }
          const r = (ext && Array.isArray(ext.rounds) ? ext.rounds.slice().reverse() : []).find((x) => x && x.success && Number.isFinite(x.timeMs));
          lastSuccessMs.value = r ? r.timeMs : null;
        } catch (_) {
          lastSuccessMs.value = null;
        }
      }
      function resetHandStateForNext() {
        handSettled.value = false;
        settledResult.value = null;
        handFailedOnce.value = false;
        handRecorded.value = false;
        timeoutRecorded.value = false;
        attemptCount.value = 0;
        hintWasUsed.value = false;
        errorValueText.value = "";
        exprOverrideText.value = "";
      }
      function settleHandResult({ ok, expression, valueFraction, stats, origin, allowRetry = false }) {
        const exprStr = expression || "";
        const statsData = stats || statsFromExpressionString(exprStr);
        const value = valueFraction || (exprStr ? evaluateExprToFraction(exprStr) : null);
        const elapsed = Date.now() - (handStartTs.value || Date.now());
        const retriesSuccess = origin === "pro" ? Math.max(0, (attemptCount.value || 1) - 1) : 0;
        const retriesFail = origin === "pro" ? attemptCount.value || 0 : 0;
        const retryableFailure = allowRetry && !ok;
        const recordRound = (success) => {
          if (selectedUserId.value) {
            try {
              recordRoundResult({ userId: selectedUserId.value, nums: currentHandNums.value, success });
            } catch (_) {
            }
          }
          try {
            pushRound({
              success,
              timeMs: elapsed,
              hintUsed: !!hintWasUsed.value,
              retries: success ? retriesSuccess : retriesFail,
              ops: statsData.ops,
              exprLen: statsData.exprLen,
              maxDepth: statsData.maxDepth,
              faceUseHigh: !!faceUseHigh.value,
              hand: { cards: (cards.value || []).map((c) => ({ rank: c.rank, suit: c.suit })) },
              expr: exprStr
            });
            try {
              scheduleTabWarmup({ delay: 200 });
            } catch (_) {
            }
            if (success)
              updateLastSuccess();
          } catch (_) {
          }
        };
        if (ok) {
          const timedOut = timeoutRecorded.value;
          errorValueText.value = "";
          if (timedOut) {
            if (handSettled.value && settledResult.value === "success") {
              try {
                saveSession();
              } catch (_) {
              }
              return;
            }
            handSettled.value = true;
            settledResult.value = "success";
            try {
              successAnimating.value = true;
              setTimeout(() => {
                successAnimating.value = false;
                nextHand();
              }, 500);
            } catch (_) {
              nextHand();
            }
            try {
              saveSession();
            } catch (_) {
            }
            return;
          }
          if (origin === "basic" && handFailedOnce.value) {
            try {
              successAnimating.value = true;
              setTimeout(() => {
                successAnimating.value = false;
              }, 500);
            } catch (_) {
            }
            try {
              saveSession();
            } catch (_) {
            }
            return;
          }
          if (handSettled.value) {
            if (settledResult.value === "success") {
              try {
                saveSession();
              } catch (_) {
              }
              return;
            }
            try {
              successAnimating.value = true;
              setTimeout(() => {
                successAnimating.value = false;
                nextHand();
              }, 500);
            } catch (_) {
              nextHand();
            }
            try {
              saveSession();
            } catch (_) {
            }
            return;
          }
          handSettled.value = true;
          settledResult.value = "success";
          handRecorded.value = true;
          handsPlayed.value += 1;
          successCount.value += 1;
          recordRound(true);
          try {
            successAnimating.value = true;
            setTimeout(() => {
              successAnimating.value = false;
              nextHand();
            }, 500);
          } catch (_) {
            nextHand();
          }
          try {
            saveSession();
          } catch (_) {
          }
          return;
        }
        const updateErrorValue = () => {
          try {
            if (value && typeof value.toString === "function") {
              errorValueText.value = "结果：" + value.toString();
            } else {
              errorValueText.value = "";
            }
          } catch (_) {
            errorValueText.value = "";
          }
        };
        if (retryableFailure) {
          updateErrorValue();
          if (!handFailedOnce.value) {
            handFailedOnce.value = true;
            settledResult.value = "fail";
            handRecorded.value = true;
            handsPlayed.value += 1;
            failCount.value += 1;
            recordRound(false);
          }
          try {
            errorAnimating.value = true;
            setTimeout(() => {
              errorAnimating.value = false;
            }, 500);
          } catch (_) {
          }
          try {
            saveSession();
          } catch (_) {
          }
          return;
        }
        updateErrorValue();
        if (!handSettled.value) {
          handSettled.value = true;
          settledResult.value = "fail";
          handRecorded.value = true;
          handsPlayed.value += 1;
          failCount.value += 1;
          recordRound(false);
        }
        try {
          errorAnimating.value = true;
          setTimeout(() => {
            errorAnimating.value = false;
          }, 500);
        } catch (_) {
        }
        try {
          saveSession();
        } catch (_) {
        }
      }
      function check() {
        const usedCount = usedByCard.value.reduce((a, b) => a + (b ? 1 : 0), 0);
        errorValueText.value = "";
        if (usedCount !== 4 || !isExpressionComplete(tokens.value)) {
          showExpressionErrorToast();
          return;
        }
        const s = expr.value;
        if (!s) {
          showExpressionErrorToast();
          return;
        }
        attemptCount.value += 1;
        const v = evaluateExprToFraction(s);
        const ok = v && v.equalsInt && v.equalsInt(24);
        settleHandResult({
          ok,
          expression: s,
          valueFraction: v,
          stats: computeExprStats(tokens.value),
          origin: "pro"
        });
      }
      function showSolution() {
        hintWasUsed.value = true;
        if (!solution.value) {
          try {
            const mapped = (cards.value || []).map((c) => mapCardRank(c.rank, faceUseHigh.value));
            solution.value = mapped.length === 4 ? solve24(mapped) : null;
          } catch (_) {
            solution.value = null;
          }
        }
        if (!handRecorded.value) {
          handRecorded.value = true;
          handsPlayed.value += 1;
          failCount.value += 1;
          try {
            const stats = computeExprStats(tokens.value);
            pushRound({
              success: false,
              timeMs: Date.now() - (handStartTs.value || Date.now()),
              hintUsed: true,
              retries: attemptCount.value || 0,
              ops: stats.ops,
              exprLen: stats.exprLen,
              maxDepth: stats.maxDepth,
              faceUseHigh: !!faceUseHigh.value,
              hand: { cards: (cards.value || []).map((c) => ({ rank: c.rank, suit: c.suit })) },
              expr: expr.value
            });
            updateLastSuccess();
          } catch (_) {
          }
          if (selectedUserId.value) {
            try {
              recordRoundResult({ userId: selectedUserId.value, nums: currentHandNums.value, success: false });
            } catch (_) {
            }
          }
        }
        if (mode.value === "basic") {
          handFailedOnce.value = true;
          const msg = solution.value ? "答案：" + solution.value : "暂无提示";
          basicDisplayExpression.value = msg;
          showHint(msg, 2e3);
        } else {
          exprOverrideText.value = solution.value ? "答案：" + solution.value : "暂无提示";
        }
        try {
          saveSession();
        } catch (_) {
        }
      }
      function skipHand() {
        if (!handRecorded.value) {
          handRecorded.value = true;
          handsPlayed.value += 1;
          failCount.value += 1;
          try {
            const stats = computeExprStats(tokens.value);
            pushRound({
              success: false,
              timeMs: Date.now() - (handStartTs.value || Date.now()),
              hintUsed: !!hintWasUsed.value,
              retries: attemptCount.value || 0,
              ops: stats.ops,
              exprLen: stats.exprLen,
              maxDepth: stats.maxDepth,
              faceUseHigh: !!faceUseHigh.value,
              hand: { cards: (cards.value || []).map((c) => ({ rank: c.rank, suit: c.suit })) },
              expr: expr.value
            });
            updateLastSuccess();
          } catch (_) {
          }
          if (selectedUserId.value) {
            try {
              recordRoundResult({ userId: selectedUserId.value, nums: currentHandNums.value, success: false });
            } catch (_) {
            }
          }
        }
        nextHand();
      }
      function reshuffle() {
        initDeck();
        handsPlayed.value = 0;
        successCount.value = 0;
        failCount.value = 0;
        handRecorded.value = false;
        vue.nextTick(() => {
          nextHand();
          saveSession();
        });
      }
      function exitGamePage() {
        if (!handRecorded.value) {
          showHint("本局进度将丢失", 1200);
        }
        exitApp({
          fallback: () => {
            try {
              if (typeof uni.switchTab === "function") {
                uni.switchTab({ url: "/pages/stats/index" });
                return;
              }
            } catch (_) {
            }
            try {
              if (typeof uni.reLaunch === "function") {
                uni.reLaunch({ url: "/pages/stats/index" });
                return;
              }
            } catch (_) {
            }
          }
        });
      }
      function goLogin() {
        try {
          uni.navigateTo({ url: "/pages/login/index" });
        } catch (e1) {
          try {
            uni.reLaunch({ url: "/pages/login/index" });
          } catch (_) {
          }
        }
      }
      function goStats() {
        try {
          uni.reLaunch({ url: "/pages/stats/index" });
        } catch (e1) {
          try {
            uni.navigateTo({ url: "/pages/stats/index" });
          } catch (_) {
          }
        }
      }
      function goGame() {
        try {
          uni.reLaunch({ url: "/pages/index/index" });
        } catch (e1) {
          try {
            uni.navigateTo({ url: "/pages/index/index" });
          } catch (_) {
          }
        }
      }
      function goUser() {
        try {
          uni.reLaunch({ url: "/pages/user/index" });
        } catch (e1) {
          try {
            uni.navigateTo({ url: "/pages/user/index" });
          } catch (_) {
          }
        }
      }
      function goSettings() {
        try {
          uni.navigateTo({ url: "/pages/settings/index" });
        } catch (e1) {
          try {
            uni.reLaunch({ url: "/pages/settings/index" });
          } catch (_) {
          }
        }
      }
      function startDrag(token, e) {
        drag.value.active = true;
        drag.value.token = token;
        const p = pointFromEvent(e);
        drag.value.x = p.x;
        drag.value.y = p.y;
        drag.value.startX = p.x;
        drag.value.startY = p.y;
        drag.value.moved = false;
        measureDropZones();
      }
      function onDrag(e) {
        if (!drag.value.active)
          return;
        const p = pointFromEvent(e);
        drag.value.x = p.x;
        drag.value.y = p.y;
        const dx = drag.value.x - drag.value.startX;
        const dy = drag.value.y - drag.value.startY;
        if (!drag.value.moved && dx * dx + dy * dy > 16)
          drag.value.moved = true;
        const token = drag.value.token;
        if (token && token.type === "tok") {
          const x = drag.value.x, y = drag.value.y;
          const inExpr = inside(exprBox.value, x, y);
          if (inExpr) {
            const to = calcInsertIndex(x, y);
            if (to !== token.index && to !== token.index + 1) {
              moveToken(token.index, to);
              token.index = to > token.index ? to - 1 : to;
              measureDropZones();
            }
            dragInsertIndex.value = to;
          } else {
            dragInsertIndex.value = -1;
          }
        } else {
          const x = drag.value.x, y = drag.value.y;
          const inExpr = inside(exprBox.value, x, y);
          dragInsertIndex.value = inExpr ? calcInsertIndex(x, y) : -1;
        }
      }
      function endDrag() {
        if (!drag.value.active)
          return;
        const x = drag.value.x, y = drag.value.y;
        const token = drag.value.token;
        const inExpr = inside(exprBox.value, x, y);
        if (token && !drag.value.moved) {
          if (token.type === "tok") {
            removeTokenAt(token.index);
          } else if (token.type === "num" || token.type === "op") {
            tryAppendToken(token);
            lastInsertedIndex.value = Math.max(0, tokens.value.length - 1);
            setTimeout(() => {
              lastInsertedIndex.value = -1;
            }, 220);
          }
          drag.value.active = false;
          drag.value.token = null;
          dragInsertIndex.value = -1;
          return;
        }
        if (token && token.type === "tok") {
          if (inExpr) {
            const to = calcInsertIndex(x, y);
            moveToken(token.index, to);
            lastInsertedIndex.value = Math.max(0, Math.min(to, tokens.value.length - 1));
            setTimeout(() => {
              lastInsertedIndex.value = -1;
            }, 220);
          } else {
            removeTokenAt(token.index);
          }
        } else if (inExpr && token) {
          const to = calcInsertIndex(x, y);
          tryInsertTokenAt(token, to);
          lastInsertedIndex.value = Math.max(0, Math.min(to, tokens.value.length - 1));
          setTimeout(() => {
            lastInsertedIndex.value = -1;
          }, 220);
        }
        drag.value.active = false;
        drag.value.token = null;
        dragInsertIndex.value = -1;
      }
      function tryAppendToken(token) {
        tryInsertTokenAt(token, tokens.value.length);
      }
      function tryInsertTokenAt(token, to) {
        clearExprOverride();
        const clamped = Math.max(0, Math.min(to, tokens.value.length));
        if (token.type === "num") {
          const ci = token.cardIndex;
          if (ci == null) {
            return;
          }
          if ((usedByCard.value[ci] || 0) >= 1) {
            return;
          }
          const arr = tokens.value.slice();
          arr.splice(clamped, 0, { type: "num", value: token.value, rank: token.rank, suit: token.suit, cardIndex: ci });
          tokens.value = arr;
          const u = usedByCard.value.slice();
          u[ci] = 1;
          usedByCard.value = u;
        } else if (token.type === "op") {
          const arr = tokens.value.slice();
          arr.splice(clamped, 0, { type: "op", value: token.value });
          tokens.value = arr;
        }
      }
      function removeTokenAt(i) {
        clearExprOverride();
        if (i < 0 || i >= tokens.value.length)
          return;
        const t = tokens.value[i];
        if (t && t.type === "num" && t.cardIndex != null) {
          const u = usedByCard.value.slice();
          u[t.cardIndex] = 0;
          usedByCard.value = u;
        }
        tokens.value = tokens.value.slice(0, i).concat(tokens.value.slice(i + 1));
      }
      function measureDropZones() {
        const q = uni.createSelectorQuery().in(proxy);
        q.select("#exprZone").boundingClientRect().selectAll(".tok").boundingClientRect().exec((res) => {
          const [exprRect, tokRectList] = res || [];
          if (exprRect)
            exprBox.value = { left: exprRect.left, top: exprRect.top, right: exprRect.right, bottom: exprRect.bottom };
          tokRects.value = tokRectList || [];
        });
      }
      function inside(box, x, y) {
        return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      }
      function pointFromEvent(e) {
        const t = e && e.touches && e.touches[0] || e && e.changedTouches && e.changedTouches[0] || e && e.detail || { x: 0, y: 0 };
        return { x: t.clientX ?? t.x ?? 0, y: t.clientY ?? t.y ?? 0 };
      }
      function updateExprScale() {
        exprScale.value = 1;
        vue.nextTick(() => {
          const q = uni.createSelectorQuery().in(proxy);
          q.select("#exprZone").boundingClientRect().select("#exprRow").boundingClientRect().exec((res) => {
            const [zone, row] = res || [];
            if (!zone || !row)
              return;
            const avail = zone.width - 24;
            const need = row.width || 0;
            if (avail > 0 && need > 0) {
              const s = Math.min(1, avail / need);
              exprScale.value = isFinite(s) && s > 0 ? s : 1;
            } else {
              exprScale.value = 1;
            }
          });
        });
      }
      vue.watch(currentUser, () => {
        avatarLoadFailed.value = false;
      });
      vue.watch(mode, (m) => {
        const normalized = m === "pro" ? "pro" : "basic";
        try {
          setLastMode(normalized);
        } catch (_) {
        }
        updateExprHeight();
        if (normalized === "basic") {
          resetBasicStateFromCards();
          basicSelection.value = { first: null, operator: null };
          vue.nextTick(() => syncBasicOpsHeight());
        } else {
          tokens.value = [];
          usedByCard.value = [0, 0, 0, 0];
          exprOverrideText.value = "";
          errorValueText.value = "";
          vue.nextTick(() => {
            updateExprHeight();
            updateExprScale();
          });
          basicOpsMetrics.value = { totalHeight: 0, buttonHeight: 0 };
        }
        closeTimerPopover();
        requestLayoutMeasure();
      });
      vue.watch(cards, () => {
        resetBasicStateFromCards();
        if (mode.value === "basic")
          vue.nextTick(() => syncBasicOpsHeight());
      });
      vue.watch(faceUseHigh, () => {
        resetBasicStateFromCards();
        if (mode.value === "basic")
          vue.nextTick(() => syncBasicOpsHeight());
      });
      vue.watch(tokens, () => updateExprScale());
      function calcInsertIndex(x, y) {
        const rects = tokRects.value || [];
        if (!rects.length)
          return tokens.value.length;
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < rects.length; i++) {
          const r2 = rects[i];
          const cx2 = r2.left + r2.width / 2;
          const cy = r2.top + r2.height / 2;
          const dx = cx2 - x;
          const dy = cy - y;
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        }
        const r = rects[best];
        const cx = r.left + r.width / 2;
        return x < cx ? best : best + 1;
      }
      function moveToken(from, to) {
        clearExprOverride();
        if (from === to)
          return;
        const arr = tokens.value.slice();
        const t = arr.splice(from, 1)[0];
        const clamped = Math.max(0, Math.min(to, arr.length));
        arr.splice(clamped, 0, t);
        tokens.value = arr;
      }
      function updateVHVar() {
        try {
          const sys = uni.getSystemInfoSync && uni.getSystemInfoSync() || {};
          const h = sys.windowHeight || (typeof window !== "undefined" ? window.innerHeight : 0) || 0;
          if (h && typeof document !== "undefined" && document.documentElement && document.documentElement.style) {
            document.documentElement.style.setProperty("--vh", h * 0.01 + "px");
          }
        } catch (e) {
        }
      }
      function onSessionOver() {
        try {
          uni.showModal({
            title: "本局结束",
            content: `局数：${handsPlayed.value}
成功：${successCount.value}
胜率：${winRate.value}%
是否开始下一局？`,
            confirmText: "下一局",
            cancelText: "统计",
            success: (res) => {
              if (res.confirm) {
                initDeck();
                handsPlayed.value = 0;
                successCount.value = 0;
                failCount.value = 0;
                handRecorded.value = false;
                sessionOver.value = false;
                vue.nextTick(() => nextHand());
              } else {
                try {
                  uni.reLaunch({ url: "/pages/stats/index" });
                } catch (e1) {
                  try {
                    uni.navigateTo({ url: "/pages/stats/index" });
                  } catch (_) {
                  }
                }
              }
            }
          });
        } catch (_) {
        }
      }
      const __returned__ = { cards, solution, usedByCard, tokens, get initialMode() {
        return initialMode;
      }, set initialMode(v) {
        initialMode = v;
      }, mode, basicSlots, basicSelection, basicHistory, basicExpression, basicDisplayExpression, basicOpsMetrics, basicOpsStyle, gameplayDefaults, appliedGameplay, pendingGameplay, faceUseHigh, hapticsEnabled, sfxEnabled, reducedMotion, handRecorded, timeoutRecorded, BASIC_EXPR_HEIGHT_PX, PRO_EXPR_HEIGHT_PX, exprZoneHeight, currentUser, avatarLoadFailed, currentUserName, currentUserAvatar, currentUserInitial, currentUserColor, deck, deckSource, mixWeight, mistakeRunUsed, mistakeRunStamp, currentHandSource, currentMistakeKey, handsPlayed, successCount, failCount, sessionOver, timerPopover, timerPopoverStyle, successAnimating, errorAnimating, exprOverrideText, errorValueText, handStartTs, nowTs, hintWasUsed, attemptCount, lastSuccessMs, SESSION_KEY, handSettled, settledResult, handFailedOnce, safeTop, safeBottom, windowHeight, refreshSafeArea, pageInlineStyle, FALLBACK_TOP_RPX, FALLBACK_BOTTOM_RPX, MODE_CHANGE_EVENT: MODE_CHANGE_EVENT$1, topFixedPx, bottomFixedPx, middleHeight, get layoutTimer() {
        return layoutTimer;
      }, set layoutTimer(v) {
        layoutTimer = v;
      }, hintState, showHint, hideHint, basicErrorMessages, showBasicError, edgeHandlers, get lastBackPressTs() {
        return lastBackPressTs;
      }, set lastBackPressTs(v) {
        lastBackPressTs = v;
      }, fmtMs, fmtMs1, normalizeRankMode, normalizeDeckSourceValue, clampMixWeightValue, normalizeGameplaySnapshot, syncPendingGameplayPrefs, applyPendingGameplayPrefs, requestLayoutMeasure, measureFixedSections, computeMiddleHeight, avatarInitial, colorFromUser, onAvatarError, saveSession, loadSession, remainingCards, winRate, handElapsedMs, get handTimer() {
        return handTimer;
      }, set handTimer(v) {
        handTimer = v;
      }, startHandTimer, stopHandTimer, handleTimeout, drag, exprBox, tokRects, dragInsertIndex, lastInsertedIndex, proxy, booted, selectedUserId, currentHandNums, expr, ghostStyle, exprScale, opsDensity, opsDensityClass, updateExprHeight, syncBasicOpsHeight, ghostText, placeholderSizeClass, applyModeFromPreference, handleExternalModeChange, applyLatestModePreference, undoDisabled, resetDisabled, submitDisabled, clearExprOverride, showExpressionErrorToast, basicCardClass, resetBasicStateFromCards, handleBasicOperator, handleBasicCardTap, applyBasicCombination, undoBasicStep, resetBasicBoard, handleUndo, handleReset, handleSubmit, handleHint, refresh, initDeck, closeTimerPopover, openTimerPopover, handleTimerTap, redealHand, nextHand, getNextDraw, drawFromNormalDeck, drawFromMistakePool, convertNumsToCards, resetMistakeRun, restartMistakeRun, switchDeckSource, promptDeckReshuffle, updateLastSuccess, resetHandStateForNext, settleHandResult, check, showSolution, skipHand, reshuffle, exitGamePage, goLogin, goStats, goGame, goUser, goSettings, startDrag, onDrag, endDrag, tryAppendToken, tryInsertTokenAt, removeTokenAt, measureDropZones, inside, pointFromEvent, updateExprScale, calcInsertIndex, moveToken, updateVHVar, onSessionOver, ref: vue.ref, onMounted: vue.onMounted, onUnmounted: vue.onUnmounted, getCurrentInstance: vue.getCurrentInstance, computed: vue.computed, watch: vue.watch, nextTick: vue.nextTick, get onBackPress() {
        return onBackPress;
      }, get onHide() {
        return onHide;
      }, get onShow() {
        return onShow;
      }, AppNavBar, CircleActionButton, PlayingCard, get evaluateExprToFraction() {
        return evaluateExprToFraction;
      }, get solve24() {
        return solve24;
      }, get ensureInit() {
        return ensureInit;
      }, get getCurrentUser() {
        return getCurrentUser;
      }, get getUsers() {
        return getUsers;
      }, get pushRound() {
        return pushRound;
      }, get readStatsExtended() {
        return readStatsExtended;
      }, get useSafeArea() {
        return useSafeArea;
      }, get rpxToPx() {
        return rpxToPx;
      }, get scheduleTabWarmup() {
        return scheduleTabWarmup;
      }, get mergeCachedStatsExt() {
        return mergeCachedStatsExt;
      }, get tokensToExpression() {
        return tokensToExpression;
      }, get formatMs() {
        return formatMs;
      }, get formatMsShort() {
        return formatMsShort;
      }, get labelForRank() {
        return labelForRank;
      }, get mapCardRank() {
        return mapCardRank;
      }, get computeExprStats() {
        return computeExprStats;
      }, get isExpressionComplete() {
        return isExpressionComplete;
      }, get statsFromExpressionString() {
        return statsFromExpressionString;
      }, get createBasicState() {
        return createBasicState;
      }, get combineBasicSlots() {
        return combineBasicSlots;
      }, get undoBasicHistory() {
        return undoBasicHistory;
      }, get drawSolvableHand() {
        return drawSolvableHand;
      }, get newDeck() {
        return newDeck;
      }, get getActivePool() {
        return getActivePool;
      }, get recordRoundResult() {
        return recordRoundResult;
      }, get useFloatingHint() {
        return useFloatingHint;
      }, get useEdgeExit() {
        return useEdgeExit;
      }, get getGameplayPrefs() {
        return getGameplayPrefs;
      }, get getLastMode() {
        return getLastMode;
      }, get setLastMode() {
        return setLastMode;
      }, get setGameplayPrefs() {
        return setGameplayPrefs;
      }, get consumeRankMigrationNotice() {
        return consumeRankMigrationNotice;
      }, get consumeAvatarRestoreNotice() {
        return consumeAvatarRestoreNotice;
      }, get exitApp() {
        return exitApp;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$4(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: vue.normalizeClass(["page col", { booted: $setup.booted }]),
        style: vue.normalizeStyle($setup.pageInlineStyle),
        onTouchstart: _cache[11] || (_cache[11] = (...args) => $setup.edgeHandlers.handleTouchStart && $setup.edgeHandlers.handleTouchStart(...args)),
        onTouchmove: _cache[12] || (_cache[12] = (...args) => $setup.edgeHandlers.handleTouchMove && $setup.edgeHandlers.handleTouchMove(...args)),
        onTouchend: _cache[13] || (_cache[13] = (...args) => $setup.edgeHandlers.handleTouchEnd && $setup.edgeHandlers.handleTouchEnd(...args)),
        onTouchcancel: _cache[14] || (_cache[14] = (...args) => $setup.edgeHandlers.handleTouchCancel && $setup.edgeHandlers.handleTouchCancel(...args))
      },
      [
        vue.createElementVNode("view", { class: "page-scroll-container" }, [
          vue.createElementVNode("view", {
            id: "gameTopBox",
            class: "game-header top-fixed"
          }, [
            vue.createVNode($setup["AppNavBar"], {
              showBack: false,
              "with-safe-top": false
            }, {
              title: vue.withCtx(() => [
                vue.createElementVNode("view", { class: "nav-title-stack" }, [
                  vue.createElementVNode("text", { class: "nav-title-main" }, "无敌24点程序")
                ])
              ]),
              _: 1
              /* STABLE */
            }),
            vue.createCommentVNode(" 顶部工具栏：显示当前用户信息与快速跳转按钮 "),
            vue.createElementVNode("view", { class: "topbar" }, [
              vue.createCommentVNode(" 用户头像和名字 "),
              vue.createElementVNode("view", {
                class: "user-chip",
                "hover-class": "user-chip-hover",
                onClick: $setup.goLogin
              }, [
                $setup.currentUserAvatar && !$setup.avatarLoadFailed ? (vue.openBlock(), vue.createElementBlock("image", {
                  key: 0,
                  class: "user-chip-avatar",
                  src: $setup.currentUserAvatar,
                  mode: "aspectFill",
                  onError: $setup.onAvatarError
                }, null, 40, ["src"])) : (vue.openBlock(), vue.createElementBlock(
                  "view",
                  {
                    key: 1,
                    class: "user-chip-fallback",
                    style: vue.normalizeStyle({ backgroundColor: $setup.currentUserColor })
                  },
                  vue.toDisplayString($setup.currentUserInitial),
                  5
                  /* TEXT, STYLE */
                )),
                vue.createElementVNode(
                  "text",
                  { class: "user-chip-name" },
                  vue.toDisplayString($setup.currentUserName),
                  1
                  /* TEXT */
                )
              ]),
              vue.createCommentVNode(" 按钮组 "),
              vue.createElementVNode("view", { class: "topbar-actions" }, [
                vue.createVNode($setup["CircleActionButton"], {
                  icon: "account_circle",
                  label: "用户",
                  onClick: $setup.goUser
                }),
                vue.createVNode($setup["CircleActionButton"], {
                  icon: "insights",
                  label: "统计",
                  onClick: $setup.goStats
                }),
                vue.createVNode($setup["CircleActionButton"], {
                  icon: "settings",
                  label: "设置",
                  onClick: $setup.goSettings
                })
              ])
            ]),
            vue.createCommentVNode(" 本局统计：紧凑表格（1行表头 + 1行数据），实时展示当前对局表现 "),
            vue.createElementVNode("view", {
              id: "statsRow",
              class: "card section stats-compact-table stats-card"
            }, [
              vue.createElementVNode("view", { class: "thead" }, [
                vue.createElementVNode("text", { class: "th" }, "剩余"),
                vue.createElementVNode("text", { class: "th" }, "局数"),
                vue.createElementVNode("text", { class: "th ok" }, "成功"),
                vue.createElementVNode("text", { class: "th fail" }, "失败"),
                vue.createElementVNode("text", { class: "th" }, "胜率"),
                vue.createElementVNode("text", { class: "th" }, "上一局"),
                vue.createElementVNode("text", { class: "th" }, "本局")
              ]),
              vue.createElementVNode("view", { class: "tbody" }, [
                vue.createElementVNode(
                  "text",
                  { class: "td" },
                  vue.toDisplayString($setup.remainingCards),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "td" },
                  vue.toDisplayString($setup.handsPlayed),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "td ok" },
                  vue.toDisplayString($setup.successCount),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "td fail" },
                  vue.toDisplayString($setup.failCount),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "td" },
                  vue.toDisplayString($setup.winRate) + "%",
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "td" },
                  vue.toDisplayString($setup.lastSuccessMs != null ? $setup.fmtMs($setup.lastSuccessMs) : "-"),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode("view", {
                  class: "td timer-cell",
                  id: "timerCell",
                  onClick: $setup.handleTimerTap
                }, [
                  $setup.handElapsedMs < 12e4 ? (vue.openBlock(), vue.createElementBlock(
                    "text",
                    { key: 0 },
                    vue.toDisplayString($setup.fmtMs1($setup.handElapsedMs)),
                    1
                    /* TEXT */
                  )) : (vue.openBlock(), vue.createElementBlock("text", {
                    key: 1,
                    class: "timer-fail-text"
                  }, "失败"))
                ])
              ])
            ])
          ]),
          vue.createElementVNode("view", { class: "game-middle" }, [
            vue.createElementVNode("view", { class: "mode-panels" }, [
              vue.createCommentVNode(" Pro 模式：拖拽式编辑区，提供更高自由度 "),
              vue.withDirectives(vue.createElementVNode(
                "view",
                { class: "pro-mode mode-panel" },
                [
                  vue.createCommentVNode(" 牌区：四张卡片等宽占满一行（每张卡片单独计数） "),
                  vue.createElementVNode("view", {
                    id: "cardGrid",
                    class: "card-grid",
                    style: { "padding-top": "0rpx" }
                  }, [
                    (vue.openBlock(true), vue.createElementBlock(
                      vue.Fragment,
                      null,
                      vue.renderList($setup.cards, (card, idx) => {
                        return vue.openBlock(), vue.createElementBlock("view", {
                          key: idx,
                          class: vue.normalizeClass(["playing-card", { used: ($setup.usedByCard[idx] || 0) > 0 }]),
                          onTouchstart: vue.withModifiers(($event) => $setup.startDrag({ type: "num", value: String(card.rank), rank: card.rank, suit: card.suit, cardIndex: idx }, $event), ["stop", "prevent"]),
                          onTouchmove: _cache[0] || (_cache[0] = vue.withModifiers(($event) => $setup.onDrag($event), ["stop", "prevent"])),
                          onTouchend: _cache[1] || (_cache[1] = vue.withModifiers(($event) => $setup.endDrag(), ["stop", "prevent"]))
                        }, [
                          vue.createVNode($setup["PlayingCard"], {
                            class: "playing-card-visual",
                            card
                          }, null, 8, ["card"])
                        ], 42, ["onTouchstart"]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ]),
                  vue.createCommentVNode(" 运算符候选区：两行布局 "),
                  vue.createElementVNode(
                    "view",
                    {
                      id: "opsRow1",
                      class: vue.normalizeClass(["ops-row-1", $setup.opsDensityClass])
                    },
                    [
                      (vue.openBlock(), vue.createElementBlock(
                        vue.Fragment,
                        null,
                        vue.renderList(["+", "-", "×", "÷"], (op) => {
                          return vue.createElementVNode("button", {
                            key: op,
                            class: "btn btn-operator",
                            onTouchstart: vue.withModifiers(($event) => $setup.startDrag({ type: "op", value: op }, $event), ["stop", "prevent"]),
                            onTouchmove: _cache[2] || (_cache[2] = vue.withModifiers(($event) => $setup.onDrag($event), ["stop", "prevent"])),
                            onTouchend: _cache[3] || (_cache[3] = vue.withModifiers(($event) => $setup.endDrag(), ["stop", "prevent"]))
                          }, vue.toDisplayString(op), 41, ["onTouchstart"]);
                        }),
                        64
                        /* STABLE_FRAGMENT */
                      ))
                    ],
                    2
                    /* CLASS */
                  ),
                  vue.createCommentVNode(" 运算符第二行：括号操作，密度根据屏幕高度动态调整 "),
                  vue.createElementVNode(
                    "view",
                    {
                      id: "opsRow2",
                      class: vue.normalizeClass(["ops-row-2", $setup.opsDensityClass])
                    },
                    [
                      (vue.openBlock(), vue.createElementBlock(
                        vue.Fragment,
                        null,
                        vue.renderList(["(", ")"], (op) => {
                          return vue.createElementVNode("button", {
                            key: op,
                            class: "btn btn-operator",
                            onTouchstart: vue.withModifiers(($event) => $setup.startDrag({ type: "op", value: op }, $event), ["stop", "prevent"]),
                            onTouchmove: _cache[4] || (_cache[4] = vue.withModifiers(($event) => $setup.onDrag($event), ["stop", "prevent"])),
                            onTouchend: _cache[5] || (_cache[5] = vue.withModifiers(($event) => $setup.endDrag(), ["stop", "prevent"]))
                          }, vue.toDisplayString(op), 41, ["onTouchstart"]);
                        }),
                        64
                        /* STABLE_FRAGMENT */
                      )),
                      $setup.mode === "pro" ? (vue.openBlock(), vue.createElementBlock("button", {
                        key: 0,
                        class: vue.normalizeClass(["btn btn-submit-pro", { disabled: $setup.submitDisabled }]),
                        disabled: $setup.submitDisabled,
                        onClick: $setup.handleSubmit
                      }, " 提交 ", 10, ["disabled"])) : vue.createCommentVNode("v-if", true)
                    ],
                    2
                    /* CLASS */
                  ),
                  vue.createCommentVNode(" 拖拽中的浮层 "),
                  $setup.drag.active ? (vue.openBlock(), vue.createElementBlock(
                    "view",
                    {
                      key: 0,
                      class: "drag-ghost",
                      style: vue.normalizeStyle($setup.ghostStyle)
                    },
                    vue.toDisplayString($setup.ghostText),
                    5
                    /* TEXT, STYLE */
                  )) : vue.createCommentVNode("v-if", true),
                  vue.createCommentVNode(" 表达式卡片容器（高度由脚本计算） "),
                  vue.createElementVNode("view", { class: "expr-card card section" }, [
                    vue.createElementVNode(
                      "view",
                      {
                        id: "exprZone",
                        class: vue.normalizeClass(["expr-zone", { "expr-zone-active": $setup.drag.active, empty: $setup.tokens.length === 0 && !$setup.exprOverrideText }]),
                        style: vue.normalizeStyle({ height: $setup.exprZoneHeight + "px" })
                      },
                      [
                        $setup.exprOverrideText ? (vue.openBlock(), vue.createElementBlock(
                          "view",
                          {
                            key: 0,
                            class: "expr-override"
                          },
                          vue.toDisplayString($setup.exprOverrideText),
                          1
                          /* TEXT */
                        )) : vue.createCommentVNode("v-if", true),
                        vue.createElementVNode(
                          "view",
                          {
                            id: "exprRow",
                            class: "row expr-row",
                            style: vue.normalizeStyle({ transform: "scale(" + $setup.exprScale + ")", transformOrigin: "left center" })
                          },
                          [
                            (vue.openBlock(true), vue.createElementBlock(
                              vue.Fragment,
                              null,
                              vue.renderList($setup.tokens, (t, i) => {
                                return vue.openBlock(), vue.createElementBlock(
                                  vue.Fragment,
                                  { key: i },
                                  [
                                    $setup.dragInsertIndex === i ? (vue.openBlock(), vue.createElementBlock(
                                      "view",
                                      {
                                        key: 0,
                                        class: vue.normalizeClass(["insert-placeholder", $setup.placeholderSizeClass])
                                      },
                                      null,
                                      2
                                      /* CLASS */
                                    )) : vue.createCommentVNode("v-if", true),
                                    vue.createElementVNode("view", {
                                      class: vue.normalizeClass(["tok", [t.type === "num" ? "num" : "op", { "just-inserted": i === $setup.lastInsertedIndex, "dragging": $setup.drag.token && $setup.drag.token.type === "tok" && $setup.drag.token.index === i }]]),
                                      onTouchstart: vue.withModifiers(($event) => $setup.startDrag({ type: "tok", index: i, value: t.value }, $event), ["stop", "prevent"]),
                                      onTouchmove: _cache[6] || (_cache[6] = vue.withModifiers(($event) => $setup.onDrag($event), ["stop", "prevent"])),
                                      onTouchend: _cache[7] || (_cache[7] = vue.withModifiers(($event) => $setup.endDrag(), ["stop", "prevent"]))
                                    }, [
                                      t.type === "num" ? (vue.openBlock(), vue.createBlock($setup["PlayingCard"], {
                                        key: 0,
                                        class: "tok-card-visual",
                                        card: { rank: t.rank != null ? t.rank : Number(t.value), suit: t.suit || "S", value: t.value },
                                        size: "sm",
                                        fill: true
                                      }, null, 8, ["card"])) : (vue.openBlock(), vue.createElementBlock(
                                        "text",
                                        {
                                          key: 1,
                                          class: "tok-op-text"
                                        },
                                        vue.toDisplayString(t.value),
                                        1
                                        /* TEXT */
                                      ))
                                    ], 42, ["onTouchstart"])
                                  ],
                                  64
                                  /* STABLE_FRAGMENT */
                                );
                              }),
                              128
                              /* KEYED_FRAGMENT */
                            )),
                            $setup.dragInsertIndex === $setup.tokens.length ? (vue.openBlock(), vue.createElementBlock(
                              "view",
                              {
                                key: 0,
                                class: vue.normalizeClass(["insert-placeholder", $setup.placeholderSizeClass])
                              },
                              null,
                              2
                              /* CLASS */
                            )) : vue.createCommentVNode("v-if", true)
                          ],
                          4
                          /* STYLE */
                        )
                      ],
                      6
                      /* CLASS, STYLE */
                    )
                  ])
                ],
                512
                /* NEED_PATCH */
              ), [
                [vue.vShow, $setup.mode === "pro"]
              ]),
              vue.createCommentVNode(" Basic 模式：简化操作，面向快速输入 "),
              vue.withDirectives(vue.createElementVNode(
                "view",
                { class: "basic-mode mode-panel" },
                [
                  vue.createElementVNode("view", { class: "basic-board" }, [
                    vue.createElementVNode("view", { class: "basic-column" }, [
                      (vue.openBlock(), vue.createElementBlock(
                        vue.Fragment,
                        null,
                        vue.renderList([0, 2], (i) => {
                          return vue.createElementVNode("view", {
                            key: "basic-left-" + i,
                            class: "basic-card-wrapper"
                          }, [
                            vue.createElementVNode("view", {
                              class: vue.normalizeClass(["basic-card", $setup.basicCardClass(i)]),
                              onClick: ($event) => $setup.handleBasicCardTap(i)
                            }, [
                              $setup.basicSlots[i] && $setup.basicSlots[i].alive && $setup.basicSlots[i].source === "card" ? (vue.openBlock(), vue.createBlock($setup["PlayingCard"], {
                                key: 0,
                                class: "basic-card-visual",
                                card: $setup.basicSlots[i].card,
                                size: "md"
                              }, null, 8, ["card"])) : $setup.basicSlots[i] && $setup.basicSlots[i].alive ? (vue.openBlock(), vue.createElementBlock("view", {
                                key: 1,
                                class: "basic-card-value"
                              }, [
                                vue.createElementVNode(
                                  "text",
                                  { class: "basic-card-value-text" },
                                  vue.toDisplayString($setup.basicSlots[i].label),
                                  1
                                  /* TEXT */
                                )
                              ])) : vue.createCommentVNode("v-if", true)
                            ], 10, ["onClick"])
                          ]);
                        }),
                        64
                        /* STABLE_FRAGMENT */
                      ))
                    ]),
                    vue.createCommentVNode(" Basic 操作区：点击一次选牌、二次选操作 "),
                    vue.createElementVNode(
                      "view",
                      {
                        class: "basic-ops",
                        style: vue.normalizeStyle($setup.basicOpsStyle)
                      },
                      [
                        (vue.openBlock(), vue.createElementBlock(
                          vue.Fragment,
                          null,
                          vue.renderList(["+", "-", "×", "÷"], (op) => {
                            return vue.createElementVNode("button", {
                              key: "basic-op-" + op,
                              class: vue.normalizeClass(["btn btn-operator", { active: $setup.basicSelection.operator === op }]),
                              onClick: ($event) => $setup.handleBasicOperator(op)
                            }, vue.toDisplayString(op), 11, ["onClick"]);
                          }),
                          64
                          /* STABLE_FRAGMENT */
                        ))
                      ],
                      4
                      /* STYLE */
                    ),
                    vue.createElementVNode("view", { class: "basic-column" }, [
                      (vue.openBlock(), vue.createElementBlock(
                        vue.Fragment,
                        null,
                        vue.renderList([1, 3], (i) => {
                          return vue.createElementVNode("view", {
                            key: "basic-right-" + i,
                            class: "basic-card-wrapper"
                          }, [
                            vue.createElementVNode("view", {
                              class: vue.normalizeClass(["basic-card", $setup.basicCardClass(i)]),
                              onClick: ($event) => $setup.handleBasicCardTap(i)
                            }, [
                              $setup.basicSlots[i] && $setup.basicSlots[i].alive && $setup.basicSlots[i].source === "card" ? (vue.openBlock(), vue.createBlock($setup["PlayingCard"], {
                                key: 0,
                                class: "basic-card-visual",
                                card: $setup.basicSlots[i].card,
                                size: "md"
                              }, null, 8, ["card"])) : $setup.basicSlots[i] && $setup.basicSlots[i].alive ? (vue.openBlock(), vue.createElementBlock("view", {
                                key: 1,
                                class: "basic-card-value"
                              }, [
                                vue.createElementVNode(
                                  "text",
                                  { class: "basic-card-value-text" },
                                  vue.toDisplayString($setup.basicSlots[i].label),
                                  1
                                  /* TEXT */
                                )
                              ])) : vue.createCommentVNode("v-if", true)
                            ], 10, ["onClick"])
                          ]);
                        }),
                        64
                        /* STABLE_FRAGMENT */
                      ))
                    ])
                  ])
                ],
                512
                /* NEED_PATCH */
              ), [
                [vue.vShow, $setup.mode !== "pro"]
              ])
            ])
          ]),
          vue.createCommentVNode(" 底部操作按钮：集中放置与局相关的快捷操作 "),
          vue.createElementVNode("view", {
            id: "gameBottomBox",
            class: "game-footer"
          }, [
            vue.createElementVNode("view", { class: "action-grid" }, [
              vue.createVNode($setup["CircleActionButton"], {
                icon: "undo",
                label: "撤销",
                disabled: $setup.undoDisabled,
                onClick: $setup.handleUndo
              }, null, 8, ["disabled"]),
              vue.createVNode($setup["CircleActionButton"], {
                icon: "refresh",
                label: "重置",
                disabled: $setup.resetDisabled,
                onClick: $setup.handleReset
              }, null, 8, ["disabled"]),
              vue.createVNode($setup["CircleActionButton"], {
                icon: "lightbulb",
                label: "提示",
                onClick: $setup.handleHint
              }),
              vue.createVNode($setup["CircleActionButton"], {
                icon: "skip_next",
                label: "下一题",
                onClick: $setup.skipHand
              })
            ])
          ])
        ]),
        vue.createCommentVNode(" 底部导航由全局 tabBar 提供（见 pages.json） "),
        vue.createCommentVNode(" 成功动画覆盖层（0.5s） "),
        $setup.successAnimating ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "success-overlay"
        }, [
          vue.createElementVNode("view", { class: "success-burst" }, "24!")
        ])) : vue.createCommentVNode("v-if", true),
        $setup.errorAnimating ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "success-overlay"
        }, [
          vue.createElementVNode("view", { class: "error-burst" }, [
            vue.createElementVNode("text", { class: "err-title" }, "计算错误"),
            $setup.errorValueText ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "err-val"
              },
              vue.toDisplayString($setup.errorValueText),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $setup.timerPopover.visible ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "timer-popover-layer",
          onClick: $setup.closeTimerPopover
        }, [
          vue.createElementVNode(
            "view",
            {
              class: "timer-popover",
              style: vue.normalizeStyle($setup.timerPopoverStyle),
              onClick: _cache[8] || (_cache[8] = vue.withModifiers(() => {
              }, ["stop"]))
            },
            [
              vue.createElementVNode("button", {
                class: "timer-popover-item",
                onClick: $setup.redealHand
              }, "重新发牌")
            ],
            4
            /* STYLE */
          )
        ])) : vue.createCommentVNode("v-if", true),
        $setup.hintState.visible ? (vue.openBlock(), vue.createElementBlock(
          "view",
          {
            key: 3,
            class: vue.normalizeClass(["floating-hint-layer", { interactive: $setup.hintState.interactive }]),
            onClick: _cache[10] || (_cache[10] = (...args) => $setup.hideHint && $setup.hideHint(...args))
          },
          [
            vue.createElementVNode(
              "view",
              {
                class: "floating-hint",
                onClick: _cache[9] || (_cache[9] = vue.withModifiers(() => {
                }, ["stop"]))
              },
              vue.toDisplayString($setup.hintState.text),
              1
              /* TEXT */
            )
          ],
          2
          /* CLASS */
        )) : vue.createCommentVNode("v-if", true)
      ],
      38
      /* CLASS, STYLE, NEED_HYDRATION */
    );
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["render", _sfc_render$4], ["__scopeId", "data-v-1cf27b2a"], ["__file", "D:/heky/SWProject/Twentyfourgame/pages/index/index.vue"]]);
  const _sfc_main$4 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const users = vue.ref({ list: [], currentId: "" });
      const newName = vue.ref("");
      const { hintState, showHint, hideHint } = useFloatingHint();
      const edgeHandlers = useEdgeExit({ showHint, onExit: () => exitPage() });
      onBackPress(() => {
        navigateToHome();
        return true;
      });
      const { safeTop, safeBottom } = useSafeArea();
      const basePaddingPx = rpxToPx(24) || 12;
      const pageStyle = vue.computed(() => {
        const safeTopPx = Math.max(0, safeTop.value || 0);
        const safeBottomPx = Math.max(0, safeBottom.value || 0);
        const base = basePaddingPx;
        return {
          paddingTop: `${safeTopPx + base}px`,
          paddingLeft: `${base}px`,
          paddingRight: `${base}px`,
          paddingBottom: `${base + safeBottomPx}px`,
          display: "flex",
          flexDirection: "column",
          rowGap: "16rpx",
          backgroundColor: "#f8fafc",
          boxSizing: "border-box",
          minHeight: "calc(var(--vh, 1vh) * 100)"
        };
      });
      function loadUsers() {
        const cached = getCachedUsersState();
        if (cached && Array.isArray(cached.list)) {
          users.value = cached;
          return;
        }
        const data = getUsers();
        users.value = data;
        setCachedUsersState(data);
      }
      const visibleUsers = vue.computed(() => (users.value.list || []).filter((u) => String(u.name || "") !== "Guest"));
      vue.onMounted(() => {
        try {
          uni.hideTabBar && uni.hideTabBar();
        } catch (_) {
        }
        ensureInit();
        loadUsers();
      });
      onShow(() => {
        loadUsers();
        if (consumeAvatarRestoreNotice()) {
          showHint("头像文件丢失，已为你恢复为默认头像", 2e3);
        }
      });
      function create() {
        addUser(newName.value.trim() || void 0);
        newName.value = "";
        loadUsers();
        try {
          scheduleTabWarmup({ delay: 200 });
        } catch (_) {
        }
      }
      function choose(id) {
        switchUser(id);
        loadUsers();
        try {
          scheduleTabWarmup({ delay: 200 });
        } catch (_) {
        }
        try {
          uni.reLaunch({ url: "/pages/index/index" });
        } catch (_) {
          try {
            uni.navigateTo({ url: "/pages/index/index" });
          } catch (e) {
          }
        }
      }
      function rename(u) {
        uni.showModal({ title: "改名", editable: true, placeholderText: u.name, success(res) {
          if (res.confirm) {
            renameUser(u.id, res.content || u.name);
            loadUsers();
            try {
              scheduleTabWarmup({ delay: 200 });
            } catch (_) {
            }
          }
        } });
      }
      function remove(id) {
        uni.showModal({
          title: "删除用户",
          content: "确定删除该用户？",
          success(res) {
            if (res.confirm) {
              removeAvatarForUser(id).finally(() => {
                removeUser(id);
                loadUsers();
                try {
                  scheduleTabWarmup({ delay: 200 });
                } catch (_) {
                }
              });
            }
          }
        });
      }
      function changeAvatar(u) {
        if (!u || !u.id)
          return;
        try {
          uni.showActionSheet({
            itemList: ["从相册选择", "移除头像", "取消"],
            success(a) {
              const i = a.tapIndex;
              if (i === 0) {
                try {
                  uni.chooseImage({
                    count: 1,
                    sizeType: ["compressed"],
                    success(sel) {
                      const path = sel.tempFilePaths && sel.tempFilePaths[0] || "";
                      const size = sel.tempFiles && sel.tempFiles[0] && sel.tempFiles[0].size || 0;
                      if (!path) {
                        showHint("未选择有效头像", 1500);
                        return;
                      }
                      saveAvatarForUser(u.id, path, { size }).then((res) => {
                        if (!res || !res.ok) {
                          showHint("头像保存失败，请重试", 1800);
                        } else {
                          showHint("头像已更新", 1200);
                        }
                        loadUsers();
                        try {
                          scheduleTabWarmup({ delay: 240 });
                        } catch (_) {
                        }
                      });
                    },
                    fail() {
                      showHint("头像选择已取消", 1200);
                    }
                  });
                } catch (_) {
                }
              } else if (i === 1) {
                removeAvatarForUser(u.id).then(() => {
                  showHint("已恢复默认头像", 1500);
                  loadUsers();
                  try {
                    scheduleTabWarmup({ delay: 240 });
                  } catch (_) {
                  }
                }).catch(() => {
                  showHint("头像清除失败，请重试", 1800);
                });
              }
            }
          });
        } catch (_) {
        }
      }
      function avatarText(name) {
        if (!name)
          return "U";
        const s = String(name).trim();
        return s.length ? s[0].toUpperCase() : "U";
      }
      function exitPage() {
        navigateToHome();
      }
      const __returned__ = { users, newName, hintState, showHint, hideHint, edgeHandlers, safeTop, safeBottom, basePaddingPx, pageStyle, loadUsers, visibleUsers, create, choose, rename, remove, changeAvatar, avatarText, exitPage, ref: vue.ref, onMounted: vue.onMounted, computed: vue.computed, get onBackPress() {
        return onBackPress;
      }, get onShow() {
        return onShow;
      }, AppNavBar, get ensureInit() {
        return ensureInit;
      }, get getUsers() {
        return getUsers;
      }, get addUser() {
        return addUser;
      }, get renameUser() {
        return renameUser;
      }, get rmUser() {
        return removeUser;
      }, get switchUser() {
        return switchUser;
      }, get useFloatingHint() {
        return useFloatingHint;
      }, get useEdgeExit() {
        return useEdgeExit;
      }, get saveAvatarForUser() {
        return saveAvatarForUser;
      }, get removeAvatarForUser() {
        return removeAvatarForUser;
      }, get consumeAvatarRestoreNotice() {
        return consumeAvatarRestoreNotice;
      }, get navigateToHome() {
        return navigateToHome;
      }, get useSafeArea() {
        return useSafeArea;
      }, get rpxToPx() {
        return rpxToPx;
      }, get getCachedUsersState() {
        return getCachedUsersState;
      }, get setCachedUsersState() {
        return setCachedUsersState;
      }, get scheduleTabWarmup() {
        return scheduleTabWarmup;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$3(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: "page",
        style: vue.normalizeStyle($setup.pageStyle),
        onTouchstart: _cache[3] || (_cache[3] = (...args) => $setup.edgeHandlers.handleTouchStart && $setup.edgeHandlers.handleTouchStart(...args)),
        onTouchmove: _cache[4] || (_cache[4] = (...args) => $setup.edgeHandlers.handleTouchMove && $setup.edgeHandlers.handleTouchMove(...args)),
        onTouchend: _cache[5] || (_cache[5] = (...args) => $setup.edgeHandlers.handleTouchEnd && $setup.edgeHandlers.handleTouchEnd(...args)),
        onTouchcancel: _cache[6] || (_cache[6] = (...args) => $setup.edgeHandlers.handleTouchCancel && $setup.edgeHandlers.handleTouchCancel(...args))
      },
      [
        vue.createVNode($setup["AppNavBar"], {
          title: "用户管理",
          "show-back": true,
          "with-safe-top": false,
          "back-to-index": true
        }),
        vue.createElementVNode("view", {
          class: "row",
          style: { "gap": "12rpx", "align-items": "center" }
        }, [
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.newName = $event),
              placeholder: "新用户名称",
              class: "input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $setup.newName]
          ]),
          vue.createElementVNode("button", {
            class: "btn btn-primary",
            onClick: $setup.create
          }, "添加")
        ]),
        vue.createElementVNode("view", { class: "list" }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($setup.visibleUsers, (u) => {
              return vue.openBlock(), vue.createElementBlock(
                "view",
                {
                  key: u.id,
                  class: vue.normalizeClass(["item card section", { active: u.id === $setup.users.currentId }])
                },
                [
                  vue.createElementVNode("view", {
                    class: "user-left",
                    onClick: ($event) => $setup.choose(u.id)
                  }, [
                    u.avatar ? (vue.openBlock(), vue.createElementBlock("image", {
                      key: 0,
                      class: "avatar-img",
                      src: u.avatar,
                      mode: "aspectFill"
                    }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock(
                      "view",
                      {
                        key: 1,
                        class: "avatar",
                        style: vue.normalizeStyle({ backgroundColor: u.color || "#e2e8f0" })
                      },
                      vue.toDisplayString($setup.avatarText(u.name)),
                      5
                      /* TEXT, STYLE */
                    )),
                    vue.createElementVNode(
                      "view",
                      { class: "name" },
                      vue.toDisplayString(u.name),
                      1
                      /* TEXT */
                    )
                  ], 8, ["onClick"]),
                  vue.createElementVNode("view", { class: "ops" }, [
                    vue.createElementVNode("button", {
                      class: "mini",
                      onClick: ($event) => $setup.rename(u)
                    }, "改名", 8, ["onClick"]),
                    vue.createElementVNode("button", {
                      class: "mini",
                      onClick: ($event) => $setup.changeAvatar(u)
                    }, "头像", 8, ["onClick"]),
                    vue.createElementVNode("button", {
                      class: "mini danger",
                      onClick: ($event) => $setup.remove(u.id)
                    }, "删除", 8, ["onClick"])
                  ])
                ],
                2
                /* CLASS */
              );
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]),
        $setup.hintState.visible ? (vue.openBlock(), vue.createElementBlock(
          "view",
          {
            key: 0,
            class: vue.normalizeClass(["floating-hint-layer", { interactive: $setup.hintState.interactive }]),
            onClick: _cache[2] || (_cache[2] = (...args) => $setup.hideHint && $setup.hideHint(...args))
          },
          [
            vue.createElementVNode(
              "view",
              {
                class: "floating-hint",
                onClick: _cache[1] || (_cache[1] = vue.withModifiers(() => {
                }, ["stop"]))
              },
              vue.toDisplayString($setup.hintState.text),
              1
              /* TEXT */
            )
          ],
          2
          /* CLASS */
        )) : vue.createCommentVNode("v-if", true)
      ],
      36
      /* STYLE, NEED_HYDRATION */
    );
  }
  const PagesUserIndex = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["render", _sfc_render$3], ["__scopeId", "data-v-79e6a490"], ["__file", "D:/heky/SWProject/Twentyfourgame/pages/user/index.vue"]]);
  const _sfc_main$3 = {
    __name: "MiniBar",
    props: {
      pct: { type: Number, default: 0 },
      color: { type: String, default: "#16a34a" },
      trackColor: { type: String, default: "#e5e7eb" },
      size: { type: Number, default: 14 }
    },
    setup(__props, { expose: __expose }) {
      __expose();
      const props = __props;
      const __returned__ = { props };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: "bar-track",
        style: vue.normalizeStyle({ height: $props.size + "rpx", background: $props.trackColor })
      },
      [
        vue.createElementVNode(
          "view",
          {
            class: "bar-fill",
            style: vue.normalizeStyle({ width: $props.pct + "%", background: $props.color })
          },
          null,
          4
          /* STYLE */
        )
      ],
      4
      /* STYLE */
    );
  }
  const MiniBar = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$2], ["__scopeId", "data-v-3db440fe"], ["__file", "D:/heky/SWProject/Twentyfourgame/components/MiniBar.vue"]]);
  function evalExprToNumber(expr) {
    if (!expr || typeof expr !== "string")
      return null;
    const cleaned = expr.replace(/[×脳]/g, "*").replace(/[÷梅]/g, "/").replace(/\s+/g, "");
    if (!/^[0-9+\-*/().]+$/.test(cleaned))
      return null;
    try {
      const val = Function('"use strict";return(' + cleaned + ")")();
      return typeof val === "number" && Number.isFinite(val) ? val : null;
    } catch (_) {
      return null;
    }
  }
  function computeOverviewRows(userRows, userExtMap, cutoffMs = 0) {
    const items = (userRows || []).map((u) => {
      const rec = userExtMap && userExtMap[u.id] || { rounds: [], agg: {} };
      const rounds = (rec.rounds || []).filter((r) => !cutoffMs || (r.ts || 0) >= cutoffMs);
      const total = rounds.length;
      const success = rounds.filter((r) => r.success).length;
      const winRate = total ? Math.round(100 * success / total) : 0;
      const times = rounds.filter((r) => r.success && Number.isFinite(r.timeMs)).map((r) => r.timeMs);
      const bestTimeMs = times.length ? Math.min(...times) : null;
      const avgTimeMs = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
      const fail = total - success;
      return { id: u.id, name: u.name, total, success, fail, times: total, winRate, bestTimeMs, avgTimeMs };
    });
    items.sort((a, b) => b.winRate - a.winRate || b.times - a.times);
    return items;
  }
  function percentile(sortedArray, p) {
    if (!sortedArray.length)
      return 0;
    const idx = Math.min(sortedArray.length - 1, Math.max(0, Math.ceil(p / 100 * sortedArray.length) - 1));
    return +sortedArray[idx].toFixed(3);
  }
  function summarizeNearMisses(rounds) {
    const diffs = [];
    for (const r of rounds || []) {
      if (r && !r.success && typeof r.expr === "string") {
        const v = evalExprToNumber(r.expr);
        if (v == null)
          continue;
        const d = v - 24;
        diffs.push({ abs: Math.abs(d), sign: Math.sign(d) });
      }
    }
    const absArr = diffs.map((x) => x.abs).sort((a, b) => a - b);
    const count = absArr.length;
    if (!count)
      return { count: 0, median: "-", p90: "-", lt1: 0, lt01: 0, biasUp: 0, biasDown: 0 };
    const median = percentile(absArr, 50);
    const p90 = percentile(absArr, 90);
    const lt1 = Math.round(100 * (absArr.filter((x) => x < 1).length / count));
    const lt01 = Math.round(100 * (absArr.filter((x) => x < 0.1).length / count));
    const up = diffs.filter((x) => x.sign > 0).length;
    const down = diffs.filter((x) => x.sign < 0).length;
    const total = up + down;
    const biasUp = total ? Math.round(100 * up / total) : 0;
    const biasDown = total ? Math.round(100 * down / total) : 0;
    return { count, median, p90, lt1, lt01, biasUp, biasDown };
  }
  function computeDailySeries(rounds) {
    const byDay = /* @__PURE__ */ new Map();
    for (const r of rounds || []) {
      const key = new Date(r.ts || 0).toISOString().slice(0, 10);
      const cur = byDay.get(key) || { total: 0, success: 0, successTimes: [] };
      cur.total += 1;
      if (r.success) {
        cur.success += 1;
        if (Number.isFinite(r.timeMs))
          cur.successTimes.push(r.timeMs);
      }
      byDay.set(key, cur);
    }
    return Array.from(byDay.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1);
  }
  function computeSpeedBuckets(rounds) {
    const defs = [
      { label: "<5s", min: 0, max: 5e3, minInclusive: true, maxInclusive: false },
      { label: "5-10s", min: 5e3, max: 1e4, minInclusive: true, maxInclusive: false },
      { label: "10-20s", min: 1e4, max: 2e4, minInclusive: true, maxInclusive: false },
      { label: "20-30s", min: 2e4, max: 3e4, minInclusive: true, maxInclusive: false },
      { label: "30-40s", min: 3e4, max: 4e4, minInclusive: true, maxInclusive: false },
      { label: "40-50s", min: 4e4, max: 5e4, minInclusive: true, maxInclusive: false },
      { label: "50-60s", min: 5e4, max: 6e4, minInclusive: true, maxInclusive: false },
      { label: "60-90s", min: 6e4, max: 9e4, minInclusive: true, maxInclusive: false },
      { label: "90-120s", min: 9e4, max: 12e4, minInclusive: true, maxInclusive: true },
      { label: ">120s", min: 12e4, max: Infinity, minInclusive: false, maxInclusive: false }
    ];
    const rows = defs.map((def) => ({ label: def.label, total: 0, success: 0, fail: 0, totalTimeMs: 0 }));
    const withinBucket = (value, def) => {
      if (!Number.isFinite(value))
        return false;
      const minOk = def.minInclusive === false ? value > def.min : value >= def.min;
      const maxOk = def.maxInclusive ? value <= def.max : value < def.max;
      return minOk && maxOk;
    };
    for (const r of rounds || []) {
      if (!Number.isFinite(r == null ? void 0 : r.timeMs))
        continue;
      const t = Math.max(0, Math.floor(r.timeMs));
      const idx = defs.findIndex((def) => withinBucket(t, def));
      if (idx < 0)
        continue;
      const row = rows[idx];
      row.total += 1;
      if (r.success)
        row.success += 1;
      else
        row.fail += 1;
      row.totalTimeMs += t;
    }
    return rows.map((row) => ({
      label: row.label,
      total: row.total,
      success: row.success,
      fail: row.fail,
      avgTimeMs: row.total ? Math.round(row.totalTimeMs / row.total) : null
    }));
  }
  const SELECTED_USER_STORE_KEY = "tf24_stats_selected_user_v1";
  const TREND_BAR_HEIGHT = 160;
  const TREND_BAR_WIDTH = 24;
  const TREND_BAR_GAP = 12;
  const DAY_MS = 864e5;
  const SORT_STORE_KEY = "tf24_overview_sort_v1";
  const _sfc_main$2 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const { safeTop, safeBottom } = useSafeArea();
      const basePaddingPx = rpxToPx(24) || 12;
      const pageStyle = vue.computed(() => {
        const safeTopPx = Math.max(0, safeTop.value || 0);
        const safeBottomPx = Math.max(0, safeBottom.value || 0);
        const base = basePaddingPx;
        return {
          paddingTop: `${safeTopPx + base}px`,
          paddingLeft: `${base}px`,
          paddingRight: `${base}px`,
          paddingBottom: `${base + safeBottomPx}px`,
          display: "flex",
          flexDirection: "column",
          rowGap: "18rpx",
          backgroundColor: "#f8fafc",
          boxSizing: "border-box",
          minHeight: "calc(var(--vh, 1vh) * 100)"
        };
      });
      const rows = vue.ref([]);
      const overviewRange = vue.ref(1);
      const hintFilter = vue.ref("all");
      const selectedUserId = vue.ref("");
      const userOptions = vue.computed(() => rows.value.map((r) => ({ id: r.id, name: r.name })));
      const selectedUserLabel = vue.computed(() => {
        var _a;
        return ((_a = userOptions.value.find((o) => o.id === selectedUserId.value)) == null ? void 0 : _a.name) || "请选择用户";
      });
      const userExtMap = vue.ref({});
      const userMap = vue.computed(() => {
        const map = {};
        for (const r of rows.value)
          map[r.id] = { id: r.id, name: r.name };
        return map;
      });
      const { hintState, showHint, hideHint } = useFloatingHint();
      const edgeHandlers = useEdgeExit({ showHint, onExit: () => exitStatsPage() });
      onBackPress(() => {
        navigateToHome();
        return true;
      });
      const ext = vue.ref({ totals: { total: 0, success: 0, fail: 0 }, days: {}, rounds: [], agg: {} });
      const rotateDates = vue.computed(() => {
        var _a, _b;
        try {
          const n = ((_b = (_a = trendSeries.value) == null ? void 0 : _a.items) == null ? void 0 : _b.length) || 0;
          return n >= 1;
        } catch (_) {
          return false;
        }
      });
      const mistakeBook = vue.ref({ active: {}, ledger: {} });
      const mistakeSummary = vue.ref({ totalWrongCount: 0, totalActiveCount: 0 });
      const mistakeFilterActiveOnly = vue.ref(true);
      const mistakeRows = vue.computed(() => {
        const book = mistakeBook.value || { active: {}, ledger: {} };
        const ledger = book.ledger || {};
        const activeKeys = new Set(Object.keys(book.active || {}));
        const rows2 = [];
        for (const key of Object.keys(ledger)) {
          const item = ledger[key] || {};
          const attempts = Number.isFinite(item.attempts) ? Math.max(0, Math.floor(item.attempts)) : 0;
          const wrong = Number.isFinite(item.wrong) ? Math.max(0, Math.floor(item.wrong)) : 0;
          const correct = Number.isFinite(item.correct) ? Math.max(0, Math.floor(item.correct)) : 0;
          const totalAttempts = attempts || wrong + correct;
          const errorRate = totalAttempts ? Math.round(wrong / totalAttempts * 100) : 0;
          const streak = Number.isFinite(item.streakCorrect) ? Math.max(0, Math.floor(item.streakCorrect)) : 0;
          const lastSeenTs = Number.isFinite(item.lastSeenTs) ? Math.floor(item.lastSeenTs) : 0;
          const nums = Array.isArray(item.nums) ? item.nums : typeof key === "string" ? key.split(",").map((n) => +n || 0) : [];
          rows2.push({
            key: item.key || key,
            displayKey: item.key || key || nums.join(","),
            nums,
            attempts: totalAttempts,
            wrong,
            correct,
            errorRate,
            streak,
            active: activeKeys.has(key),
            lastSeenTs,
            lastSeenText: lastSeenTs ? fmtTs(lastSeenTs) : "-"
          });
        }
        rows2.sort((a, b) => b.lastSeenTs - a.lastSeenTs);
        return rows2;
      });
      const mistakeDisplayRows = vue.computed(() => {
        const arr = mistakeRows.value.slice();
        const filtered = mistakeFilterActiveOnly.value ? arr.filter((r) => r.active) : arr;
        filtered.sort((a, b) => {
          return b.attempts - a.attempts || b.wrong - a.wrong || b.lastSeenTs - a.lastSeenTs;
        });
        return filtered;
      });
      vue.onMounted(() => {
        try {
          uni.hideTabBar && uni.hideTabBar();
        } catch (_) {
        }
        ensureInit();
        load2();
        loadExt();
        if (consumeAvatarRestoreNotice()) {
          showHint("头像文件丢失，已为你恢复为默认头像", 2e3);
        }
      });
      onShow(() => {
        load2();
        loadExt();
        if (consumeAvatarRestoreNotice()) {
          showHint("头像文件丢失，已为你恢复为默认头像", 2e3);
        }
      });
      onPullDownRefresh(() => {
        try {
          load2();
          loadExt();
        } finally {
          try {
            uni.stopPullDownRefresh && uni.stopPullDownRefresh();
          } catch (_) {
          }
        }
      });
      function load2() {
        let list = getCachedOverviewRows();
        if (Array.isArray(list) && list.length) {
          list = list.map((item) => ({ ...item }));
        } else {
          list = allUsersWithStats();
        }
        list.sort((a, b) => b.winRate - a.winRate || b.totals.total - a.totals.total);
        rows.value = list;
        setCachedOverviewRows(list);
        applyDefaultSelectedUser(list);
      }
      function loadExt() {
        const map = {};
        const updates = {};
        for (const u of rows.value) {
          if (!u || !u.id)
            continue;
          const cached = getCachedStatsExt(u.id);
          if (cached) {
            map[u.id] = cached;
            continue;
          }
          const ext2 = readStatsExtended(u.id);
          map[u.id] = ext2;
          updates[u.id] = ext2;
        }
        if (Object.keys(updates).length) {
          mergeCachedStatsExt(updates);
        }
        userExtMap.value = map;
        const uid = selectedUserId.value;
        ext.value = map[uid] || { totals: { total: 0, success: 0, fail: 0 }, days: {}, rounds: [], agg: {} };
        loadMistakeData();
      }
      function loadMistakeData() {
        const uid = selectedUserId.value;
        if (!uid) {
          mistakeBook.value = { active: {}, ledger: {} };
          mistakeSummary.value = { totalWrongCount: 0, totalActiveCount: 0 };
          return;
        }
        try {
          mistakeBook.value = loadMistakeBook(uid);
          mistakeSummary.value = getSummary(uid);
        } catch (_) {
          mistakeBook.value = { active: {}, ledger: {} };
          mistakeSummary.value = { totalWrongCount: 0, totalActiveCount: 0 };
        }
      }
      function loadStoredSelectedUserId() {
        try {
          if (typeof uni !== "undefined" && typeof uni.getStorageSync === "function") {
            const raw = uni.getStorageSync(SELECTED_USER_STORE_KEY);
            return typeof raw === "string" ? raw : "";
          }
        } catch (_) {
        }
        return "";
      }
      function persistSelectedUserId(id) {
        try {
          if (id) {
            if (typeof uni !== "undefined" && typeof uni.setStorageSync === "function") {
              uni.setStorageSync(SELECTED_USER_STORE_KEY, id);
            }
          } else if (typeof uni !== "undefined" && typeof uni.removeStorageSync === "function") {
            uni.removeStorageSync(SELECTED_USER_STORE_KEY);
          }
        } catch (_) {
        }
      }
      function resolveDefaultSelectedUserId(list) {
        var _a;
        const arr = Array.isArray(list) ? list : [];
        if (!arr.length)
          return "";
        const stored = loadStoredSelectedUserId();
        if (stored && arr.some((u) => u.id === stored))
          return stored;
        const current = getCurrentUser();
        if (current && arr.some((u) => u.id === current.id))
          return current.id;
        return ((_a = arr[0]) == null ? void 0 : _a.id) || "";
      }
      function applyDefaultSelectedUser(list) {
        const arr = Array.isArray(list) ? list : [];
        if (!arr.length) {
          if (selectedUserId.value)
            selectedUserId.value = "";
          persistSelectedUserId("");
          return;
        }
        const current = selectedUserId.value;
        if (current && arr.some((u) => u.id === current)) {
          persistSelectedUserId(current);
          return;
        }
        const target = resolveDefaultSelectedUserId(arr);
        if (target && current !== target) {
          selectedUserId.value = target;
        } else if (!target && current) {
          selectedUserId.value = "";
        }
        persistSelectedUserId(target);
      }
      vue.watch(selectedUserId, (uid, prev) => {
        if (uid !== prev) {
          mistakeFilterActiveOnly.value = true;
        }
        loadMistakeData();
        persistSelectedUserId(uid || "");
      });
      function selectUser(uid) {
        selectedUserId.value = uid || "";
        persistSelectedUserId(selectedUserId.value);
        loadExt();
      }
      function onUserChange(e) {
        var _a;
        try {
          const idx = ((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value) | 0;
          const opt = userOptions.value[idx];
          if (opt) {
            selectedUserId.value = opt.id;
            persistSelectedUserId(opt.id);
            loadExt();
          }
        } catch (_) {
        }
      }
      function setOverviewRange(d = 0) {
        overviewRange.value = arguments.length === 0 ? 1 : d;
      }
      function onToggleMistakeActive(e) {
        var _a;
        mistakeFilterActiveOnly.value = !!((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value);
      }
      function copyMistakeKey(row) {
        try {
          const text = typeof (row == null ? void 0 : row.displayKey) === "string" && row.displayKey.trim() ? row.displayKey : typeof (row == null ? void 0 : row.key) === "string" ? row.key : "";
          if (!text)
            return;
          const notifySuccess = () => {
            try {
              if (typeof uni !== "undefined" && typeof uni.showToast === "function") {
                uni.showToast({ title: "题目 key 已复制", icon: "none" });
              } else {
                showHint("题目 key 已复制", 1200);
              }
            } catch (_) {
              showHint("题目 key 已复制", 1200);
            }
          };
          const notifyFail = () => {
            showHint("复制失败，请手动选择", 1500);
          };
          if (typeof uni !== "undefined" && typeof uni.setClipboardData === "function") {
            uni.setClipboardData({ data: text, success: notifySuccess, fail: notifyFail });
            return;
          }
          if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(text).then(notifySuccess).catch(notifyFail);
            return;
          }
          notifyFail();
        } catch (_) {
          showHint("复制失败，请重试", 1500);
        }
      }
      function startOfTodayMs() {
        const d = /* @__PURE__ */ new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }
      function calcCutoffMs() {
        const d = Number(overviewRange.value);
        if (!d || d <= 0)
          return 0;
        const day = 864e5;
        return startOfTodayMs() - (d - 1) * day;
      }
      function goUser() {
        try {
          uni.reLaunch({ url: "/pages/user/index" });
        } catch (e1) {
          try {
            uni.navigateTo({ url: "/pages/user/index" });
          } catch (_) {
          }
        }
      }
      function fmtTs(ts) {
        try {
          const d = new Date(ts);
          return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        } catch (_) {
          return "-";
        }
      }
      function fmtMs(ms) {
        if (!Number.isFinite(ms))
          return "-";
        if (ms < 1e3)
          return ms + "ms";
        const s = ms / 1e3;
        if (s < 60)
          return s.toFixed(1) + "s";
        const m = Math.floor(s / 60);
        const r = Math.round(s % 60);
        return `${m}m${r}s`;
      }
      function normalizeCardRank(value) {
        if (Number.isFinite(value))
          return value;
        const num = Number(value);
        if (Number.isFinite(num))
          return num;
        if (typeof value === "string") {
          const key = value.trim().toUpperCase();
          if (key === "A")
            return 1;
          if (key === "J")
            return 11;
          if (key === "Q")
            return 12;
          if (key === "K")
            return 13;
        }
        return null;
      }
      function extractRoundRanks(round) {
        if (!round || typeof round !== "object")
          return [];
        if (Array.isArray(round.cards)) {
          return round.cards.map(normalizeCardRank).filter((n) => Number.isFinite(n));
        }
        if (round.hand && Array.isArray(round.hand.cards)) {
          return round.hand.cards.map((c) => normalizeCardRank(c == null ? void 0 : c.rank)).filter((n) => Number.isFinite(n));
        }
        if (Array.isArray(round.nums)) {
          return round.nums.map(normalizeCardRank).filter((n) => Number.isFinite(n));
        }
        return [];
      }
      function formatRoundCardsText(round) {
        try {
          const ranks = extractRoundRanks(round);
          if (!ranks.length)
            return "-";
          return ranks.map((n) => String(Math.trunc(n))).join(",");
        } catch (_) {
          return "-";
        }
      }
      const activeRounds = vue.computed(() => {
        const uid = selectedUserId.value;
        if (uid === "all") {
          const arr = [];
          for (const id of Object.keys(userExtMap.value || {})) {
            const rec = userExtMap.value[id];
            const list = ((rec == null ? void 0 : rec.rounds) || []).map((r) => ({ ...r, uid: id }));
            arr.push(...list);
          }
          return arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        } else {
          const rec = userExtMap.value[uid] || { rounds: [] };
          return (rec.rounds || []).map((r) => ({ ...r, uid }));
        }
      });
      const filteredRounds = vue.computed(() => {
        const list = activeRounds.value;
        const cutoff = calcCutoffMs();
        return list.filter((r) => !cutoff || (r.ts || 0) >= cutoff);
      });
      const recentRounds = vue.computed(() => {
        const sorted = filteredRounds.value.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return sorted.slice(0, 12).map((r) => ({ ...r, user: userMap.value[r.uid], cardsText: formatRoundCardsText(r) })).reverse();
      });
      function formatDayKey(ms) {
        const d = new Date(ms);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }
      function shortLabel(key) {
        return key ? key.slice(5).replace("-", "/") : "";
      }
      const trendSeries = vue.computed(() => {
        const rounds = filteredRounds.value;
        const byDay = /* @__PURE__ */ new Map();
        for (const r of rounds) {
          const key = formatDayKey(r.ts || 0);
          const cur = byDay.get(key) || { total: 0, success: 0 };
          cur.total += 1;
          if (r.success)
            cur.success += 1;
          byDay.set(key, cur);
        }
        const todayMs = startOfTodayMs();
        const todayKey = formatDayKey(todayMs);
        let keys = [];
        if (overviewRange.value > 0) {
          const span = Number(overviewRange.value) || 1;
          const startMs = todayMs - (span - 1) * DAY_MS;
          for (let ms = startMs; ms <= todayMs; ms += DAY_MS) {
            keys.push(formatDayKey(ms));
          }
        } else {
          keys = Array.from(byDay.keys());
          if (!keys.includes(todayKey))
            keys.push(todayKey);
          keys.sort();
          if (keys.length > 30)
            keys = keys.slice(-30);
        }
        const seriesData = keys.map((key) => {
          const entry = byDay.get(key) || { total: 0, success: 0 };
          const total = entry.total || 0;
          const success = entry.success || 0;
          const winRate = total ? success / total : 0;
          return { key, total, success, winRate };
        });
        const maxTotal = Math.max(1, ...seriesData.map((item) => item.total));
        const items = seriesData.map((item) => {
          const totalHeight = item.total ? Math.max(4, Math.round(item.total / maxTotal * TREND_BAR_HEIGHT)) : 0;
          const successHeight = item.total ? Math.round(totalHeight * item.winRate) : 0;
          const failHeight = Math.max(0, totalHeight - successHeight);
          return {
            label: item.key,
            shortLabel: shortLabel(item.key),
            totalHeight,
            successHeight,
            failHeight
          };
        });
        const width = items.length ? items.length * (TREND_BAR_WIDTH + TREND_BAR_GAP) - TREND_BAR_GAP : 0;
        return {
          items,
          barWidth: TREND_BAR_WIDTH,
          gap: TREND_BAR_GAP,
          chartHeight: TREND_BAR_HEIGHT,
          width
        };
      });
      const overviewRows = vue.computed(() => computeOverviewRows(rows.value, userExtMap.value, calcCutoffMs()));
      const currentRounds = vue.computed(() => {
        const uid = selectedUserId.value;
        const rec = uid ? userExtMap.value[uid] || { rounds: [] } : { rounds: [] };
        const cutoff = calcCutoffMs();
        const arr = rec.rounds || [];
        return cutoff > 0 ? arr.filter((r) => (r.ts || 0) >= cutoff) : arr.slice();
      });
      function evalExprToNumber2(expr) {
        if (!expr || typeof expr !== "string")
          return null;
        const cleaned = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
        if (!/^[0-9+\-*/().]+$/.test(cleaned))
          return null;
        try {
          const val = Function(`"use strict";return(${cleaned})`)();
          return typeof val === "number" && Number.isFinite(val) ? val : null;
        } catch (_) {
          return null;
        }
      }
      const nearSummary = vue.computed(() => summarizeNearMisses(currentRounds.value));
      const opStats = vue.computed(() => {
        const ops = ["+", "-", "×", "÷"];
        const first = Object.fromEntries(ops.map((o) => [o, { total: 0, success: 0 }]));
        const allCounts = Object.fromEntries(ops.map((o) => [o, 0]));
        for (const r of currentRounds.value) {
          const seq = Array.isArray(r == null ? void 0 : r.ops) ? r.ops : [];
          if (seq.length) {
            const f = seq[0];
            if (first[f]) {
              first[f].total += 1;
              if (r.success)
                first[f].success += 1;
            }
          }
          for (const o of seq) {
            if (allCounts[o] != null)
              allCounts[o] += 1;
          }
        }
        const totalOps = Object.values(allCounts).reduce((a, b) => a + b, 0);
        let entropy = 0;
        if (totalOps > 0) {
          for (const o of ops) {
            const p = allCounts[o] / totalOps;
            if (p > 0)
              entropy += -p * Math.log2(p);
          }
        }
        const entropyMax = Math.log2(4);
        const entropyPct = entropyMax ? Math.round(entropy / entropyMax * 100) : 0;
        return { first, allCounts, totalOps, entropy, entropyPct };
      });
      const streakStats = vue.computed(() => {
        const arr = (currentRounds.value || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
        let curWin = 0, maxWin = 0, curLose = 0, maxLose = 0;
        for (const r of arr) {
          if (r.success) {
            curWin += 1;
            if (curWin > maxWin)
              maxWin = curWin;
            curLose = 0;
          } else {
            curLose += 1;
            if (curLose > maxLose)
              maxLose = curLose;
            curWin = 0;
          }
        }
        return { curWin, maxWin, curLose, maxLose };
      });
      const skillsRadar = vue.computed(() => {
        const rounds = currentRounds.value || [];
        const total = rounds.length || 1;
        const mk = (key, label, pred) => {
          let t = 0, ok = 0;
          for (const r of rounds) {
            const yes = !!pred(r);
            if (yes) {
              t += 1;
              if (r.success)
                ok += 1;
            }
          }
          const usePct = Math.round(100 * (t / total));
          const winPct = t ? Math.round(100 * (ok / t)) : 0;
          return { key, label, usePct, winPct };
        };
        const hasOp = (r, op) => Array.isArray(r == null ? void 0 : r.ops) && r.ops.includes(op);
        const hasParen = (r) => typeof (r == null ? void 0 : r.expr) === "string" && /[()]/.test(r.expr);
        const hasFraction = (r) => {
          if (typeof (r == null ? void 0 : r.expr) === "string" && /[.]/.test(r.expr))
            return true;
          if (typeof (r == null ? void 0 : r.expr) === "string" && /[÷/]/.test(r.expr))
            return true;
          const v = typeof (r == null ? void 0 : r.expr) === "string" ? evalExprToNumber2(r.expr) : null;
          return v != null && Math.abs(v - Math.round(v)) > 1e-9;
        };
        return [
          mk("plus", "＋ 加法", (r) => hasOp(r, "+")),
          mk("minus", "－ 减法", (r) => hasOp(r, "-")),
          mk("mul", "× 乘法", (r) => hasOp(r, "×")),
          mk("div", "÷ 除法", (r) => hasOp(r, "÷") || typeof (r == null ? void 0 : r.expr) === "string" && r.expr.includes("/")),
          mk("paren", "括号", hasParen),
          mk("frac", "分数", hasFraction)
        ];
      });
      const dailySeries = vue.computed(() => computeDailySeries(filteredRounds.value));
      function rollingOf(windowDays) {
        const days = dailySeries.value;
        if (!days.length)
          return { win: 0, avg: "-" };
        const tail = days.slice(-windowDays);
        const total = tail.reduce((a, [, v]) => a + v.total, 0);
        const success = tail.reduce((a, [, v]) => a + v.success, 0);
        const times = tail.flatMap(([, v]) => v.successTimes);
        const win = total ? Math.round(100 * success / total) : 0;
        const avg = times.length ? fmtMs(Math.round(times.reduce((a, b) => a + b, 0) / times.length)) : "-";
        return { win, avg };
      }
      const rolling = vue.computed(() => ({
        win7: rollingOf(7).win,
        win30: rollingOf(30).win,
        avg7: rollingOf(7).avg,
        avg30: rollingOf(30).avg
      }));
      const badges = vue.computed(() => {
        const out = [];
        const rounds = currentRounds.value || [];
        const total = rounds.length;
        const success = rounds.filter((r) => r.success).length;
        const winRate = total ? 100 * success / total : 0;
        if (opStats.value.entropyPct >= 75)
          out.push("多样探索者");
        else if (opStats.value.entropyPct <= 35)
          out.push("单核惯性");
        const opsTotal = Math.max(1, opStats.value.totalOps);
        if ((opStats.value.allCounts["×"] || 0) / opsTotal >= 0.4)
          out.push("乘法信徒");
        if (nearSummary.value.count > 0 && nearSummary.value.lt1 >= 50)
          out.push("精准狙击");
        const frac = (skillsRadar.value || []).find((x) => x.key === "frac");
        if (frac && frac.usePct > 0 && winRate - frac.winPct >= 20)
          out.push("分数恐惧症");
        const succWithRetries = rounds.filter((r) => r.success && Number.isFinite(r.retries) && r.retries > 0).length;
        const succTotal = rounds.filter((r) => r.success).length || 1;
        if (succWithRetries / succTotal >= 0.5 && succTotal >= 4)
          out.push("逆转之王");
        const succTimes = rounds.filter((r) => r.success && Number.isFinite(r.timeMs)).map((r) => r.timeMs);
        const best = succTimes.length ? Math.min(...succTimes) : Infinity;
        if (best <= 1500)
          out.push("极速手");
        const avgRetriesAll = rounds.filter((r) => Number.isFinite(r.retries)).reduce((a, b) => a + b.retries, 0) / Math.max(1, rounds.filter((r) => Number.isFinite(r.retries)).length) || 0;
        if (avgRetriesAll >= 1 && winRate >= 50)
          out.push("磨刀匠");
        return out;
      });
      function handSignature(hand) {
        try {
          const cs = hand && Array.isArray(hand.cards) ? hand.cards : [];
          const ranks = cs.map((c) => +c.rank).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
          return ranks.join(",");
        } catch (_) {
          return "";
        }
      }
      const speedBuckets = vue.computed(() => {
        const rows2 = computeSpeedBuckets(currentRounds.value);
        return rows2.map((row) => {
          const total = row.total || 0;
          const success = row.success || 0;
          const fail = row.fail || 0;
          const avgTimeMs = Number.isFinite(row.avgTimeMs) ? row.avgTimeMs : null;
          const successRate = total ? Math.round(success / total * 100) : 0;
          return {
            label: row.label,
            total,
            success,
            fail,
            successRate,
            avgTimeMs,
            avgTimeText: avgTimeMs != null ? fmtMs(avgTimeMs) : "-"
          };
        });
      });
      const sortKey = vue.ref("winRate");
      const sortDir = vue.ref("desc");
      try {
        const raw = uni.getStorageSync && uni.getStorageSync(SORT_STORE_KEY);
        const cfg = raw && (typeof raw === "string" ? JSON.parse(raw) : raw);
        if (cfg && cfg.key && cfg.dir && (cfg.dir === "asc" || cfg.dir === "desc")) {
          sortKey.value = cfg.key;
          sortDir.value = cfg.dir;
        }
      } catch (_) {
      }
      function persistSort() {
        try {
          uni.setStorageSync && uni.setStorageSync(SORT_STORE_KEY, JSON.stringify({ key: sortKey.value, dir: sortDir.value }));
        } catch (_) {
        }
      }
      function sortBy(key) {
        const defaultDir = key === "name" || key === "avgTimeMs" || key === "bestTimeMs" ? "asc" : "desc";
        if (sortKey.value !== key) {
          sortKey.value = key;
          sortDir.value = defaultDir;
        } else {
          sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
        }
        persistSort();
      }
      const overviewRowsSorted = vue.computed(() => {
        try {
          const rows2 = Array.isArray(overviewRows) ? overviewRows : (overviewRows == null ? void 0 : overviewRows.value) || [];
          const list = [...rows2];
          const key = sortKey.value;
          const dir = sortDir.value;
          const sign = dir === "asc" ? 1 : -1;
          list.sort((a, b) => {
            const av = a == null ? void 0 : a[key];
            const bv = b == null ? void 0 : b[key];
            if (key === "name") {
              const as = String(av ?? "");
              const bs = String(bv ?? "");
              return as.localeCompare(bs, "zh") * sign;
            }
            if (key === "avgTimeMs" || key === "bestTimeMs") {
              const isEmpty = (v) => v == null || v === "" || v === "-" || !Number.isFinite(Number(v));
              const aEmpty = isEmpty(av);
              const bEmpty = isEmpty(bv);
              if (aEmpty && bEmpty)
                return 0;
              if (aEmpty)
                return 1;
              if (bEmpty)
                return -1;
              const na2 = Number(av);
              const nb2 = Number(bv);
              if (na2 === nb2)
                return 0;
              return (na2 > nb2 ? 1 : -1) * sign;
            }
            const na = Number.isFinite(av) ? av : -Infinity;
            const nb = Number.isFinite(bv) ? bv : -Infinity;
            if (na === nb)
              return 0;
            return (na > nb ? 1 : -1) * sign;
          });
          return list;
        } catch (_) {
          return [];
        }
      });
      function exitStatsPage() {
        navigateToHome();
      }
      const __returned__ = { SELECTED_USER_STORE_KEY, safeTop, safeBottom, basePaddingPx, pageStyle, rows, overviewRange, hintFilter, selectedUserId, userOptions, selectedUserLabel, userExtMap, userMap, hintState, showHint, hideHint, edgeHandlers, ext, rotateDates, mistakeBook, mistakeSummary, mistakeFilterActiveOnly, mistakeRows, mistakeDisplayRows, load: load2, loadExt, loadMistakeData, loadStoredSelectedUserId, persistSelectedUserId, resolveDefaultSelectedUserId, applyDefaultSelectedUser, selectUser, onUserChange, setOverviewRange, onToggleMistakeActive, copyMistakeKey, startOfTodayMs, calcCutoffMs, goUser, fmtTs, fmtMs, normalizeCardRank, extractRoundRanks, formatRoundCardsText, activeRounds, filteredRounds, recentRounds, TREND_BAR_HEIGHT, TREND_BAR_WIDTH, TREND_BAR_GAP, DAY_MS, formatDayKey, shortLabel, trendSeries, overviewRows, currentRounds, evalExprToNumber: evalExprToNumber2, nearSummary, opStats, streakStats, skillsRadar, dailySeries, rollingOf, rolling, badges, handSignature, speedBuckets, SORT_STORE_KEY, sortKey, sortDir, persistSort, sortBy, overviewRowsSorted, exitStatsPage, ref: vue.ref, onMounted: vue.onMounted, computed: vue.computed, watch: vue.watch, MiniBar, AppNavBar, get onBackPress() {
        return onBackPress;
      }, get onShow() {
        return onShow;
      }, get onPullDownRefresh() {
        return onPullDownRefresh;
      }, get ensureInit() {
        return ensureInit;
      }, get allUsersWithStats() {
        return allUsersWithStats;
      }, get readStatsExtended() {
        return readStatsExtended;
      }, get getCurrentUser() {
        return getCurrentUser;
      }, get loadMistakeBook() {
        return loadMistakeBook;
      }, get getMistakeSummary() {
        return getSummary;
      }, get useFloatingHint() {
        return useFloatingHint;
      }, get useEdgeExit() {
        return useEdgeExit;
      }, get consumeAvatarRestoreNotice() {
        return consumeAvatarRestoreNotice;
      }, get navigateToHome() {
        return navigateToHome;
      }, get computeOverviewRows() {
        return computeOverviewRows;
      }, get summarizeNearMisses() {
        return summarizeNearMisses;
      }, get computeDailySeries() {
        return computeDailySeries;
      }, get computeSpeedBuckets() {
        return computeSpeedBuckets;
      }, get useSafeArea() {
        return useSafeArea;
      }, get rpxToPx() {
        return rpxToPx;
      }, get getCachedOverviewRows() {
        return getCachedOverviewRows;
      }, get setCachedOverviewRows() {
        return setCachedOverviewRows;
      }, get getCachedStatsExt() {
        return getCachedStatsExt;
      }, get mergeCachedStatsExt() {
        return mergeCachedStatsExt;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: "page",
        style: vue.normalizeStyle($setup.pageStyle),
        onTouchstart: _cache[13] || (_cache[13] = (...args) => $setup.edgeHandlers.handleTouchStart && $setup.edgeHandlers.handleTouchStart(...args)),
        onTouchmove: _cache[14] || (_cache[14] = (...args) => $setup.edgeHandlers.handleTouchMove && $setup.edgeHandlers.handleTouchMove(...args)),
        onTouchend: _cache[15] || (_cache[15] = (...args) => $setup.edgeHandlers.handleTouchEnd && $setup.edgeHandlers.handleTouchEnd(...args)),
        onTouchcancel: _cache[16] || (_cache[16] = (...args) => $setup.edgeHandlers.handleTouchCancel && $setup.edgeHandlers.handleTouchCancel(...args))
      },
      [
        vue.createVNode($setup["AppNavBar"], {
          title: "历史统计",
          "show-back": true,
          "with-safe-top": false,
          "back-to-index": true
        }),
        vue.createElementVNode("view", { class: "section" }, [
          vue.createElementVNode("view", {
            class: "row",
            style: { "justify-content": "space-between", "align-items": "center", "gap": "12rpx", "flex-wrap": "wrap" }
          }, [
            vue.createElementVNode("text", { class: "title" }, "玩家总览"),
            vue.createElementVNode("view", {
              class: "row",
              style: { "display": "flex", "align-items": "center", "gap": "12rpx" }
            }, [
              vue.createElementVNode("view", { class: "seg" }, [
                vue.createElementVNode(
                  "button",
                  {
                    class: vue.normalizeClass(["seg-btn", { active: $setup.overviewRange === 1 }]),
                    onClick: _cache[0] || (_cache[0] = ($event) => $setup.setOverviewRange(1))
                  },
                  "今天",
                  2
                  /* CLASS */
                ),
                vue.createElementVNode(
                  "button",
                  {
                    class: vue.normalizeClass(["seg-btn", { active: $setup.overviewRange === 3 }]),
                    onClick: _cache[1] || (_cache[1] = ($event) => $setup.setOverviewRange(3))
                  },
                  "3天",
                  2
                  /* CLASS */
                ),
                vue.createElementVNode(
                  "button",
                  {
                    class: vue.normalizeClass(["seg-btn", { active: $setup.overviewRange === 7 }]),
                    onClick: _cache[2] || (_cache[2] = ($event) => $setup.setOverviewRange(7))
                  },
                  "7天",
                  2
                  /* CLASS */
                ),
                vue.createElementVNode(
                  "button",
                  {
                    class: vue.normalizeClass(["seg-btn", { active: $setup.overviewRange === 30 }]),
                    onClick: _cache[3] || (_cache[3] = ($event) => $setup.setOverviewRange(30))
                  },
                  "30天",
                  2
                  /* CLASS */
                ),
                vue.createElementVNode(
                  "button",
                  {
                    class: vue.normalizeClass(["seg-btn", { active: $setup.overviewRange === 0 }]),
                    onClick: _cache[4] || (_cache[4] = ($event) => $setup.setOverviewRange(0))
                  },
                  "全部",
                  2
                  /* CLASS */
                )
              ])
            ])
          ]),
          vue.createElementVNode("view", { class: "table" }, [
            vue.createElementVNode("view", { class: "thead" }, [
              vue.createElementVNode("text", { class: "th rank" }, "#"),
              vue.createElementVNode(
                "text",
                {
                  class: vue.normalizeClass(["th user", { active: $setup.sortKey === "name" }]),
                  onClick: _cache[5] || (_cache[5] = ($event) => $setup.sortBy("name"))
                },
                "用户",
                2
                /* CLASS */
              ),
              vue.createElementVNode(
                "text",
                {
                  class: vue.normalizeClass(["th", { active: $setup.sortKey === "times" }]),
                  onClick: _cache[6] || (_cache[6] = ($event) => $setup.sortBy("times"))
                },
                "总局数",
                2
                /* CLASS */
              ),
              vue.createElementVNode(
                "text",
                {
                  class: vue.normalizeClass(["th ok", { active: $setup.sortKey === "success" }]),
                  onClick: _cache[7] || (_cache[7] = ($event) => $setup.sortBy("success"))
                },
                [
                  vue.createTextVNode("成 "),
                  vue.createElementVNode("text", null, [
                    vue.createTextVNode("/ "),
                    vue.createElementVNode("text", { class: "th fail" }, "败 ")
                  ])
                ],
                2
                /* CLASS */
              ),
              vue.createElementVNode(
                "text",
                {
                  class: vue.normalizeClass(["th", { active: $setup.sortKey === "winRate" }]),
                  onClick: _cache[8] || (_cache[8] = ($event) => $setup.sortBy("winRate"))
                },
                "🎯胜率",
                2
                /* CLASS */
              ),
              vue.createElementVNode(
                "text",
                {
                  class: vue.normalizeClass(["th", { active: $setup.sortKey === "avgTimeMs" }]),
                  onClick: _cache[9] || (_cache[9] = ($event) => $setup.sortBy("avgTimeMs"))
                },
                "平均",
                2
                /* CLASS */
              ),
              vue.createElementVNode(
                "text",
                {
                  class: vue.normalizeClass(["th", { active: $setup.sortKey === "bestTimeMs" }]),
                  onClick: _cache[10] || (_cache[10] = ($event) => $setup.sortBy("bestTimeMs"))
                },
                "🏆最佳",
                2
                /* CLASS */
              )
            ]),
            vue.createElementVNode("view", { class: "tbody" }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.overviewRowsSorted, (row, i) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    class: "tr",
                    key: row.id,
                    onClick: ($event) => $setup.selectUser(row.id)
                  }, [
                    vue.createElementVNode(
                      "text",
                      { class: "td rank" },
                      vue.toDisplayString(i + 1),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "td user" },
                      vue.toDisplayString(row.name),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "td" },
                      vue.toDisplayString(row.times),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode("text", { class: "td ok" }, [
                      vue.createTextVNode(
                        vue.toDisplayString(row.success) + " ",
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode("text", null, [
                        vue.createTextVNode("/ "),
                        vue.createElementVNode(
                          "text",
                          { class: "td fail" },
                          vue.toDisplayString(row.fail),
                          1
                          /* TEXT */
                        )
                      ])
                    ]),
                    vue.createElementVNode(
                      "text",
                      { class: "td" },
                      vue.toDisplayString(row.winRate) + "%",
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "td" },
                      vue.toDisplayString(row.avgTimeMs != null ? $setup.fmtMs(row.avgTimeMs) : "-"),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "td" },
                      vue.toDisplayString(row.bestTimeMs != null ? $setup.fmtMs(row.bestTimeMs) : "-"),
                      1
                      /* TEXT */
                    )
                  ], 8, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])
          ])
        ]),
        $setup.selectedUserId ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "section title"
        }, [
          vue.createElementVNode("view", {
            class: "user-picker",
            style: { "display": "flex", "align-items": "center", "gap": "8rpx" }
          }, [
            vue.createCommentVNode(' <text style="color:#6b7280; font-size:26rpx;">查看</text> '),
            vue.createElementVNode("picker", {
              range: $setup.userOptions,
              "range-key": "name",
              onChange: $setup.onUserChange
            }, [
              vue.createElementVNode(
                "view",
                { class: "picker-trigger" },
                vue.toDisplayString($setup.selectedUserLabel),
                1
                /* TEXT */
              )
            ], 40, ["range"])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $setup.selectedUserId ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "section"
        }, [
          vue.createElementVNode("view", {
            class: "row",
            style: { "justify-content": "space-between", "align-items": "center", "gap": "12rpx", "flex-wrap": "wrap" }
          }, [
            vue.createElementVNode("text", { class: "title" }, "📈个人趋势")
          ]),
          vue.createElementVNode("view", {
            class: "trend-chart",
            style: { "margin-top": "12rpx" }
          }, [
            vue.createElementVNode(
              "view",
              {
                class: "trend-chart-inner",
                style: vue.normalizeStyle({ width: $setup.trendSeries.width ? $setup.trendSeries.width + "rpx" : "100%", height: $setup.trendSeries.chartHeight + "rpx" })
              },
              [
                vue.createElementVNode(
                  "view",
                  {
                    class: "trend-bars",
                    style: vue.normalizeStyle({ gap: $setup.trendSeries.gap + "rpx", width: $setup.trendSeries.width ? $setup.trendSeries.width + "rpx" : "100%" })
                  },
                  [
                    (vue.openBlock(true), vue.createElementBlock(
                      vue.Fragment,
                      null,
                      vue.renderList($setup.trendSeries.items, (d, i) => {
                        return vue.openBlock(), vue.createElementBlock(
                          "view",
                          {
                            key: d.label || i,
                            class: "trend-item",
                            style: vue.normalizeStyle({ width: $setup.trendSeries.barWidth + "rpx" })
                          },
                          [
                            vue.createElementVNode(
                              "view",
                              {
                                class: "bar",
                                style: vue.normalizeStyle({ height: d.totalHeight + "rpx" })
                              },
                              [
                                vue.createElementVNode(
                                  "view",
                                  {
                                    class: "bar-fail",
                                    style: vue.normalizeStyle({ height: d.failHeight + "rpx" })
                                  },
                                  null,
                                  4
                                  /* STYLE */
                                ),
                                vue.createElementVNode(
                                  "view",
                                  {
                                    class: "bar-success",
                                    style: vue.normalizeStyle({ height: d.successHeight + "rpx" })
                                  },
                                  null,
                                  4
                                  /* STYLE */
                                )
                              ],
                              4
                              /* STYLE */
                            )
                          ],
                          4
                          /* STYLE */
                        );
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ],
                  4
                  /* STYLE */
                )
              ],
              4
              /* STYLE */
            ),
            vue.createElementVNode(
              "view",
              {
                class: vue.normalizeClass(["trend-labels", { rotate: $setup.rotateDates }]),
                style: vue.normalizeStyle({ gap: $setup.trendSeries.gap + "rpx", width: $setup.trendSeries.width ? $setup.trendSeries.width + "rpx" : "100%" })
              },
              [
                (vue.openBlock(true), vue.createElementBlock(
                  vue.Fragment,
                  null,
                  vue.renderList($setup.trendSeries.items, (d, i) => {
                    return vue.openBlock(), vue.createElementBlock(
                      "text",
                      {
                        key: "label-" + i,
                        class: "bar-label",
                        style: vue.normalizeStyle({ width: $setup.trendSeries.barWidth + "rpx" })
                      },
                      vue.toDisplayString(d.shortLabel),
                      5
                      /* TEXT, STYLE */
                    );
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ],
              6
              /* CLASS, STYLE */
            )
          ]),
          vue.createElementVNode("view", {
            class: "trend-legend",
            style: { "margin-top": "8rpx", "color": "#6b7280", "font-size": "24rpx" }
          }, "绿色=胜利局数，红色=失败局数"),
          vue.createCommentVNode(` <view class="table" style="margin-top:12rpx;">\r
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }">\r
          <text class="th">窗口</text>\r
          <text class="th">滚动胜率</text>\r
          <text class="th">滚动平均用时</text>\r
        </view>\r
        <view class="tbody">\r
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }">\r
            <text class="td">7天</text>\r
            <text class="td">{{ rolling.win7 }}%</text>\r
            <text class="td">{{ rolling.avg7 }}</text>\r
          </view>\r
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }">\r
            <text class="td">30天</text>\r
            <text class="td">{{ rolling.win30 }}%</text>\r
            <text class="td">{{ rolling.avg30 }}</text>\r
          </view>\r
        </view>\r
      </view> `),
          vue.createElementVNode("view", {
            class: "table",
            style: { "margin-top": "12rpx" }
          }, [
            vue.createElementVNode(
              "view",
              {
                class: "thead",
                style: vue.normalizeStyle({ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" })
              },
              [
                vue.createElementVNode("text", { class: "th" }, "当前连胜"),
                vue.createElementVNode("text", { class: "th" }, "最长连胜"),
                vue.createElementVNode("text", { class: "th" }, "当前连败"),
                vue.createElementVNode("text", { class: "th" }, "最长连败")
              ],
              4
              /* STYLE */
            ),
            vue.createElementVNode("view", { class: "tbody" }, [
              vue.createElementVNode(
                "view",
                {
                  class: "tr",
                  style: vue.normalizeStyle({ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" })
                },
                [
                  vue.createElementVNode(
                    "text",
                    { class: "td ok" },
                    vue.toDisplayString($setup.streakStats.curWin),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "td ok" },
                    vue.toDisplayString($setup.streakStats.maxWin),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "td fail" },
                    vue.toDisplayString($setup.streakStats.curLose),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "td fail" },
                    vue.toDisplayString($setup.streakStats.maxLose),
                    1
                    /* TEXT */
                  )
                ],
                4
                /* STYLE */
              )
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $setup.selectedUserId ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "section"
        }, [
          vue.createElementVNode("view", {
            class: "row",
            style: { "justify-content": "space-between", "align-items": "center" }
          }, [
            vue.createElementVNode("text", { class: "title" }, "最近战绩")
          ]),
          $setup.recentRounds.length ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "rounds"
          }, [
            vue.createElementVNode("view", { class: "rounds-head" }, [
              vue.createElementVNode("text", null, "时间"),
              vue.createElementVNode("text", null, "结果"),
              vue.createElementVNode("text", null, "用时"),
              vue.createElementVNode("text", null, "牌面")
            ]),
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList(($setup.recentRounds || []).slice().reverse(), (r) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: r.id,
                  class: "round-item"
                }, [
                  vue.createElementVNode(
                    "text",
                    { class: "r-time" },
                    vue.toDisplayString($setup.fmtTs(r.ts)),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    {
                      class: vue.normalizeClass(["r-result", { ok: r.success, fail: !r.success }])
                    },
                    vue.toDisplayString(r.success ? "成功" : "失败"),
                    3
                    /* TEXT, CLASS */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "r-timeMs" },
                    vue.toDisplayString(r.timeMs != null && Number.isFinite(r.timeMs) ? (r.timeMs / 1e3).toFixed(1) + "s" : "-"),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "r-cards" },
                    vue.toDisplayString(r.cardsText),
                    1
                    /* TEXT */
                  )
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])) : (vue.openBlock(), vue.createElementBlock("view", {
            key: 1,
            class: "empty-tip"
          }, "暂无最近战绩"))
        ])) : vue.createCommentVNode("v-if", true),
        $setup.selectedUserId ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 3,
          class: "section"
        }, [
          vue.createElementVNode("view", {
            class: "row",
            style: { "justify-content": "space-between", "align-items": "center", "gap": "12rpx", "flex-wrap": "wrap" }
          }, [
            vue.createElementVNode("text", { class: "title" }, "📝错题本"),
            vue.createElementVNode("text", { class: "mistake-tip" }, "连续正确 5 次将自动移出活动错题本（但仍计入总错题统计）")
          ]),
          vue.createElementVNode("view", { class: "mistake-summary" }, [
            vue.createElementVNode("view", { class: "mistake-summary-item" }, [
              vue.createElementVNode("text", { class: "mistake-summary-label" }, "错题总数"),
              vue.createElementVNode(
                "text",
                { class: "mistake-summary-value" },
                vue.toDisplayString($setup.mistakeSummary.totalWrongCount),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "mistake-summary-item" }, [
              vue.createElementVNode("text", { class: "mistake-summary-label" }, "遗留错题"),
              vue.createElementVNode(
                "text",
                { class: "mistake-summary-value" },
                vue.toDisplayString($setup.mistakeSummary.totalActiveCount),
                1
                /* TEXT */
              )
            ])
          ]),
          vue.createElementVNode("view", { class: "mistake-controls" }, [
            vue.createElementVNode("label", { class: "mistake-filter" }, [
              vue.createElementVNode("switch", {
                checked: $setup.mistakeFilterActiveOnly,
                onChange: $setup.onToggleMistakeActive,
                color: "#145751"
              }, null, 40, ["checked"]),
              vue.createElementVNode("text", null, "仅看活动")
            ])
          ]),
          $setup.mistakeDisplayRows.length ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "table mistake-table"
          }, [
            vue.createElementVNode("view", { class: "mistake-grid mistake-head" }, [
              vue.createElementVNode("text", { class: "mistake-th key" }, "题目 key"),
              vue.createElementVNode("text", { class: "mistake-th" }, "尝试"),
              vue.createElementVNode("text", { class: "mistake-th" }, "错误"),
              vue.createElementVNode("text", { class: "mistake-th" }, "正确"),
              vue.createElementVNode("text", { class: "mistake-th" }, "是否活动")
            ]),
            vue.createElementVNode("view", { class: "mistake-body" }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.mistakeDisplayRows, (row) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    class: "mistake-grid mistake-row",
                    key: row.key
                  }, [
                    vue.createElementVNode("text", {
                      class: "mistake-cell key",
                      onClick: ($event) => $setup.copyMistakeKey(row)
                    }, vue.toDisplayString(row.displayKey), 9, ["onClick"]),
                    vue.createElementVNode(
                      "text",
                      { class: "mistake-cell" },
                      vue.toDisplayString(row.attempts),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "mistake-cell fail" },
                      vue.toDisplayString(row.wrong),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "mistake-cell ok" },
                      vue.toDisplayString(row.correct),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      {
                        class: vue.normalizeClass(["mistake-cell", { ok: row.active }])
                      },
                      vue.toDisplayString(row.active ? "是" : "否"),
                      3
                      /* TEXT, CLASS */
                    )
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])
          ])) : (vue.openBlock(), vue.createElementBlock(
            "view",
            {
              key: 1,
              class: "mistake-empty"
            },
            vue.toDisplayString($setup.mistakeFilterActiveOnly ? "当前无活动错题" : "暂无错题记录"),
            1
            /* TEXT */
          ))
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 称号系统（基础版） "),
        $setup.selectedUserId ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 4,
          class: "section"
        }, [
          vue.createElementVNode("view", {
            class: "row",
            style: { "justify-content": "space-between", "align-items": "center" }
          }, [
            vue.createElementVNode("text", { class: "title" }, "称号")
          ]),
          vue.createElementVNode("view", { style: { "display": "flex", "flex-wrap": "wrap", "gap": "8rpx", "margin-top": "8rpx" } }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($setup.badges, (b, i) => {
                return vue.openBlock(), vue.createElementBlock(
                  "text",
                  {
                    key: i,
                    style: { "padding": "6rpx 12rpx", "background": "#f1f5f9", "border-radius": "20rpx", "font-size": "26rpx" }
                  },
                  vue.toDisplayString(b),
                  1
                  /* TEXT */
                );
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 速度-准确概览（时间分桶） "),
        $setup.selectedUserId ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 5,
          class: "section"
        }, [
          vue.createElementVNode("view", {
            class: "row",
            style: { "justify-content": "space-between", "align-items": "center" }
          }, [
            vue.createElementVNode("text", { class: "title" }, "速度-准确概览")
          ]),
          vue.createElementVNode("view", { class: "table" }, [
            vue.createElementVNode(
              "view",
              {
                class: "thead",
                style: vue.normalizeStyle({ display: "grid", gridTemplateColumns: "1.5fr repeat(5, 1fr)" })
              },
              [
                vue.createElementVNode("text", { class: "th" }, "时间段"),
                vue.createElementVNode("text", { class: "th" }, "总数"),
                vue.createElementVNode("text", { class: "th" }, "成功"),
                vue.createElementVNode("text", { class: "th" }, "失败"),
                vue.createElementVNode("text", { class: "th" }, "成功率"),
                vue.createElementVNode("text", { class: "th" }, "平均用时")
              ],
              4
              /* STYLE */
            ),
            vue.createElementVNode("view", { class: "tbody" }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.speedBuckets, (b) => {
                  return vue.openBlock(), vue.createElementBlock(
                    "view",
                    {
                      class: "tr",
                      style: vue.normalizeStyle({ display: "grid", gridTemplateColumns: "1.5fr repeat(5, 1fr)" }),
                      key: b.label
                    },
                    [
                      vue.createElementVNode(
                        "text",
                        { class: "td" },
                        vue.toDisplayString(b.label),
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode(
                        "text",
                        { class: "td" },
                        vue.toDisplayString(b.total),
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode(
                        "text",
                        { class: "td ok" },
                        vue.toDisplayString(b.success),
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode(
                        "text",
                        { class: "td fail" },
                        vue.toDisplayString(b.fail),
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode("view", {
                        class: "td",
                        style: { "padding": "0 8rpx" }
                      }, [
                        vue.createVNode($setup["MiniBar"], {
                          pct: b.successRate
                        }, null, 8, ["pct"])
                      ]),
                      vue.createElementVNode(
                        "text",
                        { class: "td" },
                        vue.toDisplayString(b.avgTimeText),
                        1
                        /* TEXT */
                      )
                    ],
                    4
                    /* STYLE */
                  );
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 技能雷达（表格版） "),
        $setup.selectedUserId ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 6,
          class: "section"
        }, [
          vue.createElementVNode("view", {
            class: "row",
            style: { "justify-content": "space-between", "align-items": "center" }
          }, [
            vue.createElementVNode("text", { class: "title" }, "技能雷达（表格版）")
          ]),
          vue.createElementVNode("view", { class: "table" }, [
            vue.createElementVNode("view", {
              class: "thead",
              style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }
            }, [
              vue.createElementVNode("text", { class: "th" }, "技能"),
              vue.createElementVNode("text", { class: "th" }, "使用占比"),
              vue.createElementVNode("text", { class: "th" }, "胜率")
            ]),
            vue.createElementVNode("view", { class: "tbody" }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.skillsRadar, (r) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    class: "tr",
                    style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr" },
                    key: r.key
                  }, [
                    vue.createElementVNode(
                      "text",
                      { class: "td" },
                      vue.toDisplayString(r.label),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "td" },
                      vue.toDisplayString(r.usePct) + "%",
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "td" },
                      vue.toDisplayString(r.winPct) + "%",
                      1
                      /* TEXT */
                    )
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $setup.hintState.visible ? (vue.openBlock(), vue.createElementBlock(
          "view",
          {
            key: 7,
            class: vue.normalizeClass(["floating-hint-layer", { interactive: $setup.hintState.interactive }]),
            onClick: _cache[12] || (_cache[12] = (...args) => $setup.hideHint && $setup.hideHint(...args))
          },
          [
            vue.createElementVNode(
              "view",
              {
                class: "floating-hint",
                onClick: _cache[11] || (_cache[11] = vue.withModifiers(() => {
                }, ["stop"]))
              },
              vue.toDisplayString($setup.hintState.text),
              1
              /* TEXT */
            )
          ],
          2
          /* CLASS */
        )) : vue.createCommentVNode("v-if", true)
      ],
      36
      /* STYLE, NEED_HYDRATION */
    );
  }
  const PagesStatsIndex = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$1], ["__scopeId", "data-v-1fa681a1"], ["__file", "D:/heky/SWProject/Twentyfourgame/pages/stats/index.vue"]]);
  const MODE_CHANGE_EVENT = "tf24:mode-changed";
  const _sfc_main$1 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const { safeBottom } = useSafeArea();
      const playMode = vue.ref(getLastMode ? getLastMode() : "basic");
      const rankMode = vue.ref("jqk-11-12-13");
      const deckSource = vue.ref("regular");
      const mixWeight = vue.ref(50);
      const haptics = vue.ref(true);
      const sfx = vue.ref(true);
      const reducedMotion = vue.ref(false);
      const modeOptions = [
        { value: "basic", label: "基础模式（点选）" },
        { value: "pro", label: "专业模式（拖拽）" }
      ];
      const rankOptions = [
        { value: "jqk-1", label: "JQK 记作 1" },
        { value: "jqk-11-12-13", label: "JQK 记作 11/12/13" }
      ];
      const deckOptions = [
        { value: "regular", label: "常规题库" },
        { value: "mistakes", label: "错题本" },
        { value: "mix", label: "混合" }
      ];
      const bodyStyle = vue.computed(() => ({
        paddingBottom: `${Math.max(24, (safeBottom.value || 0) + 24)}px`
      }));
      const toggles = vue.computed(() => [
        {
          key: "haptics",
          title: "振动反馈",
          desc: "答题提示或失败时震动提醒",
          checked: haptics.value
        },
        {
          key: "sfx",
          title: "音效提示",
          desc: "保留关键操作音效",
          checked: sfx.value
        },
        {
          key: "reducedMotion",
          title: "低性能模式",
          desc: "减少动画效果以提升流畅度",
          checked: reducedMotion.value
        }
      ]);
      onBackPress(() => {
        navigateToHome();
        return true;
      });
      function syncFromStorage(showMigration = false) {
        const prefs = getGameplayPrefs();
        playMode.value = getLastMode ? getLastMode() : playMode.value;
        rankMode.value = prefs.rankMode;
        deckSource.value = prefs.deckSource;
        mixWeight.value = prefs.mixWeight;
        haptics.value = !!prefs.haptics;
        sfx.value = !!prefs.sfx;
        reducedMotion.value = !!prefs.reducedMotion;
        if (showMigration && prefs.rankMigrationNotice) {
          try {
            uni.showToast({
              title: "已迁移到新规则：JQK 仅支持 1 或 11/12/13",
              icon: "none",
              duration: 2500
            });
          } catch (_) {
          }
          consumeRankMigrationNotice();
        }
      }
      vue.onMounted(() => {
        syncFromStorage(true);
      });
      onShow(() => {
        syncFromStorage(false);
      });
      function onModeChange(e) {
        var _a, _b;
        const raw = ((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value) ?? ((_b = e == null ? void 0 : e.target) == null ? void 0 : _b.value) ?? "";
        const normalized = raw === "pro" ? "pro" : "basic";
        if (playMode.value !== normalized) {
          playMode.value = normalized;
        }
        try {
          setLastMode(normalized);
        } catch (_) {
        }
        try {
          if (typeof uni.$emit === "function") {
            uni.$emit(MODE_CHANGE_EVENT, normalized);
          }
        } catch (_) {
        }
        try {
          uni.showToast({
            title: normalized === "pro" ? "已切换为专业模式" : "已切换为基础模式",
            icon: "none",
            duration: 1600
          });
        } catch (_) {
        }
      }
      function onRankModeChange(e) {
        var _a;
        const value = ((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value) || "jqk-11-12-13";
        rankMode.value = value;
        setGameplayPrefs({ rankMode: value });
      }
      function onDeckSourceChange(e) {
        var _a;
        const value = ((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value) || "regular";
        deckSource.value = value;
        setGameplayPrefs({ deckSource: value });
      }
      function onMixWeightChange(e) {
        var _a;
        const value = Number((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value);
        if (!Number.isFinite(value))
          return;
        mixWeight.value = Math.min(100, Math.max(0, Math.round(value)));
        setGameplayPrefs({ mixWeight: mixWeight.value });
      }
      function onToggleChange(key, value) {
        if (key === "haptics")
          haptics.value = !!value;
        if (key === "sfx")
          sfx.value = !!value;
        if (key === "reducedMotion")
          reducedMotion.value = !!value;
        setGameplayPrefs({
          haptics: haptics.value,
          sfx: sfx.value,
          reducedMotion: reducedMotion.value
        });
      }
      function clearCache() {
        try {
          uni.showModal({
            title: "清理缓存",
            content: "将清除当前牌局缓存，保留用户与统计数据。",
            confirmText: "立即清理",
            cancelText: "取消",
            success: (res) => {
              if (res.confirm) {
                try {
                  uni.removeStorageSync("tf24_game_session_v1");
                } catch (_) {
                }
                try {
                  uni.removeStorageSync("__tf24_tab_cache__");
                } catch (_) {
                }
                try {
                  uni.showToast({ title: "缓存已清理", icon: "success" });
                } catch (_) {
                }
              }
            }
          });
        } catch (_) {
          try {
            uni.removeStorageSync("tf24_game_session_v1");
          } catch (err) {
          }
          try {
            uni.removeStorageSync("__tf24_tab_cache__");
          } catch (err) {
          }
        }
      }
      const __returned__ = { safeBottom, MODE_CHANGE_EVENT, playMode, rankMode, deckSource, mixWeight, haptics, sfx, reducedMotion, modeOptions, rankOptions, deckOptions, bodyStyle, toggles, syncFromStorage, onModeChange, onRankModeChange, onDeckSourceChange, onMixWeightChange, onToggleChange, clearCache, computed: vue.computed, ref: vue.ref, onMounted: vue.onMounted, get onBackPress() {
        return onBackPress;
      }, get onShow() {
        return onShow;
      }, AppNavBar, get useSafeArea() {
        return useSafeArea;
      }, get getGameplayPrefs() {
        return getGameplayPrefs;
      }, get setGameplayPrefs() {
        return setGameplayPrefs;
      }, get consumeRankMigrationNotice() {
        return consumeRankMigrationNotice;
      }, get getLastMode() {
        return getLastMode;
      }, get setLastMode() {
        return setLastMode;
      }, get navigateToHome() {
        return navigateToHome;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "settings-page" }, [
      vue.createVNode($setup["AppNavBar"], {
        title: "设置",
        "show-back": true,
        "back-to-index": true
      }),
      vue.createElementVNode(
        "view",
        {
          class: "settings-body",
          style: vue.normalizeStyle($setup.bodyStyle)
        },
        [
          vue.createElementVNode("view", { class: "section" }, [
            vue.createElementVNode("view", { class: "section-title" }, "默认模式"),
            vue.createElementVNode("radio-group", {
              class: "radio-group",
              onChange: $setup.onModeChange,
              value: $setup.playMode
            }, [
              (vue.openBlock(), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.modeOptions, (item) => {
                  return vue.createElementVNode("label", {
                    class: "radio-item",
                    key: item.value
                  }, [
                    vue.createElementVNode("radio", {
                      value: item.value,
                      checked: $setup.playMode === item.value
                    }, null, 8, ["value", "checked"]),
                    vue.createElementVNode(
                      "text",
                      { class: "radio-label" },
                      vue.toDisplayString(item.label),
                      1
                      /* TEXT */
                    )
                  ]);
                }),
                64
                /* STABLE_FRAGMENT */
              ))
            ], 40, ["value"]),
            vue.createElementVNode("view", { class: "section-tip" }, "切换后返回题目页时会自动应用")
          ]),
          vue.createElementVNode("view", { class: "section" }, [
            vue.createElementVNode("view", { class: "section-title" }, "JQK 数值"),
            vue.createElementVNode("radio-group", {
              class: "radio-group",
              onChange: $setup.onRankModeChange,
              value: $setup.rankMode
            }, [
              (vue.openBlock(), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.rankOptions, (item) => {
                  return vue.createElementVNode("label", {
                    class: "radio-item",
                    key: item.value
                  }, [
                    vue.createElementVNode("radio", {
                      value: item.value,
                      checked: $setup.rankMode === item.value
                    }, null, 8, ["value", "checked"]),
                    vue.createElementVNode(
                      "text",
                      { class: "radio-label" },
                      vue.toDisplayString(item.label),
                      1
                      /* TEXT */
                    )
                  ]);
                }),
                64
                /* STABLE_FRAGMENT */
              ))
            ], 40, ["value"]),
            vue.createElementVNode("view", { class: "section-tip" }, "仅可选择两套固定规则。")
          ]),
          vue.createElementVNode("view", { class: "section" }, [
            vue.createElementVNode("view", { class: "section-title" }, "题库来源"),
            vue.createElementVNode("radio-group", {
              class: "radio-group",
              onChange: $setup.onDeckSourceChange,
              value: $setup.deckSource
            }, [
              (vue.openBlock(), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.deckOptions, (item) => {
                  return vue.createElementVNode("label", {
                    class: "radio-item",
                    key: item.value
                  }, [
                    vue.createElementVNode("radio", {
                      value: item.value,
                      checked: $setup.deckSource === item.value
                    }, null, 8, ["value", "checked"]),
                    vue.createElementVNode(
                      "text",
                      { class: "radio-label" },
                      vue.toDisplayString(item.label),
                      1
                      /* TEXT */
                    )
                  ]);
                }),
                64
                /* STABLE_FRAGMENT */
              ))
            ], 40, ["value"]),
            $setup.deckSource === "mix" ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "mix-weight"
            }, [
              vue.createElementVNode(
                "view",
                { class: "mix-label" },
                "错题权重 " + vue.toDisplayString($setup.mixWeight) + "%",
                1
                /* TEXT */
              ),
              vue.createElementVNode("slider", {
                value: $setup.mixWeight,
                min: "0",
                max: "100",
                step: "1",
                onChange: $setup.onMixWeightChange,
                "active-color": "#2563eb",
                "background-color": "#e2e8f0"
              }, null, 40, ["value"])
            ])) : vue.createCommentVNode("v-if", true)
          ]),
          vue.createElementVNode("view", { class: "section" }, [
            vue.createElementVNode("view", { class: "section-title" }, "其他偏好"),
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($setup.toggles, (toggle) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  class: "toggle-item",
                  key: toggle.key
                }, [
                  vue.createElementVNode("view", { class: "toggle-texts" }, [
                    vue.createElementVNode(
                      "text",
                      { class: "toggle-title" },
                      vue.toDisplayString(toggle.title),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "toggle-desc" },
                      vue.toDisplayString(toggle.desc),
                      1
                      /* TEXT */
                    )
                  ]),
                  vue.createElementVNode("switch", {
                    checked: toggle.checked,
                    onChange: (e) => $setup.onToggleChange(toggle.key, e.detail.value),
                    color: "#2563eb"
                  }, null, 40, ["checked", "onChange"])
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ]),
          vue.createElementVNode("view", { class: "section" }, [
            vue.createElementVNode("button", {
              class: "clear-cache",
              onClick: $setup.clearCache
            }, "清理缓存")
          ])
        ],
        4
        /* STYLE */
      )
    ]);
  }
  const PagesSettingsIndex = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__scopeId", "data-v-a11b3e9a"], ["__file", "D:/heky/SWProject/Twentyfourgame/pages/settings/index.vue"]]);
  __definePage("pages/login/index", PagesLoginIndex);
  __definePage("pages/index/index", PagesIndexIndex);
  __definePage("pages/user/index", PagesUserIndex);
  __definePage("pages/stats/index", PagesStatsIndex);
  __definePage("pages/settings/index", PagesSettingsIndex);
  const _sfc_main = {
    onLaunch() {
      try {
        ensureUserAvatars && ensureUserAvatars().catch(() => {
        });
      } catch (_) {
      }
      try {
        scheduleTabWarmup({ immediate: true });
      } catch (_) {
      }
      try {
        uni.preloadPage && uni.preloadPage({ url: "/pages/index/index" });
        uni.preloadPage && uni.preloadPage({ url: "/pages/stats/index" });
        uni.preloadPage && uni.preloadPage({ url: "/pages/user/index" });
      } catch (e) {
      }
    },
    onShow() {
    },
    onHide() {
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "D:/heky/SWProject/Twentyfourgame/App.vue"]]);
  function createApp() {
    const app = vue.createVueApp(App);
    return { app };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);

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
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$4 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const users = vue.ref({ list: [], currentId: "" });
      const errMsg = vue.ref("");
      vue.onMounted(() => {
        ensureInit();
        safeLoad();
      });
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
        const tabs = ["/pages/index/index", "/pages/stats/index", "/pages/user/index"];
        if (tabs.includes(url)) {
          try {
            uni.switchTab({ url });
          } catch (_) {
          }
          return;
        }
        try {
          uni.reLaunch({ url });
        } catch (e1) {
          try {
            uni.navigateTo({ url });
          } catch (_) {
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
              finalizeCreate(name, path);
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
      function finalizeCreate(name, avatar) {
        const id = addUser(name, avatar);
        switchUser(id);
        touchLastPlayed(id);
        go("/pages/login/index");
      }
      function guest() {
        go("/pages/index/index");
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
      const __returned__ = { users, errMsg, safeLoad, sortedUsers, refresh, go, choose, createUser, stepChooseAvatar, finalizeCreate, guest, avatarText, lastPlayedText, colorFrom, resetData, ref: vue.ref, computed: vue.computed, onMounted: vue.onMounted, get ensureInit() {
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
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$3(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "login-page" }, [
      vue.createCommentVNode(" 顶部栏 "),
      vue.createElementVNode("view", { class: "login-topbar" }, [
        vue.createCommentVNode(' <button class="icon-btn" @tap="goBack">←</button> '),
        vue.createElementVNode("text", { class: "login-title" }, "无敌24点"),
        vue.createCommentVNode(' <view style="width:40rpx"></view> ')
      ]),
      vue.createCommentVNode(" 主体 "),
      vue.createElementVNode("view", { class: "login-body" }, [
        vue.createElementVNode("view", { class: "login-heading" }, [
          vue.createElementVNode("text", { class: "h1" }, "选择玩家")
        ]),
        vue.createCommentVNode(" 错误状态 "),
        $setup.errMsg ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "error-card"
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
            vue.createElementVNode("view", { class: "empty-card" }, [
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
                    class: "user-item",
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
                        "最近游戏：" + vue.toDisplayString($setup.lastPlayedText(u.lastPlayedAt)),
                        1
                        /* TEXT */
                      ),
                      vue.createCommentVNode(" </text>\r\n            </text> ")
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
      vue.createCommentVNode(" 底部区块 "),
      vue.createElementVNode("view", { class: "login-footer" }, [
        vue.createElementVNode("view", { class: "or-row" }, [
          vue.createElementVNode("view", { class: "line" }),
          vue.createElementVNode("text", { class: "or" }, "也可以"),
          vue.createElementVNode("view", { class: "line" })
        ]),
        vue.createElementVNode("button", {
          class: "guest-btn",
          onClick: $setup.guest
        }, "以游客登录")
      ])
    ]);
  }
  const PagesLoginIndex = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["render", _sfc_render$3], ["__scopeId", "data-v-d08ef7d4"], ["__file", "D:/heky/SWProject/Twentyfourgame/pages/login/index.vue"]]);
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
  const _sfc_main$3 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const cards = vue.ref([{ rank: 1, suit: "S" }, { rank: 5, suit: "H" }, { rank: 5, suit: "D" }, { rank: 5, suit: "C" }]);
      const solution = vue.ref(null);
      const feedback = vue.ref("");
      const usedByCard = vue.ref([0, 0, 0, 0]);
      const tokens = vue.ref([]);
      const faceUseHigh = vue.ref(false);
      const handRecorded = vue.ref(false);
      const exprZoneHeight = vue.ref(200);
      const currentUser = vue.ref(null);
      const deck = vue.ref([]);
      const handsPlayed = vue.ref(0);
      const successCount = vue.ref(0);
      const failCount = vue.ref(0);
      const sessionOver = vue.ref(false);
      const handStartTs = vue.ref(Date.now());
      const hintWasUsed = vue.ref(false);
      const attemptCount = vue.ref(0);
      const lastSuccessMs = vue.ref(null);
      const remainingCards = vue.computed(() => (deck.value || []).length);
      const winRate = vue.computed(() => {
        const t = successCount.value + failCount.value;
        return t ? Math.round(100 * successCount.value / t) : 0;
      });
      const drag = vue.ref({ active: false, token: null, x: 0, y: 0, startX: 0, startY: 0, moved: false });
      const exprBox = vue.ref({ left: 0, top: 0, right: 0, bottom: 0 });
      const tokRects = vue.ref([]);
      const dragInsertIndex = vue.ref(-1);
      const lastInsertedIndex = vue.ref(-1);
      const { proxy } = vue.getCurrentInstance();
      const booted = vue.ref(false);
      const expr = vue.computed(() => tokens.value.map((x) => x.type === "num" ? String(evalRank(x.rank ?? +x.value)) : x.value).join(""));
      const ghostStyle = vue.computed(() => `left:${drag.value.x}px; top:${drag.value.y}px;`);
      const exprScale = vue.ref(1);
      const opsDensity = vue.ref("normal");
      const opsDensityClass = vue.computed(() => opsDensity.value === "tight" ? "ops-tight" : opsDensity.value === "compact" ? "ops-compact" : "");
      const ghostText = vue.computed(() => {
        const t = drag.value.token;
        if (!t)
          return "";
        if (t.type === "num")
          return labelFor(t.rank || +t.value);
        if (t.type === "tok")
          return /^(10|11|12|13|[1-9])$/.test(t.value) ? labelFor(+t.value) : t.value;
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
      const currentText = vue.computed(() => {
        attemptCount.value += 1;
        const s = expr.value;
        if (!s)
          return "";
        const v = evaluateExprToFraction(s);
        return v ? `${v.toString()}` : "";
      });
      function refresh() {
        nextHand();
      }
      function initDeck() {
        const suits = ["S", "H", "D", "C"];
        const arr = [];
        for (const s of suits) {
          for (let r = 1; r <= 13; r++)
            arr.push({ rank: r, suit: s });
        }
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        deck.value = arr;
      }
      function nextHand() {
        if (!deck.value || deck.value.length < 4) {
          sessionOver.value = true;
          feedback.value = "牌库不足，已结束本局";
          onSessionOver();
          return;
        }
        const maxTry = Math.min(200, 1 + deck.value.length * deck.value.length);
        let pickIdx = null;
        for (let t = 0; t < maxTry; t++) {
          const idxs = /* @__PURE__ */ new Set();
          while (idxs.size < 4)
            idxs.add(Math.floor(Math.random() * deck.value.length));
          const ids2 = Array.from(idxs);
          const cs2 = ids2.map((i) => deck.value[i]);
          const mapped = cs2.map((c) => evalRank(c.rank));
          const sol = solve24(mapped);
          if (sol) {
            pickIdx = { ids: ids2, sol };
            break;
          }
        }
        if (!pickIdx) {
          sessionOver.value = true;
          feedback.value = "本副牌无可解手牌，已结束本局";
          onSessionOver();
          return;
        }
        const ids = pickIdx.ids.sort((a, b) => b - a);
        const cs = [];
        for (const i of ids) {
          cs.unshift(deck.value[i]);
          deck.value.splice(i, 1);
        }
        cards.value = cs;
        solution.value = pickIdx.sol;
        tokens.value = [];
        usedByCard.value = [0, 0, 0, 0];
        handRecorded.value = false;
        handStartTs.value = Date.now();
        hintWasUsed.value = false;
        attemptCount.value = 0;
        feedback.value = "拖入 + - × ÷ ( ) 组成 24";
        vue.nextTick(() => recomputeExprHeight());
      }
      vue.onMounted(() => {
        ensureInit();
        currentUser.value = getCurrentUser() || null;
        initDeck();
        nextHand();
        setTimeout(() => {
          booted.value = true;
        }, 0);
        vue.nextTick(() => {
          updateVHVar();
          recomputeExprHeight();
          updateExprScale();
        });
        if (uni.onWindowResize)
          uni.onWindowResize(() => {
            updateVHVar();
            updateExprScale();
            recomputeExprHeight();
          });
        updateLastSuccess();
      });
      function clearAll() {
        tokens.value = [];
        usedByCard.value = [0, 0, 0, 0];
      }
      function computeExprStats() {
        const arr = tokens.value || [];
        const ops = [];
        let depth = 0, maxDepth = 0;
        for (const t of arr) {
          if (t.type === "op") {
            if (t.value === "(") {
              depth++;
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
      function updateLastSuccess() {
        try {
          const cu = getCurrentUser && getCurrentUser();
          if (!cu || !cu.id) {
            lastSuccessMs.value = null;
            return;
          }
          const ext = readStatsExtended && readStatsExtended(cu.id);
          const r = (ext && Array.isArray(ext.rounds) ? ext.rounds.slice().reverse() : []).find((x) => x && x.success && Number.isFinite(x.timeMs));
          lastSuccessMs.value = r ? r.timeMs : null;
        } catch (_) {
          lastSuccessMs.value = null;
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
      function check() {
        const usedCount = usedByCard.value.reduce((a, b) => a + (b ? 1 : 0), 0);
        if (usedCount !== 4) {
          feedback.value = "请先使用四张牌再提交";
          return;
        }
        const s = expr.value;
        const v = evaluateExprToFraction(s);
        const ok = v && v.equalsInt && v.equalsInt(24);
        feedback.value = ok ? "恭喜，得到 24！" : "未得到 24，再试试";
        if (ok && !handRecorded.value) {
          handRecorded.value = true;
          handsPlayed.value += 1;
          successCount.value += 1;
          try {
            const stats = computeExprStats();
            pushRound({
              success: true,
              timeMs: Date.now() - (handStartTs.value || Date.now()),
              hintUsed: !!hintWasUsed.value,
              retries: Math.max(0, (attemptCount.value || 1) - 1),
              ops: stats.ops,
              exprLen: stats.exprLen,
              maxDepth: stats.maxDepth,
              faceUseHigh: !!faceUseHigh.value,
              hand: { cards: (cards.value || []).map((c) => ({ rank: c.rank, suit: c.suit })) },
              expr: s
            });
            updateLastSuccess();
          } catch (_) {
          }
        }
      }
      function showSolution() {
        hintWasUsed.value = true;
        if (!handRecorded.value) {
          handRecorded.value = true;
          handsPlayed.value += 1;
          failCount.value += 1;
          try {
            const stats = computeExprStats();
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
        }
        feedback.value = solution.value ? "答案：" + solution.value : "暂无提示";
      }
      function toggleFaceMode() {
        faceUseHigh.value = !faceUseHigh.value;
      }
      function skipHand() {
        if (!handRecorded.value) {
          handRecorded.value = true;
          handsPlayed.value += 1;
          failCount.value += 1;
          try {
            const stats = computeExprStats();
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
        }
        nextHand();
      }
      function goLogin() {
        try {
          uni.reLaunch({ url: "/pages/login/index" });
        } catch (e1) {
          try {
            uni.navigateTo({ url: "/pages/login/index" });
          } catch (_) {
          }
        }
      }
      function goStats() {
        try {
          uni.switchTab({ url: "/pages/stats/index" });
        } catch (_) {
        }
      }
      function goGame() {
        try {
          uni.switchTab({ url: "/pages/index/index" });
        } catch (_) {
        }
      }
      function goUser() {
        try {
          uni.switchTab({ url: "/pages/user/index" });
        } catch (_) {
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
      const lastTap = vue.ref({ time: 0, key: "" });
      function tapKeyFor(token) {
        if (!token)
          return "";
        if (token.type === "num" && token.cardIndex != null)
          return `num-${token.cardIndex}`;
        if (token.type === "op")
          return `op-${token.value}`;
        if (token.type === "tok")
          return `tok-${token.index}`;
        return `${token.type}-${token.value || ""}`;
      }
      function endDrag() {
        if (!drag.value.active)
          return;
        const x = drag.value.x, y = drag.value.y;
        const token = drag.value.token;
        const inExpr = inside(exprBox.value, x, y);
        if (token && !drag.value.moved) {
          const now = Date.now();
          const key = tapKeyFor(token);
          if (now - (lastTap.value.time || 0) < 300 && lastTap.value.key === key) {
            if (token.type === "tok") {
              removeTokenAt(token.index);
            } else if (token.type === "num" || token.type === "op") {
              tryAppendToken(token);
              lastInsertedIndex.value = Math.max(0, tokens.value.length - 1);
              setTimeout(() => {
                lastInsertedIndex.value = -1;
              }, 220);
            }
            lastTap.value = { time: 0, key: "" };
            drag.value.active = false;
            drag.value.token = null;
            dragInsertIndex.value = -1;
            return;
          } else {
            lastTap.value = { time: now, key };
            drag.value.active = false;
            drag.value.token = null;
            dragInsertIndex.value = -1;
            return;
          }
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
        const clamped = Math.max(0, Math.min(to, tokens.value.length));
        if (token.type === "num") {
          const ci = token.cardIndex;
          if (ci == null) {
            feedback.value = "请选择一张牌";
            return;
          }
          if ((usedByCard.value[ci] || 0) >= 1) {
            feedback.value = "该牌已使用";
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
          if (h)
            document.documentElement && document.documentElement.style.setProperty("--vh", h * 0.01 + "px");
        } catch (e) {
        }
      }
      function recomputeExprHeight() {
        const sys = uni.getSystemInfoSync && uni.getSystemInfoSync() || {};
        const winH = sys.windowHeight || sys.screenHeight || 0;
        if (winH && winH < 640)
          opsDensity.value = "tight";
        else if (winH && winH < 740)
          opsDensity.value = "compact";
        else
          opsDensity.value = "normal";
        vue.nextTick(() => {
          const q = uni.createSelectorQuery().in(proxy);
          q.select("#exprZone").boundingClientRect().select("#hintText").boundingClientRect().select("#opsRow1").boundingClientRect().select("#opsRow2").boundingClientRect().select("#submitRow").boundingClientRect().select("#failRow").boundingClientRect().exec((res) => {
            const [exprRect, hintRect, ops1Rect, ops2Rect, submitRect, failRect] = res || [];
            if (!exprRect)
              return;
            const hHint = hintRect && hintRect.height || 0;
            const hOps1 = ops1Rect && ops1Rect.height || 0;
            const hOps2 = ops2Rect && ops2Rect.height || 0;
            const hSubmit = submitRect && submitRect.height || 0;
            const hFail = failRect && failRect.height || 0;
            winH - (exprRect.top || 0) - (hHint + hOps1 + hOps2 + hSubmit + hFail) - 12;
            exprZoneHeight.value = 70;
          });
        });
      }
      function evalRank(rank) {
        if (rank === 1)
          return 1;
        if (rank === 11 || rank === 12 || rank === 13)
          return faceUseHigh.value ? rank : 1;
        return rank;
      }
      function labelFor(n) {
        if (n === 1)
          return "A";
        if (n === 11)
          return "J";
        if (n === 12)
          return "Q";
        if (n === 13)
          return "K";
        return String(n);
      }
      function cardImage(card) {
        const suitMap = { "S": "Spade", "H": "Heart", "D": "Diamond", "C": "Club" };
        const faceMap = { 1: "A", 11: "J", 12: "Q", 13: "K" };
        const suitName = suitMap[card.suit] || "Spade";
        const rankName = faceMap[card.rank] || String(card.rank);
        return `/static/cards/${suitName}${rankName}.png`;
      }
      function randomSuit() {
        return ["S", "H", "D", "C"][Math.floor(Math.random() * 4)];
      }
      function onSessionOver() {
        try {
          uni.showModal({
            title: "本局结束",
            content: `局：${handsPlayed.value}
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
                  uni.navigateTo({ url: "/pages/stats/index" });
                } catch (_) {
                }
              }
            }
          });
        } catch (_) {
        }
      }
      const __returned__ = { cards, solution, feedback, usedByCard, tokens, faceUseHigh, handRecorded, exprZoneHeight, currentUser, deck, handsPlayed, successCount, failCount, sessionOver, handStartTs, hintWasUsed, attemptCount, lastSuccessMs, remainingCards, winRate, drag, exprBox, tokRects, dragInsertIndex, lastInsertedIndex, proxy, booted, expr, ghostStyle, exprScale, opsDensity, opsDensityClass, ghostText, placeholderSizeClass, currentText, refresh, initDeck, nextHand, clearAll, computeExprStats, updateLastSuccess, fmtMs, check, showSolution, toggleFaceMode, skipHand, goLogin, goStats, goGame, goUser, startDrag, onDrag, lastTap, tapKeyFor, endDrag, tryAppendToken, tryInsertTokenAt, removeTokenAt, measureDropZones, inside, pointFromEvent, updateExprScale, calcInsertIndex, moveToken, updateVHVar, recomputeExprHeight, evalRank, labelFor, cardImage, randomSuit, onSessionOver, ref: vue.ref, onMounted: vue.onMounted, getCurrentInstance: vue.getCurrentInstance, computed: vue.computed, watch: vue.watch, nextTick: vue.nextTick, get evaluateExprToFraction() {
        return evaluateExprToFraction;
      }, get solve24() {
        return solve24;
      }, get ensureInit() {
        return ensureInit;
      }, get getCurrentUser() {
        return getCurrentUser;
      }, get pushRound() {
        return pushRound;
      }, get readStatsExtended() {
        return readStatsExtended;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: vue.normalizeClass(["page col", { booted: $setup.booted }]),
        style: { "padding": "20rpx", "gap": "16rpx", "position": "relative" }
      },
      [
        vue.createCommentVNode(" 顶部：当前用户与切换 "),
        vue.createElementVNode("view", {
          class: "topbar",
          style: { "display": "flex", "align-items": "center", "justify-content": "space-between", "gap": "12rpx", "background": "transparent", "border": "none" }
        }, [
          vue.createElementVNode(
            "text",
            {
              class: "topbar-title",
              style: { "text-align": "left", "flex": "1" }
            },
            "当前用户：" + vue.toDisplayString($setup.currentUser && $setup.currentUser.name ? $setup.currentUser.name : "未选择"),
            1
            /* TEXT */
          ),
          vue.createElementVNode("button", {
            class: "btn btn-secondary",
            style: { "padding": "16rpx 20rpx", "width": "auto" },
            onClick: $setup.goLogin
          }, "切换用户")
        ]),
        vue.createCommentVNode(" 本局统计：紧凑表格（1行表头 + 1行数据） "),
        vue.createElementVNode("view", {
          id: "statsRow",
          class: "stats-card stats-compact-table"
        }, [
          vue.createElementVNode("view", { class: "thead" }, [
            vue.createElementVNode("text", { class: "th" }, "剩余"),
            vue.createElementVNode("text", { class: "th" }, "局数"),
            vue.createElementVNode("text", { class: "th ok" }, "成功"),
            vue.createElementVNode("text", { class: "th fail" }, "失败"),
            vue.createElementVNode("text", { class: "th" }, "胜率"),
            vue.createElementVNode("text", { class: "th" }, "上一局")
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
            )
          ])
        ]),
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
                class: vue.normalizeClass(["card", { used: ($setup.usedByCard[idx] || 0) > 0 }]),
                onTouchstart: vue.withModifiers(($event) => $setup.startDrag({ type: "num", value: String(card.rank), rank: card.rank, suit: card.suit, cardIndex: idx }, $event), ["stop", "prevent"]),
                onTouchmove: _cache[0] || (_cache[0] = vue.withModifiers(($event) => $setup.onDrag($event), ["stop", "prevent"])),
                onTouchend: _cache[1] || (_cache[1] = vue.withModifiers(($event) => $setup.endDrag(), ["stop", "prevent"]))
              }, [
                vue.createElementVNode("image", {
                  class: "card-img",
                  src: $setup.cardImage(card),
                  mode: "widthFix"
                }, null, 8, ["src"])
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
        vue.createElementVNode(
          "view",
          {
            id: "opsRow2",
            class: vue.normalizeClass(["ops-row-2", $setup.opsDensityClass])
          },
          [
            vue.createElementVNode("view", { class: "ops-left" }, [
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
              ))
            ]),
            vue.createElementVNode(
              "button",
              {
                class: "btn btn-secondary mode-btn",
                onClick: $setup.toggleFaceMode
              },
              vue.toDisplayString($setup.faceUseHigh ? "J/Q/K=11/12/13" : "J/Q/K=1"),
              1
              /* TEXT */
            )
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
        vue.createElementVNode("view", { class: "expr-card" }, [
          vue.createCommentVNode(` <view class="expr-title">当前表达式：<text class="status-text">{{ currentText ? currentText : '未完成' }}</text></view> `),
          vue.createElementVNode(
            "view",
            {
              id: "exprZone",
              class: vue.normalizeClass(["expr-zone", { "expr-zone-active": $setup.drag.active }]),
              style: vue.normalizeStyle({ height: $setup.exprZoneHeight + "px" })
            },
            [
              vue.createCommentVNode(' <view v-if="tokens.length === 0" class="expr-placeholder">将卡牌和运算符拖到这里</view> '),
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
                            t.type === "num" ? (vue.openBlock(), vue.createElementBlock("image", {
                              key: 0,
                              class: "tok-card-img",
                              src: $setup.cardImage({ rank: t.rank || +t.value, suit: t.suit || "S" }),
                              mode: "heightFix"
                            }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock(
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
        ]),
        vue.createCommentVNode(" 轻提示文案 "),
        vue.createElementVNode(
          "text",
          {
            id: "hintText",
            class: "hint-text"
          },
          vue.toDisplayString($setup.feedback || "请用四张牌和运算符算出24"),
          1
          /* TEXT */
        ),
        vue.createCommentVNode(" 提交 / 清空：各占一半宽度 "),
        vue.createElementVNode("view", {
          id: "submitRow",
          class: "pair-grid"
        }, [
          vue.createElementVNode("button", {
            class: "btn btn-primary",
            onClick: $setup.check
          }, "提交答案"),
          vue.createElementVNode("button", {
            class: "btn btn-primary",
            onClick: $setup.clearAll
          }, "清空表达式")
        ]),
        vue.createCommentVNode(" 答案 / 换题：位于提交区下方 "),
        vue.createElementVNode("view", {
          id: "failRow",
          class: "pair-grid"
        }, [
          vue.createElementVNode("button", {
            class: "btn btn-secondary",
            onClick: $setup.showSolution
          }, "答案"),
          vue.createElementVNode("button", {
            class: "btn btn-secondary",
            onClick: $setup.skipHand
          }, "换题")
        ]),
        vue.createCommentVNode(" 底部导航由全局 tabBar 提供（见 pages.json） ")
      ],
      2
      /* CLASS */
    );
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$2], ["__scopeId", "data-v-1cf27b2a"], ["__file", "D:/heky/SWProject/Twentyfourgame/pages/index/index.vue"]]);
  const _sfc_main$2 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const users = vue.ref({ list: [], currentId: "" });
      const newName = vue.ref("");
      const visibleUsers = vue.computed(() => (users.value.list || []).filter((u) => String(u.name || "") !== "Guest"));
      vue.onMounted(() => {
        ensureInit();
        users.value = getUsers();
      });
      function refresh() {
        users.value = getUsers();
      }
      function create() {
        addUser(newName.value.trim() || void 0);
        newName.value = "";
        refresh();
      }
      function choose(id) {
        switchUser(id);
        refresh();
        uni.showToast({ title: "已切换", icon: "success" });
      }
      function rename(u) {
        uni.showModal({ title: "改名", editable: true, placeholderText: u.name, success(res) {
          if (res.confirm) {
            renameUser(u.id, res.content || u.name);
            refresh();
          }
        } });
      }
      function remove(id) {
        uni.showModal({ title: "删除用户", content: "确定删除该用户？", success(res) {
          if (res.confirm) {
            removeUser(id);
            refresh();
          }
        } });
      }
      const __returned__ = { users, newName, visibleUsers, refresh, create, choose, rename, remove, ref: vue.ref, onMounted: vue.onMounted, computed: vue.computed, get ensureInit() {
        return ensureInit;
      }, get getUsers() {
        return getUsers;
      }, get setUsers() {
        return setUsers;
      }, get addUser() {
        return addUser;
      }, get renameUser() {
        return renameUser;
      }, get rmUser() {
        return removeUser;
      }, get switchUser() {
        return switchUser;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", {
      class: "page",
      style: { "padding": "24rpx", "display": "flex", "flex-direction": "column", "gap": "16rpx" }
    }, [
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
                class: vue.normalizeClass(["item", { active: u.id === $setup.users.currentId }])
              },
              [
                vue.createElementVNode("view", {
                  class: "name",
                  onClick: ($event) => $setup.choose(u.id)
                }, vue.toDisplayString(u.name), 9, ["onClick"]),
                vue.createElementVNode("view", { class: "ops" }, [
                  vue.createElementVNode("button", {
                    class: "mini",
                    onClick: ($event) => $setup.rename(u)
                  }, "改名", 8, ["onClick"]),
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
      ])
    ]);
  }
  const PagesUserIndex = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$1], ["__scopeId", "data-v-79e6a490"], ["__file", "D:/heky/SWProject/Twentyfourgame/pages/user/index.vue"]]);
  const _sfc_main$1 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const rows = vue.ref([]);
      const overviewRange = vue.ref(7);
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
      const ext = vue.ref({ totals: { total: 0, success: 0, fail: 0 }, days: {}, rounds: [], agg: {} });
      vue.onMounted(() => {
        ensureInit();
        load2();
        loadExt();
      });
      function load2() {
        const list = allUsersWithStats();
        list.sort((a, b) => b.winRate - a.winRate || b.totals.total - a.totals.total);
        rows.value = list;
      }
      function loadExt() {
        const map = {};
        for (const u of rows.value) {
          map[u.id] = readStatsExtended(u.id);
        }
        userExtMap.value = map;
        const uid = selectedUserId.value;
        ext.value = map[uid] || { totals: { total: 0, success: 0, fail: 0 }, days: {}, rounds: [], agg: {} };
      }
      function selectUser(uid) {
        selectedUserId.value = uid || "";
        loadExt();
        try {
          uni.pageScrollTo && uni.pageScrollTo({ selector: ".trend", duration: 200 });
        } catch (_) {
        }
      }
      function onUserChange(e) {
        var _a;
        try {
          const idx = ((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value) | 0;
          const opt = userOptions.value[idx];
          if (opt) {
            selectedUserId.value = opt.id;
            loadExt();
          }
        } catch (_) {
        }
      }
      function setOverviewRange(d) {
        overviewRange.value = d;
      }
      function goUser() {
        try {
          uni.switchTab({ url: "/pages/user/index" });
        } catch (_) {
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
        const cutoff = overviewRange.value && overviewRange.value > 0 ? Date.now() - overviewRange.value * 864e5 : 0;
        return list.filter((r) => !cutoff || (r.ts || 0) >= cutoff);
      });
      const recentRounds = vue.computed(() => filteredRounds.value.slice(0, 12).map((r) => ({ ...r, user: userMap.value[r.uid] })));
      const trendBars = vue.computed(() => {
        const rounds = filteredRounds.value;
        const byDay = /* @__PURE__ */ new Map();
        for (const r of rounds) {
          const key = new Date(r.ts || 0).toISOString().slice(0, 10);
          const cur = byDay.get(key) || { total: 0, success: 0 };
          cur.total += 1;
          if (r.success)
            cur.success += 1;
          byDay.set(key, cur);
        }
        let days = Array.from(byDay.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1);
        if (overviewRange.value > 0) {
          const cutoff = Date.now() - overviewRange.value * 864e5;
          days = days.filter(([k]) => (/* @__PURE__ */ new Date(k + "T00:00:00Z")).getTime() >= cutoff);
        }
        days = days.slice(-30);
        const maxTotal = Math.max(1, ...days.map(([, v]) => v.total));
        return days.map(([k, v]) => {
          const h = Math.max(4, Math.round(120 * (v.total / maxTotal)));
          const rate = v.total ? v.success / v.total : 0;
          const color = v.total ? "#16a34a" : "#e5e7eb";
          return { label: k, height: Math.max(6, Math.round(h * rate)), color };
        });
      });
      const overviewRows = vue.computed(() => {
        const cutoff = overviewRange.value && overviewRange.value > 0 ? Date.now() - overviewRange.value * 864e5 : 0;
        const items = rows.value.map((u) => {
          const rec = userExtMap.value[u.id] || { rounds: [], agg: {} };
          const rounds = (rec.rounds || []).filter((r) => !cutoff || (r.ts || 0) >= cutoff);
          const total = rounds.length;
          const success = rounds.filter((r) => r.success).length;
          const winRate = total ? Math.round(100 * success / total) : 0;
          const times = rounds.filter((r) => r.success && Number.isFinite(r.timeMs)).map((r) => r.timeMs);
          const bestTimeMs = times.length ? Math.min(...times) : null;
          const avgTimeMs = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
          return { id: u.id, name: u.name, total, success, times: total, winRate, bestTimeMs, avgTimeMs };
        });
        items.sort((a, b) => b.winRate - a.winRate || b.times - a.times);
        return items;
      });
      const __returned__ = { rows, overviewRange, hintFilter, selectedUserId, userOptions, selectedUserLabel, userExtMap, userMap, ext, load: load2, loadExt, selectUser, onUserChange, setOverviewRange, goUser, fmtTs, fmtMs, activeRounds, filteredRounds, recentRounds, trendBars, overviewRows, ref: vue.ref, onMounted: vue.onMounted, computed: vue.computed, get ensureInit() {
        return ensureInit;
      }, get allUsersWithStats() {
        return allUsersWithStats;
      }, get readStatsExtended() {
        return readStatsExtended;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", {
      class: "page",
      style: { "padding": "24rpx", "display": "flex", "flex-direction": "column", "gap": "18rpx" }
    }, [
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
                  class: vue.normalizeClass(["seg-btn", { active: $setup.overviewRange === 7 }]),
                  onClick: _cache[0] || (_cache[0] = ($event) => $setup.setOverviewRange(7))
                },
                "近7天",
                2
                /* CLASS */
              ),
              vue.createElementVNode(
                "button",
                {
                  class: vue.normalizeClass(["seg-btn", { active: $setup.overviewRange === 30 }]),
                  onClick: _cache[1] || (_cache[1] = ($event) => $setup.setOverviewRange(30))
                },
                "近30天",
                2
                /* CLASS */
              ),
              vue.createElementVNode(
                "button",
                {
                  class: vue.normalizeClass(["seg-btn", { active: $setup.overviewRange === 0 }]),
                  onClick: _cache[2] || (_cache[2] = ($event) => $setup.setOverviewRange(0))
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
            vue.createElementVNode("text", { class: "th rank" }, "排名"),
            vue.createElementVNode("text", { class: "th user" }, "用户"),
            vue.createElementVNode("text", { class: "th" }, "总局数"),
            vue.createElementVNode("text", { class: "th ok" }, "成功"),
            vue.createElementVNode("text", { class: "th" }, "🎯胜率"),
            vue.createElementVNode("text", { class: "th" }, "平均"),
            vue.createElementVNode("text", { class: "th" }, "🏆最佳")
          ]),
          vue.createElementVNode("view", { class: "tbody" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($setup.overviewRows, (row, i) => {
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
                  vue.createElementVNode(
                    "text",
                    { class: "td ok" },
                    vue.toDisplayString(row.success),
                    1
                    /* TEXT */
                  ),
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
        class: "section"
      }, [
        vue.createElementVNode("view", {
          class: "row",
          style: { "justify-content": "space-between", "align-items": "center", "gap": "12rpx", "flex-wrap": "wrap" }
        }, [
          vue.createElementVNode("text", { class: "title" }, "📈个人趋势"),
          vue.createElementVNode("view", {
            class: "user-picker",
            style: { "display": "flex", "align-items": "center", "gap": "8rpx" }
          }, [
            vue.createElementVNode("text", { style: { "color": "#6b7280", "font-size": "26rpx" } }, "查看"),
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
        ]),
        vue.createElementVNode("view", {
          class: "trend",
          style: { "margin-top": "12rpx", "height": "160rpx", "display": "flex", "align-items": "flex-end", "gap": "6rpx" }
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($setup.trendBars, (d, i) => {
              return vue.openBlock(), vue.createElementBlock(
                "view",
                {
                  key: i,
                  class: "bar",
                  style: vue.normalizeStyle({ height: (d.height || 4) + "rpx", background: d.color })
                },
                null,
                4
                /* STYLE */
              );
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]),
        vue.createElementVNode("view", {
          class: "trend-legend",
          style: { "margin-top": "8rpx", "color": "#6b7280", "font-size": "24rpx" }
        }, "绿色=成功占比，灰色=无数据")
      ])) : vue.createCommentVNode("v-if", true),
      $setup.selectedUserId ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "section"
      }, [
        vue.createElementVNode("view", {
          class: "row",
          style: { "justify-content": "space-between", "align-items": "center" }
        }, [
          vue.createElementVNode("text", { class: "title" }, "最近战绩")
        ]),
        vue.createElementVNode("view", { class: "rounds" }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($setup.recentRounds, (r) => {
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
                  vue.toDisplayString(r.timeMs != null ? r.timeMs + "ms" : "-"),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "r-meta" },
                  vue.toDisplayString((r.faceUseHigh ? "JQK高位" : "JQK低位") + " · " + (r.hintUsed ? "用提示" : "无提示")),
                  1
                  /* TEXT */
                )
              ]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesStatsIndex = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__scopeId", "data-v-1fa681a1"], ["__file", "D:/heky/SWProject/Twentyfourgame/pages/stats/index.vue"]]);
  __definePage("pages/login/index", PagesLoginIndex);
  __definePage("pages/index/index", PagesIndexIndex);
  __definePage("pages/user/index", PagesUserIndex);
  __definePage("pages/stats/index", PagesStatsIndex);
  const _sfc_main = {
    onLaunch() {
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

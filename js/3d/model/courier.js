/* model/courier.js — Courier orders, police heat (chase) and city rebuilding (landmarks, permanent coin bonus). */
"use strict";
/* ---------- city rebuilding (permanent) ---------- */
const CITY = [
  { cost: 400, n: { uz: "Teleminora", en: "TV Tower", ja: "テレビ塔" } },
  { cost: 700, n: { uz: "Registon", en: "Registan", ja: "レギスタン" } },
  { cost: 900, n: { uz: "Minorai Kalon", en: "Kalon Minaret", ja: "カロン・ミナレット" } },
  { cost: 1100, n: { uz: "Kalta Minor", en: "Kalta Minor", ja: "カルタ・ミノル" } },
  { cost: 1300, n: { uz: "Ipak saroyi", en: "Silk Palace", ja: "シルク宮殿" } },
  { cost: 1500, n: { uz: "Neon minora", en: "Neon Tower", ja: "ネオンタワー" } },
];
let cityBuilt = store.get("zr3d_city", []);
if (!Array.isArray(cityBuilt) || cityBuilt.length !== CITY.length) cityBuilt = CITY.map(() => 0);
const cityCount = () => cityBuilt.reduce((a, b) => a + (b ? 1 : 0), 0),
  cityMul = () => 1 + 0.05 * cityCount();
function cityBuy(i) {
  if (cityBuilt[i] || wallet < CITY[i].cost) return false;
  wallet -= CITY[i].cost;
  cityBuilt[i] = 1;
  store.set("zr_wallet", wallet);
  store.set("zr3d_city", cityBuilt);
  return true;
}
/* the chunk (60 m) that holds theme-local z = 640 becomes a plaza with the landmark once it is built */
function plazaOf(ci) {
  const zc = ci * CH + CH / 2,
    k = Math.floor(zc / THEME_LEN);
  if (ci !== Math.floor((k * THEME_LEN + 650) / CH)) return -1;
  const th = themeAt(zc);
  return cityBuilt[th] ? th : -1;
}
/* ---------- courier ---------- */
let CR = { st: "find", at: 120, hits: 0, n: 0, streak: 0, tLeft: 0, tMax: 1, earned: 0, drop: null, pkg: null },
  heat = 0,
  coinFrac = 0;
function courReset() {
  ST = { k: -1, state: "none" };
  CR = { st: "find", at: startZ + 120, hits: 0, n: 0, streak: 0, tLeft: 0, tMax: 1, earned: 0, drop: null, pkg: null };
  heat = 0;
  coinFrac = 0;
}
const NOBLOCK = { coin: 1, pow: 1, let: 1, pkg: 1, drop: 1, pad: 1, ramp: 1 };
/* keep the pickup / drop-off lane free of obstacles */
function courClear() {
  for (const t of [CR.pkg, CR.drop])
    if (t && !t.got)
      for (const o of objs)
        if (!o.dead && !NOBLOCK[o.k] && Math.abs(o.x - t.x) < 1.3 && o.z - 1 < t.z + 5 && o.z + (o.len || 0) > t.z - 6) o.dead = true;
}
/* ---------- story journey: one quest per city block ---------- */
const QUEST = [
  { uz: "Bolaga sovg'a yetkaz", en: "Deliver a gift to a child", ja: "子どもへプレゼントを届ける", who: { uz: "Toshkent", en: "Tashkent", ja: "タシケント" } },
  { uz: "Registonga sopol vaza yetkaz", en: "Bring a ceramic vase to Registan", ja: "レギスタンへ陶器の花瓶を届ける", who: { uz: "Samarqand", en: "Samarkand", ja: "サマルカンド" } },
  { uz: "Toqiga ipak mato yetkaz", en: "Bring silk cloth to the bazaar dome", ja: "バザールへ絹の布を届ける", who: { uz: "Buxoro", en: "Bukhara", ja: "ブハラ" } },
  { uz: "Qal'a darvozasiga eski kalit yetkaz", en: "Bring the old key to the fortress gate", ja: "城門へ古い鍵を届ける", who: { uz: "Xiva", en: "Khiva", ja: "ヒヴァ" } },
  { uz: "Ipak fabrikasiga namuna yetkaz", en: "Bring a sample to the silk mill", ja: "絹工場へサンプルを届ける", who: { uz: "Farg'ona", en: "Fergana", ja: "フェルガナ" } },
  { uz: "Tungi kafega shirinlik yetkaz", en: "Bring sweets to the night cafe", ja: "夜のカフェへお菓子を届ける", who: { uz: "Neon Toshkent", en: "Neon Tashkent", ja: "ネオン・タシケント" } },
];
const questName = (i) => QUEST[i][LG] || QUEST[i].en,
  cityName = (i) => QUEST[i].who[LG] || QUEST[i].who.en;
let jr = store.get("zr3d_jr", null);
if (!jr || !Array.isArray(jr.best) || jr.best.length !== QUEST.length) jr = { best: QUEST.map(() => 0), done: 0 };
const jrUnlocked = (i) => i === 0 || jr.best[i - 1] > 0,
  jrCount = () => jr.best.filter((x) => x > 0).length;
/* ---------- recurring customers: trust grows with good ratings, each unlocks a 3-chapter mini story ---------- */
const CU = [
  { e: "👵", n: { uz: "Zulfiya xola", en: "Granny Zulfiya", ja: "ズルフィヤおばあさん" }, ch: [
    { uz: "Rahmat, bolam. Qo'llarim qaltirab, eshikkacha bora olmayman.", en: "Thank you, dear. My hands shake too much to walk to the door.", ja: "ありがとう。手が震えて玄関まで行けないのよ。" },
    { uz: "Senga o'zim pishirgan non qoldirdim. Doim shoshasan, bir o'tir.", en: "I saved you some bread I baked. You're always rushing, sit a while.", ja: "焼いたパンを取っておいたよ。いつも急いでるね、少し座りなさい。" },
    { uz: "Sen nevaramdek bo'lib qolding. Mana eski ro'molim, omad keltiradi.", en: "You've become like a grandchild to me. Take my old scarf, it brings luck.", ja: "あなたは孫のようだよ。この古いスカーフは幸運を呼ぶよ。" } ] },
  { e: "🧒", n: { uz: "Aziz", en: "Aziz", ja: "アジズ" }, ch: [
    { uz: "Aka, sen haqiqiy kuryermisan? Men ham katta bo'lib kuryer bo'laman!", en: "Are you a real courier? I'll be one when I grow up!", ja: "本物の配達員？僕も大きくなったらなる！" },
    { uz: "Rasm chizdim: sen tez yugurayapsan. Devorimga osib qo'ydim.", en: "I drew you running fast. I hung it on my wall.", ja: "速く走る君を描いたよ。壁に貼ったんだ。" },
    { uz: "Bugun maktabda hammaga seni aytdim. Sen mening qahramonimsan!", en: "I told everyone at school about you. You're my hero!", ja: "今日学校でみんなに君のことを話した。君はヒーローだ！" } ] },
  { e: "🧔", n: { uz: "Karim aka", en: "Mr. Karim", ja: "カリムさん" }, ch: [
    { uz: "Yana vaqtida keldingmi? Mijoz ishonchi — eng katta boylik.", en: "On time again? A customer's trust is the biggest wealth.", ja: "また時間通りだね。客の信頼が一番の財産だ。" },
    { uz: "Do'konimga yana bir kuryer kerak, lekin faqat ishonchli odam. Sen ishonchlisan.", en: "I need another courier, but only a reliable one. You are.", ja: "もう一人配達員が欲しいが、信頼できる人だけ。君ならいい。" },
    { uz: "Do'konimning yarmini senga ishonib topshiraman. Endi sherikmiz!", en: "I'd trust you with half my shop. We're partners now!", ja: "店の半分を任せよう。今日から相棒だ！" } ] },
  { e: "👩‍🏫", n: { uz: "Malika opa", en: "Teacher Malika", ja: "マリカ先生" }, ch: [
    { uz: "Kitoblarim og'ir, rahmat. Bolalar seni kutib turishdi.", en: "My books are heavy, thank you. The kids were waiting for you.", ja: "本が重くてね、ありがとう。子どもたちが待ってたわ。" },
    { uz: "Sinfga kirib salom ber. Bolalar kuryer qanday ishlashini bilishni xohlaydi.", en: "Come say hi to the class. They want to know how couriers work.", ja: "教室に来て挨拶して。みんな配達員の仕事を知りたいの。" },
    { uz: "Maktab devoriga ismingni yozaman: 'Shaharning eng ishonchli kuryeri'.", en: "I'll write your name on the school wall: 'The city's most trusted courier'.", ja: "学校の壁に君の名前を書くわ。「街で一番信頼できる配達員」と。" } ] },
];
const CU_AT = [3, 8, 15],
  STORY_CU = [1, 3, 2, 0, 3, 2];
let cu = store.get("zr3d_cu", null);
if (!cu || !Array.isArray(cu.t) || cu.t.length !== CU.length) cu = { t: CU.map(() => 0), c: CU.map(() => 0) };
/* per-customer collection stats: deliveries made and the sum of the ratings given (older saves start from zero) */
if (!Array.isArray(cu.d) || cu.d.length !== CU.length) cu.d = CU.map(() => 0);
if (!Array.isArray(cu.r) || cu.r.length !== CU.length) cu.r = CU.map(() => 0);
const cuName = (i) => CU[i].n[LG] || CU[i].n.en,
  cuText = (i, j) => CU[i].ch[j][LG] || CU[i].ch[j].en;
let lastCu = -1;
const ITEM_CU = [6, 0, 8, 7],
  ITEM_EMO = ["🧸", "🏺", "🧵", "🗝️", "🧶", "🍬", "🫓", "📚", "🧺"];
function pickCust(story) {
  if (story) return STORY_CU[ST.th] ?? 0;
  let c;
  do c = (RNG() * CU.length) | 0;
  while (c === lastCu);
  return c;
}
/* collection card text: who they are, and the name of what they like to order */
const CU_BIO = [
  { uz: "Mahalladagi mehribon xola. Non pishirishni yaxshi ko'radi.", en: "The kind granny of the neighbourhood. Loves baking bread.", ja: "町の優しいおばあさん。パンを焼くのが好き。" },
  { uz: "Kuryer bo'lishni orzu qiladigan quvnoq bola.", en: "A cheerful boy who dreams of becoming a courier.", ja: "配達員を夢見る元気な男の子。" },
  { uz: "Bozordagi do'kon egasi. Vaqtida yetkazishni qadrlaydi.", en: "A bazaar shop owner who values punctual delivery.", ja: "市場の店主。時間通りの配達を大切にする。" },
  { uz: "Maktab o'qituvchisi. Kitoblarni juda yaxshi ko'radi.", en: "A school teacher who adores books.", ja: "学校の先生。本が大好き。" },
];
const ITEM_FAV = [
  { uz: "Ayiqcha", en: "Teddy bear", ja: "くまのぬいぐるみ" },
  { uz: "Sopol vaza", en: "Ceramic vase", ja: "陶器の花瓶" },
  { uz: "Ipak mato", en: "Silk cloth", ja: "絹の布" },
  { uz: "Eski kalit", en: "Old key", ja: "古い鍵" },
  { uz: "Mato namunasi", en: "Fabric sample", ja: "布のサンプル" },
  { uz: "Shirinlik", en: "Sweets", ja: "お菓子" },
  { uz: "Issiq non", en: "Warm bread", ja: "焼きたてのパン" },
  { uz: "Kitoblar", en: "Books", ja: "本" },
  { uz: "Savat", en: "Basket", ja: "かご" },
];
const cuBio = (i) => CU_BIO[i][LG] || CU_BIO[i].en,
  cuFav = (i) => ITEM_FAV[ITEM_CU[i]][LG] || ITEM_FAV[ITEM_CU[i]].en,
  cuLevel = (i) => cu.c[i], // 0 new, 1 familiar, 2 friend, 3 partner
  cuAvg = (i) => (cu.d[i] ? cu.r[i] / cu.d[i] : 0);
function cuTrust(c, rt) {
  cu.d[c]++;
  cu.r[c] += rt;
  const add = rt >= 5 ? 2 : rt === 4 ? 1 : 0;
  if (!add) {
    store.set("zr3d_cu", cu);
    return { add: 0, ch: -1 };
  }
  cu.t[c] += add;
  const j = cu.c[c];
  let ch = -1,
    g = 0;
  if (j < CU_AT.length && cu.t[c] >= CU_AT[j]) {
    cu.c[c] = j + 1;
    ch = j;
    g = 100 * (j + 1);
    coinsGot += g;
    LT.coins += g;
    bonus += g * 10;
  }
  store.set("zr3d_cu", cu);
  return { add, ch, g };
}
/* ---------- delivery scene: the run freezes, the customer talks, the reward is shown ---------- */
const THX = [
  { uz: "Rahmat! Bu sovg'ani butun yil kutgandim!", en: "Thank you! I've waited all year for this gift!", ja: "ありがとう！一年間ずっとこのプレゼントを待ってたんだ！" },
  { uz: "Voy, vaza butun! Registonda ko'rgazma aynan shu bilan ochiladi.", en: "The vase is intact! The Registan exhibit opens with exactly this.", ja: "花瓶は無事だ！レギスタンの展示はまさにこれで始まるの。" },
  { uz: "Ipak yarqirayapti! Toq bugun gavjum bo'ladi, rahmat.", en: "The silk is gleaming! The dome will be busy today, thank you.", ja: "絹が輝いてる！今日のドームは賑わうぞ、ありがとう。" },
  { uz: "Eski kalit! Ota-bobolarimiz darvozani shu bilan ochgan.", en: "The old key! Our ancestors opened this gate with it.", ja: "古い鍵だ！先祖はこれで門を開けたのよ。" },
  { uz: "Namuna ajoyib, fabrika buyurtmani qabul qiladi!", en: "The sample is perfect, the mill will take the order!", ja: "サンプルは完璧、工場は注文を受けられるわ！" },
  { uz: "Shirinliklar issiq! Tungi kafe bugun to'la bo'ladi.", en: "The sweets are warm! The night cafe will be packed tonight.", ja: "お菓子はまだ温かい！今夜のカフェは満員だ。" },
];
const GEN = {
  hi: [
    { uz: "Ajoyib! Hammasi butun va vaqtida keldi!", en: "Wonderful! Everything arrived intact and on time!", ja: "素晴らしい！無傷で時間通りに届いた！" },
    { uz: "Siz haqiqiy ishonchli kuryersiz, rahmat!", en: "You're a truly reliable courier, thank you!", ja: "本当に頼れる配達員ね、ありがとう！" },
  ],
  mid: [
    { uz: "Rahmat. Biroz silkinibdi, lekin yaxshi.", en: "Thanks. It got shaken a bit, but it's fine.", ja: "ありがとう。少し揺れたけど大丈夫。" },
    { uz: "Mayli, yetib keldi. Keyingi safar ehtiyotroq bo'ling.", en: "Well, it arrived. Be more careful next time.", ja: "まあ届いたね。次はもっと気をつけて。" },
  ],
  lo: [
    { uz: "Voy, qutisi ezilib ketibdi... Ehtiyot bo'lish kerak edi.", en: "Oh, the box is crushed... You should've been careful.", ja: "あらら、箱が潰れてる…もっと気をつけてよ。" },
    { uz: "Kech qoldingiz va buzilibdi. Ko'p yulduz bera olmayman.", en: "Late and damaged. I can't give many stars.", ja: "遅いし壊れてる。星はあまりあげられないな。" },
  ],
};
let talk = null;
const lgp = (o) => o[LG] || o.en;
function showTalk(d) {
  /* d: {c, pages[], rt, reward, add, extra[], must} */
  talk = d;
  d.pi = 0;
  d.ci = 0;
  d.t = 0;
  paused = true;
  uiTalk(d);
}
let ST = { k: -1, state: "none" },
  storyCard = { t: 0, title: "", sub: "" };
const starStr = (r) => "★".repeat(r) + "☆".repeat(5 - r);
/* customer rating 1..5: every hit while carrying and every late minute costs a star */
const ratingNow = () => clamp(5 - CR.hits - (CR.tLeft < 0 ? 1 : 0), 1, 5);
function storyUpdate() {
  const k = Math.floor(pz / THEME_LEN);
  if (k !== ST.k && !(CR.st === "carry" && CR.story)) {
    const th = themeAt(k * THEME_LEN + 1);
    ST = { k, th, state: "pending", z0: k * THEME_LEN, z1: (k + 1) * THEME_LEN };
    storyCard = { t: 5, title: cityName(th).toUpperCase() + " · " + T("qTitle"), sub: questName(th) };
  }
}
function courTouch(o) {
  o.got = true;
  if (o.k === "pkg") {
    const story = !!o.story,
      dist = 3000,
      l = (RNG() * 3) | 0;
    CR.st = "carry";
    CR.pkg = null;
    CR.hits = 0;
    CR.story = story;
    CR.cust = o.cust;
    CR.item = o.item;
    CR.anim = { k: "in", item: o.item, t: 0, x: o.x, y: o.y, z: o.z };
    CR.tMax = CR.tLeft = (dist / Math.max(speed, SPEED0)) * 1.15 + 4;
    CR.drop = { k: "drop", x: LX[l], z: pz + dist, len: 3, story, item: o.item, cust: o.cust };
    objs.push(CR.drop);
    courClear();
    floatText(story ? T("qPick") : T("cPick"), story ? "#7fe6ff" : "#ffd84f");
    sfx.pow();
    burst(o.x, o.y, o.z, 14, story ? "#7fe6ff" : "#ffd84f", 4);
    return;
  }
  const late = CR.tLeft < 0,
    rt = ratingNow(),
    story = !!CR.story,
    base = story ? 120 : 18 + Math.min(CR.streak, 6) * 4,
    tb = late ? 0 : Math.round(clamp(CR.tLeft / CR.tMax, 0, 1) * (story ? 60 : 20)),
    reward = Math.round((base + tb) * (0.5 + 0.1 * rt));
  coinsGot += reward;
  LT.coins += reward;
  bonus += reward * (story ? 20 : 12);
  S.deliv++;
  LT.deliv = (LT.deliv || 0) + 1;
  LT.rateSum = (LT.rateSum || 0) + rt;
  LT.rateN = (LT.rateN || 0) + 1;
  CR.n++;
  CR.rsum = (CR.rsum || 0) + rt;
  CR.earned += reward;
  CR.streak = late || rt < 4 ? 0 : CR.streak + 1;
  heat = Math.max(0, heat - 20);
  energy = Math.min(100, energy + 15);
  burst(o.x, 1.5, o.z, 24, "#7ffcb0", 6);
  let firstQ = false,
    qDone = false;
  if (story && ST.state === "carry") {
    ST.state = "done";
    qDone = true;
    firstQ = jr.best[ST.th] === 0;
    jr.best[ST.th] = Math.max(jr.best[ST.th], rt);
    bonus += 600 + rt * 200;
    CR.quests = (CR.quests || 0) + 1;
    if (!jr.done && jrCount() === QUEST.length) {
      jr.done = 1;
      bonus += 5000;
    }
    store.set("zr3d_jr", jr);
  }
  const tr = CR.cust >= 0 ? cuTrust(CR.cust, rt) : { add: 0, ch: -1 },
    gen = GEN[rt >= 4 ? "hi" : rt === 3 ? "mid" : "lo"],
    pages = [story && THX[ST.th] ? lgp(THX[ST.th]) : lgp(gen[(Math.random() * gen.length) | 0])],
    extra = [];
  if (tr.ch >= 0) {
    pages.push(cuText(CR.cust, tr.ch));
    extra.push(CU[CR.cust].e + " " + (tr.ch + 1) + "/" + CU_AT.length + "  +" + tr.g + " 🪙");
  }
  if (qDone) {
    extra.push("✅ " + T("qDone"));
    if (firstQ && ST.th + 1 < QUEST.length) extra.push("🔓 " + T("qUnlock").replace("{c}", cityName(ST.th + 1)));
    if (jr.done === 1 && jrCount() === QUEST.length && firstQ) extra.push("🏆 " + T("jrEnd"));
  }
  showTalk({ c: CR.cust, pages, rt, reward, add: tr.add, extra, must: story || tr.ch >= 0 });
  CR.anim = { k: "out", item: o.item, t: 0, x: o.x, z: o.z, cust: o.cust, cx: o.x + (o.x >= 0 ? 1.9 : -1.9) };
  CR.story = false;
  CR.st = "find";
  CR.drop = null;
  CR.at = pz + 300;
}
function courUpdate(dt) {
  storyUpdate();
  if (CR.st === "find") {
    const wantStory = ST.state === "pending" && pz + 120 >= ST.z0 + 40;
    if (!CR.pkg && (wantStory || pz + 120 >= CR.at)) {
      const cust = (lastCu = pickCust(wantStory));
      CR.pkg = { k: "pkg", x: LX[(RNG() * 3) | 0], z: Math.max(wantStory ? ST.z0 + 40 : CR.at, pz + 120), y: 1.1, len: 0, story: wantStory, cust, item: wantStory ? ST.th : ITEM_CU[cust] };
      if (wantStory) ST.state = "carry";
      objs.push(CR.pkg);
      courClear();
    } else if (CR.pkg && !CR.pkg.got && CR.pkg.z < pz - 3) {
      if (CR.pkg.story) {
        ST.state = "fail";
        floatText(T("qFail"), "#ff6b84");
      } else floatText(T("cMissPkg"), "#ff9a9a");
      CR.pkg = null;
      CR.at = pz + 300;
    }
  } else {
    CR.tLeft -= dt;
    if (CR.drop && CR.drop.z - pz < 150 && (CR.clr = (CR.clr || 0) - dt) < 0) {
      CR.clr = 0.4;
      courClear();
    }
    if (CR.drop && !CR.drop.got && CR.drop.z < pz - 3) {
      if (CR.story) {
        ST.state = "fail";
        floatText(T("qFail"), "#ff6b84");
      } else floatText(T("cMiss"), "#ff6b84");
      CR.story = false;
      CR.drop = null;
      CR.st = "find";
      CR.at = pz + 300;
      CR.streak = 0;
    }
  }
  /* police heat: rises over distance, coins and deliveries cool it; at 100 the patrol catches up (a hit) */
  if (pz > 250) {
    heat += dt * (1.6 + clamp(pz / 2600, 0, 1) * 1.2) * (jet > 0 || invul > 1 ? 0.3 : 1);
    if (heat >= 100) {
      heat = 62;
      floatText(T("cCaught"), "#ff6b84");
      hurt(null);
    }
  }
}

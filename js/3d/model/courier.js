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
const cuName = (i) => CU[i].n[LG] || CU[i].n.en,
  cuText = (i, j) => CU[i].ch[j][LG] || CU[i].ch[j].en;
let lastCu = -1;
function pickCust(story) {
  if (story) return STORY_CU[ST.th] ?? 0;
  let c;
  do c = (Math.random() * CU.length) | 0;
  while (c === lastCu);
  return c;
}
function cuTrust(c, rt) {
  const add = rt >= 5 ? 2 : rt === 4 ? 1 : 0;
  if (!add) return;
  cu.t[c] += add;
  const j = cu.c[c];
  if (j < CU_AT.length && cu.t[c] >= CU_AT[j]) {
    cu.c[c] = j + 1;
    const g = 100 * (j + 1);
    coinsGot += g;
    LT.coins += g;
    bonus += g * 10;
    storyCard = { t: 7, title: CU[c].e + " " + cuName(c) + "  ·  " + (j + 1) + "/" + CU_AT.length + "  +" + g, sub: cuText(c, j) };
  }
  store.set("zr3d_cu", cu);
}
let ST = { k: -1, state: "none" },
  storyCard = { t: 0, title: "", sub: "" };
const starStr = (r) => "★".repeat(r) + "☆".repeat(5 - r);
/* customer rating 1..5: every hit while carrying and every late minute costs a star */
const ratingNow = () => clamp(5 - CR.hits - (CR.tLeft < 0 ? 1 : 0), 1, 5);
function storyUpdate() {
  const k = Math.floor(pz / THEME_LEN);
  if (k !== ST.k) {
    const th = themeAt(k * THEME_LEN + 1);
    ST = { k, th, state: "pending", z0: k * THEME_LEN, z1: (k + 1) * THEME_LEN };
    storyCard = { t: 5, title: cityName(th).toUpperCase() + " · " + T("qTitle"), sub: questName(th) };
  }
}
function courTouch(o) {
  o.got = true;
  if (o.k === "pkg") {
    const story = !!o.story,
      dist = story ? clamp(ST.z1 - 130 - pz, 170, 520) : 230 + rnd(0, 90),
      l = (Math.random() * 3) | 0;
    CR.st = "carry";
    CR.pkg = null;
    CR.hits = 0;
    CR.story = story;
    CR.cust = lastCu = pickCust(story);
    CR.tMax = CR.tLeft = (dist / Math.max(speed, SPEED0)) * 1.15 + 4;
    CR.drop = { k: "drop", x: LX[l], z: pz + dist, len: 3, story };
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
  floatText(starStr(rt) + "  +" + reward, rt >= 4 ? "#7ffcb0" : rt === 3 ? "#ffe27a" : "#ffb36b");
  sfx.zumary();
  burst(o.x, 1.5, o.z, 24, "#7ffcb0", 6);
  if (story && ST.state === "carry") {
    ST.state = "done";
    const first = jr.best[ST.th] === 0;
    jr.best[ST.th] = Math.max(jr.best[ST.th], rt);
    bonus += 600 + rt * 200;
    CR.quests = (CR.quests || 0) + 1;
    storyCard = {
      t: 4.5,
      title: T("qDone") + "  " + starStr(rt),
      sub: first && ST.th + 1 < QUEST.length ? T("qUnlock").replace("{c}", cityName(ST.th + 1)) : cityName(ST.th),
    };
    if (!jr.done && jrCount() === QUEST.length) {
      jr.done = 1;
      bonus += 5000;
      setTimeout(() => {
        storyCard = { t: 7, title: T("jrEnd"), sub: T("jrEndSub") };
      }, 4600);
    }
    store.set("zr3d_jr", jr);
  }
  if (CR.cust >= 0) cuTrust(CR.cust, rt);
  CR.story = false;
  CR.st = "find";
  CR.drop = null;
  CR.at = pz + 110;
}
function courUpdate(dt) {
  storyUpdate();
  if (CR.st === "find") {
    const wantStory = ST.state === "pending" && pz + 120 >= ST.z0 + 100;
    if (!CR.pkg && (wantStory || pz + 120 >= CR.at)) {
      CR.pkg = { k: "pkg", x: LX[(Math.random() * 3) | 0], z: Math.max(wantStory ? ST.z0 + 100 : CR.at, pz + 120), y: 1.1, len: 0, story: wantStory };
      if (wantStory) ST.state = "carry";
      objs.push(CR.pkg);
      courClear();
    } else if (CR.pkg && !CR.pkg.got && CR.pkg.z < pz - 3) {
      if (CR.pkg.story) {
        ST.state = "fail";
        floatText(T("qFail"), "#ff6b84");
      } else floatText(T("cMissPkg"), "#ff9a9a");
      CR.pkg = null;
      CR.at = pz + 140;
    }
  } else {
    CR.tLeft -= dt;
    if (CR.drop && !CR.drop.got && CR.drop.z < pz - 3) {
      if (CR.story) {
        ST.state = "fail";
        floatText(T("qFail"), "#ff6b84");
      } else floatText(T("cMiss"), "#ff6b84");
      CR.story = false;
      CR.drop = null;
      CR.st = "find";
      CR.at = pz + 130;
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

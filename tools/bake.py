#!/usr/bin/env python3
"""Bakes the 3D robot models (js/3d/view/hero.js, chaser.js) into side-view sprite sheets for the 2D game.
Usage: python3 tools/bake.py  (needs playwright + chromium; serves the repo on a local port)
Output: assets/baked/hero_<skin>.png, guard.png, dog.png  (single-row sheets; frame size = logical size * PX)."""
import asyncio, base64, os, subprocess, sys, time
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "baked")
PORT = 8771
INIT = """
const g = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (t, a) {
  if (t === 'webgl' || t === 'experimental-webgl') a = Object.assign({}, a, {alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: true});
  return g.call(this, t, a);
};
"""
BAKE = """
async ([kind, skin, PX]) => {
  const SS = 4, S0 = 1.55 / 54; // world units per 2D unit (hero ~54 units tall = 1.55 world)
  const spec = { hero: {w: 84, h: 78, fx: 42, fy: 74, n: 17}, guard: {w: 90, h: 82, fx: 44, fy: 78, n: 13}, dog: {w: 96, h: 58, fx: 46, fy: 54, n: 24} }[kind];
  const W = spec.w * PX * SS, H = spec.h * PX * SS, cw = Math.round(spec.w * PX), ch = Math.round(spec.h * PX);
  const sheet = document.createElement('canvas'); sheet.width = cw * spec.n; sheet.height = ch;
  const sc = sheet.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
  const tc = tmp.getContext('2d');
  cv.width = W; cv.height = H;
  const look0 = Rig.LOOKS[skin] || Rig.LOOKS.default;
  const frameState = (i) => {
    const base = { ph: 0, air: false, slide: false, hit: false, boost: false, dash: 0, scoot: false, fx: 0, fy: 0, land: 0, wing: 0, t: 1.0, sp: 0.5, tilt: 0 };
    if (i < 12) return Object.assign(base, { ph: (i / 12) * Math.PI * 2 });
    return Object.assign(base, [{ air: true, wing: 0.2 }, { air: true, wing: 0.9 }, { land: 0.7 }, { slide: true }, { hit: true }][i - 12]);
  };
  for (let i = 0; i < spec.n; i++) {
    const cxz = (spec.w / 2 - spec.fx) * S0, cy = (spec.fy - spec.h / 2) * S0, halfH = (spec.h / 2) * S0;
    const D = 60, fov = 2 * Math.atan(halfH / D);
    pz = 0; speed = 15;
    setEnvironment();
    SUN = (() => { const v = [-0.55, 0.5, 0.7], l = Math.hypot(...v); return v.map((x) => x / l); })();
    FOGK = 0;
    CAM = [-D, cy, cxz];
    const V = M4.look(CAM, [0, cy, cxz], [0, 1, 0]);
    VP = M4.mul(M4.persp(fov, W / H, 1, 200), V);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    useMain();
    const root = joint(Tp(0, 0, 0), 0, 0, 0, 0, kind === 'hero' ? -0.6 : -0.5, 0);
    if (kind === 'hero') drawHero(root, look0, frameState(i));
    else if (kind === 'guard') drawBox(root, ((i % 12) / 12) * Math.PI * 2, 1.0 + (i === 12 ? 0.4 : 0));
    else drawBall(root, ((i % 12) / 12) * Math.PI * 2, i >= 12 ? 1.37 : 1.0);
    flushChars();
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const id = tc.createImageData(W, H);
    for (let y = 0; y < H; y++) id.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    tc.putImageData(id, 0, 0);
    sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = 'high';
    sc.drawImage(tmp, i * cw, 0, cw, ch);
  }
  return sheet.toDataURL('image/png');
}
"""
async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            ctx = await b.new_context(viewport={"width": 900, "height": 600})
            await ctx.add_init_script(INIT)
            pg = await ctx.new_page()
            await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
            await pg.goto(f"http://localhost:{PORT}/city3d.html"); await pg.wait_for_timeout(1500)
            await pg.evaluate("ZR3D.pause && 0")
            jobs = [("hero", s) for s in ["default", "rose", "mint", "gold"]] + [("guard", "default"), ("dog", "default")]
            for kind, skin in jobs:
                url = await pg.evaluate(BAKE, [kind, skin, 3])
                name = f"hero_{skin}.png" if kind == "hero" else f"{kind}.png"
                open(os.path.join(OUT, name), "wb").write(base64.b64decode(url.split(",")[1]))
                print("baked", name)
            await b.close()
    finally:
        srv.terminate()
asyncio.run(main())

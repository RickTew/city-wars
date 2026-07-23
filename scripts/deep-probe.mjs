/**
 * Deep playtest probe — boot game, check rings/paths/save/escape for flags.
 * Usage: node scripts/deep-probe.mjs
 */
import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'timers/promises';

const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.CW_URL || 'http://localhost:5173/';

const flags = [];
const ok = (m) => console.log('  ✓', m);
const flag = (m) => {
  flags.push(m);
  console.log('  ⚑ FLAG:', m);
};

async function clickBtn(page, text) {
  for (let i = 0; i < 50; i++) {
    const hit = await page.evaluate((t) => {
      const needle = t.toLowerCase();
      const nodes = [...document.querySelectorAll('button')];
      const el = nodes.find((n) => (n.textContent || '').toLowerCase().includes(needle));
      if (!el) return false;
      const opts = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse' };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      return true;
    }, text);
    if (hit) return;
    await sleep(100);
  }
  throw new Error(`Button not found: ${text}`);
}

async function dismiss(page) {
  for (let i = 0; i < 12; i++) {
    const open = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      if (!g?.popupOpen) return false;
      g.dismissPopup();
      return true;
    });
    if (!open) break;
    await sleep(50);
  }
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,720'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));

  try {
    console.log('· Boot', BASE);
    await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(500);
    await clickBtn(page, 'START RUN');
    await sleep(400);
    await clickBtn(page, 'ENTER THE GRID');
    await page.waitForFunction(() => window.__CITY_WARS__?.player, { timeout: 20000 });
    await sleep(1000);
    await dismiss(page);
    ok('Game scene ready');

    // Zone ladder east
    console.log('· Zone ladder (east transect)');
    const zones = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      const z = g.zones;
      const path = [];
      for (let x = 48; x < 95; x += 2) {
        const id = z.getZone(x, 48);
        const last = path[path.length - 1];
        if (!last || last.zone !== id) {
          path.push({ x, zone: id, lv: z.level(x, 48), name: z.label(id) });
        }
      }
      return {
        path,
        enterable: z.enterableList().map((m) => m.short),
      };
    });
    ok(`East rings: ${zones.path.map((p) => p.zone).join('→')}`);
    for (const need of ['home', 'yellow', 'orange', 'green', 'blue', 'red']) {
      if (!zones.path.some((p) => p.zone === need)) flag(`Missing ring on E-W: ${need}`);
    }
    let prevLv = -1;
    for (const p of zones.path) {
      if (p.lv < prevLv) flag(`Level went backwards at x=${p.x}: ${p.zone} lv${p.lv}`);
      prevLv = p.lv;
    }
    if (zones.enterable.length !== 5) flag(`Enterable count ${zones.enterable.length}`);
    else ok(`Enterable ${zones.enterable.join('→')}`);

    // Interactables
    console.log('· Interactables walkable / no enemy overlap');
    const spots = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      const enemyOn = (x, y) => g.enemies.some((e) => e.alive && e.tx === x && e.ty === y);
      const scan = (label, list) =>
        (list || []).map((p) => ({
          label,
          x: p.x,
          y: p.y,
          id: p.id || null,
          blocked: g.blocked(p.x, p.y),
          walk: g.walkable(p.x, p.y),
          enemy: enemyOn(p.x, p.y),
          zone: g.zones.getZone(p.x, p.y),
        }));
      return {
        all: [
          ...scan('loot', g.lootSpots),
          ...scan('gear', g.gearDrops),
          ...scan('bp', g.bpSpots),
          ...scan('pad', g.escapePads),
          ...scan('bench', g.benches),
          ...scan('sleep', g.sleeps),
        ],
      };
    });
    let bad = 0;
    for (const s of spots.all) {
      if (s.blocked || !s.walk) {
        flag(`${s.label}${s.id ? '(' + s.id + ')' : ''} blocked @${s.x},${s.y}`);
        bad++;
      }
      if (s.enemy) {
        flag(`${s.label} enemy on tile @${s.x},${s.y}`);
        bad++;
      }
    }
    if (!bad) ok(`All ${spots.all.length} interactables clear`);

    // Breach / pads RED
    console.log('· RED ring critical props');
    const red = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      const breach = g.bpSpots.find((b) => b.id === 'breach');
      return {
        breach: {
          ...breach,
          zone: g.zones.getZone(breach.x, breach.y),
          walk: g.walkable(breach.x, breach.y),
        },
        pads: g.escapePads.map((p) => ({
          ...p,
          zone: g.zones.getZone(p.x, p.y),
          walk: g.walkable(p.x, p.y),
        })),
      };
    });
    if (red.breach.zone !== 'red') flag(`Breach in ${red.breach.zone}, want red`);
    else ok(`Breach @${red.breach.x},${red.breach.y} RED`);
    for (const p of red.pads) {
      if (p.zone !== 'red' || !p.walk) flag(`Pad ${p.x},${p.y} zone=${p.zone} walk=${p.walk}`);
    }
    if (!flags.some((f) => f.includes('Pad'))) ok('Escape pads RED + walkable');

    // Warp rings
    console.log('· Warp each ring');
    // RED sample must be walkable (not solid barricade) — south pad approach works
    const warps = [
      [48, 48, 'home'],
      [62, 48, 'yellow'],
      [70, 48, 'orange'],
      [78, 48, 'green'],
      [84, 48, 'blue'],
      [48, 9, 'red'], // north approach corridor (must stay walkable after wall carve)
    ];
    for (const [x, y, want] of warps) {
      const r = await page.evaluate(
        (tx, ty) => {
          const g = window.__CITY_WARS__;
          const okWarp = g.debugWarp(tx, ty);
          return {
            okWarp,
            zone: g.zones.getZone(g.player.tx, g.player.ty),
            hud: g.zones.hudLine(g.player.tx, g.player.ty),
            tx: g.player.tx,
            ty: g.player.ty,
          };
        },
        x,
        y
      );
      await sleep(60);
      await dismiss(page);
      if (r.zone !== want) flag(`Warp ${want} → landed ${r.zone} @${r.tx},${r.ty} (ok=${r.okWarp})`);
      else ok(`Warp ${want}: ${r.hud}`);
    }

    // Paths
    console.log('· Pathfinding HQ → breach / pads');
    const paths = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      g.debugWarp(48, 48);
      const bp = g.bpSpots.find((b) => b.id === 'breach');
      g.setMousePath(bp.x, bp.y, true);
      const toBreach = g.movePath?.length || 0;
      g.clearMousePath();
      const pads = g.escapePads.map((p) => {
        g.setMousePath(p.x, p.y, false);
        const len = g.movePath?.length || 0;
        g.clearMousePath();
        return { x: p.x, y: p.y, len };
      });
      return { toBreach, pads, bp: { x: bp.x, y: bp.y } };
    });
    if (!paths.toBreach) flag(`No path HQ→breach ${JSON.stringify(paths.bp)}`);
    else ok(`Path HQ→breach: ${paths.toBreach} steps`);
    for (const p of paths.pads) {
      if (!p.len) flag(`No path to pad ${p.x},${p.y}`);
      else ok(`Path pad ${p.x},${p.y}: ${p.len}`);
    }

    // Day sleep short rest
    console.log('· Day sleep at HQ');
    const sleepTest = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      g.debugWarp(48, 48);
      g.dayNight.t = 0.2;
      g.dayNight.day = 1;
      g.player.hp = 20;
      const before = { t: g.dayNight.t, day: g.dayNight.day };
      g.doSleep();
      return {
        before,
        after: { t: g.dayNight.t, day: g.dayNight.day, hp: g.player.hp },
      };
    });
    await dismiss(page);
    if (sleepTest.after.day !== sleepTest.before.day) {
      flag(`Day HQ sleep advanced day ${sleepTest.before.day}→${sleepTest.after.day}`);
    }
    if (sleepTest.after.t < 0.05 && sleepTest.before.t >= 0.15) {
      flag('Day HQ sleep reset clock to morning');
    } else {
      ok(
        `Day rest t ${sleepTest.before.t.toFixed(2)}→${sleepTest.after.t.toFixed(2)} hp=${sleepTest.after.hp}`
      );
    }

    // Save
    console.log('· Save payload');
    const saveCheck = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      g.runStats.crafts = 3;
      g.runStats.kills = 2;
      const saved = g.debugSave();
      const peek = JSON.parse(localStorage.getItem('city_wars_save_v1') || 'null');
      return {
        saved,
        crafts: peek?.runStats?.crafts,
        kills: peek?.runStats?.kills,
        startedAt: peek?.runStats?.startedAt,
        zoom: g.cameras.main.zoom,
      };
    });
    if (!saveCheck.saved) flag('Save failed');
    if (saveCheck.crafts !== 3) flag(`crafts not saved (${saveCheck.crafts})`);
    else ok('Save stores crafts/kills');
    if (!saveCheck.startedAt) flag('Missing startedAt');
    else ok('startedAt present');
    ok(`Zoom ${saveCheck.zoom}`);

    // Enemy density
    console.log('· Enemy density');
    const dens = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      const counts = { home: 0, yellow: 0, orange: 0, green: 0, blue: 0, red: 0 };
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const z = g.zones.getZone(e.tx, e.ty);
        counts[z] = (counts[z] || 0) + 1;
      }
      return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
    });
    ok(`Enemies ${dens.total}: ${JSON.stringify(dens.counts)}`);
    if (dens.total < 15) flag(`Sparse enemies (${dens.total})`);
    if ((dens.counts.home || 0) > 2) flag(`Too many HOME enemies (${dens.counts.home})`);
    // Mid rings must host fights (the bug we fixed: all 55 in RED)
    const mid =
      (dens.counts.yellow || 0) +
      (dens.counts.orange || 0) +
      (dens.counts.green || 0) +
      (dens.counts.blue || 0);
    if (mid < 20) flag(`Mid rings too empty (${mid} total yel–blu)`);
    if ((dens.counts.red || 0) > mid + 5) flag(`RED still dominates (${dens.counts.red} vs mid ${mid})`);
    else ok(`Ring balance OK mid=${mid} red=${dens.counts.red || 0}`);

    // Escape preconditions
    console.log('· Escape pad + Breach Kit');
    const esc = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      if (!g.inv.items.some((i) => i.id === 'breach')) g.inv.addItem('breach');
      const pad = g.nearestEscapePad();
      g.debugWarp(pad.x, pad.y);
      return {
        pad,
        tile: g.ground[g.player.ty][g.player.tx],
        hasBreach: g.inv.items.some((i) => i.id === 'breach'),
        zone: g.zones.getZone(g.player.tx, g.player.ty),
      };
    });
    if (esc.tile !== 8) flag(`Not on ESCAPE tile (id=${esc.tile})`);
    else ok(`On ESCAPE pad ${esc.pad.x},${esc.pad.y} (${esc.zone})`);

    // Guide spots still HOME
    console.log('· Tutorial hike zones');
    const guide = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      const loot = g.lootSpots.find((l) => l.guide);
      const stick = g.gearDrops.find((d) => d.id === 'stick');
      const hat = g.gearDrops.find((d) => d.id === 'sexy_hat');
      return {
        loot: { ...loot, zone: g.zones.getZone(loot.x, loot.y) },
        stick: { ...stick, zone: g.zones.getZone(stick.x, stick.y) },
        hat: { ...hat, zone: g.zones.getZone(hat.x, hat.y) },
      };
    });
    for (const [k, v] of Object.entries(guide)) {
      if (v.zone !== 'home') flag(`Guide ${k} in ${v.zone}, expected home`);
    }
    if (!flags.some((f) => f.startsWith('Guide'))) ok('Guide hikes stay in HOME');

    // First-enter zone popup path (no throw)
    console.log('· Zone enter story');
    const zStory = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      g._storyQuiet = false;
      g.story.narratorOn = true;
      const cards = ['yellow', 'orange', 'green', 'blue', 'red'].map((z) => g.story.onZone(z));
      return cards.map((c) => c && { title: c.title, body: (c.body || '').slice(0, 40) });
    });
    const missing = zStory.filter((c) => !c);
    if (missing.length) flag(`Zone story cards missing: ${missing.length}`);
    else ok(`Zone cards: ${zStory.map((c) => c.title).join(' · ')}`);

    // Default zoom range
    if (saveCheck.zoom < 0.45 || saveCheck.zoom > 0.75) flag(`Default zoom odd ${saveCheck.zoom}`);

    if (pageErrors.length) {
      for (const e of pageErrors.slice(0, 6)) flag(`PageError: ${e}`);
    } else ok('No page JS errors');
  } catch (e) {
    flag(`Probe crashed: ${e.message || e}`);
    console.error(e);
  } finally {
    await browser.close();
  }

  console.log('\n======== DEEP PROBE SUMMARY ========');
  if (!flags.length) {
    console.log('No flags found.');
  } else {
    console.log(`${flags.length} flag(s):`);
    flags.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  process.exitCode = flags.length ? 1 : 0;
}

main();

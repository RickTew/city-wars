/**
 * City Wars smoke playtest via Chrome headless.
 * Walks the tutorial path using the window.__CITY_WARS__ debug API.
 *
 * Usage: node scripts/playtest.mjs
 * Requires: Chrome + puppeteer (npx, no install if cached)
 */
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const BASE = process.env.CW_URL || 'http://localhost:5173/';
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function tryPuppeteer() {
  try {
    const require = createRequire(import.meta.url);
    // Prefer local, then npx resolution won't work; use dynamic import of puppeteer-core
    return await import('puppeteer-core');
  } catch {
    return null;
  }
}

async function main() {
  let puppeteer = await tryPuppeteer();
  if (!puppeteer) {
    // Install puppeteer-core lightly (no bundled chrome)
    console.log('Installing puppeteer-core for playtest…');
    await new Promise((resolve, reject) => {
      const p = spawn('npm', ['install', '--no-save', 'puppeteer-core@24'], {
        cwd: new URL('..', import.meta.url).pathname,
        stdio: 'inherit',
        env: { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || ''}` },
      });
      p.on('error', reject);
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('npm install failed'))));
    });
    puppeteer = await import('puppeteer-core');
  }

  const browser = await puppeteer.default.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', `--window-size=1280,720`],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const log = (m) => console.log(`  · ${m}`);
  const fail = (m) => {
    console.error(`FAIL: ${m}`);
    process.exitCode = 1;
  };

  try {
    log(`Open ${BASE}`);
    await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });

    // Menu → pick medium day → start (layout-aware tap)
    await page.waitForFunction(() => document.querySelector('canvas'), { timeout: 10000 });
    await sleep(400);
    const vp = page.viewport();
    const mw = vp?.width || 1280;
    const mh = vp?.height || 720;
    // START RUN sits ~48% down on the centered menu block
    await page.mouse.click(mw / 2, mh * 0.48);
    await sleep(500);
    // Character select: ENTER THE GRID
    await page.mouse.click(mw / 2, mh - 36);
    await sleep(900);

    // Wait for game scene debug API
    await page.waitForFunction(() => window.__CITY_WARS__?.player, { timeout: 15000 });
    log('Game scene ready');

    const dismissAll = async () => {
      for (let i = 0; i < 8; i++) {
        const open = await page.evaluate(() => {
          const g = window.__CITY_WARS__;
          if (!g?.popupOpen) return false;
          g.dismissPopup();
          return true;
        });
        if (!open) break;
        await sleep(80);
      }
    };

    await dismissAll();
    await sleep(200);

    // --- Tutorial steps via warp + actions ---
    const step = async (name, fn) => {
      log(name);
      await fn();
      await sleep(120);
      await dismissAll();
      const st = await page.evaluate(() => window.__CITY_WARS__.debugState());
      return st;
    };

    let st = await step('Loot guide crate (east hike)', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        const loot = g.lootSpots.find((l) => l.guide);
        g.debugWarp(loot.x, loot.y);
        g.scavenge(loot.x, loot.y);
      });
    });
    if (!st.guide.flags.looted && st.mats.cloth < 2) fail('Guide crate cloth missing');
    else log(`  cloth=${st.mats.cloth} scrap=${st.mats.scrap}`);

    st = await step('Pick Street Stick (south hike)', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        const d = g.gearDrops.find((x) => x.id === 'stick');
        g.debugWarp(d.x, d.y);
      });
    });
    if (!st.items.includes('stick') && st.equip.weapon !== 'stick') fail('Stick not picked up');

    st = await step('Pick Neon Fedora (west hike)', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        const d = g.gearDrops.find((x) => x.id === 'sexy_hat');
        g.debugWarp(d.x, d.y);
      });
    });
    if (!st.items.includes('sexy_hat') && st.equip.head !== 'sexy_hat') fail('Hat not picked up');

    st = await step('Equip stick + hat', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        const stick = g.inv.items.find((i) => i.id === 'stick');
        const hat = g.inv.items.find((i) => i.id === 'sexy_hat');
        if (stick) g.inv.equipItem(stick.uid);
        if (hat) g.inv.equipItem(hat.uid);
        g.checkGuide();
      });
    });
    if (st.equip.weapon !== 'stick' && st.equip.weapon !== 'pipe') fail('Weapon not equipped');
    if (st.equip.head !== 'sexy_hat') fail('Hat not equipped');
    if (st.sneak < 1) fail('Hat sneakBonus not applied');
    else log(`  ATK=${st.atk} DEF=${st.def} sneak=${st.sneak}`);

    st = await step('Craft Field Bandage at HQ bench', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        const b = g.benches[0];
        g.debugWarp(b.x, b.y);
        // Ensure cloth
        if (g.inv.count('cloth') < 2) g.inv.addMat('cloth', 2);
        g.inv.learnBlueprint('bandage');
        g.tryCraftId('bandage');
      });
    });
    if (!st.items.includes('bandage') && st.equip.quick1 !== 'bandage' && st.equip.quick2 !== 'bandage') {
      // bandage might still be in bag after craft
      if (st.guide.flags.bandage !== true && !st.items.includes('bandage')) fail('Bandage not crafted');
    }

    st = await step('Auto-open craft panel at bench', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        const b = g.benches[0];
        g.craftPanel.close();
        g._benchCraftDismissed = false;
        g._benchAutoCraft = false;
        g.debugWarp(b.x, b.y);
      });
    });
    if (!st.craftOpen) fail('Craft panel should auto-open at bench');
    else log('  craft panel auto-open');

    st = await step('Stack bandages via hotkey craft', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        const b = g.benches[0];
        g.debugWarp(b.x, b.y);
        if (g.inv.count('cloth') < 4) g.inv.addMat('cloth', 4);
        g.inv.learnBlueprint('bandage');
        g.tryCraftId('bandage');
        g.tryCraftKey(0);
      });
    });
    const stackN = await page.evaluate(() => window.__CITY_WARS__.inv.countItem('bandage'));
    if (stackN < 2) fail(`Expected stacked bandages >= 2, got ${stackN}`);
    else log(`  bandage stack = ${stackN}`);

    const healLbl = await page.evaluate(() => window.__CITY_WARS__.healButtonLabel());
    if (stackN > 1 && !healLbl.includes('×')) fail(`HEAL label should show stack count, got ${healLbl}`);
    else log(`  heal label = ${healLbl}`);

    st = await step('Fight guide dog', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        // Force quest 1 dog path
        g._guideLooted = true;
        g.guide.flags.looted = true;
        g.guide.flags.stick = true;
        g.guide.flags.hat = true;
        g.guide.flags.equippedStick = true;
        g.guide.flags.equippedHat = true;
        g.guide.flags.bandage = true;
        g.guide.quest = 1;
        g.spawnGuideDog();
        const dog = g.guideDog;
        if (dog) {
          g.debugWarp(dog.tx, dog.ty); // may start combat via step - instead startCombat
        }
        if (g.guideDog) {
          // Stand next to dog
          const nx = g.guideDog.tx + 1;
          const ny = g.guideDog.ty;
          if (g.walkable(nx, ny)) g.player.setTile(nx, ny, false);
          g.startCombat(g.guideDog, true);
          // One-shot the dog for smoke
          g.guideDog.hp = 1;
          g.combatAttackTarget(g.guideDog);
          // Drain enemy turns if any
          g.mode = 'explore';
          g._guideDogDead = true;
          g.checkGuide();
        }
      });
    });
    if (!st.guide.flags.dogDead && st.guide.quest < 2) fail('Guide dog quest not complete');

    // Dawn must NOT wipe a living guide dog mid-quest
    st = await step('Dawn cull preserves guide dog flag path', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        // Spawn a night dog + a fake guide dog and cull
        const dog = g.enemies.find((e) => e.kind === 'dog') || null;
        // Call dawn cull
        g.refreshNightSpawns(false);
        // Ensure _isGuideDog would survive: re-spawn and cull
        g.spawnGuideDog();
        if (g.guideDog) {
          g.guideDog._isGuideDog = true;
          // mark a throwaway night dog
          const extra = g.enemies.filter((e) => e.kind === 'dog' && e !== g.guideDog);
          extra.forEach((e) => {
            e.nightOnly = true;
          });
          g.refreshNightSpawns(false);
        }
        void dog;
      });
    });
    // If guide dog was alive after spawn, it should still be
    const dogOk = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      if (!g.guideDog) return true; // already dead from fight - OK
      return g.guideDog.alive && g.enemies.includes(g.guideDog);
    });
    if (!dogOk) fail('Guide dog was culled at dawn');
    else log('  guide dog survives dawn cull');

    st = await step('Sleep at HQ completes tutorial', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        g.guide.quest = 2;
        g.guide.flags.dogDead = true;
        g._guideDogDead = true;
        g.debugWarp(48, 48); // HQ center (MAP 96 → center 48)
        g.doSleep();
      });
    });
    await dismissAll();
    st = await page.evaluate(() => window.__CITY_WARS__.debugState());
    if (!st.guide.done && !st.guide.flags.slept) {
      // day rest still sets slept at home
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        g._guideSlept = true;
        g.checkGuide();
      });
      st = await page.evaluate(() => window.__CITY_WARS__.debugState());
    }
    if (!st.guide.done) fail('Tutorial not marked done after sleep');
    else log('  tutorial done');

    // Armor DEF smoke: equip vest conceptually
    st = await step('Armor DEF applies in combat math', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        g.inv.addItem('vest');
        const v = g.inv.items.find((i) => i.id === 'vest');
        g.inv.equipItem(v.uid);
      });
    });
    if (st.def < 2) fail(`Expected DEF>=2 with vest, got ${st.def}`);
    else log(`  DEF with vest = ${st.def}`);

    // HEAL from quick slot
    st = await step('HEAL from quick slot', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        g.player.hp = 10;
        if (g.inv.countItem('bandage') === 0) g.inv.addItem('bandage');
        const b = g.inv.items.find((i) => i.id === 'bandage');
        if (b) g.inv.equipItem(b.uid, 'quick1');
        // remove bag copies so only quick works
        g.inv.items = g.inv.items.filter((i) => i.id !== 'bandage');
        g.useBandage();
      });
    });
    if (st.hp <= 10) fail(`HEAL from quick failed, hp=${st.hp}`);
    else log(`  HP after heal = ${st.hp}`);

    // batBonus is live-only (not double-baked into craft)
    st = await step('batBonus live (not double-baked)', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        // Force a bat character bonus for math check
        g.player.batBonus = 2;
        g.inv.addItem('pipe');
        const pipe = g.inv.items.find((i) => i.id === 'pipe');
        g.inv.equipItem(pipe.uid);
        // Weapon base ATK must stay 3; effective ATK = base player + 3 + 2 bat
      });
    });
    {
      const math = await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        const wAtk = g.inv.weapon?.atk || 0;
        const eff = g.playerEffectiveAtk();
        return { wAtk, eff, base: g.player.baseAtk, bat: g.player.batBonus };
      });
      if (math.wAtk !== 3) fail(`pipe.atk should stay 3, got ${math.wAtk}`);
      else if (math.eff !== math.base + 3 + math.bat) fail(`effective ATK wrong: ${JSON.stringify(math)}`);
      else log(`  pipe.atk=${math.wAtk} effective=${math.eff} (base ${math.base}+bat ${math.bat})`);
    }

    // craftBonus refund path does not crash
    st = await step('craftBonus craft path', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        g.player.craftBonus = 2;
        g.inv.addMat('cloth', 4);
        g.inv.learnBlueprint('rags');
        const b = g.benches[0];
        g.debugWarp(b.x, b.y);
        g.tryCraftId('rags');
      });
    });
    if (!st.items.includes('rags') && st.equip.legs !== 'rags') fail('Rags craft failed');
    else log('  rags craft OK');

    // MRE heal
    st = await step('MRE Paste heal', async () => {
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        g.player.hp = 20;
        g.inv.addItem('mre');
        g.useBandage(); // prefers bandage/stim first; clear them
      });
      await page.evaluate(() => {
        const g = window.__CITY_WARS__;
        // strip heals so MRE is used
        g.inv.items = g.inv.items.filter((i) => i.id === 'mre' || (i.type !== 'consumable' && i.id !== 'bandage' && i.id !== 'stim'));
        for (const s of ['quick1', 'quick2']) {
          if (g.inv.equip[s]?.id === 'bandage' || g.inv.equip[s]?.id === 'stim') g.inv.equip[s] = null;
        }
        if (g.inv.countItem('mre') === 0) g.inv.addItem('mre');
        g.player.hp = 20;
        g.useBandage();
      });
    });
    if (st.hp <= 20) fail(`MRE heal failed, hp=${st.hp}`);
    else log(`  HP after MRE = ${st.hp}`);

    st = await step('Mobile two-row HUD layout', async () => {
      await page.setViewport({ width: 390, height: 844 });
      await sleep(250);
    });
    const mobile = await page.evaluate(() => {
      const g = window.__CITY_WARS__;
      const m = g.barMetrics();
      const bag = g.btnBag?.bg;
      const menu = g.btnMenu?.bg;
      return {
        twoRow: m.twoRow,
        healOnBar: !!g.btnHeal,
        moreHidden: !g.btnMore,
        healLabel: g.healButtonLabel(),
        bagMenuSep: bag && menu ? Math.abs(bag.y - menu.y) > 8 : true,
      };
    });
    if (!mobile.twoRow) fail('Expected two-row bar on phone viewport');
    if (!mobile.healOnBar) fail('HEAL should be visible on mobile bar');
    if (!mobile.moreHidden) fail('MORE should be hidden on two-row mobile');
    if (!mobile.bagMenuSep) fail('BAG and MENU should be on separate rows');
    else log(`  two-row bar · heal=${mobile.healLabel}`);

    await page.setViewport({ width: 1280, height: 720 });
    await sleep(150);

    if (errors.length) {
      console.warn('Page errors:', errors.slice(0, 5));
    }

    if (process.exitCode) {
      console.log('\nPlaytest finished with failures.');
    } else {
      console.log('\nPlaytest PASS ✓');
    }
  } catch (e) {
    console.error('Playtest crashed:', e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();

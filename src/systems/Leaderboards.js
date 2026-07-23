/**
 * Local best-plays board (no backend).
 *
 * City Wars is not a timed run — day/night is a world cycle.
 * Boards track escape skill: kills, crafts, speed, survival, heat.
 * Migrates older city_wars_legacy_v1 data on first read.
 */
const KEY = 'city_wars_boards_v2';
const LEGACY_KEY = 'city_wars_legacy_v1';

const EMPTY_BEST = () => ({
  value: null,
  runner: '',
  at: 0,
  extra: null,
});

const DEFAULT = () => ({
  v: 2,
  escapes: 0,
  deaths: 0,
  best: {
    kills: EMPTY_BEST(), // highest kills in one run
    crafts: EMPTY_BEST(), // most items crafted in one run
    fastestDays: EMPTY_BEST(), // fewest in-game days to escape (lower better)
    fastestMs: EMPTY_BEST(), // wall-clock ms to escape (lower better)
    longestDays: EMPTY_BEST(), // most days survived (any end)
    peakHeat: EMPTY_BEST(), // highest heat on a successful escape
  },
  recent: [], // last ~12 run summaries
});

function isBetterHigh(prev, next) {
  if (next == null || Number.isNaN(next)) return false;
  if (prev == null || prev.value == null) return true;
  return next > prev.value;
}

function isBetterLow(prev, next) {
  if (next == null || Number.isNaN(next) || next < 0) return false;
  if (prev == null || prev.value == null) return true;
  return next < prev.value;
}

function slot(value, runner, extra = null) {
  return { value, runner: runner || '', at: Date.now(), extra };
}

export class Leaderboards {
  static load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = { ...DEFAULT(), ...JSON.parse(raw) };
        data.best = { ...DEFAULT().best, ...(data.best || {}) };
        return data;
      }
      return this._migrateLegacy();
    } catch {
      return DEFAULT();
    }
  }

  static _migrateLegacy() {
    const base = DEFAULT();
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return base;
      const leg = JSON.parse(raw);
      base.escapes = leg.escapes || 0;
      base.deaths = leg.deaths || 0;
      if (leg.bestKills) base.best.kills = slot(leg.bestKills, leg.lastRunner || '');
      if (leg.bestDays) base.best.longestDays = slot(leg.bestDays, leg.lastRunner || '');
      if (leg.lastHeat != null) base.best.peakHeat = slot(leg.lastHeat, leg.lastRunner || '');
      this.save(base);
      return base;
    } catch {
      return base;
    }
  }

  static save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      // Keep legacy key in sync so old summary readers still work if any remain
      localStorage.setItem(
        LEGACY_KEY,
        JSON.stringify({
          escapes: data.escapes,
          deaths: data.deaths,
          bestDays: data.best?.longestDays?.value || 0,
          bestKills: data.best?.kills?.value || 0,
          lastEscape: data.recent?.[0]?.at || null,
          lastRunner: data.recent?.[0]?.runner || null,
          lastHeat: data.best?.peakHeat?.value || 0,
        })
      );
    } catch {
      /* ignore quota */
    }
  }

  /**
   * @param {{
   *   won: boolean,
   *   days?: number,
   *   kills?: number,
   *   crafts?: number,
   *   heat?: number,
   *   runner?: string,
   *   durationMs?: number,
   * }} run
   */
  static recordRun(run) {
    const b = this.load();
    const days = run.days || 1;
    const kills = run.kills || 0;
    const crafts = run.crafts || 0;
    const heat = Math.round(run.heat || 0);
    const runner = run.runner || '';
    const ms = run.durationMs > 0 ? run.durationMs : null;

    if (run.won) b.escapes += 1;
    else b.deaths += 1;

    if (isBetterHigh(b.best.kills, kills)) b.best.kills = slot(kills, runner);
    if (isBetterHigh(b.best.crafts, crafts)) b.best.crafts = slot(crafts, runner);
    if (isBetterHigh(b.best.longestDays, days)) b.best.longestDays = slot(days, runner);

    if (run.won) {
      if (isBetterLow(b.best.fastestDays, days)) b.best.fastestDays = slot(days, runner);
      if (ms != null && isBetterLow(b.best.fastestMs, ms)) b.best.fastestMs = slot(ms, runner);
      if (isBetterHigh(b.best.peakHeat, heat)) b.best.peakHeat = slot(heat, runner);
    }

    b.recent.unshift({
      won: !!run.won,
      days,
      kills,
      crafts,
      heat,
      runner,
      durationMs: ms,
      at: Date.now(),
    });
    b.recent = b.recent.slice(0, 12);
    this.save(b);
    return b;
  }

  /** Back-compat for older call sites. */
  static recordEscape(opts = {}) {
    return this.recordRun({ won: true, ...opts });
  }

  static recordDeath(opts = {}) {
    return this.recordRun({ won: false, ...opts });
  }

  static summaryLine() {
    const l = this.load();
    if (!l.escapes && !l.deaths) return 'No runs logged yet. Break the grid once.';
    const parts = [];
    if (l.escapes) parts.push(`${l.escapes} escape${l.escapes === 1 ? '' : 's'}`);
    if (l.deaths) parts.push(`${l.deaths} KIA`);
    if (l.best?.kills?.value) parts.push(`best kills ${l.best.kills.value}`);
    if (l.best?.fastestDays?.value != null) parts.push(`fastest day ${l.best.fastestDays.value}`);
    return parts.join(' · ');
  }

  static formatMs(ms) {
    if (ms == null || ms < 0) return '—';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m < 60) return `${m}m ${r}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  /** Rows for the LEADERBOARDS panel. */
  static boardRows() {
    const l = this.load();
    const b = l.best;
    const line = (label, entry, fmt = (v) => String(v)) => {
      if (!entry || entry.value == null) return { label, value: '—', runner: '' };
      return {
        label,
        value: fmt(entry.value),
        runner: entry.runner || '',
      };
    };
    return {
      totals: { escapes: l.escapes, deaths: l.deaths },
      rows: [
        line('Most kills (one run)', b.kills),
        line('Most crafts (one run)', b.crafts),
        line('Fastest escape (days)', b.fastestDays, (v) => `Day ${v}`),
        line('Fastest escape (clock)', b.fastestMs, (v) => this.formatMs(v)),
        line('Longest survival (days)', b.longestDays, (v) => `Day ${v}`),
        line('Hottest escape (heat)', b.peakHeat),
      ],
      recent: l.recent || [],
    };
  }
}

// Alias so existing imports keep working if any still use RunLegacy name via re-export
export { Leaderboards as RunLegacy };

/**
 * Lightweight meta between runs (localStorage, no backend).
 */
const KEY = 'city_wars_legacy_v1';

const DEFAULT = {
  escapes: 0,
  deaths: 0,
  bestDays: 0,
  bestKills: 0,
  lastEscape: null,
  lastRunner: null,
};

export class RunLegacy {
  static load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULT };
      return { ...DEFAULT, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT };
    }
  }

  static save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  static recordEscape({ days = 1, kills = 0, heat = 0, runner = '' } = {}) {
    const leg = this.load();
    leg.escapes += 1;
    leg.bestDays = Math.max(leg.bestDays, days);
    leg.bestKills = Math.max(leg.bestKills, kills);
    leg.lastEscape = Date.now();
    leg.lastRunner = runner;
    leg.lastHeat = heat;
    this.save(leg);
    return leg;
  }

  static recordDeath({ days = 1, kills = 0 } = {}) {
    const leg = this.load();
    leg.deaths += 1;
    leg.bestKills = Math.max(leg.bestKills, kills);
    this.save(leg);
    return leg;
  }

  static summaryLine() {
    const l = this.load();
    if (!l.escapes && !l.deaths) return 'No runs logged yet. Break the grid once.';
    const parts = [];
    if (l.escapes) parts.push(`${l.escapes} escape${l.escapes === 1 ? '' : 's'}`);
    if (l.deaths) parts.push(`${l.deaths} KIA`);
    if (l.bestDays) parts.push(`best day ${l.bestDays}`);
    return parts.join(' · ');
  }
}

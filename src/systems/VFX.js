import Phaser from 'phaser';

/** World VFX — requires local Phaser import (not global). */
export class VFX {
  constructor(scene) {
    this.scene = scene;
  }

  floatText(x, y, text, color = '#fff', size = 16) {
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(80);
    this.scene.tweens.add({
      targets: t,
      y: y - 36,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  burst(x, y, color = 0xffffff, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      const p = this.scene.add.circle(x, y, 3, color, 1).setDepth(70);
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(a) * Phaser.Math.Between(18, 40),
        y: y + Math.sin(a) * Phaser.Math.Between(18, 40),
        alpha: 0,
        duration: 280,
        onComplete: () => p.destroy(),
      });
    }
  }

  slash(x1, y1, x2, y2, color = 0xffffff) {
    const g = this.scene.add.graphics().setDepth(75);
    g.lineStyle(3, color, 0.9);
    g.lineBetween(x1, y1, x2, y2);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 180,
      onComplete: () => g.destroy(),
    });
  }

  pulseRing(x, y, color = 0x38bdf8) {
    const c = this.scene.add.circle(x, y, 8, color, 0).setStrokeStyle(2, color, 1).setDepth(60);
    this.scene.tweens.add({
      targets: c,
      scale: 3,
      alpha: 0,
      duration: 350,
      onComplete: () => c.destroy(),
    });
  }

  screenShake(intensity = 0.006, duration = 120) {
    this.scene.cameras?.main?.shake(duration, intensity);
  }

  /** Horizontal scan across the north Wall district. */
  wallScan(yWorld, color = 0x38bdf8) {
    const g = this.scene.add.graphics().setDepth(90);
    const w = this.scene.scale.width * 2;
    g.fillStyle(color, 0.35);
    g.fillRect(0, yWorld - 2, w, 4);
    g.fillStyle(color, 0.12);
    g.fillRect(0, yWorld - 12, w, 24);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  escapeFlash(x, y) {
    const ring = this.scene.add.circle(x, y, 6, 0xfbbf24, 0).setStrokeStyle(4, 0xfbbf24, 1).setDepth(95);
    this.scene.tweens.add({
      targets: ring,
      scale: 12,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.burst(x, y, 0x38bdf8, 16);
    this.burst(x, y, 0xfbbf24, 10);
    this.screenShake(0.012, 280);
  }

  /** Pulsing screen-edge tint when grid heat is high. */
  heatVignette(level, pulse = 1) {
    const g = this.scene.heatVignette;
    if (!g) return;
    if (level < 60) {
      g.clear();
      g.setAlpha(0);
      return;
    }
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const border = level >= 85 ? 18 : level >= 75 ? 14 : 10;
    const base = level >= 85 ? 0.28 : level >= 75 ? 0.2 : 0.1;
    const alpha = base * pulse;
    const col = level >= 85 ? 0xef4444 : 0xf97316;
    g.clear();
    g.fillStyle(col, alpha);
    g.fillRect(0, 0, w, border);
    g.fillRect(0, h - border, w, border);
    g.fillRect(0, 0, border, h);
    g.fillRect(w - border, 0, border, h);
    g.setAlpha(1);
  }

  heatSweepFlash() {
    this.screenShake(0.006, 140);
    const cx = this.scene.scale.width / 2;
    const cy = this.scene.scale.height / 2 - 40;
    this.floatText(cx, cy, 'GRID SWEEP', '#f97316', 22);
  }
}

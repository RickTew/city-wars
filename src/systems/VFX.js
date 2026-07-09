import Phaser from 'phaser';

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
}

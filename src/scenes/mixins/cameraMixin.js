/** Camera free-look / edge-pan (mixin). No auto-follow — camera stays where you put it. */
import Phaser from 'phaser';
import { WORLD_H, WORLD_W } from '../../config/constants.js';

export const cameraMixin = {
  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.stopFollow();
    cam.centerOn(this.player.x, this.player.y);
    cam.setRoundPixels(true);
    cam.setZoom(1);
    this.camFollowPlayer = false;
    this.edgePan = { margin: 32, speed: 480 };
    this._edgePanIdle = 0;
  },

  /** One-time center (load / warp). Does not enable follow. */
  snapCameraToPlayer() {
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.centerOn(this.player.x, this.player.y);
    this.clampCamScroll();
    this.camFollowPlayer = false;
    this._midDrag = null;
    this._touchDrag = null;
  },

  /** @deprecated No-op — camera no longer auto-follows the player. */
  relockCameraToPlayer() {
    /* kept for call-site compat */
  },

  beginFreeCam() {
    const cam = this.cameras.main;
    if (this.camFollowPlayer) {
      cam.stopFollow();
      this.camFollowPlayer = false;
    }
  },

  clampCamScroll() {
    const cam = this.cameras.main;
    const maxX = Math.max(0, WORLD_W - cam.width / cam.zoom);
    const maxY = Math.max(0, WORLD_H - cam.height / cam.zoom);
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, maxX);
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, maxY);
  },

  updateCameraEdgePan(dt) {
    if (this.ended || this.isPaused() || this.mode === 'combat') return;
    if (this._midDrag || this._touchDrag) return;

    const cam = this.cameras.main;
    const p = this.input.activePointer;
    if (!p) return;

    const m = this.edgePan.margin;
    const topHud = this.isMobileHud?.() ? 84 : 56;
    const botHud = this.barMetrics?.().hudBottom ?? 90;
    let dx = 0;
    let dy = 0;
    if (p.x >= 0 && p.x <= this.scale.width && p.y >= 0 && p.y <= this.scale.height) {
      if (p.x < m) dx = -1;
      else if (p.x > this.scale.width - m) dx = 1;
      if (p.y > topHud && p.y < topHud + m) dy = -1;
      else if (p.y < this.scale.height - botHud && p.y > this.scale.height - botHud - m) dy = 1;
    }

    if (dx || dy) {
      this.beginFreeCam();
      const sp = this.edgePan.speed * dt;
      cam.scrollX += dx * sp;
      cam.scrollY += dy * sp;
      this.clampCamScroll();
    }
  },
};

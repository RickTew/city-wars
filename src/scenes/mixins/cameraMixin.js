/** Camera free-look / edge-pan (mixin). */
import Phaser from 'phaser';
import { WORLD_H, WORLD_W } from '../../config/constants.js';

export const cameraMixin = {
  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player.asFollowTarget(), true, 0.15, 0.15);
    cam.setDeadzone(this.scale.width * 0.2, this.scale.height * 0.18);
    cam.setRoundPixels(true);
    cam.setZoom(1);
    this.camFollowPlayer = true;
    // Edge-of-screen mouse pan (look ahead without moving)
    this.edgePan = { margin: 32, speed: 480, idleRelock: 1.6 };
    this._edgePanIdle = 0;
  },

/** Re-attach camera to player after free look / edge pan. */
  relockCameraToPlayer() {
    if (this.camFollowPlayer) return;
    const cam = this.cameras.main;
    cam.startFollow(this.player.asFollowTarget(), true, 0.22, 0.22);
    cam.setDeadzone(this.scale.width * 0.2, this.scale.height * 0.18);
    this.camFollowPlayer = true;
    this._edgePanIdle = 0;
    this._midDrag = null;
  },

/** Stop follow and clamp scroll when free-looking. */
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

/**
   * When the mouse sits near the screen edge, pan the camera so you can
   * peek at objectives / terrain. Relocks to the player after idle or move.
   * Middle-mouse drag also free-pans (see setupInput).
   */
  updateCameraEdgePan(dt) {
    if (this.ended || this.isPaused() || this.mode === 'combat') return;
    // Middle-drag owns camera this frame
    if (this._midDrag) {
      this._edgePanIdle = 0;
      return;
    }
    const cam = this.cameras.main;
    const p = this.input.activePointer;
    if (!p) return;

    const m = this.edgePan.margin;
    const topHud = 56;
    const botHud = 90;
    let dx = 0;
    let dy = 0;
    // Only pan when pointer is over the game canvas
    if (p.x >= 0 && p.x <= this.scale.width && p.y >= 0 && p.y <= this.scale.height) {
      if (p.x < m) dx = -1;
      else if (p.x > this.scale.width - m) dx = 1;
      if (p.y > topHud && p.y < topHud + m) dy = -1;
      else if (p.y < this.scale.height - botHud && p.y > this.scale.height - botHud - m) dy = 1;
      // pure edges of window (including over HUD strip edges for L/R)
      if (p.y < m && p.y >= 0) dy = -1;
      if (p.y > this.scale.height - m) dy = 1;
    }

    if (dx || dy) {
      this.beginFreeCam();
      const sp = this.edgePan.speed * dt;
      cam.scrollX += dx * sp;
      cam.scrollY += dy * sp;
      this.clampCamScroll();
      this._edgePanIdle = 0;
    } else if (!this.camFollowPlayer) {
      this._edgePanIdle = (this._edgePanIdle || 0) + dt;
      if (this._edgePanIdle >= this.edgePan.idleRelock) {
        this.relockCameraToPlayer();
      }
    }
  },
};

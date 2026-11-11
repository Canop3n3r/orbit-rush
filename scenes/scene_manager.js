// One active scene. The game calls enter when the player changes where they are,
// exit when they leave, and tick once per frame. Scenes are plain objects
// { enter, exit, tick }. This file does not touch the page.

export class SceneManager {
  constructor() {
    this.active = null;
    this.name = null;
  }
  enter(name, scene) {
    if (this.active === scene) return this;
    if (this.active && this.active.exit) this.active.exit();
    this.active = scene || null;
    this.name = name;
    if (this.active && this.active.enter) this.active.enter();
    return this;
  }
  exit() {
    if (this.active && this.active.exit) this.active.exit();
    this.active = null;
    this.name = null;
    return this;
  }
  tick(dt) {
    if (this.active && this.active.tick) this.active.tick(dt);
  }
}

import { GameEngine, GROUND } from "./engine.js";

const palette = {
  sky: "#1a2527",
  far: "#202f31",
  middle: "#253638",
  near: "#304345",
  edge: "#151e20",
  root: "#3b4340",
  floor: "#292d28",
  moss: "#78806a",
  amber: "#f3bc66",
  cream: "#f5e9ca",
  fur: "#c99560",
  furLight: "#e0b47a",
  teal: "#7db6a5",
};

export class Renderer {
  reducedMotion = false;
  private context: CanvasRenderingContext2D;
  private width = 1100;
  private canvas: HTMLCanvasElement;
  private game: GameEngine;
  constructor(canvas: HTMLCanvasElement, game: GameEngine) {
    this.canvas = canvas;
    this.game = game;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas is unavailable.");
    this.context = context;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.game.width = Math.max(420, (rect.width / rect.height) * 500);
    this.draw();
  }
  private ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    color: string,
    angle = 0,
  ) {
    const ctx = this.context;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  private path(points: number[][], color: string) {
    const ctx = this.context;
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) =>
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
    );
    ctx.closePath();
    ctx.fill();
  }
  draw() {
    const ctx = this.context;
    const game = this.game;
    const w = game.width;
    // Anchor a uniformly scaled scene to the bottom. Tall text layouts leave
    // quiet sky above the artwork instead of stretching the character.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const scale = Math.min(this.canvas.width / w, this.canvas.height / 500);
    ctx.setTransform(scale, 0, 0, scale, 0, this.canvas.height - 500 * scale);
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, w, 500);
    ctx.save();
    if (!this.reducedMotion && game.quakeTime > 0) {
      const amount = Math.min(1, game.quakeTime) * 2.1;
      ctx.translate(
        Math.sin(game.quakeTime * 46) * amount,
        Math.cos(game.quakeTime * 55) * amount,
      );
    }
    const offset = this.reducedMotion ? 0 : game.offset;
    this.cave(w, offset);
    this.ground(w, game.offset);

    if (game.phase === "ready") {
      const mobile = window.matchMedia("(max-width: 40rem)").matches;
      const x = w * (mobile ? 0.63 : 0.77);
      const scale = mobile ? 1.2 : 2.15;
      this.wheel(x - 8, GROUND - scale * 45, scale * 64, 0);
      this.hamster(x + 3, GROUND - 7, scale, 0, false, false);
      this.mushrooms(x - scale * 100, GROUND + 5, scale * 0.8);
      this.mushrooms(x + scale * 75, GROUND + 5, scale * 0.5);
    } else {
      for (const hazard of game.hazards) {
        if (hazard.type === "rock") this.rock(hazard.x, GROUND, hazard.width);
        else this.hangingRoot(hazard.x, GROUND);
      }
      this.hamster(
        game.playerX,
        GROUND - game.jumpHeight,
        0.82,
        game.elapsed,
        game.sliding,
        game.phase === "running" && game.jumpHeight === 0,
      );
    }
    // Settlements are decorative; debris never enters the collision collection.
    if (!this.reducedMotion && game.quakeTime > 0) {
      const t = 1.2 - game.quakeTime;
      ctx.globalAlpha = Math.min(1, game.quakeTime * 2);
      for (let i = 0; i < 24; i++) {
        const x =
          ((i * 131 + game.quakeCount * 17) % w) + Math.sin(i + t * 3) * 9;
        const y = 40 + (i % 4) * 36 + t * (95 + (i % 3) * 45);
        this.path(
          [
            [x, y],
            [x + 5, y - 3],
            [x + 8, y + 3],
            [x + 2, y + 5],
          ],
          "#bda482",
        );
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  private cave(w: number, offset: number) {
    const ctx = this.context;
    // Hand-built, layered rock silhouettes; scenery wraps independently of hazards.
    for (let layer = 0; layer < 3; layer++) {
      const period = 450 + layer * 140;
      const shift = (offset * (0.08 + layer * 0.1)) % period;
      const colors = [palette.far, palette.middle, palette.near];
      for (let i = -1; i < w / period + 2; i++) {
        const x = i * period - shift;
        const y = 95 + layer * 40;
        ctx.fillStyle = colors[layer];
        ctx.beginPath();
        ctx.moveTo(x - 50, 420);
        ctx.lineTo(x - 50, y + 200);
        ctx.bezierCurveTo(x + 50, y + 190, x + 40, y + 40, x + 145, y + 30);
        ctx.bezierCurveTo(x + 230, y - 45, x + 190, y + 180, x + 285, y + 145);
        ctx.bezierCurveTo(
          x + 330,
          y + 125,
          x + 340,
          y + 200,
          x + period + 10,
          y + 185,
        );
        ctx.lineTo(x + period + 10, 420);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Quiet archways and a weathered wheel suggest a place rather than a flat backdrop.
    for (let i = -1; i < w / 570 + 1; i++) {
      const x = i * 570 + 350 - ((offset * 0.12) % 570);
      ctx.strokeStyle = "#405052";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.38;
      ctx.beginPath();
      ctx.ellipse(x, 299, 69, 105, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 69, 299);
      ctx.lineTo(x - 69, 378);
      ctx.moveTo(x + 69, 299);
      ctx.lineTo(x + 69, 378);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    this.path(
      [
        [0, 0],
        [w, 0],
        [w, 82],
        [w - 40, 69],
        [w - 90, 106],
        [w - 135, 72],
        [w - 160, 119],
        [w - 200, 65],
        [w * 0.61, 44],
        [w * 0.46, 56],
        [w * 0.3, 27],
        [w * 0.19, 61],
        [85, 91],
        [49, 132],
        [29, 73],
        [0, 96],
      ],
      palette.edge,
    );
    ctx.strokeStyle = "#485044";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const x = 60 + (i * (w - 90)) / 5;
      ctx.beginPath();
      ctx.moveTo(x, 35);
      ctx.bezierCurveTo(x - 17, 76, x + 12, 81, x - 15, 118 + (i % 2) * 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 3, 84);
      ctx.quadraticCurveTo(x + 14, 95, x + 21, 91);
      ctx.stroke();
      this.ellipse(x - 8, 116 + (i % 2) * 18, 5, 10, "#43523d", 0.6);
    }
    for (let i = 0; i < 28; i++) {
      const x =
        (i * 137.7 + 30 - ((offset * 0.17) % (w + 60)) + w * 5) % (w + 60);
      const y = 105 + ((i * 67.3) % 235);
      // Keep bright fireflies away from the ready screen's text.
      if (this.game.phase === "ready" && y < 280) continue;
      const size = i % 5 === 0 ? 2 : 1;
      ctx.globalAlpha = 0.24 + (i % 4) * 0.14;
      this.ellipse(x, y, size, size, palette.amber);
    }
    ctx.globalAlpha = 1;
    // The hero text's side of the cave stays calm and dark.
    if (this.game.phase === "ready" && this.width >= 620) {
      const shade = ctx.createLinearGradient(0, 0, w * 0.7, 0);
      shade.addColorStop(0, "#182124");
      shade.addColorStop(0.7, "#182124e8");
      shade.addColorStop(1, "#18212400");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 90, w * 0.7, 290);
    }
  }
  private ground(w: number, offset: number) {
    const ctx = this.context;
    ctx.fillStyle = palette.floor;
    ctx.fillRect(0, GROUND + 3, w, 110);
    const points = [[0, GROUND + 5]];
    for (let x = 0; x <= w + 20; x += 20)
      points.push([x, GROUND + 2 + Math.sin((x + offset * 0.3) * 0.06) * 3]);
    points.push([w + 20, GROUND + 13], [0, GROUND + 13]);
    this.path(points, palette.moss);
    ctx.fillStyle = "#494b3d";
    ctx.fillRect(0, GROUND + 13, w, 3);
    for (let i = -1; i < w / 130 + 1; i++) {
      const x = i * 130 - (offset % 130);
      this.ellipse(x + 35, GROUND + 29 + (i % 3) * 9, 4, 2, "#515044");
      this.ellipse(x + 85, GROUND + 63, 2, 2, "#494a40");
      ctx.strokeStyle = "#535746";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 20, GROUND + 3);
      ctx.lineTo(x + 16, GROUND - 8);
      ctx.moveTo(x + 20, GROUND + 3);
      ctx.lineTo(x + 25, GROUND - 5);
      ctx.stroke();
    }
    const foreground = ctx.createLinearGradient(0, 440, 0, 500);
    foreground.addColorStop(0, "#191f1f00");
    foreground.addColorStop(1, "#161c1d");
    ctx.fillStyle = foreground;
    ctx.fillRect(0, 440, w, 60);
    for (let i = 0; i < w / 400 + 1; i++) {
      const x = i * 400 + 270 - ((offset * 0.6) % 400);
      this.mushrooms(x, GROUND + 6, 0.62);
    }
  }
  private wheel(x: number, y: number, r: number, angle: number) {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = "#686a4f";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#93906a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#515b4c";
    ctx.lineWidth = 4;
    for (let i = 0; i < 10; i++) {
      ctx.rotate(Math.PI / 5);
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(0, r - 6);
      ctx.stroke();
    }
    this.ellipse(0, 0, 12, 12, "#a3956b");
    ctx.restore();
  }
  private hamster(
    x: number,
    y: number,
    scale: number,
    time: number,
    slide: boolean,
    running: boolean,
  ) {
    const ctx = this.context;
    this.ellipse(x + 1, GROUND + 4, 32 * scale, 5 * scale, "#18202070");
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (slide) {
      ctx.scale(1.3, 0.48);
      ctx.translate(5, 0);
    }
    const step = running ? Math.sin(time * 23) * 9 : 0;
    ctx.translate(
      0,
      running && !this.reducedMotion ? Math.abs(Math.sin(time * 23)) * -2 : 0,
    );
    this.ellipse(-29, -22, 10, 7, palette.furLight, -0.2);
    this.ellipse(-17 - step, -4, 14, 7, "#b27e50", 0.2);
    this.ellipse(20 + step, -5, 15, 7, "#e0ae77", -0.1);
    this.ellipse(-3, -39, 35, 38, palette.fur);
    this.ellipse(8, -34, 27, 32, palette.cream, -0.1);
    this.ellipse(-3, -75, 17, 20, "#bf875b", -0.3);
    this.ellipse(-3, -76, 10, 12, "#d69c87", -0.3);
    this.ellipse(29, -76, 14, 16, "#d9a971", 0.1);
    this.ellipse(29, -76, 8, 10, "#dfa58d", 0.1);
    this.ellipse(15, -57, 34, 29, palette.furLight, -0.08);
    this.ellipse(29, -46, 23, 17, palette.cream, -0.1);
    this.ellipse(29, -59, 4.3, 5.5, "#252a27");
    this.ellipse(30, -61, 1.2, 1.6, "#fff6dd");
    this.ellipse(17, -45, 7, 4, "#d79a7c", -0.15);
    this.ellipse(50, -49, 4, 3.4, "#634b40", -0.15);
    ctx.strokeStyle = "#775747";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(45, -45);
    ctx.quadraticCurveTo(43, -40, 39, -43);
    ctx.stroke();
    ctx.strokeStyle = "#d7c5a0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(44, -45);
    ctx.lineTo(60, -43);
    ctx.moveTo(43, -42);
    ctx.lineTo(56, -38);
    ctx.stroke();
    this.path(
      [
        [-13, -37],
        [23, -30],
        [17, -20],
        [-18, -30],
      ],
      palette.teal,
    );
    this.path(
      [
        [-12, -32],
        [-36, -36 + step * 0.3],
        [-30, -23],
        [-14, -26],
      ],
      "#598c7f",
    );
    this.ellipse(17, -20, 13, 6, palette.furLight, -0.45 + step * 0.025);
    ctx.restore();
  }
  private mushrooms(x: number, y: number, scale: number) {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = "#d7bb83";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-2, -15, 0, -24);
    ctx.moveTo(16, 0);
    ctx.lineTo(17, -14);
    ctx.stroke();
    this.ellipse(0, -24, 16, 5, "#e1af66");
    this.ellipse(17, -14, 10, 3, "#c29259");
    this.path(
      [
        [-16, -24],
        [-12, -33],
        [-4, -38],
        [4, -37],
        [12, -32],
        [16, -24],
      ],
      "#d4a05d",
    );
    this.path(
      [
        [7, -14],
        [11, -21],
        [19, -23],
        [25, -18],
        [27, -14],
      ],
      "#ac8050",
    );
    this.ellipse(-4, -32, 2, 1.4, "#f5d394");
    this.ellipse(5, -29, 2.5, 1.4, "#f5d394");
    ctx.restore();
  }
  private rock(x: number, y: number, width: number) {
    this.path(
      [
        [x - 4, y],
        [x + 2, y - 25],
        [x + 15, y - 43],
        [x + 31, y - 40],
        [x + width + 5, y - 20],
        [x + width + 6, y],
      ],
      "#84948b",
    );
    this.path(
      [
        [x + 2, y - 25],
        [x + 15, y - 43],
        [x + 22, y - 21],
        [x + 13, y - 6],
        [x - 4, y],
      ],
      "#a6afa0",
    );
    this.path(
      [
        [x + 22, y - 21],
        [x + 31, y - 40],
        [x + width + 5, y - 20],
        [x + width + 6, y],
        [x + 13, y - 6],
      ],
      "#63776f",
    );
    this.path(
      [
        [x + 2, y - 25],
        [x + 15, y - 43],
        [x + 31, y - 40],
        [x + 22, y - 33],
      ],
      "#c6c3a4",
    );
  }
  private hangingRoot(x: number, y: number) {
    const ctx = this.context;
    ctx.strokeStyle = "#8f7654";
    ctx.lineWidth = 13;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 25, y - 170);
    ctx.bezierCurveTo(x - 5, y - 130, x + 42, y - 90, x + 18, y - 42);
    ctx.stroke();
    ctx.strokeStyle = "#c3a16a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 21, y - 150);
    ctx.bezierCurveTo(x + 5, y - 118, x + 37, y - 88, x + 17, y - 44);
    ctx.stroke();
    ctx.strokeStyle = "#8f7654";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + 20, y - 87);
    ctx.lineTo(x + 42, y - 99);
    ctx.moveTo(x + 15, y - 118);
    ctx.lineTo(x - 2, y - 130);
    ctx.stroke();
    this.ellipse(x + 35, y - 103, 9, 4, "#7f9a69", -0.6);
    this.ellipse(x + 5, y - 127, 9, 4, "#7f9a69", 0.6);
  }
}

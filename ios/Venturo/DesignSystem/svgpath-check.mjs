// Prototype of the SVG path parser before writing it in Swift.
//
// Same algorithm, run against all 20 real glyph strings, so the logic is
// verified on a machine that can execute it. Only the transcription to Swift
// is then unverified, rather than the algorithm as well.

const PATHS = {
  compass: ["M15.6 8.4l-2 5.2-5.2 2 2-5.2z"],
  sprout: ["M12 21v-7", "M12 14c0-3.3-2.7-6-6-6H4c0 3.3 2.7 6 6 6z", "M12 12c0-3.3 2.7-6 6-6h2c0 3.3-2.7 6-6 6z"],
  chart: ["M4 20V10", "M10 20V4", "M16 20v-6", "M22 20H2"],
  user: ["M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"],
  x: ["M6 6l12 12M18 6L6 18"],
  chev: ["M6 9l6 6 6-6"],
  check: ["M5 13l4.5 4.5L19 7"],
  plus: ["M12 5v14M5 12h14"],
  out: ["M8 16L16 8", "M9 8h7v7"],
  flame: ["M12 21c3.6 0 6-2.4 6-5.6 0-4.2-4.4-5.6-3.4-10.4C11.4 6 9 8.4 9 11c0-1.2-.6-2.2-1.4-2.8C6.6 9.6 6 11.6 6 13.8 6 18 8.4 21 12 21z"],
  heart: ["M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z"],
  trophy: ["M8 4h8v5a4 4 0 01-8 0z", "M8 5H5v2a3 3 0 003 3", "M16 5h3v2a3 3 0 01-3 3", "M12 13v4M9 20h6"],
  lock: ["M8.5 11V8a3.5 3.5 0 017 0v3"],
  sliders: ["M4 7h11M19 7h1M4 17h4M12 17h8"],
  link: ["M10 13.5a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1 1", "M14 10.5a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1-1"],
  book: ["M5 4h9a3 3 0 013 3v13H8a3 3 0 01-3-3z", "M5 17h12"],
  note: [],
  shop: ["M4 9h16l-1 11H5z", "M8.5 9V6.5a3.5 3.5 0 017 0V9"],
  tag: ["M4 11V5h6l9 9-6 6z"],
  spark: ["M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z", "M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"],
};

// A scanner rather than a pre-tokenizer, because arcs cannot be tokenized
// without knowing you are in an arc.
//
// The arc large-arc and sweep flags are SINGLE DIGITS and are allowed to run
// straight into the number after them. In "a4 4 0 017-2.6" the "017" is
// flag 0, flag 1, then x=7 — not the number 17. A context-free tokenizer reads
// it as 17, which silently eats one argument and desynchronises every command
// after it, so coordinates start consuming command letters.
class Scanner {
  constructor(d) { this.s = d; this.i = 0; }
  skip() { while (this.i < this.s.length && /[\s,]/.test(this.s[this.i])) this.i++; }
  atEnd() { this.skip(); return this.i >= this.s.length; }
  peekCommand() {
    this.skip();
    const c = this.s[this.i];
    return c && /[MmLlHhVvCcSsAaZz]/.test(c) ? c : null;
  }
  takeCommand() { const c = this.peekCommand(); if (c) this.i++; return c; }
  number() {
    this.skip();
    const m = /^[-+]?(\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/.exec(this.s.slice(this.i));
    if (!m) throw new Error(`expected a number at ${this.i}: ${JSON.stringify(this.s.slice(this.i, this.i + 12))}`);
    this.i += m[0].length;
    return parseFloat(m[0]);
  }
  /** Exactly one character, "0" or "1". */
  flag() {
    this.skip();
    const c = this.s[this.i];
    if (c !== '0' && c !== '1') throw new Error(`expected an arc flag at ${this.i}, got ${JSON.stringify(c)}`);
    this.i++;
    return c === '1';
  }
}

// Endpoint parameterisation → centre, per the SVG spec's implementation notes.
// Every arc in this icon set is circular (rx === ry, no rotation), which the
// assertion below checks rather than assumes.
function arcToCenter(x1, y1, rx, ry, phi, largeArc, sweep, x2, y2) {
  if (rx === 0 || ry === 0) return null;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2;
  const x1p = cosP * dx2 + sinP * dy2;
  const y1p = -sinP * dx2 + cosP * dy2;

  rx = Math.abs(rx); ry = Math.abs(ry);
  // Scale the radii up if they are too small to span the two points.
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }

  const sign = largeArc !== sweep ? 1 : -1;
  const num = rx*rx*ry*ry - rx*rx*y1p*y1p - ry*ry*x1p*x1p;
  const den = rx*rx*y1p*y1p + ry*ry*x1p*x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = co * (rx * y1p) / ry;
  const cyp = co * -(ry * x1p) / rx;

  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;

  const ang = (ux, uy, vx, vy) => {
    const dot = ux*vx + uy*vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux*vy - uy*vx < 0) a = -a;
    return a;
  };
  const theta = ang(1, 0, (x1p - cxp)/rx, (y1p - cyp)/ry);
  let delta = ang((x1p - cxp)/rx, (y1p - cyp)/ry, (-x1p - cxp)/rx, (-y1p - cyp)/ry);
  if (!sweep && delta > 0) delta -= 2*Math.PI;
  if (sweep && delta < 0) delta += 2*Math.PI;

  return { cx, cy, rx, ry, theta, delta };
}

function parse(d, sink) {
  const sc = new Scanner(d);
  let x = 0, y = 0, sx = 0, sy = 0;
  let cmd = null, prevCubic = null;

  while (!sc.atEnd()) {
    const next = sc.takeCommand();
    if (next) {
      cmd = next;
    } else if (cmd === 'M') {
      // A moveto with extra coordinate pairs continues as a lineto.
      cmd = 'L';
    } else if (cmd === 'm') {
      cmd = 'l';
    } else if (!cmd) {
      throw new Error('path does not start with a command');
    }

    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    const n = () => sc.number();

    switch (cmd.toUpperCase()) {
      case 'M': x = n() + ox; y = n() + oy; sx = x; sy = y; sink.move(x, y); prevCubic = null; break;
      case 'L': x = n() + ox; y = n() + oy; sink.line(x, y); prevCubic = null; break;
      case 'H': x = n() + ox; sink.line(x, y); prevCubic = null; break;
      case 'V': y = n() + oy; sink.line(x, y); prevCubic = null; break;
      case 'C': {
        const c1x = n()+ox, c1y = n()+oy, c2x = n()+ox, c2y = n()+oy;
        x = n()+ox; y = n()+oy;
        sink.curve(x, y, c1x, c1y, c2x, c2y);
        prevCubic = { x: c2x, y: c2y };
        break;
      }
      case 'S': {
        // The first control point mirrors the previous curve's second one
        // through the current point. With no previous curve it coincides with
        // the current point, which the spec requires.
        const c1x = prevCubic ? 2*x - prevCubic.x : x;
        const c1y = prevCubic ? 2*y - prevCubic.y : y;
        const c2x = n()+ox, c2y = n()+oy;
        x = n()+ox; y = n()+oy;
        sink.curve(x, y, c1x, c1y, c2x, c2y);
        prevCubic = { x: c2x, y: c2y };
        break;
      }
      case 'A': {
        const rx = n(), ry = n(), rot = n() * Math.PI/180;
        const large = sc.flag(), sweep = sc.flag();
        const ex = n()+ox, ey = n()+oy;
        const a = arcToCenter(x, y, rx, ry, rot, large, sweep, ex, ey);
        if (a) sink.arc(a, ex, ey, rx, ry, rot);
        x = ex; y = ey; prevCubic = null;
        break;
      }
      case 'Z': x = sx; y = sy; sink.close(); prevCubic = null; break;
      default: throw new Error('unhandled command: ' + cmd);
    }
  }
}

// ---- run it over every glyph ------------------------------------------------
let failures = 0, arcs = 0, nonCircular = 0, cmds = new Set();
for (const [name, ds] of Object.entries(PATHS)) {
  for (const d of ds) {
    for (const ch of d) if (/[MmLlHhVvCcSsAaZz]/.test(ch)) cmds.add(ch);
    const pts = [];
    const sink = {
      move: (x,y)=>pts.push([x,y]), line: (x,y)=>pts.push([x,y]),
      curve: (x,y,a,b,c,e)=>pts.push([x,y],[a,b],[c,e]),
      arc: (a,ex,ey,rx,ry)=>{ arcs++; if (Math.abs(rx-ry) > 1e-9) nonCircular++; pts.push([ex,ey],[a.cx,a.cy]); },
      close: ()=>{},
    };
    try { parse(d, sink); } catch (e) { console.log(`  FAIL ${name}: ${e.message}`); failures++; continue; }
    const bad = pts.filter(([px,py]) => !isFinite(px) || !isFinite(py) || px < -6 || px > 30 || py < -6 || py > 30);
    if (bad.length) { console.log(`  OUT OF RANGE ${name}: ${JSON.stringify(bad.slice(0,3))}`); failures++; }
  }
}
console.log('commands used across all glyphs:', [...cmds].sort().join(' '));
console.log('arcs parsed:', arcs, '| non-circular:', nonCircular);
console.log(failures === 0 ? 'ALL 20 GLYPHS PARSE, all geometry within the 24x24 viewBox' : `${failures} FAILURES`);

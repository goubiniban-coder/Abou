import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Scène three.js du globe. Monté dans un conteneur, renvoie une fonction de nettoyage.

const GREEN = 0x15873b;
const GREEN_LIGHT = 0x4cc471;
const MINT = 0xc8ecb5;
const YELLOW = 0xfcd116;
const PLASTER = 0xf3f5f2;

/** Générateur pseudo-aléatoire déterministe : le labyrinthe et les billes restent les mêmes à chaque visite. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Texture équirectangulaire de la sphère : calotte blanche, ceinture labyrinthe, bas teinté vert tendre. */
function sphereTextures() {
  const W = 2048;
  const H = 1024;
  const color = document.createElement("canvas");
  color.width = W;
  color.height = H;
  const c = color.getContext("2d")!;
  const bump = document.createElement("canvas");
  bump.width = W;
  bump.height = H;
  const b = bump.getContext("2d")!;

  const top = H * 0.36;
  const bottom = H * 0.64;
  // Couleur
  c.fillStyle = "#f6f7f5";
  c.fillRect(0, 0, W, H);
  const low = c.createLinearGradient(0, bottom, 0, H);
  low.addColorStop(0, "#f6f7f5");
  low.addColorStop(1, "#cdeec0");
  c.fillStyle = low;
  c.fillRect(0, bottom, W, H - bottom);
  c.fillStyle = "#cfd7d0";
  c.fillRect(0, top, W, bottom - top);
  // Relief : noir = creux, blanc = bosse
  b.fillStyle = "#808080";
  b.fillRect(0, 0, W, H);
  b.fillStyle = "#202020";
  b.fillRect(0, top, W, bottom - top);

  // Vrai labyrinthe (parcours en profondeur) sur une grille qui boucle horizontalement.
  const cols = 72;
  const rows = 10;
  const cw = W / cols;
  const ch = (bottom - top) / rows;
  const rand = rng(7);
  const seen = new Set<number>();
  const open = new Set<string>();
  const stack = [[0, 0]];
  seen.add(0);
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const next = [
      [(x + 1) % cols, y],
      [(x - 1 + cols) % cols, y],
      [x, y + 1],
      [x, y - 1],
    ].filter(([nx, ny]) => ny >= 0 && ny < rows && !seen.has(ny * cols + nx));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [nx, ny] = next[Math.floor(rand() * next.length)];
    open.add([x, y, nx, ny].join()).add([nx, ny, x, y].join());
    seen.add(ny * cols + nx);
    stack.push([nx, ny]);
  }
  const wall = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  // Ombre portée des murs d'abord, puis les murs eux-mêmes.
  for (const [ctx, style, width, dx, dy] of [
    [c, "#a9b5ad", cw * 0.36, cw * 0.1, ch * 0.12],
    [c, "#ffffff", cw * 0.34, 0, 0],
    [b, "#ffffff", cw * 0.34, 0, 0],
  ] as const) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.lineCap = "square";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = x * cw + dx;
        const py = top + y * ch + dy;
        if (!open.has([x, y, (x + 1) % cols, y].join())) wall(ctx, px + cw, py, px + cw, py + ch);
        if (y < rows - 1 && !open.has([x, y, x, y + 1].join())) wall(ctx, px, py + ch, px + cw, py + ch);
      }
    }
  }
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const bumpMap = new THREE.CanvasTexture(bump);
  return { map, bumpMap };
}

/** Disque perforé du socle. */
function dotsTexture() {
  const s = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, s, s);
  c.fillStyle = "#5f7166";
  for (let y = 6; y < s; y += 12) for (let x = 6 + ((y / 12) % 2) * 6; x < s; x += 12) {
    c.beginPath();
    c.arc(x, y, 3.6, 0, Math.PI * 2);
    c.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Livre entrouvert : deux plats et leurs blocs de pages autour d'un dos. */
function makeBook(cover: number, rand: () => number) {
  const book = new THREE.Group();
  const coverMat = new THREE.MeshStandardMaterial({ color: cover, roughness: 0.45, metalness: 0.05 });
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xfffbea, roughness: 0.9 });
  const lineMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(cover).lerp(new THREE.Color(0xd9d2b8), 0.35), roughness: 1 });
  const open = 0.42 + rand() * 0.25;
  for (const side of [-1, 1]) {
    const half = new THREE.Group();
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.035), coverMat);
    c.position.set(0.23 * side, 0, 0);
    c.castShadow = false;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.07), pageMat);
    p.position.set(0.215 * side, 0, 0.05);
    p.castShadow = false;
    half.add(c, p);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.018, 0.002), lineMat);
      l.position.set(0.22 * side, 0.18 - i * 0.1, 0.087);
      half.add(l);
    }
    half.rotation.y = -side * open;
    book.add(half);
  }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.64, 12), coverMat);
  book.add(spine);
  // Marque-page qui dépasse en bas du dos.
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.004), new THREE.MeshStandardMaterial({ color: cover === YELLOW ? GREEN : YELLOW, roughness: 0.6 }));
  ribbon.position.set(0.04, -0.38, 0.09);
  ribbon.rotation.z = 0.12;
  book.add(ribbon);
  return book;
}

export function mountGlobe(host: HTMLElement, onReady: () => void): () => void {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return () => {};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 640 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMap;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.1, 13.5);
  camera.lookAt(0, -0.15, 0);

  // Lumières : clé chaude en haut à gauche, contre-jour vert, lueur du bassin.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a5a3a, 0.7));
  const key = new THREE.DirectionalLight(0xfff6e5, 2.4);
  key.position.set(-4, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight(GREEN_LIGHT, 1.6);
  rim.position.set(5, 1, -4);
  scene.add(rim);
  const glow = new THREE.PointLight(0x8fd36b, 6, 6, 1.6);
  glow.position.set(0, -2.1, 0);
  scene.add(glow);

  const world = new THREE.Group();
  scene.add(world);
  const rand = rng(42);

  // Sphère
  const R = 1.55;
  const globe = new THREE.Group();
  globe.position.y = 0.35;
  globe.rotation.set(0.28, 0, -0.42);
  world.add(globe);
  const { map, bumpMap } = sphereTextures();
  const sphereMat = new THREE.MeshPhysicalMaterial({
    color: PLASTER,
    map,
    bumpMap,
    bumpScale: 3,
    roughness: 0.62,
    clearcoat: 0.15,
    clearcoatRoughness: 0.6,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xffffff),
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 96), sphereMat);
  sphere.castShadow = true;
  globe.add(sphere);

  // Lèvres de la ceinture et anneaux de la calotte, en relief.
  const plaster = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const lat = (0.5 - 0.36) * Math.PI;
  for (const s of [1, -1]) {
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R * Math.cos(lat) + 0.01, 0.035, 16, 160), plaster);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = s * R * Math.sin(lat);
    globe.add(lip);
  }
  const capRings = [0.62, 0.48, 0.34, 0.2];
  capRings.forEach((r, i) => {
    const y = Math.sqrt(R * R - r * r) + 0.005;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, i === 2 ? 0.03 : 0.014, 12, 96), plaster);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    globe.add(ring);
  });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.05, 32), plaster);
  cap.position.y = Math.sqrt(R * R - 0.12 * 0.12) + 0.02;
  globe.add(cap);

  // Réseau géodésique
  const network = new THREE.Group();
  network.position.y = 0.35;
  world.add(network);
  const ico = new THREE.IcosahedronGeometry(2.2, 1);
  const pos = ico.getAttribute("position");
  // Même décalage pour les sommets confondus, sinon le réseau se dédouble.
  const jitter = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!jitter.has(key)) jitter.set(key, 1 + (rand() - 0.5) * 0.14);
    v.multiplyScalar(jitter.get(key)!);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(ico),
    new THREE.LineBasicMaterial({ color: 0x9fd4ae, transparent: true, opacity: 0.9 }),
  );
  network.add(edges);
  const nodeGeo = new THREE.SphereGeometry(0.03, 12, 8);
  const seenNode = new Set<string>();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(2)},${pos.getY(i).toFixed(2)},${pos.getZ(i).toFixed(2)}`;
    if (seenNode.has(k)) continue;
    seenNode.add(k);
    const n = new THREE.Mesh(nodeGeo, plaster);
    n.position.fromBufferAttribute(pos, i);
    n.scale.setScalar(rand() > 0.8 ? 1.8 : 1);
    network.add(n);
  }

  // Billes de plâtre, de verre et une touche de jaune
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.04, thickness: 0.4, ior: 1.45, clearcoat: 1 });
  const ballPlaster = new THREE.MeshPhysicalMaterial({ color: 0xf2f4f1, roughness: 0.75, sheen: 0.5, sheenColor: new THREE.Color(0xffffff) });
  const ballYellow = new THREE.MeshPhysicalMaterial({ color: YELLOW, roughness: 0.35, clearcoat: 0.6 });
  const balls: { mesh: THREE.Mesh; base: THREE.Vector3; phase: number; speed: number }[] = [];
  const spots: [number, number, number, number, THREE.Material][] = [
    [2.35, 1.95, 0.6, 0.2, ballPlaster],
    [2.56, 1.65, 0.2, 0.26, ballPlaster],
    [2.45, 1.2, 1.2, 0.12, ballPlaster],
    [2.61, 0.95, -0.3, 0.12, glass],
    [2.29, -0.25, 0.9, 0.24, ballPlaster],
    [2.52, -0.85, 0.3, 0.28, ballPlaster],
    [0.95, -0.35, 1.9, 0.2, ballYellow],
    [-2.29, -0.85, 0.7, 0.2, ballPlaster],
    [-2.56, 0.5, -0.2, 0.14, glass],
    [-1.9, -1.55, 1.0, 0.16, glass],
    [-2.34, 1.6, 0.4, 0.1, ballYellow],
    [2.29, -1.75, 0.7, 0.32, ballPlaster],
    [-2.45, -2.0, 0.5, 0.18, ballPlaster],
  ];
  const ballGeo = new THREE.SphereGeometry(1, 48, 32);
  for (const [x, y, z, r, mat] of spots) {
    const mesh = new THREE.Mesh(ballGeo, mat);
    mesh.scale.setScalar(r);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    world.add(mesh);
    balls.push({ mesh, base: mesh.position.clone(), phase: rand() * Math.PI * 2, speed: 0.6 + rand() * 0.6 });
  }

  // Socle
  const pedestal = new THREE.Group();
  pedestal.position.y = -2.55;
  world.add(pedestal);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.8, 0.38, 96), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, clearcoat: 0.3 }));
  base.receiveShadow = true;
  base.castShadow = true;
  pedestal.add(base);
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.04, 16, 128), plaster);
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = 0.19;
  pedestal.add(rimRing);
  const dots = dotsTexture();
  dots.wrapS = dots.wrapT = THREE.RepeatWrapping;
  dots.repeat.set(2, 2);
  dots.anisotropy = 8;
  const grill = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.66, 96), new THREE.MeshStandardMaterial({ map: dots, roughness: 0.8 }));
  grill.rotation.x = -Math.PI / 2;
  grill.position.y = 0.192;
  grill.receiveShadow = true;
  pedestal.add(grill);
  const basin = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 96),
    new THREE.MeshStandardMaterial({ color: 0x8fd36b, emissive: GREEN_LIGHT, emissiveIntensity: 1.3, roughness: 0.2 }),
  );
  basin.rotation.x = -Math.PI / 2;
  basin.position.y = 0.19;
  basin.receiveShadow = true;
  pedestal.add(basin);
  // Halo qui monte du bassin
  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = haloCanvas.height = 128;
  const hc = haloCanvas.getContext("2d")!;
  const hg = hc.createRadialGradient(64, 64, 0, 64, 64, 64);
  hg.addColorStop(0, "rgba(200,236,181,0.9)");
  hg.addColorStop(1, "rgba(200,236,181,0)");
  hc.fillStyle = hg;
  hc.fillRect(0, 0, 128, 128);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(haloCanvas), transparent: true, depthWrite: false, opacity: 0.55 }));
  halo.scale.set(3.6, 1.6, 1);
  halo.position.y = 0.6;
  pedestal.add(halo);

  // Ombre portée au sol
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.4, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.75;
  floor.receiveShadow = true;
  world.add(floor);

  // Livres en orbite sur deux anneaux inclinés, avec leur trajectoire en pointillés.
  const orbitDefs = [
    { radius: 2.6, tilt: new THREE.Euler(1.2, 0, -0.35), speed: 0.32, colors: [YELLOW, GREEN, 0xffffff, GREEN_LIGHT] },
    { radius: 2.2, tilt: new THREE.Euler(1.0, 0, 0.5), speed: -0.45, colors: [0xffe047, 0x136b32, MINT] },
  ];
  const books: { book: THREE.Group; orbit: THREE.Group; radius: number; angle: number; speed: number; spin: number }[] = [];
  for (const o of orbitDefs) {
    const orbit = new THREE.Group();
    orbit.position.y = 0.35;
    orbit.rotation.copy(o.tilt);
    world.add(orbit);
    const pts = new THREE.EllipseCurve(0, 0, o.radius, o.radius).getPoints(160);
    const trail = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, 0))),
      new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.08, gapSize: 0.08, transparent: true, opacity: 0.4 }),
    );
    trail.computeLineDistances();
    orbit.add(trail);
    o.colors.forEach((color, i) => {
      const book = makeBook(color, rand);
      book.scale.setScalar(1.2);
      orbit.add(book);
      books.push({ book, orbit, radius: o.radius, angle: (i / o.colors.length) * Math.PI * 2, speed: o.speed, spin: 0.4 + rand() * 0.6 });
    });
  }

  // Taille et caméra
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // Légère parallaxe à la souris
  const pointer = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener("pointermove", onMove);

  // Le globe se fait tourner à la main, avec un peu d'élan au lâcher.
  let spin = 0;
  let spinVel = 0;
  let dragX: number | null = null;
  host.style.cursor = "grab";
  host.style.touchAction = "pan-y";
  const onDown = (e: PointerEvent) => {
    dragX = e.clientX;
    host.setPointerCapture(e.pointerId);
    host.style.cursor = "grabbing";
  };
  const onDrag = (e: PointerEvent) => {
    if (dragX === null) return;
    spinVel = (e.clientX - dragX) * 0.008;
    spin += spinVel;
    dragX = e.clientX;
  };
  const onUp = () => {
    dragX = null;
    host.style.cursor = "grab";
  };
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onDrag);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onUp);

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visible = true;
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  io.observe(host);

  const start = performance.now();
  const q = new THREE.Quaternion();
  let frame = 0;
  let first = true;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!visible && !first) return;
    const t = still ? 2 : (performance.now() - start) / 1000;
    // Entrée : la scène grandit et les livres s'écartent jusqu'à leur orbite.
    const e = 1 - Math.pow(1 - Math.min(t / 1.4, 1), 3);
    world.scale.setScalar(0.82 + 0.18 * e);
    if (dragX === null) {
      spin += spinVel;
      spinVel *= 0.95;
    }
    sphere.rotation.y = t * 0.25 + spin;
    globe.position.y = 0.35 + Math.sin(t * 0.9) * 0.06;
    network.rotation.y = -t * 0.08 + spin * 0.4;
    network.rotation.z = Math.sin(t * 0.3) * 0.08;
    for (const b of balls) b.mesh.position.y = b.base.y + Math.sin(t * b.speed + b.phase) * 0.12;
    for (const b of books) {
      const a = b.angle + t * b.speed;
      const r = b.radius * (0.55 + 0.45 * e);
      b.book.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      b.orbit.getWorldQuaternion(q).invert();
      b.book.quaternion.copy(q);
      // Rotation complète : on voit tour à tour la couverture et les pages.
      b.book.rotateY(t * b.spin + b.angle);
      b.book.rotateZ(Math.sin(t * 0.7 + b.angle) * 0.25);
    }
    halo.material.opacity = 0.45 + Math.sin(t * 1.4) * 0.12;
    world.rotation.y += (pointer.x * 0.18 - world.rotation.y) * 0.04;
    world.rotation.x += (pointer.y * 0.06 - world.rotation.x) * 0.04;
    renderer.render(scene, camera);
    if (first) {
      first = false;
      onReady();
      if (still) cancelAnimationFrame(frame);
    }
  };
  tick();

  return () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerdown", onDown);
    host.removeEventListener("pointermove", onDrag);
    host.removeEventListener("pointerup", onUp);
    host.removeEventListener("pointercancel", onUp);
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.LineLoop || o instanceof THREE.Sprite) {
        o.geometry?.dispose();
        const m = o.material as THREE.Material | THREE.Material[];
        (Array.isArray(m) ? m : [m]).forEach((mat) => mat.dispose());
      }
    });
    map.dispose();
    bumpMap.dispose();
    dots.dispose();
    envMap.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

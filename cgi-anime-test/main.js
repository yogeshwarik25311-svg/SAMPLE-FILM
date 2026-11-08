import * as THREE from "three";

const canvas = document.querySelector("#scene");
const status = document.querySelector("#status");
const replayButton = document.querySelector("#replay");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("The scene canvas could not be found.");
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const INTRO_DURATION = 34;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xaecdc4, 67, 205);

const camera = new THREE.PerspectiveCamera(
  46,
  window.innerWidth / window.innerHeight,
  0.1,
  420
);
camera.position.set(0, 6.8, 22);

const clock = new THREE.Clock();
const random = seededRandom(84192);
const animatedClouds = [];
let grassShader = null;
let introStartedAt = performance.now();

const material = {
  bark: new THREE.MeshStandardMaterial({
    color: 0x4b3528,
    roughness: 0.94,
  }),
  foliage: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    flatShading: true,
  }),
  grass: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    side: THREE.DoubleSide,
  }),
  petal: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    side: THREE.DoubleSide,
  }),
  warmWood: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
  }),
  trimWood: new THREE.MeshStandardMaterial({
    color: 0x53392a,
    roughness: 0.92,
  }),
  roof: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.91,
    side: THREE.DoubleSide,
  }),
  stone: new THREE.MeshStandardMaterial({
    color: 0x827d69,
    roughness: 0.98,
  }),
};

const ambient = new THREE.HemisphereLight(0xe5f4ed, 0x506a4d, 2.1);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffe4b0, 3.3);
sun.position.set(-22, 31, 17);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 100;
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.028;
sun.target.position.set(0, 0, -8);
scene.add(sun, sun.target);

const warmFill = new THREE.DirectionalLight(0xb8d9dc, 0.72);
warmFill.position.set(18, 13, -18);
scene.add(warmFill);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(300, 32, 22),
  new THREE.MeshBasicMaterial({
    map: makeSkyTexture(),
    side: THREE.BackSide,
    depthWrite: false,
  })
);
scene.add(sky);

const groundTexture = makeGroundTexture();
groundTexture.repeat.set(5, 6);
material.ground = new THREE.MeshStandardMaterial({
  map: groundTexture,
  roughness: 1,
  metalness: 0,
});

const terrain = createTerrain();
scene.add(terrain);

createMountainRanges();
createDistantForest();
createClouds();
createMeadowGrass();
createFlowers();
createFramingTrees();
createHouse();
createStonePath();
createFence();

const cameraStart = {
  position: new THREE.Vector3(-2, 7.2, 24),
  target: new THREE.Vector3(-1, 5.8, -34),
};

const cameraEnd = {
  position: new THREE.Vector3(6.1, 5.6, 16),
  target: new THREE.Vector3(11.2, 3.3, -1.5),
};

camera.position.copy(cameraStart.position);

const lookTarget = new THREE.Vector3();

function animate() {
  const elapsed = clock.getElapsedTime();
  const progress = reducedMotion
    ? 1
    : smoothstep(0, 1, Math.min((performance.now() - introStartedAt) / (INTRO_DURATION * 1000), 1));

  camera.position.lerpVectors(cameraStart.position, cameraEnd.position, progress);
  camera.position.y += Math.sin(elapsed * 0.28) * 0.055;

  lookTarget.lerpVectors(cameraStart.target, cameraEnd.target, progress);
  lookTarget.x += Math.sin(elapsed * 0.18) * 0.12;
  camera.lookAt(lookTarget);

  for (const cloud of animatedClouds) {
    cloud.group.position.x = cloud.originX + Math.sin(elapsed * 0.055 + cloud.phase) * 1.4;
  }

  if (grassShader) {
    grassShader.uniforms.uTime.value = elapsed;
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
status?.classList.add("is-hidden");

replayButton?.addEventListener("click", () => {
  introStartedAt = performance.now();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* -------------------------------------------------------------------------- */
/* Landscape                                                                  */
/* -------------------------------------------------------------------------- */

function createTerrain() {
  const width = 140;
  const depth = 154;
  const segmentsX = 150;
  const segmentsZ = 170;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let row = 0; row <= segmentsZ; row += 1) {
    const v = row / segmentsZ;
    const z = 38 - v * depth;

    for (let col = 0; col <= segmentsX; col += 1) {
      const u = col / segmentsX;
      const x = (u - 0.5) * width;
      const y = terrainHeight(x, z);

      positions.push(x, y, z);
      uvs.push(u * 5, v * 6);

      if (row < segmentsZ && col < segmentsX) {
        const a = row * (segmentsX + 1) + col;
        const b = a + 1;
        const c = a + segmentsX + 1;
        const d = c + 1;

        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material.ground);
  mesh.receiveShadow = true;
  mesh.position.y = -0.16;
  mesh.name = "Meadow terrain";
  return mesh;
}

function terrainHeight(x, z) {
  const broadHills =
    Math.sin(x * 0.075 + z * 0.035) * 0.34 +
    Math.cos(z * 0.09 - x * 0.025) * 0.24;
  const fineVariation =
    (valueNoise(x * 0.13, z * 0.13) - 0.5) * 0.46 +
    (valueNoise(x * 0.39, z * 0.39) - 0.5) * 0.12;
  const backRise = Math.max(0, -z - 9) * 0.024;
  return broadHills + fineVariation + backRise;
}

function createMountainRanges() {
  const layers = [
    {
      z: -47,
      depth: 11,
      height: 16,
      base: 0x315d4e,
      peak: 0x8caa78,
      seed: 15,
      fogFactor: 0.12,
    },
    {
      z: -61,
      depth: 10,
      height: 23,
      base: 0x3a6b67,
      peak: 0xa5bda0,
      seed: 34,
      fogFactor: 0.25,
    },
    {
      z: -75,
      depth: 9,
      height: 29,
      base: 0x4c777c,
      peak: 0xb2c8bd,
      seed: 67,
      fogFactor: 0.42,
    },
    {
      z: -87,
      depth: 8,
      height: 35,
      base: 0x65888c,
      peak: 0xc2d2c8,
      seed: 92,
      fogFactor: 0.57,
    },
  ];

  for (const layer of layers) {
    scene.add(createMountainLayer(layer));
  }
}

function createMountainLayer(config) {
  const segmentsX = 240;
  const rows = 22;
  const width = 178;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const baseColor = new THREE.Color(config.base);
  const peakColor = new THREE.Color(config.peak);
  const mistColor = new THREE.Color(0xc3d8d2);
  const peaks = [];

  for (let i = 0; i < 10; i += 1) {
    peaks.push({
      x: -82 + i * 19 + seededRandom(config.seed + i * 17)() * 10,
      height: config.height * (0.48 + seededRandom(config.seed * 5 + i)() * 0.7),
      width: 4.5 + seededRandom(config.seed * 13 + i * 3)() * 8,
    });
  }

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;

    for (let col = 0; col <= segmentsX; col += 1) {
      const u = col / segmentsX;
      const x = (u - 0.5) * width;
      let ridge = 1.6;

      for (const peak of peaks) {
        const distance = (x - peak.x) / peak.width;
        ridge += peak.height * Math.exp(-distance * distance * 0.72);
      }

      const unevenRidge =
        Math.sin(x * 0.24 + config.seed) * 0.9 +
        Math.sin(x * 0.67 + config.seed * 0.7) * 0.32;
      const top = Math.max(1, ridge + unevenRidge);
      const y = top * (1 - v) + 0.7;
      const z = config.z + v * config.depth + Math.sin(x * 0.045 + config.seed) * v * 0.55;

      positions.push(x, y, z);
      uvs.push(u * 3.2, v * 1.25);

      const elevation = THREE.MathUtils.clamp(y / config.height, 0, 1);
      const ridgeColor = baseColor.clone().lerp(peakColor, 0.2 + elevation * 0.56);
      const color = ridgeColor.lerp(mistColor, config.fogFactor * (0.35 + v * 0.7));
      colors.push(color.r, color.g, color.b);

      if (row < rows && col < segmentsX) {
        const a = row * (segmentsX + 1) + col;
        const b = a + 1;
        const c = a + segmentsX + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mountainMaterial = new THREE.MeshStandardMaterial({
    map: makeMountainTexture(config.seed),
    color: 0xffffff,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    fog: true,
  });

  const mesh = new THREE.Mesh(geometry, mountainMaterial);
  mesh.position.y = -0.35;
  mesh.receiveShadow = true;
  mesh.name = "Painterly mountain range";
  return mesh;
}

function createDistantForest() {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const forestMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    flatShading: true,
  });
  const count = 620;
  const forest = new THREE.InstancedMesh(geometry, forestMaterial, count);
  const dummy = new THREE.Object3D();
  const colors = [0x294d3e, 0x386448, 0x4b754d, 0x5d8050].map(
    (color) => new THREE.Color(color)
  );

  for (let i = 0; i < count; i += 1) {
    const x = (random() - 0.5) * 83;
    const z = -14 - random() * 32;
    const scale = 0.35 + random() * 1.25;

    dummy.position.set(x, terrainHeight(x, z) + scale * 0.4, z);
    dummy.scale.set(scale * 1.6, scale * (0.65 + random() * 0.6), scale * 1.1);
    dummy.rotation.y = random() * Math.PI;
    dummy.updateMatrix();

    forest.setMatrixAt(i, dummy.matrix);
    forest.setColorAt(i, colors[Math.floor(random() * colors.length)]);
  }

  forest.receiveShadow = true;
  forest.name = "Distant forest canopy";
  scene.add(forest);
}

/* -------------------------------------------------------------------------- */
/* Painterly procedural textures                                              */
/* -------------------------------------------------------------------------- */

function makeSkyTexture() {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 512;
  canvasTexture.height = 512;

  const context = canvasTexture.getContext("2d");
  if (!context) throw new Error("Could not create the sky texture.");

  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#62aabd");
  gradient.addColorStop(0.36, "#93ced4");
  gradient.addColorStop(0.7, "#d3e7d5");
  gradient.addColorStop(1, "#b6cfc3");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);

  const glow = context.createRadialGradient(355, 215, 8, 355, 215, 240);
  glow.addColorStop(0, "rgba(255, 237, 187, 0.38)");
  glow.addColorStop(1, "rgba(255, 237, 187, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGroundTexture() {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 512;
  canvasTexture.height = 512;

  const context = canvasTexture.getContext("2d");
  if (!context) throw new Error("Could not create the meadow texture.");

  context.fillStyle = "#55784b";
  context.fillRect(0, 0, 512, 512);

  const strokes = [
    "rgba(170, 187, 99, 0.21)",
    "rgba(123, 159, 75, 0.34)",
    "rgba(41, 92, 54, 0.25)",
    "rgba(210, 195, 125, 0.13)",
    "rgba(37, 76, 48, 0.22)",
  ];

  for (let i = 0; i < 1100; i += 1) {
    const x = random() * 512;
    const y = random() * 512;
    const length = 4 + random() * 32;
    context.strokeStyle = strokes[Math.floor(random() * strokes.length)];
    context.lineWidth = 0.6 + random() * 2.2;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + length * 0.4, y - 4, x + length, y + random() * 7);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function makeMountainTexture(seed) {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 512;
  canvasTexture.height = 384;

  const context = canvasTexture.getContext("2d");
  if (!context) throw new Error("Could not create the mountain texture.");

  context.fillStyle = "#a0b3a2";
  context.fillRect(0, 0, 512, 384);

  const palette = ["#577766", "#6d8c77", "#b9c6a5", "#728e83", "#d0d4b6", "#456d68"];
  const localRandom = seededRandom(seed * 71);

  for (let i = 0; i < 1500; i += 1) {
    const x = localRandom() * 512;
    const y = localRandom() * 384;
    const width = 4 + localRandom() * 31;
    const height = 1 + localRandom() * 4;

    context.globalAlpha = 0.12 + localRandom() * 0.26;
    context.fillStyle = palette[Math.floor(localRandom() * palette.length)];
    context.beginPath();
    context.ellipse(x, y, width, height, -0.18 + localRandom() * 0.36, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeWoodTexture() {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 512;
  canvasTexture.height = 512;

  const context = canvasTexture.getContext("2d");
  if (!context) throw new Error("Could not create the wood texture.");

  context.fillStyle = "#80563a";
  context.fillRect(0, 0, 512, 512);

  const plankColors = ["#6a4732", "#875d3b", "#976d47", "#704b32", "#9b754e"];
  for (let row = 0; row < 14; row += 1) {
    const y = row * 38;
    context.fillStyle = plankColors[Math.floor(random() * plankColors.length)];
    context.fillRect(0, y, 512, 36);
    context.fillStyle = "rgba(31, 25, 20, 0.35)";
    context.fillRect(0, y + 36, 512, 2);

    for (let i = 0; i < 34; i += 1) {
      const x = random() * 512;
      const lineY = y + random() * 34;
      context.strokeStyle = random() > 0.5
        ? "rgba(230, 187, 128, 0.15)"
        : "rgba(38, 27, 20, 0.18)";
      context.lineWidth = 0.7 + random() * 1.4;
      context.beginPath();
      context.moveTo(x, lineY);
      context.bezierCurveTo(x + 14, lineY - 1, x + 32, lineY + 2, x + 61, lineY);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeRoofTexture() {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 512;
  canvasTexture.height = 512;

  const context = canvasTexture.getContext("2d");
  if (!context) throw new Error("Could not create the roof texture.");

  context.fillStyle = "#313b39";
  context.fillRect(0, 0, 512, 512);

  const colors = ["#344447", "#465653", "#52605a", "#29373a", "#687068"];
  for (let row = 0; row < 21; row += 1) {
    const offset = row % 2 === 0 ? 0 : 24;
    for (let col = -1; col < 13; col += 1) {
      const x = col * 46 + offset;
      const y = row * 24;
      context.fillStyle = colors[Math.floor(random() * colors.length)];
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 42, y);
      context.lineTo(x + 38, y + 22);
      context.lineTo(x + 4, y + 22);
      context.closePath();
      context.fill();
      context.strokeStyle = "rgba(19, 29, 31, 0.55)";
      context.lineWidth = 2;
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvasTexture);
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.colorSpace = THREE.SRGBColorSpace;
return texture;
}

/* -------------------------------------------------------------------------- */
/* Clouds and living meadow                                                   */
/* -------------------------------------------------------------------------- */

function createClouds() {
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff2d6,
    roughness: 1,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const cloudPositions = [
    [-34, 15, -33, 7.5],
    [-17, 17, -40, 6.4],
    [4, 16, -36, 6.8],
    [29, 18, -44, 8.4],
    [46, 14, -35, 5.2],
  ];

  for (let index = 0; index < cloudPositions.length; index += 1) {
    const [x, y, z, size] = cloudPositions[index];
    const group = new THREE.Group();
    group.position.set(x, y, z);

    for (let puff = 0; puff < 7; puff += 1) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        cloudMaterial
      );
      cloud.position.set(
        (random() - 0.5) * size * 1.5,
        (random() - 0.5) * size * 0.38,
        (random() - 0.5) * size * 0.28
      );
      cloud.scale.set(
        size * (0.38 + random() * 0.34),
        size * (0.17 + random() * 0.14),
        size * (0.18 + random() * 0.16)
      );
      group.add(cloud);
    }

    animatedClouds.push({
      group,
      originX: x,
      phase: index * 1.2,
    });
    scene.add(group);
  }
}

function createMeadowGrass() {
  const count = 7800;
  const geometry = createGrassBladeGeometry();

  material.grass.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nuniform float uTime;\n..."
    );
    grassShader = shader;
  };

  const grass = new THREE.InstancedMesh(geometry, material.grass, count);
  grass.frustumCulled = false;
  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i += 1) {
    const x = (random() - 0.5) * 70;
    const z = 26 - random() * 61;
    const height = 0.28 + random() * 0.75;
    const width = 0.72 + random() * 0.65;

    dummy.position.set(x, terrainHeight(x, z) - 0.08, z);
    dummy.rotation.set(0, random() * Math.PI, (random() - 0.5) * 0.08);
    dummy.scale.set(width, height, width);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);

    const hue = 0.22 + random() * 0.075;
    const saturation = 0.32 + random() * 0.34;
    const lightness = 0.29 + random() * 0.22;
    grass.setColorAt(i, new THREE.Color().setHSL(hue, saturation, lightness));
  }

  grass.castShadow = false;
  grass.receiveShadow = true;
  grass.name = "Wind-swept meadow grass";
  scene.add(grass);
}

function createGrassBladeGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = [
    0, 0, 0,
    -0.14, 0.58, 0,
    0.02, 1, 0,
    0, 0, 0,
    0, 0.58, -0.14,
    0, 1, 0.02,
  ];

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2, 3, 4, 5]);
  geometry.computeVertexNormals();
  return geometry;
}

function createFlowers() {
  const flowerCount = 88;
  const petalsPerFlower = 5;
  const petalGeometry = new THREE.SphereGeometry(0.105, 7, 5);
  petalGeometry.scale(1, 0.42, 0.7);

  const petalMesh = new THREE.InstancedMesh(
    petalGeometry,
    material.petal,
    flowerCount * petalsPerFlower
  );

  const centerMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.075, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xe8b84d, roughness: 0.9 })
  );

  const stemMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.6, 6),
    material.stem,
    flowerCount
  );

  const dummy = new THREE.Object3D();

  for (let i = 0; i < flowerCount; i += 1) {
    const x = (random() - 0.5) * 60;
    const z = 22 - random() * 55;
    const y = terrainHeight(x, z);
    const scale = 0.6 + random() * 0.8;

    for (let petal = 0; petal < petalsPerFlower; petal += 1) {
      const angle = (petal / petalsPerFlower) * Math.PI * 2;
      const radius = 0.12 * scale;
      const px = x + Math.cos(angle) * radius;
      const pz = z + Math.sin(angle) * radius;
      const py = y + 0.45 * scale;

      dummy.position.set(px, py, pz);
      dummy.scale.setScalar(scale * 0.9);
      dummy.rotation.set(0.3, angle, 0);
      dummy.updateMatrix();

      const instance = i * petalsPerFlower + petal;
      petalMesh.setMatrixAt(instance, dummy.matrix);
      petalMesh.setColorAt(instance, color);
    }

    dummy.position.set(x, y + 0.45 * scale, z);
    dummy.scale.setScalar(scale);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    centerMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, y + 0.22 * scale, z);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    stemMesh.setMatrixAt(i, dummy.matrix);
  }

  petalMesh.receiveShadow = true;
  centerMesh.receiveShadow = true;
  stemMesh.castShadow = true;
  scene.add(petalMesh, centerMesh, stemMesh);
}

/* -------------------------------------------------------------------------- */
/* Framing trees                                                             */
/* -------------------------------------------------------------------------- */

function createFramingTrees() {
  addTree(-12.5, 4.5, 10.8, 6.2, 60);
  addTree(-24, -8, 8.2, 4.6, 35);
  addTree(25, -3, 9.5, 5.1, 47);
}

function addTree(x, z, height, canopyRadius, leafCount) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);

  addBranch(group, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, height, 0), 0.48);

  const branchPoints = [
    [-0.1, height * 0.48, 0, -2.5, height * 0.78, -0.1],
    [0.03, height * 0.56, 0.05, 2.3, height * 0.84, 0.4],
    [0.06, height * 0.7, 0, -2.1, height * 0.98, 0.5],
    [0.06, height * 0.74, 0, 2.3, height * 1.05, -0.5],
    [0.02, height * 0.56, 0, -0.5, height * 0.91, 2.3],
    [0.02, height * 0.62, 0, 0.4, height * 0.97, -2.2],
  ];

  for (const branch of branchPoints) {
    addBranch(
      group,
      new THREE.Vector3(branch[0], branch[1], branch[2]),
      new THREE.Vector3(branch[3], branch[4], branch[5]),
      0.19
    );
  }

  const leafGeometry = new THREE.IcosahedronGeometry(1, 1);
  const leaves = new THREE.InstancedMesh(leafGeometry, material.foliage, leafCount);
  const dummy = new THREE.Object3D();
  const leafPalette = [0x47723d, 0x638b48, 0x6fba95, 0x315h3c, 0xb1bd62].map(
    (value) => new THREE.Color(value)
  );

  for (let i = 0; i < leafCount; i += 1) {
    const angle = random() * Math.PI * 2;
    const spread = Math.sqrt(random()) * canopyRadius;
    const canopyY = height * 0.72 + (random() - 0.35) * canopyRadius * 0.82;
    const size = 0.72 + random() * 1.48;

    dummy.position.set(
      Math.cos(angle) * spread,
      canopyY,
      Math.sin(angle) * spread * 0.72
    );

    dummy.rotation.set(random() * 0.45, random() * Math.PI, random() * 0.45);
    dummy.scale.set(size * 1.15, size * 0.76, size);
    dummy.updateMatrix();

    leaves.setMatrixAt(i, dummy.matrix);
    leaves.setColorAt(i, leafPalette[Math.floor(random() * leafPalette.length)]);
  }

  leaves.castShadow = true;
  leaves.receiveShadow = true;
  group.add(leaves);
  scene.add(group);
}

function addBranch(parent, start, end, radius) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const branch = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.34, radius, length, 8),
    material.bark
  );

  branch.position.copy(start).add(end).multiplyScalar(0.5);
  branch.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  branch.castShadow = true;
  branch.receiveShadow = true;
  parent.add(branch);
}

/* -------------------------------------------------------------------------- */
/* Countryside house, path, and fence                                        */
/* -------------------------------------------------------------------------- */

function createHouse() {
  material.warmWood.map = makeWoodTexture();
  material.warmWood.map.repeat.set(1.4, 1);
  material.roof.map = makeRoofTexture();
  material.roof.map.repeat.set(1.5, 1.2);

  const x = 12;
  const z = -2;
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);
  group.name = "Countryside house";

  addHousePart(group, new THREE.BoxGeometry(7, 4, 5), material.warmWood, 0, 2, 0);

  const gableGeometry = new THREE.BufferGeometry();
  gableGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      -3.5, 4, 2.53,
      3.5, 4, 2.53,
      0, 6.35, 2.53,
      -3.5, 4, -2.53,
      0, 6.35, -2.53,
      3.5, 4, -2.53,
    ], 3)
  );
  gableGeometry.setIndex([0, 1, 2, 3, 4, 5]);
  gableGeometry.computeVertexNormals();

  const gable = new THREE.Mesh(gableGeometry, material.warmWood);
  gable.castShadow = true;
  group.add(gable);

  addRoofSlope(group, -1);
  addRoofSlope(group, 1);

  const frontZ = 2.56;
  addHousePart(group, new THREE.BoxGeometry(1.3, 1.5, 0.16), material.trimWood, -1.65, 2, frontZ);
  addHousePart(group, new THREE.BoxGeometry(1.04, 1.22, 0.08), glassMaterial(), -1.65, 2, frontZ);
  addHousePart(group, new THREE.BoxGeometry(0.1, 1.42, 0.12), material.trimWood, -1.65, 2, frontZ);
  addHousePart(group, new THREE.BoxGeometry(1.26, 0.1, 0.12), material.trimWood, -1.65, 2, frontZ);

  addHousePart(group, new THREE.BoxGeometry(1.3, 1.5, 0.16), material.trimWood, 0.25, 2, frontZ);
  addHousePart(group, new THREE.BoxGeometry(1.04, 1.22, 0.08), glassMaterial(), 0.25, 2, frontZ);
  addHousePart(group, new THREE.BoxGeometry(0.1, 1.42, 0.12), material.trimWood, 0.25, 2, frontZ);
  addHousePart(group, new THREE.BoxGeometry(1.26, 0.1, 0.12), material.trimWood, 0.25, 2, frontZ);

  const doorMaterial = new THREE.MeshStandardMaterial({
    map: material.warmWood.map,
    color: 0x79543a,
    roughness: 0.9,
  });
  addHousePart(group, new THREE.BoxGeometry(1.12, 2.55, 0.2), doorMaterial, 2.45, 1.28, frontZ);
  addHousePart(group, new THREE.BoxGeometry(1.42, 0.18, 0.32), material.trimWood, 2.45, 2.55, frontZ);

  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 8),
    new THREE.MeshStandardMaterial({
      color: 0xd7ad5f,
      metalness: 0.62,
      roughness: 0.34,
    })
  );
  knob.position.set(2.82, 1.2, frontZ + 0.19);
  group.add(knob);

  addHousePart(group, new THREE.BoxGeometry(7.35, 0.2, 5.2), material.trimWood, 0, 0.12, 0);

  const porchPosts = [-3.05, 3.05];
  for (const postX of porchPosts) {
    addHousePart(group, new THREE.BoxGeometry(0.2, 2.6, 0.2), material.trimWood, postX, 1.4, 3.3);
  }

  addHousePart(group, new THREE.BoxGeometry(7.2, 0.18, 1.15), material.warmWood, 0, 2.65, 2.75);

  const lantern = new THREE.Group();
  lantern.position.set(1.25, 3.4, 2.9);
  addHousePart(lantern, new THREE.BoxGeometry(0.42, 0.56, 0.42), material.trimWood, 0, 0, 0);
  addHousePart(
    lantern,
    new THREE.BoxGeometry(0.24, 0.36, 0.26),
    new THREE.MeshBasicMaterial({ color: 0xffd27c }),
    0,
    0,
    0.03
  );
    }
  addHousePart(lantern, new THREE.BoxGeometry(0.52, 0.08, 0.5), material.trimWood, 0, 0.32, 0);
  group.add(lantern);

  const porchLight = new THREE.PointLight(0xffc978, 0.65, 8);
  porchLight.position.set(1.2, 3.3, 3.5);
  group.add(porchLight);

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  scene.add(group);
}

function addRoofSlope(group, side) {
  const eaveX = side * 4;
  const ridgeY = 6.42;
  const eaveY = 4.05;
  const frontZ = 2.55;
  const backZ = -2.55;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      0, ridgeY, frontZ,
      eaveX, eaveY, frontZ,
      0, ridgeY, backZ,
      eaveX, eaveY, backZ,
    ], 3)
  );
  geometry.setIndex([0, 1, 2, 1, 3, 2]);
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2)
  );
  geometry.computeVertexNormals();

  const roof = new THREE.Mesh(geometry, material.roof);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.25, 6.4),
    material.trimWood
  );
  beam.position.set(eaveX, eaveY - 0.05, 0);
  beam.castShadow = true;
  group.add(beam);
}

function glassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x668b86,
    emissive: 0x1d352d,
    emissiveIntensity: 0.35,
    roughness: 0.22,
    metalness: 0.08,
  });
}

function addHousePart(group, geometry, partMaterial, x, y, z) {
  const mesh = new THREE.Mesh(geometry, partMaterial);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createStonePath() {
  const stoneColors = [0x77796a, 0x96917a, 0x817f70, 0xaaa18a];

  for (let i = 0; i < 26; i += 1) {
    const t = i / 25;
    const z = 2.7 + t * 16;
    const x = 9.6 - t * 4.4 + Math.sin(t * 5) * 0.5;
    const sizeX = 0.78 + random() * 0.7;
    const sizeZ = 0.55 + random() * 0.58;
    const shape = new THREE.Shape();
    const points = 7;

    for (let point = 0; point < points; point += 1) {
      const angle = (point / points) * Math.PI * 2;
      const radius = 0.77 + random() * 0.35;
      const px = Math.cos(angle) * sizeX * radius;
      const py = Math.sin(angle) * sizeZ * radius;
      if (point === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }

    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);

    const stone = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: stoneColors[Math.floor(random() * stoneColors.length)],
        roughness: 1,
        side: THREE.DoubleSide,
      })
    );

    stone.position.set(x, terrainHeight(x, z) + 0.045 + random() * 0.025, z);
    stone.rotation.y = (random() - 0.5) * 0.36;
    stone.receiveShadow = true;
    scene.add(stone);
  }
}

function createFence() {
  const fenceMaterial = new THREE.MeshStandardMaterial({
    map: material.warmWood.map || makeWoodTexture(),
    color: 0x94714c,
    roughness: 0.94,
  });

  const fenceZ = 8.6;
  const sections = [
    [4.2, 7.6],
    [9.4, 18.5],
  ];

  for (const [start, end] of sections) {
    for (let x = start; x <= end; x += 1.65) {
      const y = terrainHeight(x, fenceZ);

      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 1.35, 0.2),
        material.trimWood
      );
      post.position.set(x, y + 0.67, fenceZ);
      post.castShadow = true;
      post.receiveShadow = true;
      scene.add(post);
    }

    const middleX = (start + end) / 2;
    const middleY = terrainHeight(middleX, fenceZ);

    for (const railY of [0.48, 0.98]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(end - start, 0.16, 0.18),
        fenceMaterial
      );
      rail.position.set(middleX, middleY + railY, fenceZ);
      rail.castShadow = true;
      rail.receiveShadow = true;
      scene.add(rail);
    }
  }

  const gatePost = new THREE.Mesh(
    new THREE.BoxGeometry(0.23, 1.45, 0.23),
    material.trimWood
  );
  gatePost.position.set(8.5, terrainHeight(8.5, fenceZ) + 0.72, fenceZ);
  gatePost.castShadow = true;
  scene.add(gatePost);
}

/* -------------------------------------------------------------------------- */
/* Deterministic helpers                                                      */
/* -------------------------------------------------------------------------- */

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function seededRandom(seed) {
  let value = seed >>> 0;

  return function nextRandom() {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smoothstep(0, 1, x - x0);
  const tz = smoothstep(0, 1, z - z0);

  const a = hash(x0, z0);
  const b = hash(x0 + 1, z0);
  const c = hash(x0, z0 + 1);
  const d = hash(x0 + 1, z0 + 1);

  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, tx),
    THREE.MathUtils.lerp(c, d, tx),
    tz
  );
}

function hash(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7 + 841.92) * 43758.5453123;
  return value - Math.floor(value);
  }

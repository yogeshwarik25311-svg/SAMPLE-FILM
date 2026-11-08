import * as THREE from
  "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// ---------- SCENE ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color("#b6d9ed");
scene.fog = new THREE.Fog("#b6d9ed", 24, 100);

const camera = new THREE.PerspectiveCamera(
  48, 9 / 16, 0.1, 180
);
camera.position.set(0, 6, 19);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(
  document.getElementById("stage").clientWidth,
  document.getElementById("stage").clientHeight
);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.getElementById("stage").appendChild(renderer.domElement);
document.getElementById("loading").remove();

// ---------- LIGHTING ----------
scene.add(new THREE.HemisphereLight("#e5f5ff", "#526b43", 2));

const sun = new THREE.DirectionalLight("#fff1d4", 3);
sun.position.set(-12, 20, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// ---------- MATERIALS ----------
const mat = (color, roughness = 1) =>
  new THREE.MeshStandardMaterial({ color, roughness });

// ---------- MOUNTAIN GENERATOR ----------
function mountainRange(z, width, height, colors) {
  const nx = 110, nz = 28;
  const positions = [], indices = [], vertexColors = [];

  const peaks = [
    [-0.85, .65, .10], [-0.62, .9, .12],
    [-0.32, .55, .13], [-0.05, 1, .10],
    [0.24, .72, .13], [0.53, .95, .11],
    [0.82, .62, .14]
  ];

  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const x = (u - .5) * width;
      const v = j / nz;

      let ridge = .07;
      for (const [p, h, w] of peaks) {
        ridge = Math.max(
          ridge,
          h * Math.exp(-((u - (p + 1) / 2) ** 2) / w)
        );
      }

      const y = ridge * height * (1 - v * .78);
      positions.push(x, y - .4, v * 22);

      const blend = Math.min(1, y / (height * .7));
      const c = new THREE.Color(colors[0]).lerp(
        new THREE.Color(colors[1]), blend
      );
      vertexColors.push(c.r, c.g, c.b);

      if (i < nx && j < nz) {
        const a = j * (nx + 1) + i;
        const b = a + nx + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position",
    new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color",
    new THREE.Float32BufferAttribute(vertexColors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mountain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true
    })
  );

  mountain.position.z = z;
  mountain.receiveShadow = true;
  scene.add(mountain);
}

mountainRange(-43, 85, 17, ["#315b70", "#d2dce0"]);
mountainRange(-31, 72, 12, ["#416c69", "#b9c8b0"]);

// ---------- MEADOW ----------
const groundGeo = new THREE.PlaneGeometry(100, 100, 65, 65);
groundGeo.rotateX(-Math.PI / 2);

const p = groundGeo.attributes.position;
for (let i = 0; i < p.count; i++) {
  const x = p.getX(i), z = p.getZ(i);
  p.setY(i,
    -.5 + Math.sin(x * .12) * .18 +
    Math.cos(z * .15) * .13
  );
}
groundGeo.computeVertexNormals();

const ground = new THREE.Mesh(
  groundGeo,
  mat("#63864b")
);
ground.position.z = -13;
ground.receiveShadow = true;
scene.add(ground);

// ---------- TREES ----------
function tree(x, z, scale = 1) {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(.13, .2, 2.2, 7),
    mat("#62452e")
  );
  trunk.position.y = 1;
  group.add(trunk);

  for (let i = 0; i < 3; i++) {
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(1.15 - i * .2, 2.5, 8),
      mat(["#315e43", "#477b4e", "#60915a"][i])
    );
    leaves.position.y = 2.1 + i * .85;
    group.add(leaves);
  }

  group.position.set(x, -.3, z);
  group.scale.setScalar(scale);
  group.traverse(o => {
    if (o.isMesh) o.castShadow = true;
  });
  scene.add(group);
}

tree(-5, -6, 1.7);
tree(-7, -13, 1.1);
tree(7, -14, 1.2);
tree(6, -2, .8);

// ---------- LITTLE HOUSE ----------
const house = new THREE.Group();

const walls = new THREE.Mesh(
  new THREE.BoxGeometry(3.4, 2.5, 2.8),
  mat("#d6b98e")
);
walls.position.y = 1;
walls.castShadow = true;
house.add(walls);

const roof = new THREE.Mesh(
  new THREE.ConeGeometry(2.5, 1.7, 4),
  mat("#70463d")
);
roof.rotation.y = Math.PI / 4;
roof.position.y = 3;
roof.castShadow = true;
house.add(roof);

const door = new THREE.Mesh(
  new THREE.BoxGeometry(.65, 1.45, .08),
  mat("#60442f")
);
door.position.set(0, .7, 1.44);
house.add(door);

const windowMat = new THREE.MeshStandardMaterial({
  color: "#a8d9e8",
  emissive: "#294d5c",
  emissiveIntensity: .25
});

for (const x of [-1, 1]) {
  const window = new THREE.Mesh(
    new THREE.BoxGeometry(.65, .65, .08),
    windowMat
  );
  window.position.set(x, 1.35, 1.44);
  house.add(window);
}

house.position.set(4, -.4, -7);
house.scale.setScalar(.9);
scene.add(house);

// ---------- MOVING CLOUDS ----------
const clouds = [];

function cloud(x, y, z, scale) {
  const group = new THREE.Group();

  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 9),
      new THREE.MeshStandardMaterial({
        color: "#f5fbff",
        roughness: 1
      })
    );
    puff.position.set(i * .8, Math.sin(i) * .25, 0);
    puff.scale.set(1.1, .65, .7);
    group.add(puff);
  }

  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  scene.add(group);
  clouds.push(group);
}

cloud(-7, 12, -18, 1.4);
cloud(4, 15, -25, 1.8);
cloud(9, 10, -12, 1);

// ---------- FOREGROUND GRASS ----------
const grassGeo = new THREE.ConeGeometry(.045, .42, 4);
const grass = new THREE.InstancedMesh(
  grassGeo, mat("#8eaa58"), 550
);

const dummy = new THREE.Object3D();

for (let i = 0; i < 550; i++) {
  dummy.position.set(
    (Math.random() - .5) * 35,
    -.25,
    -24 + Math.random() * 27
  );
  dummy.rotation.z = (Math.random() - .5) * .3;
  dummy.scale.setScalar(.5 + Math.random());
  dummy.updateMatrix();
  grass.setMatrixAt(i, dummy.matrix);
}
scene.add(grass);

// ---------- CINEMATIC CAMERA ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const time = clock.getElapsedTime();
  const progress = (time % 10) / 10;
  const smooth = progress * progress * (3 - 2 * progress);

  camera.position.z = 19 - smooth * 5;
  camera.position.y = 6 - smooth * 1.2;
  camera.position.x = Math.sin(progress * Math.PI) * .65;

  camera.lookAt(
    Math.sin(progress * Math.PI) * .4,
    3.5,
    -13
  );

  clouds.forEach((c, i) => {
    c.position.x += .002 + i * .0003;
    if (c.position.x > 16) c.position.x = -16;
  });

  grass.rotation.z = Math.sin(time * 1.4) * .008;

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  const stage = document.getElementById("stage");
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(stage.clientWidth, stage.clientHeight);
});

animate();

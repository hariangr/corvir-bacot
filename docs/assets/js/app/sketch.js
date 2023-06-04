const mappa = new Mappa("Leaflet");
let trainMap;
let canvas;
let visualizes;

let width = window.innerWidth;
let height = window.innerHeight;

let data = [];

let meterToPxUnit = 0;

const config = {
  // drawOffside: false, // Draw area yang cob nya berada diluar viewport (Untuk meningkatkan performa)
};

const options = {
  lat: 0.7893,
  lng: 120.9213,
  zoom: 4.3,
  style: "http://{s}.tile.osm.org/{z}/{x}/{y}.png",
};

function windowResized() {
  width = window.innerWidth;
  height = window.innerHeight;

  resizeCanvas(width, height);
}

function preload() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlDefault = "assets/datasets/level2.min.json";
  const url = urlParams.get("dataset") ?? urlDefault;

  visualizes = loadJSON(url);
  if (!visualizes || visualizes == null || visualizes.length == 0) {
    visualizes = loadJSON(urlDefault);
  }
  
  document.getElementById("loadingIndicator").classList.add("hideLoading");
}

function setup() {
  canvas = createCanvas(width, height);
  canvas.position(0, 0);
  canvas.class("p5canvas");

  trainMap = mappa.tileMap(options);
  trainMap.overlay(canvas);
  trainMap.onChange(() => {
    meterToPxUnit = getMeterToPx();
  });
}

function drawOneRegion(
  label,
  cob,
  coordinates,
  radius,
  outmostCord,
  neighborIds
) {
  const midPoint = trainMap.latLngToPixel(cob.latitude, cob.longitude);
  fill(0, 0, 200, 255);
  const scl = pow(2, trainMap.zoom());

  // Midpoint
  if (
    midPoint.x < 0 ||
    midPoint.x > width ||
    midPoint.y < 0 ||
    midPoint.y > height
  ) {
    return;
  }
  ellipse(midPoint.x, midPoint.y, 0.05 * scl);

  // Label
  // textSize(16);
  // fill(0, 102, 153);
  // text(label, midPoint.x, midPoint.y - 10);

  // Area
  fill(255, 0, 200, 100);
  beginShape();
  for (const it of coordinates) {
    const pix = trainMap.latLngToPixel(it[0], it[1]);
    vertex(pix.x, pix.y);
  }
  endShape(CLOSE);

  // Outer Bound
  /*
  noFill();
  // console.log(trainMap.zoom());
  stroke(255, 0, 0);
  const _rad = radius * meterToPxUnit;
  // circle(midPoint.x, midPoint.y, _rad);
  */

  // Outermost Cord
  /*
  fill(100);
  stroke(0, 255, 0);
  const xy = trainMap.latLngToPixel(outmostCord[0], outmostCord[1]);
  ellipse(xy.x, xy.y, 5);
  */

  // Neighbor Connector
  if (neighborIds != null && neighborIds.length > 0) {
    for (const n of neighborIds) {
      const midpointNeighbor = [
        visualizes[n].cob["latitude"],
        visualizes[n].cob["longitude"],
      ];
      drawNeighborConnector(
        [cob["latitude"], cob["longitude"]],
        midpointNeighbor
      );
    }
  } else {
    // console.log(label + " doesn't have children");
  }
}

function drawNeighborConnector(aCord, bCord) {
  const aPx = trainMap.latLngToPixel(aCord[0], aCord[1]);
  const bPx = trainMap.latLngToPixel(bCord[0], bCord[1]);

  stroke(100);
  line(aPx.x, aPx.y, bPx.x, bPx.y);
}

function getMeterToPx() {
  const a = [40.741895, -73.989308];
  const b = [4.334316, 95.953518];

  _distanceAToB = 14899240.620745627; // Meters
  const aPx = trainMap.latLngToPixel(a[0], a[1]);
  const bPx = trainMap.latLngToPixel(b[0], b[1]);

  const xComp = (aPx.x - bPx.x) ** 2;
  const yComp = (aPx.y - bPx.y) ** 2;
  const distPx = Math.sqrt(xComp + yComp);

  return distPx / _distanceAToB; // Return 1 meter dalam satuan pixel
}

function draw() {
  clear();

  for (let i = 0; i < Object.keys(visualizes).length; i++) {
    const it = visualizes[i];

    // drawOneRegion("ID " + it.id, it.cob, it.c, it.radius, it.outmostCord, it.neighbor);
    drawOneRegion(
      "ID " + it.id,
      it.cob,
      [],
      it.radius,
      it.outmostCord,
      it.neighbor
    );
  }

  nextFrameBfs();
  drawSourceGoalPointer();
  if (sourceId != undefined && goalId != undefined) {
    if (traceback.length > 0) {
      drawCurrentLine(goalId);
    }
  }
}

/* BFS */
let queueIds = []; // Simpan id saja disini, memori kasian
let visitedIds = []; // Jangan dua kali mengecek sebuah node
let parentRelation = [];
let sourceId;
let goalId;
let traceback = []; // id, Kalau udah non empty, artinya udah ketemu. Dimulai dari goal, ke source (Dibalik)
let tracebackPixPath = []; // Kalau udah finish tampilkan line nya, cached
function newBFS(_idSource, _idGoal) {
  queueIds = [_idSource];
  sourceId = _idSource;
  goalId = _idGoal;
  visitedIds = [];
  tracebackPixPath = [];
  traceback = [];
  parentRelation = new Array(Object.keys(visualizes).length);
}
function tracebackPath(_idSource, _idGoal) {
  let _path = [_idGoal];
  let lastChecked = _idGoal;
  while (true) {
    const it = parentRelation[lastChecked];
    if (_idSource == _idGoal) {
      return _path;
    }

    if (it == _idSource) {
      _path.push(it);
      return _path;
    }

    if (it == undefined) {
      throw new Error("No parent for id " + lastChecked);
    }

    _path.push(it);
    lastChecked = it;
  }
}
let stopBfsFrame = false;
function nextFrameBfs() {
  if (stopBfsFrame) {
    return;
  }

  if (queueIds.length > 0 && traceback.length == 0) {
    const curId = queueIds.shift(); // Ambil id paling kiri di queue dan hapus dari queue
    visitedIds.push(curId);

    const it = visualizes[curId];
    if (it["id"] == goalId) {
      // Ketemu

      // Traceback
      traceback = tracebackPath(sourceId, curId);

      const event = new CustomEvent("bfs-finish", {
        detail: { traceback },
      });
      document.dispatchEvent(event);
      return;
    }

    drawCurrentLine(curId);

    const forQueue = it["neighbor"];
    for (const it of forQueue) {
      if (!visitedIds.includes(it) && !queueIds.includes(it)) {
        queueIds.push(it);
        parentRelation[it] = curId;
      }
    }
  } else {
  }
}
function drawSourceGoalPointer() {
  push();
  if (uiSourceId != undefined) {
    const src = visualizes[uiSourceId];
    const pixSrc = trainMap.latLngToPixel(src.cob.latitude, src.cob.longitude);
    fill(255, 0, 255);
    circle(pixSrc.x, pixSrc.y, 15);
  }

  if (uiGoalId != undefined) {
    const gol = visualizes[uiGoalId];
    const pixGol = trainMap.latLngToPixel(gol.cob.latitude, gol.cob.longitude);
    fill(0, 255, 255);
    circle(pixGol.x, pixGol.y, 15);
  }
  pop();
}
function drawCurrentLine(currentId) {
  const backPath = tracebackPath(sourceId, currentId);
  let _cords = {};

  if (backPath.length < 2) {
    return;
  }

  for (const it of backPath) {
    const _obj = visualizes[it];
    const pix = trainMap.latLngToPixel(_obj.cob.latitude, _obj.cob.longitude);
    _cords[it] = pix;
  }

  let lastCord = backPath[0];
  for (let i = 0; i < backPath.length; i++) {
    const it = backPath[i];
    const cur = _cords[it];
    push();
    strokeWeight(4); // Thicker
    stroke(0, 255, 0);
    text(visualizes[it].h[2], cur.x, cur.y - 10);
    line(lastCord.x, lastCord.y, cur.x, cur.y);
    pop();
    lastCord = cur;
  }
}
function tempSearch(src, gol) {
  newBFS(src, gol);
}

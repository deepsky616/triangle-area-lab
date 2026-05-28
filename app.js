const sourceSvg = document.querySelector("#sourceSvg");
const sourceTriangle = document.querySelector("#sourceTriangle");
const vertexHandles = document.querySelector("#vertexHandles");
const baseLine = document.querySelector("#baseLine");
const heightLine = document.querySelector("#heightLine");
const baseLabel = document.querySelector("#baseLabel");
const heightLabel = document.querySelector("#heightLabel");
const stage = document.querySelector("#stage");
const stageSvg = document.querySelector("#stageSvg");
const hint = document.querySelector("#hint");

const baseValue = document.querySelector("#baseValue");
const heightValue = document.querySelector("#heightValue");
const rectValue = document.querySelector("#rectValue");
const areaValue = document.querySelector("#areaValue");

const palette = ["#f7c948", "#72d6c9", "#f18f7e", "#9bb7ff", "#c8df72", "#f6a6d8"];
let triangle = [
  { x: 80, y: 140 },
  { x: 180, y: 140 },
  { x: 130, y: 60 },
];
let pieces = [];
let selectedId = null;
let nextId = 1;
let showGuide = false;
let guideState = null;
let sourceDragIndex = null;
let pieceDrag = null;
let guideDrag = null;

function pointsToString(points) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function clonePoints(points) {
  return points.map((point) => ({ ...point }));
}

function getBaseHeight() {
  const [a, b, c] = triangle;
  const base = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return { base, height: area2 / base, area: area2 / 2 };
}

function nearestPointOnBase() {
  const [a, b, c] = triangle;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function updateSource() {
  sourceTriangle.setAttribute("points", pointsToString(triangle));
  const [a, b, c] = triangle;
  const foot = nearestPointOnBase();
  baseLine.setAttribute("x1", a.x);
  baseLine.setAttribute("y1", a.y);
  baseLine.setAttribute("x2", b.x);
  baseLine.setAttribute("y2", b.y);
  heightLine.setAttribute("x1", c.x);
  heightLine.setAttribute("y1", c.y);
  heightLine.setAttribute("x2", foot.x);
  heightLine.setAttribute("y2", foot.y);
  baseLabel.setAttribute("x", (a.x + b.x) / 2 - 14);
  baseLabel.setAttribute("y", a.y + 24);
  heightLabel.setAttribute("x", (c.x + foot.x) / 2 + 8);
  heightLabel.setAttribute("y", (c.y + foot.y) / 2);

  vertexHandles.replaceChildren(
    ...triangle.map((point, index) => {
      const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      handle.setAttribute("class", "handle");
      handle.setAttribute("cx", point.x);
      handle.setAttribute("cy", point.y);
      handle.setAttribute("r", 9);
      handle.dataset.index = index;
      return handle;
    }),
  );

  const { base, height, area } = getBaseHeight();
  baseValue.textContent = `${Math.round(base)} 칸`;
  heightValue.textContent = `${Math.round(height)} 칸`;
  rectValue.textContent = `${Math.round(base * height).toLocaleString()} 칸²`;
  areaValue.textContent = `${Math.round(area).toLocaleString()} 칸²`;
}

function normalize(points) {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  return points.map((point) => ({ x: point.x - minX, y: point.y - minY }));
}

function makePiece(points, x = 120, y = 120) {
  return {
    id: nextId++,
    points: normalize(points),
    x,
    y,
    rotation: 0,
    flip: 1,
    color: palette[(nextId - 2) % palette.length],
  };
}

function addPiece() {
  const piece = makePiece(triangle, 120 + pieces.length * 26, 120 + pieces.length * 18);
  pieces.push(piece);
  selectedId = piece.id;
  renderStage();
}

function selectedPiece() {
  return pieces.find((piece) => piece.id === selectedId);
}

function cloneSelected() {
  const piece = selectedPiece();
  if (!piece) return addPiece();
  const copy = {
    ...piece,
    id: nextId++,
    points: clonePoints(piece.points),
    x: piece.x + 34,
    y: piece.y + 34,
    color: palette[(nextId - 2) % palette.length],
  };
  pieces.push(copy);
  selectedId = copy.id;
  renderStage();
}

function cutSelected() {
  const piece = selectedPiece();
  if (!piece || piece.points.length !== 3) return;
  const [a, b, c] = piece.points;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const left = makePiece([a, mid, c], piece.x, piece.y);
  const right = makePiece([mid, b, c], piece.x + 26, piece.y + 18);
  left.rotation = piece.rotation;
  right.rotation = piece.rotation;
  left.flip = piece.flip;
  right.flip = piece.flip;
  pieces = pieces.filter((item) => item.id !== piece.id).concat(left, right);
  selectedId = right.id;
  renderStage();
}

function rotateSelected(amount) {
  const piece = selectedPiece();
  if (!piece) return;
  piece.rotation = (piece.rotation + amount) % 360;
  renderStage();
}

function flipSelected() {
  const piece = selectedPiece();
  if (!piece) return;
  piece.flip *= -1;
  renderStage();
}

function deleteSelected() {
  pieces = pieces.filter((piece) => piece.id !== selectedId);
  selectedId = pieces.at(-1)?.id ?? null;
  renderStage();
}

function initGuideState() {
  const vb = stageSvg.viewBox.baseVal;
  const sw = vb.width || 600;
  const sh = vb.height || 620;

  const norm = normalize(triangle);
  const [a, b, c] = norm;
  const { base, height } = getBaseHeight();
  const midBaseX = (a.x + b.x) / 2;
  const skew = c.x - midBaseX;

  const cx = sw / 2;
  const cy = sh / 2;

  guideState = {
    bl: { x: cx - base / 2, y: cy + height / 2 },
    br: { x: cx + base / 2, y: cy + height / 2 },
    tl: { x: cx - base / 2 + skew, y: cy - height / 2 },
  };
}

function renderStage() {
  sizeStageSvg();

  if (showGuide && !guideState) {
    initGuideState();
  }

  hint.classList.toggle("hidden", pieces.length > 0);
  stageSvg.replaceChildren();

  // Guide outline (behind pieces)
  if (showGuide && guideState) {
    const { bl, br, tl } = guideState;
    const tr = { x: br.x + tl.x - bl.x, y: br.y + tl.y - bl.y };

    const outline = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    outline.setAttribute("class", "piece-outline");
    outline.setAttribute("points", pointsToString([bl, br, tr, tl]));
    stageSvg.append(outline);
  }

  // Pieces
  pieces.forEach((piece) => {
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("class", `piece${piece.id === selectedId ? " selected" : ""}`);
    polygon.setAttribute("points", pointsToString(piece.points));
    polygon.setAttribute("fill", piece.color);
    polygon.setAttribute(
      "transform",
      `translate(${piece.x} ${piece.y}) rotate(${piece.rotation}) scale(${piece.flip} 1)`,
    );
    polygon.dataset.id = piece.id;
    stageSvg.append(polygon);

    if (piece.points.length === 3 && piece.id === selectedId) {
      const [a, b, c] = piece.points;
      const cut = document.createElementNS("http://www.w3.org/2000/svg", "line");
      cut.setAttribute("class", "cut-line");
      cut.setAttribute("x1", (a.x + b.x) / 2);
      cut.setAttribute("y1", (a.y + b.y) / 2);
      cut.setAttribute("x2", c.x);
      cut.setAttribute("y2", c.y);
      cut.setAttribute(
        "transform",
        `translate(${piece.x} ${piece.y}) rotate(${piece.rotation}) scale(${piece.flip} 1)`,
      );
      stageSvg.append(cut);
    }
  });

  // Guide handles (on top of pieces so always clickable)
  if (showGuide && guideState) {
    // bl: move entire guide, br: adjust width, tl: adjust height/skew
    Object.entries(guideState).forEach(([key, pt]) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("class", "guide-handle");
      circle.setAttribute("cx", pt.x);
      circle.setAttribute("cy", pt.y);
      circle.setAttribute("r", 9);
      circle.dataset.handle = key;
      stageSvg.append(circle);
    });
  }
}

function svgPoint(svg, event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

function sizeStageSvg() {
  const rect = stage.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width));
  const height = Math.max(420, Math.round(rect.height));
  stageSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  stageSvg.setAttribute("width", width);
  stageSvg.setAttribute("height", height);
}

sourceSvg.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest(".handle");
  if (!handle) return;
  sourceDragIndex = Number(handle.dataset.index);
  sourceSvg.setPointerCapture(event.pointerId);
});

sourceSvg.addEventListener("pointermove", (event) => {
  if (sourceDragIndex === null) return;
  const point = svgPoint(sourceSvg, event);
  triangle[sourceDragIndex] = {
    x: Math.max(20, Math.min(240, point.x)),
    y: Math.max(24, Math.min(166, point.y)),
  };
  updateSource();
});

sourceSvg.addEventListener("pointerup", () => {
  sourceDragIndex = null;
});

stageSvg.addEventListener("pointerdown", (event) => {
  // Guide handle takes priority over pieces
  const handleEl = event.target.closest(".guide-handle");
  if (handleEl && showGuide && guideState) {
    const key = handleEl.dataset.handle;
    const point = svgPoint(stageSvg, event);
    guideDrag = {
      key,
      ox: point.x - guideState[key].x,
      oy: point.y - guideState[key].y,
    };
    stageSvg.setPointerCapture(event.pointerId);
    return;
  }

  const target = event.target.closest(".piece");
  if (!target) return;
  const id = Number(target.dataset.id);
  selectedId = id;
  const piece = selectedPiece();
  const point = svgPoint(stageSvg, event);
  pieceDrag = { id, dx: point.x - piece.x, dy: point.y - piece.y };
  stageSvg.setPointerCapture(event.pointerId);
  renderStage();
});

stageSvg.addEventListener("pointermove", (event) => {
  if (guideDrag) {
    const point = svgPoint(stageSvg, event);
    const newPos = { x: point.x - guideDrag.ox, y: point.y - guideDrag.oy };

    if (guideDrag.key === "bl") {
      // bl handle moves the entire parallelogram
      const dx = newPos.x - guideState.bl.x;
      const dy = newPos.y - guideState.bl.y;
      guideState.bl = newPos;
      guideState.br = { x: guideState.br.x + dx, y: guideState.br.y + dy };
      guideState.tl = { x: guideState.tl.x + dx, y: guideState.tl.y + dy };
    } else {
      // br adjusts base width, tl adjusts height/skew
      guideState[guideDrag.key] = newPos;
    }

    renderStage();
    return;
  }

  if (!pieceDrag) return;
  const piece = pieces.find((item) => item.id === pieceDrag.id);
  if (!piece) return;
  const point = svgPoint(stageSvg, event);
  piece.x = point.x - pieceDrag.dx;
  piece.y = point.y - pieceDrag.dy;
  renderStage();
});

stageSvg.addEventListener("pointerup", () => {
  guideDrag = null;
  pieceDrag = null;
});

document.querySelector("#addPieceBtn").addEventListener("click", addPiece);
document.querySelector("#cloneBtn").addEventListener("click", cloneSelected);
document.querySelector("#cutBtn").addEventListener("click", cutSelected);
document.querySelector("#rotateLeftBtn").addEventListener("click", () => rotateSelected(-15));
document.querySelector("#rotateRightBtn").addEventListener("click", () => rotateSelected(15));
document.querySelector("#flipBtn").addEventListener("click", flipSelected);
document.querySelector("#deleteBtn").addEventListener("click", deleteSelected);
document.querySelector("#guideBtn").addEventListener("click", () => {
  showGuide = !showGuide;
  renderStage();
});
document.querySelector("#resetBtn").addEventListener("click", () => {
  pieces = [];
  selectedId = null;
  showGuide = false;
  guideState = null;
  renderStage();
});

stage.addEventListener("keydown", (event) => {
  const piece = selectedPiece();
  if (!piece) return;
  const step = event.shiftKey ? 16 : 6;
  if (event.key === "ArrowLeft") piece.x -= step;
  if (event.key === "ArrowRight") piece.x += step;
  if (event.key === "ArrowUp") piece.y -= step;
  if (event.key === "ArrowDown") piece.y += step;
  if (event.key.toLowerCase() === "r") piece.rotation += 15;
  renderStage();
});

new ResizeObserver(renderStage).observe(stage);
updateSource();
renderStage();

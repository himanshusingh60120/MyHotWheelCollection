// =====================================================================
//  HIMANSHU'S HOT WHEELS GARAGE
//  Data plumbing untouched. Everything else got a spoiler and neons.
// =====================================================================

// --- Google API & Spreadsheet Keys (DO NOT TOUCH — the garage runs on these) ---
const GOOGLE_API_KEY = "AIzaSyCGB6F8rosJD_g4e6diqpplrdbkQsj-eQY";
const SPREADSHEET_ID = "1n0xWyZzJ1lDRuAgy4prTy_FxEmzCls2IxcGn7pXKRWg";

// --- DOM Element References ---
const collectionContainer = document.querySelector('.collection-container');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const emptyNote = document.getElementById('empty-note');

// Modal refs
const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalImage = document.getElementById('modal-image');
const modalTitle = document.getElementById('modal-title');
const modalVerdict = document.getElementById('modal-verdict');
const modalSpecs = document.getElementById('modal-specs');
const modalInfo = document.getElementById('modal-info');

// Number formatter for Indian Rupees (same as before)
const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
});

// Full car list lives here after fetch, so search/sort don't re-hit the API
let allCars = [];

/**
 * Robust helper to convert currency strings into numbers.
 * This strips symbols and commas to ensure math operations work.
 */
const parseCurrency = (valueString) => {
    if (!valueString) return 0;
    const numericValue = parseFloat(valueString.toString().replace(/[^0-9.]/g, ''));
    return isNaN(numericValue) ? 0 : numericValue;
};

// =====================================================================
//  THREE.JS HERO — one flowing infinity circuit:
//  flyover bridge → loop ornament → far sweep → kicker jump →
//  underpass → elevated colonnade → back over the bridge. Repeat forever.
// =====================================================================
(function initHero() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas || typeof THREE === 'undefined') return; // no canvas, no circus

    // ---------- Scene basics ----------
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d0e12, 24, 52);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ---------- Lights: warm key + neon accents ----------
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(8, 14, 10);
    scene.add(keyLight);
    const loopGlow = new THREE.PointLight(0xff5a1f, 1.3, 26);
    loopGlow.position.set(6, 3, 6);
    scene.add(loopGlow);
    const coolGlow = new THREE.PointLight(0x2f7bff, 0.6, 30);
    coolGlow.position.set(-9, 4, -6);
    scene.add(coolGlow);

    // Everything track-related lives in one group so it can sway together
    const world = new THREE.Group();
    scene.add(world);

    // ---------- Floor: dark, with a soft warm pool of light ----------
    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(45, 48),
        new THREE.MeshStandardMaterial({ color: 0x101218, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    world.add(floor);

    // Radial glow under the circuit (skipped gracefully if unavailable)
    if (typeof document.createElement === 'function') {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
        g.addColorStop(0, 'rgba(255, 110, 40, 0.55)');
        g.addColorStop(0.55, 'rgba(255, 90, 31, 0.16)');
        g.addColorStop(1, 'rgba(255, 90, 31, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
        const glow = new THREE.Mesh(
            new THREE.PlaneGeometry(34, 22),
            new THREE.MeshBasicMaterial({
                map: new THREE.CanvasTexture(c),
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            })
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.0;
        world.add(glow);
    }

    // ---------- THE CIRCUIT: a figure-eight that never stops flowing ----------
    // One closed spline. The cars follow ALL of it; the orange track is only
    // drawn where there's plastic — the small missing bit is the kicker jump.
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const controlPoints = [
        // Flyover bridge — the crown of the circuit
        V(0.0, 1.75, 0.0),
        // Sweep down into the right lobe
        V(2.6, 0.9, 1.9),
        V(4.4, 0.18, 2.9),
        // The loop ornament (slight z-drift so it never clips itself)
        V(6.0, 0.08, 3.0),
        V(7.15, 1.25, 2.9),
        V(6.0, 2.4, 2.8),
        V(4.85, 1.25, 2.7),
        V(6.0, 0.08, 2.6),
        // Out to the far right sweep
        V(8.3, 0.12, 2.1),
        V(10.3, 0.2, 0.5),
        V(10.3, 0.22, -1.6),
        // Kicker jump on the back straight
        V(8.6, 0.55, -3.0),
        // *** the little flight ***
        V(6.9, 0.9, -3.15),
        // Landing
        V(5.1, 0.45, -2.95),
        V(2.8, 0.18, -1.9),
        // Underneath the bridge
        V(0.0, 0.05, 0.0),
        // Left lobe: a long, rising, elevated sweep on a colonnade
        V(-4.5, 0.45, 2.9),
        V(-8.0, 0.8, 3.2),
        V(-10.3, 1.15, 1.4),
        V(-10.3, 1.3, -1.4),
        V(-8.0, 1.45, -3.1),
        V(-4.5, 1.6, -2.6),
        // …and back up onto the bridge. Closed.
    ];
    const curve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.5);

    // ---------- Frames along the curve (smooth, no flipping) ----------
    const SEGS = 900;
    const frames = curve.computeFrenetFrames(SEGS, true);
    const N = frames.tangents.length;
    const pts = [];
    for (let i = 0; i < N; i++) pts.push(curve.getPointAt(i / (N - 1)));

    // Parallel-transport frames start with an arbitrary twist —
    // rotate the whole frame field so "up" at the start is actually up.
    (function alignFrames() {
        const t0 = frames.tangents[0];
        const up = new THREE.Vector3(0, 1, 0);
        const desired = up.clone().sub(t0.clone().multiplyScalar(up.dot(t0))).normalize();
        const n0 = frames.normals[0];
        const angle = Math.atan2(new THREE.Vector3().crossVectors(n0, desired).dot(t0), n0.dot(desired));
        for (let i = 0; i < N; i++) {
            frames.normals[i].applyAxisAngle(frames.tangents[i], angle);
            frames.binormals[i].applyAxisAngle(frames.tangents[i], angle);
        }
    })();

    // Which samples are the jump? (the short airborne stretch on the back straight)
    const isGap = pts.map(p => p.z < -2.35 && p.x > 5.6 && p.x < 8.3);

    // ---------- Build the orange track ribbon + yellow rails ----------
    const HALF_W = 0.42;
    const trackMat = new THREE.MeshStandardMaterial({
        color: 0xff5a1f, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide,
    });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.4, metalness: 0.3 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.8 });

    function buildRun(indices) {
        // Ribbon
        const pos = [], norm = [], idx = [];
        indices.forEach((i, k) => {
            const p = pts[i], b = frames.binormals[i], n = frames.normals[i];
            const L = p.clone().addScaledVector(b, HALF_W);
            const R = p.clone().addScaledVector(b, -HALF_W);
            pos.push(L.x, L.y, L.z, R.x, R.y, R.z);
            norm.push(n.x, n.y, n.z, n.x, n.y, n.z);
            if (k > 0) {
                const a = (k - 1) * 2;
                idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
        geo.setIndex(idx);
        world.add(new THREE.Mesh(geo, trackMat));

        // Side rails (every 3rd point keeps the spline light)
        [HALF_W, -HALF_W].forEach(side => {
            const railPts = [];
            for (let k = 0; k < indices.length; k += 3) {
                const i = indices[k];
                railPts.push(
                    pts[i].clone()
                        .addScaledVector(frames.binormals[i], side)
                        .addScaledVector(frames.normals[i], 0.06)
                );
            }
            if (railPts.length < 2) return;
            const railCurve = new THREE.CatmullRomCurve3(railPts);
            world.add(new THREE.Mesh(
                new THREE.TubeGeometry(railCurve, railPts.length * 2, 0.055, 6, false),
                railMat
            ));
        });

        // Support pillars under anything elevated — the colonnade look
        for (let k = 0; k < indices.length; k += 22) {
            const i = indices[k];
            const p = pts[i];
            if (p.y < 0.5) continue;
            // Keep the loop's interior and the underpass clear
            const inLoopZone = p.x > 4.4 && p.x < 7.7 && p.z > 2.2;
            const inCrossover = Math.abs(p.x) < 1.4 && Math.abs(p.z) < 1.4;
            if (inLoopZone || inCrossover) continue;
            const h = p.y - 0.04;
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 8), pillarMat);
            pillar.position.set(p.x, h / 2, p.z);
            world.add(pillar);
        }
    }

    // Split the closed sample loop into contiguous runs of actual track,
    // starting just after the gap so no run wraps the seam.
    let gapStart = isGap.indexOf(true);
    if (gapStart < 0) gapStart = 0;
    let run = [];
    for (let s = 0; s <= N; s++) {
        const i = (gapStart + s) % N;
        if (!isGap[i]) {
            run.push(i);
        } else if (run.length > 1) {
            buildRun(run);
            run = [];
        }
    }
    if (run.length > 1) buildRun(run);

    // ---------- Turbo booster before the loop (spinning yellow wheels) ----------
    const spinners = [];
    (function buildBooster() {
        const target = V(3.6, 0.3, 2.75);
        let best = 0, bestD = Infinity;
        for (let i = 0; i < N; i++) {
            if (isGap[i]) continue;
            const d = pts[i].distanceToSquared(target);
            if (d < bestD) { bestD = d; best = i; }
        }
        const p = pts[best], b = frames.binormals[best], t = frames.tangents[best];

        const boost = new THREE.Group();
        [1, -1].forEach(side => {
            const spin = new THREE.Group();
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.26, 0.26, 0.16, 16),
                railMat
            );
            spin.add(wheel);
            spin.position.copy(p)
                .addScaledVector(b, side * (HALF_W + 0.2))
                .add(V(0, 0.28, 0));
            boost.add(spin);
            spinners.push(spin);

            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), pillarMat);
            post.position.copy(spin.position).add(V(0, -0.2, 0));
            boost.add(post);
        });
        const arch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, (HALF_W + 0.4) * 2), trackMat);
        arch.position.copy(p).add(V(0, 0.68, 0));
        arch.lookAt(p.clone().add(t));
        boost.add(arch);
        world.add(boost);
    })();

    // ---------- The racers ----------
    function buildCar(paintColor) {
        const car = new THREE.Group();
        const paint = new THREE.MeshStandardMaterial({ color: paintColor, roughness: 0.25, metalness: 0.7 });
        const glass = new THREE.MeshStandardMaterial({ color: 0x0d0e12, roughness: 0.15, metalness: 0.9 });
        const tyre  = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9 });
        const rim   = new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.3, metalness: 0.8 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.34, 0.8), paint);
        body.position.y = 0.28;
        car.add(body);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 0.68), glass);
        cabin.position.set(-0.1, 0.58, 0);
        car.add(cabin);

        const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.85), paint);
        spoiler.position.set(-0.82, 0.62, 0);
        car.add(spoiler);
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.5), glass);
        strut.position.set(-0.8, 0.5, 0);
        car.add(strut);

        const wheels = [];
        [[0.55, 0.42], [0.55, -0.42], [-0.55, 0.42], [-0.55, -0.42]].forEach(([x, z]) => {
            const spin = new THREE.Group();
            spin.position.set(x, 0.16, z);
            const t = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 20), tyre);
            t.rotation.x = Math.PI / 2;
            const r = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.15, 12), rim);
            r.rotation.x = Math.PI / 2;
            spin.add(t, r);
            car.add(spin);
            wheels.push(spin);
        });

        car.scale.setScalar(0.7);
        return { car, wheels };
    }

    const racers = [
        { color: 0x2f7bff, offset: 0.00, lane:  0.12 },  // blue — the favourite
        { color: 0xff3b3b, offset: 0.34, lane: -0.12 },  // red — the rival
        { color: 0x2dd4a7, offset: 0.67, lane:  0.00 },  // teal — the wildcard
    ].map(cfg => {
        const built = buildCar(cfg.color);
        world.add(built.car);
        return { ...cfg, ...built };
    });

    // Pose a car at parameter u (0..1) along the circuit
    const _fwd = new THREE.Vector3(), _up = new THREE.Vector3(), _right = new THREE.Vector3();
    const _pos = new THREE.Vector3(), _m = new THREE.Matrix4();
    function poseCar(racer, u) {
        u = ((u % 1) + 1) % 1;
        const f = u * (N - 1);
        const i0 = Math.floor(f), i1 = (i0 + 1) % N, blend = f - i0;

        _up.copy(frames.normals[i0]).lerp(frames.normals[i1], blend).normalize();
        _fwd.copy(frames.tangents[i0]).lerp(frames.tangents[i1], blend).normalize();
        // Re-orthogonalise up against forward
        _up.addScaledVector(_fwd, -_up.dot(_fwd)).normalize();
        _right.crossVectors(_fwd, _up);

        _pos.copy(pts[i0]).lerp(pts[i1], blend)
            .addScaledVector(_up, 0.03)
            .addScaledVector(frames.binormals[i0], racer.lane);

        racer.car.position.copy(_pos);
        _m.makeBasis(_fwd, _up, _right);
        racer.car.quaternion.setFromRotationMatrix(_m);
    }

    // ---------- A few drifting sparks, kept quiet ----------
    const starGeo = new THREE.BufferGeometry();
    const starCount = 120;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
        positions[i]     = (Math.random() - 0.5) * 50;
        positions[i + 1] = Math.random() * 14;
        positions[i + 2] = (Math.random() - 0.5) * 34 - 4;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xff8a50, size: 0.06, transparent: true, opacity: 0.4 })
    );
    scene.add(stars);

    // ---------- Camera, parallax, resize ----------
    const mouse = { x: 0, y: 0 };
    window.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    });

    let camDist = 17, camHeight = 6.6;
    function resize() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }
        // Pull back on narrow screens so the whole circuit stays in frame
        const a = camera.aspect;
        camDist = a > 1.6 ? 16.5 : a > 1.1 ? 20 : a > 0.8 ? 26 : 32;
        camHeight = a > 1.1 ? 6.6 : 8;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();
    const LAP_SECONDS = 12;

    function animate() {
        requestAnimationFrame(animate);
        resize();

        const t = clock.getElapsedTime();
        const drive = reduceMotion ? 0 : t / LAP_SECONDS;

        racers.forEach((r, i) => {
            poseCar(r, drive + r.offset);
            if (!reduceMotion) r.wheels.forEach(w => (w.rotation.z = t * 16 + i));
        });

        if (!reduceMotion) {
            spinners.forEach(s => (s.rotation.y = t * 18));
            world.rotation.y = Math.sin(t * 0.18) * 0.08;   // lazy showroom sway
            stars.rotation.y = t * 0.012;
        }

        // Parallax drift toward the cursor; scene sits low so the title breathes
        camera.position.x = 0.3 + mouse.x * 2.0;
        camera.position.y = camHeight - mouse.y * 1.1;
        camera.position.z = camDist;
        camera.lookAt(0, 0.5, 0);

        renderer.render(scene, camera);
    }
    animate();
})();

// =====================================================================
//  STATS COUNT-UP — numbers that rev instead of just appearing
// =====================================================================
function countUp(el, target, isMoney) {
    const duration = 1200;
    const start = performance.now();
    function frame(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out, like good brakes
        const val = target * eased;
        el.textContent = isMoney ? formatter.format(val) : Math.round(val);
        if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// =====================================================================
//  CARD RENDERING — blister pack front, spec-card back
// =====================================================================

/**
 * Creates the HTML structure for a single car card.
 * Uses lowercase 'link' and 'info' to match the headers in your spreadsheet.
 */
function createCarCard(car, index) {
    // Matches Column E: "link"
    const finalImageUrl = car.link || `https://placehold.co/300x200?text=${encodeURIComponent(car["Car Model"])}`;

    // Matches Column F: "info"
    const carInfoContent = car.info || 'No lore yet. A car of mystery.';

    return `
        <div class="car-card-container" data-index="${index}" style="--i:${index}" tabindex="0" role="button" aria-label="View ${car["Car Model"]}">
            <div class="card-inner">
                <div class="card-face card-face-front">
                    <span class="card-number">#${String(index + 1).padStart(2, '0')}</span>
                    <div class="image-container">
                        <img src="${finalImageUrl}" alt="${car["Car Model"]}" loading="lazy"
                             onerror="this.onerror=null;this.src='https://placehold.co/300x200?text=${encodeURIComponent(car["Car Model"])}';">
                    </div>
                    <h2 class="car-name">${car["Car Model"]}</h2>
                    <span class="flip-hint">hover</span>
                </div>
                <div class="card-face card-face-back">
                    <span class="card-number back">#${String(index + 1).padStart(2, '0')}</span>
                    <h2 class="car-name">${car["Car Model"]}</h2>
                    <p class="car-info">${carInfoContent}</p>
                    <span class="overlay-cta">Tap for the full spec sheet →</span>
                </div>
            </div>
        </div>
    `;
}

// =====================================================================
//  MODAL — the full spec sheet (estimated values stay in the vault)
// =====================================================================
const TAGLINES = [
    'Certified shelf royalty.',
    'Does 0–60 in one wrist flick.',
    'Undefeated on the dining table circuit.',
    'Mint-ish. The "ish" has stories.',
    'Chosen over groceries at least once.',
    'Loud paint, louder personality.',
    'Survived the great shelf earthquake.',
    'The pegs never saw it coming.',
];

function openModal(car) {
    const name = car["Car Model"] || 'Unnamed legend';
    modalTitle.textContent = name;
    modalImage.src = car.link || `https://placehold.co/600x400?text=${encodeURIComponent(name)}`;
    modalImage.alt = name;

    // A tagline instead of a valuation — the accountant is off duty
    let seed = 0;
    for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i);
    modalVerdict.textContent = TAGLINES[seed % TAGLINES.length];

    // Spec rows: everything from the sheet EXCEPT what's private or shown already
    const skip = new Set(['Car Model', 'link', 'info', 'Estimated Value (₹)']);
    let specsHTML = '';
    Object.keys(car).forEach((key) => {
        if (skip.has(key) || !car[key]) return;
        const isMoneyCol = key === 'Price Acquired';
        const val = isMoneyCol ? formatter.format(parseCurrency(car[key])) : car[key];
        specsHTML += `
            <div class="spec-row">
                <span class="spec-key">${key}</span>
                <span class="spec-val">${val}</span>
            </div>`;
    });
    modalSpecs.innerHTML = specsHTML;
    modalInfo.textContent = car.info || '';

    modalBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalBackdrop.hidden = true;
    document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalBackdrop.hidden) closeModal();
});

// =====================================================================
//  SEARCH + SORT — because scrolling is for people with fewer cars
// =====================================================================
function getVisibleCars() {
    const q = (searchInput.value || '').trim().toLowerCase();
    let list = allCars.filter((car) =>
        !q ||
        (car["Car Model"] || '').toLowerCase().includes(q) ||
        (car.info || '').toLowerCase().includes(q)
    );

    switch (sortSelect.value) {
        case 'name':
            list = [...list].sort((a, b) => (a["Car Model"] || '').localeCompare(b["Car Model"] || ''));
            break;
        case 'paid':
            list = [...list].sort((a, b) => parseCurrency(b["Price Acquired"]) - parseCurrency(a["Price Acquired"]));
            break;
        // 'sheet' keeps garage order
    }
    return list;
}

function renderCards() {
    const list = getVisibleCars();
    emptyNote.hidden = list.length !== 0;

    collectionContainer.innerHTML = '';
    list.forEach((car, i) => {
        collectionContainer.innerHTML += createCarCard(car, i);
    });

    // Wire up modal after the HTML lands (the flip is pure CSS)
    collectionContainer.querySelectorAll('.car-card-container').forEach((cardEl, i) => {
        const open = () => openModal(list[i]);
        cardEl.addEventListener('click', open);
        cardEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

searchInput.addEventListener('input', renderCards);
sortSelect.addEventListener('change', renderCards);

// =====================================================================
//  DATA — fetch logic and column mapping exactly as before
// =====================================================================

/**
 * Fetches data from Google Sheets, calculates stats, and renders the UI.
 */
async function fetchAndRenderCars() {
    const range = 'Sheet1!A:F';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

    // Witty loading state while the sheet warms its tyres
    collectionContainer.innerHTML = `
        <div class="loading-state">
            <div class="loading-wheel"></div>
            <p>Rolling the garage door up…</p>
        </div>`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const rows = data.values;

        if (rows && rows.length > 1) {
            // Clean headers by removing any accidental leading/trailing spaces
            const headers = rows[0].map(h => h.trim());
            const carData = rows.slice(1);

            const carList = carData.map(row => {
                let obj = {};
                headers.forEach((header, i) => {
                    obj[header] = row[i] || '';
                });
                return obj;
            });

            // The only public stat: how deep the obsession goes
            countUp(document.getElementById('total-cars'), carList.length, false);

            // Render Cards
            allCars = carList;
            renderCards();

        } else {
            collectionContainer.innerHTML = '<p class="error-note">The spreadsheet is emptier than a toy aisle on launch day. Add some cars!</p>';
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        collectionContainer.innerHTML = '<p class="error-note">Pit stop failure — couldn\'t load the data. Check spreadsheet permissions and the API key, then refresh.</p>';
    }
}

// --- Initial Page Load ---
fetchAndRenderCars();

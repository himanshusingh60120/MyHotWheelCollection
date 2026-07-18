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
//  THREE.JS HERO — a full circuit: drop-in, loop, booster, jump, GAP,
//  landing, banked return. Three cars. Zero adult supervision.
// =====================================================================
(function initHero() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas || typeof THREE === 'undefined') return; // no canvas, no circus

    // ---------- Scene basics ----------
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d0e12, 26, 60);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ---------- Lights: garage fluorescents + neon accents ----------
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(8, 14, 10);
    scene.add(keyLight);
    const loopGlow = new THREE.PointLight(0xff5a1f, 1.4, 28);
    loopGlow.position.set(-4, 3, 4);
    scene.add(loopGlow);
    const coolGlow = new THREE.PointLight(0x2f7bff, 0.7, 30);
    coolGlow.position.set(10, 4, -8);
    scene.add(coolGlow);

    // Everything track-related lives in one group so it can sway together
    const world = new THREE.Group();
    scene.add(world);

    // ---------- Ground: dark garage floor with a faint grid ----------
    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(45, 48),
        new THREE.MeshStandardMaterial({ color: 0x101218, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    world.add(floor);

    const grid = new THREE.GridHelper(70, 35, 0x1e222c, 0x151820);
    grid.position.y = 0;
    world.add(grid);

    // ---------- THE CIRCUIT ----------
    // One closed spline. The cars follow ALL of it; the orange track is
    // only drawn where there's plastic — the missing bit is the jump.
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const controlPoints = [
        // High start platform + drop-in
        V(-13.0, 3.4, 1.0),
        V(-10.5, 1.7, 0.6),
        V(-8.4, 0.35, 0.2),
        V(-6.4, 0.06, 0.0),
        // Loop-the-loop (slight z-drift so the track doesn't clip itself)
        V(-4.2, 0.06, 0.0),
        V(-2.35, 1.95, -0.12),
        V(-4.2, 3.8, -0.25),
        V(-6.05, 1.95, -0.38),
        V(-4.2, 0.06, -0.5),
        // Flat run through the booster
        V(-2.0, 0.05, -0.38),
        V(0.6, 0.05, -0.2),
        // Jump ramp
        V(2.3, 0.5, -0.08),
        V(3.3, 1.2, 0.0),
        // *** THE GAP *** (pure air — no track gets drawn here)
        V(4.9, 2.0, 0.0),
        V(6.5, 1.55, 0.0),
        // Landing ramp + run-out
        V(7.7, 0.8, 0.0),
        V(9.2, 0.08, 0.0),
        V(11.2, 0.06, -0.6),
        // Banked sweeper back
        V(13.2, 0.5, -3.0),
        V(13.4, 0.6, -6.2),
        V(10.5, 0.25, -8.8),
        V(5.5, 0.1, -9.8),
        V(0.0, 0.3, -10.1),
        V(-5.5, 0.6, -9.5),
        // Climb back to the start platform
        V(-10.2, 1.7, -7.6),
        V(-13.6, 2.6, -4.2),
        V(-14.2, 3.3, -1.2),
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

    // Which samples are the gap? (the airborne stretch after the ramp lip)
    const isGap = pts.map(p => p.x > 3.45 && p.x < 7.55 && p.z > -2.5 && p.y > 0.4);

    // ---------- Build the orange track ribbon + yellow rails ----------
    const HALF_W = 0.42;
    const trackMat = new THREE.MeshStandardMaterial({
        color: 0xff5a1f, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide,
    });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.4, metalness: 0.3 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x262a33, roughness: 0.8 });

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

        // Support pillars under anything elevated (sells the "plastic track" look)
        for (let k = 0; k < indices.length; k += 26) {
            const i = indices[k];
            const p = pts[i];
            if (p.y < 0.55) continue;
            // Don't prop up the inside of the loop
            const inLoop = p.x > -6.6 && p.x < -1.8 && p.y > 0.5 && p.z > -1.2 && p.y < 3.2;
            if (inLoop && p.y < 3.0) continue;
            const h = p.y - 0.05;
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

    // ---------- Turbo booster on the flat (spinning yellow wheels) ----------
    const spinners = [];
    (function buildBooster() {
        // Find the nearest on-track sample to the flat section
        const target = V(0.6, 0.05, -0.2);
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
                new THREE.CylinderGeometry(0.28, 0.28, 0.16, 16),
                railMat
            );
            spin.add(wheel);
            spin.position.copy(p)
                .addScaledVector(b, side * (HALF_W + 0.22))
                .add(V(0, 0.3, 0));
            boost.add(spin);
            spinners.push(spin);

            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8), pillarMat);
            post.position.copy(spin.position).add(V(0, -0.22, 0));
            boost.add(post);
        });
        // Arch over the top, because drama
        const arch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, (HALF_W + 0.42) * 2), trackMat);
        arch.position.copy(p).add(V(0, 0.72, 0));
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

        car.scale.setScalar(0.72);
        return { car, wheels };
    }

    const racers = [
        { color: 0x2f7bff, offset: 0.00, lane:  0.13 },  // blue — the favourite
        { color: 0xff3b3b, offset: 0.38, lane: -0.13 },  // red — the rival
        { color: 0x2dd4a7, offset: 0.72, lane:  0.00 },  // teal — the wildcard
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

    // ---------- Drifting spark particles ----------
    const starGeo = new THREE.BufferGeometry();
    const starCount = 180;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
        positions[i]     = (Math.random() - 0.5) * 60;
        positions[i + 1] = Math.random() * 16;
        positions[i + 2] = (Math.random() - 0.5) * 40 - 5;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xff8a50, size: 0.07, transparent: true, opacity: 0.5 })
    );
    scene.add(stars);

    // ---------- Camera, parallax, resize ----------
    const mouse = { x: 0, y: 0 };
    window.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    });

    let camDist = 21, camHeight = 7.5;
    function resize() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }
        // Pull back on narrow screens so the whole circuit stays in frame
        const a = camera.aspect;
        camDist = a > 1.6 ? 20 : a > 1.1 ? 25 : a > 0.8 ? 31 : 38;
        camHeight = a > 1.1 ? 7.5 : 9;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();
    const LAP_SECONDS = 13;

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
            world.rotation.y = Math.sin(t * 0.2) * 0.05;   // lazy showroom sway
            stars.rotation.y = t * 0.015;
        }

        // Parallax drift toward the cursor; scene sits low so the title breathes
        camera.position.x = 0.5 + mouse.x * 2.2;
        camera.position.y = camHeight - mouse.y * 1.2;
        camera.position.z = camDist;
        camera.lookAt(0, -0.4, -3.5);

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
//  CARD RENDERING
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
            <div class="card-front">
                <span class="card-number">#${String(index + 1).padStart(2, '0')}</span>
                <div class="image-container">
                    <img src="${finalImageUrl}" alt="${car["Car Model"]}" loading="lazy"
                         onerror="this.onerror=null;this.src='https://placehold.co/300x200?text=${encodeURIComponent(car["Car Model"])}';">
                    <div class="info-overlay">
                        <p class="car-info">${carInfoContent}</p>
                        <span class="overlay-cta">Tap for the full spec sheet →</span>
                    </div>
                </div>
                <h2 class="car-name">${car["Car Model"]}</h2>
                <div class="card-glare"></div>
            </div>
        </div>
    `;
}

// 3D tilt: cards lean into your cursor like they're taking a corner
function attachTilt(cardEl) {
    const inner = cardEl.querySelector('.card-front');
    const glare = cardEl.querySelector('.card-glare');

    cardEl.addEventListener('mousemove', (e) => {
        const rect = cardEl.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const rx = (0.5 - py) * 12;
        const ry = (px - 0.5) * 14;
        inner.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.03)`;
        if (glare) {
            glare.style.opacity = '1';
            glare.style.background =
                `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.18), transparent 55%)`;
        }
    });

    cardEl.addEventListener('mouseleave', () => {
        inner.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
        if (glare) glare.style.opacity = '0';
    });
}

// =====================================================================
//  MODAL — the full spec sheet, with a financial verdict
// =====================================================================
function openModal(car) {
    const name = car["Car Model"] || 'Unnamed legend';
    modalTitle.textContent = name;
    modalImage.src = car.link || `https://placehold.co/600x400?text=${encodeURIComponent(name)}`;
    modalImage.alt = name;

    const paid = parseCurrency(car["Price Acquired"]);
    const worth = parseCurrency(car["Estimated Value (₹)"]);
    const diff = worth - paid;

    // The verdict: was this an investment or an "investment"?
    let verdict;
    if (paid === 0 && worth === 0) {
        verdict = 'Value: sentimental. Which is priceless. Which is convenient.';
    } else if (diff > 0) {
        verdict = `Up ${formatter.format(diff)}. Better returns than my mutual funds. 📈`;
    } else if (diff < 0) {
        verdict = `Down ${formatter.format(Math.abs(diff))}. We call this one "an emotional asset". 📉`;
    } else {
        verdict = 'Breaking exactly even. Suspiciously responsible.';
    }
    modalVerdict.textContent = verdict;

    // Spec rows: show every sheet column except the ones already displayed
    const skip = new Set(['Car Model', 'link', 'info']);
    let specsHTML = '';
    Object.keys(car).forEach((key) => {
        if (skip.has(key) || !car[key]) return;
        const isMoneyCol = key === 'Price Acquired' || key === 'Estimated Value (₹)';
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
        case 'value':
            list = [...list].sort((a, b) => parseCurrency(b["Estimated Value (₹)"]) - parseCurrency(a["Estimated Value (₹)"]));
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

    // Wire up tilt + modal after the HTML lands
    collectionContainer.querySelectorAll('.car-card-container').forEach((cardEl, i) => {
        attachTilt(cardEl);
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

            // Calculate Statistics
            const totalCars = carList.length;

            // Matches Column B: "Price Acquired" and Column C: "Estimated Value (₹)"
            const totalPriceAcquired = carList.reduce((sum, car) => sum + parseCurrency(car["Price Acquired"]), 0);
            const totalEstimatedValue = carList.reduce((sum, car) => sum + parseCurrency(car["Estimated Value (₹)"]), 0);

            // Update UI Stats — with a rev-up instead of a teleport
            countUp(document.getElementById('total-cars'), totalCars, false);
            countUp(document.getElementById('total-price-acquired'), totalPriceAcquired, true);
            countUp(document.getElementById('total-value'), totalEstimatedValue, true);

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

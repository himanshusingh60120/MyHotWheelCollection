// =====================================================================
//  THE HOT WHEELS GARAGE — SEALED VAULT EDITION
//  Data plumbing untouched. Everything else got a spoiler and neons.
// =====================================================================

// --- Google API & Spreadsheet Keys (DO NOT TOUCH — the vault runs on these) ---
const GOOGLE_API_KEY = "AIzaSyCGB6F8rosJD_g4e6diqpplrdbkQsj-eQY";
const SPREADSHEET_ID = "1n0xWyZzJ1lDRuAgy4prTy_FxEmzCls2IxcGn7pXKRWg";

// --- DOM Element References ---
const collectionContainer = document.querySelector('.collection-container');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const emptyNote = document.getElementById('empty-note');
const lineupCount = document.getElementById('lineup-count');

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

// A shorter formatter for the little price chips on cards
const chipFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
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
//  SCROLL STATE — one source of truth the whole page listens to
// =====================================================================
const scrollState = { y: 0, progress: 0, boost: 0, vel: 0, smoothVel: 0 };

(function initScroll() {
    let lastY = window.scrollY || 0;
    const heroContent = document.getElementById('hero-content');
    const fill = document.getElementById('progress-fill');
    const car = document.getElementById('progress-car');
    const wheels = car ? car.querySelectorAll('.pwheel') : [];
    const ghost = document.querySelector('.ghost');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function onScroll() {
        const y = window.scrollY || 0;
        const docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        scrollState.vel = y - lastY;
        scrollState.y = y;
        scrollState.progress = Math.min(y / docH, 1);

        // Scrolling revs the engines — the trails surge with scroll velocity
        scrollState.boost = Math.min(4, scrollState.boost + Math.abs(scrollState.vel) * 0.004);
        lastY = y;

        // Progress car commutes across the top of the page
        if (fill) fill.style.width = (scrollState.progress * 100) + '%';
        if (car) {
            car.style.left = `calc(${(scrollState.progress * 100).toFixed(2)}% - ${(scrollState.progress * 44).toFixed(0)}px)`;
            wheels.forEach(w => { w.style.transform = `rotate(${(y * 1.4) % 360}deg)`; });
        }

        // Hero parallax: the poster cruises up and fades as you leave
        if (heroContent) {
            const p = Math.min(y / Math.max(window.innerHeight, 1), 1);
            heroContent.style.transform = `translateY(${(-p * 80).toFixed(1)}px)`;
            heroContent.style.opacity = String(Math.max(0, 1 - p * 1.3));
        }

        // Ghost type drifts slower than the page — cheap depth
        if (ghost) ghost.style.transform = `translateY(${(y * -0.06).toFixed(1)}px)`;
    }

    // Velocity skew: the grid leans into hard scrolls, then settles
    function settle() {
        requestAnimationFrame(settle);
        if (reduceMotion || !collectionContainer) return;
        scrollState.smoothVel += (scrollState.vel - scrollState.smoothVel) * 0.12;
        scrollState.vel *= 0.86;
        const skew = Math.max(-1.4, Math.min(1.4, scrollState.smoothVel * 0.03));
        collectionContainer.style.transform = `skewY(${skew.toFixed(3)}deg)`;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    settle();
})();

// =====================================================================
//  THREE.JS BACKDROP — neon light trails behind the ENTIRE page.
//  Mouse steers. Scroll dollies the camera and revs the trails.
// =====================================================================
(function initHero() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas || typeof THREE === 'undefined') return; // no canvas, no circus

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d0e12, 16, 66);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const world = new THREE.Group();
    scene.add(world);

    // ---------- Synthwave horizon ----------
    const grid = new THREE.GridHelper(160, 80, 0x27304a, 0x151a26);
    grid.position.y = -5;
    world.add(grid);

    // ---------- The light trails ----------
    const PALETTE = [0xff5a1f, 0xffc400, 0x2f7bff, 0xff5a1f, 0x2dd4a7, 0xff3b3b];
    const TRAILS = [];
    const TAIL = 16;
    const cometGeo = new THREE.SphereGeometry(0.24, 10, 10);

    for (let j = 0; j < 6; j++) {
        const pts = [];
        const depth = -3 - j * 2.4;
        const amp = 2.2 + (j % 3) * 1.1;
        const phase = j * 1.9;
        for (let k = 0; k <= 7; k++) {
            const x = -34 + k * (68 / 7);
            const y = 2.8 + Math.sin(phase + k * 0.85) * amp + j * 0.55;
            const z = depth + Math.cos(phase * 0.7 + k * 0.6) * 2.6;
            pts.push(new THREE.Vector3(x, y, z));
        }
        const curve = new THREE.CatmullRomCurve3(pts);

        // Permanent ribbon so the path reads even between comets…
        const tube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 90, 0.04, 6, false),
            new THREE.MeshBasicMaterial({
                color: PALETTE[j], transparent: true, opacity: 0.3,
                blending: THREE.AdditiveBlending, depthWrite: false,
            })
        );
        world.add(tube);
        // …plus a wide soft halo for that neon bloom feel
        const halo = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 60, 0.16, 6, false),
            new THREE.MeshBasicMaterial({
                color: PALETTE[j], transparent: true, opacity: 0.06,
                blending: THREE.AdditiveBlending, depthWrite: false,
            })
        );
        world.add(halo);

        const segs = [];
        for (let i = 0; i < TAIL; i++) {
            const m = new THREE.Mesh(
                cometGeo,
                new THREE.MeshBasicMaterial({
                    color: PALETTE[j],
                    transparent: true,
                    opacity: Math.pow(1 - i / TAIL, 1.6) * 0.95,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                })
            );
            m.scale.setScalar(1 - (i / TAIL) * 0.75);
            world.add(m);
            segs.push(m);
        }

        TRAILS.push({
            curve, segs,
            head: Math.random(),
            speed: 0.045 + Math.random() * 0.05,
        });
    }

    // ---------- Distant embers ----------
    const starGeo = new THREE.BufferGeometry();
    const starCount = 200;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
        positions[i]     = (Math.random() - 0.5) * 90;
        positions[i + 1] = (Math.random() - 0.5) * 40 + 6;
        positions[i + 2] = (Math.random() - 0.5) * 50 - 8;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xff8a50, size: 0.07, transparent: true, opacity: 0.45 })
    );
    scene.add(stars);

    // ---------- Mouse steering + resize ----------
    const mouse = { x: 0, y: 0 };
    window.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    });

    function resize() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        resize();

        const t = clock.getElapsedTime();
        const rev = 1 + scrollState.boost;           // scroll = throttle
        scrollState.boost *= 0.94;                    // ease back off

        if (!reduceMotion) {
            TRAILS.forEach((tr) => {
                tr.head = (tr.head + tr.speed * rev * 0.016) % 1;
                for (let i = 0; i < TAIL; i++) {
                    let u = tr.head - i * 0.007 * (0.7 + rev * 0.3);
                    u = ((u % 1) + 1) % 1;
                    tr.segs[i].position.copy(tr.curve.getPointAt(u));
                }
            });
            world.rotation.y = Math.sin(t * 0.1) * 0.05 + scrollState.progress * 0.7;
            stars.rotation.y = t * 0.008;
        }

        // Scrolling the page descends the camera through the trail field
        const p = scrollState.progress;
        camera.position.x = mouse.x * 2.4;
        camera.position.y = 3.4 - mouse.y * 1.4 - p * 4.2;
        camera.position.z = 20 - p * 7;
        camera.lookAt(0, 2.6 - p * 3.4, -6);

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
//  CARD RENDERING — uniform modules, whole car always visible
// =====================================================================

/**
 * Creates the HTML structure for a single car card.
 * Uses lowercase 'link' and 'info' to match the headers in your spreadsheet.
 */
function createCarCard(car, index) {
    // Matches Column E: "link"
    const finalImageUrl = car.link || `https://placehold.co/600x800?text=${encodeURIComponent(car["Car Model"])}`;

    // Matches Column B: "Price Acquired" — the only number a card shares
    const paid = parseCurrency(car["Price Acquired"]);
    const paidChip = paid > 0
        ? `Paid ${chipFormatter.format(paid)}`
        : 'Priceless (unpriced)';

    return `
        <div class="car-card-container reveal" data-index="${index}" style="--i:${index % 12}" tabindex="0" role="button" aria-label="View ${car["Car Model"]}">
            <div class="card-shell">
                <div class="image-container">
                    <span class="card-number">#${String(index + 1).padStart(2, '0')}</span>
                    <span class="seal-badge" title="Mint On Card. Obviously.">MOC ✓</span>
                    <img src="${finalImageUrl}" alt="${car["Car Model"]}" loading="lazy"
                         onerror="this.onerror=null;this.src='https://placehold.co/600x800?text=${encodeURIComponent(car["Car Model"])}';">
                </div>
                <div class="card-meta">
                    <h3 class="car-name">${car["Car Model"]}</h3>
                    <div class="card-row">
                        <span class="price-chip">${paidChip}</span>
                        <span class="card-cta">spec sheet →</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Cards glide in as they enter the viewport
let revealObserver = null;
function observeReveals() {
    if (revealObserver) revealObserver.disconnect();
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const items = collectionContainer.querySelectorAll('.reveal');
    if (prefersReduced || !('IntersectionObserver' in window)) {
        items.forEach(el => el.classList.add('visible'));
        return;
    }
    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    items.forEach(el => revealObserver.observe(el));
}

// Cursor spotlight: cards glow where you point at them
function attachSpotlight(cardEl) {
    cardEl.addEventListener('mousemove', (e) => {
        const rect = cardEl.getBoundingClientRect();
        cardEl.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%');
        cardEl.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%');
    });
}

// =====================================================================
//  MODAL — whitelisted spec sheet. Price Acquired only, nothing leaks.
// =====================================================================
const TAGLINES = [
    'Certified shelf royalty.',
    'Does 0–60 in one wrist flick. Theoretically. It\'s sealed.',
    'Undefeated on the dining table circuit.',
    'Mint on card. Monk-level restraint.',
    'Chosen over groceries at least once.',
    'Loud paint, louder personality.',
    'Never touched grass. Or floor. Or air.',
    'The pegs never saw it coming.',
];

function openModal(car) {
    const name = car["Car Model"] || 'Unnamed legend';
    modalTitle.textContent = name;
    modalImage.src = car.link || `https://placehold.co/600x800?text=${encodeURIComponent(name)}`;
    modalImage.alt = name;

    // A tagline instead of a valuation — the accountant is off duty
    let seed = 0;
    for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i);
    modalVerdict.textContent = TAGLINES[seed % TAGLINES.length];

    // WHITELIST: only these rows ever render, no matter what the sheet holds
    const rows = [];
    const paid = parseCurrency(car["Price Acquired"]);
    if (paid > 0) rows.push(['Price acquired', formatter.format(paid)]);
    rows.push(['Condition', 'Sealed — Mint On Card']);
    rows.push(['Scale', '1:64']);

    modalSpecs.innerHTML = rows.map(([k, v]) => `
        <div class="spec-row">
            <span class="spec-key">${k}</span>
            <span class="spec-val">${v}</span>
        </div>`).join('');

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
        // 'sheet' keeps vault order
    }
    return list;
}

function updateLineupCount(shown) {
    if (!lineupCount) return;
    const total = allCars.length;
    if (shown === total) {
        lineupCount.textContent = `All ${total} legends, present and polished.`;
    } else if (shown === 0) {
        lineupCount.textContent = `0 of ${total}. The vault denies everything.`;
    } else {
        lineupCount.textContent = `${shown} of ${total} answered the call.`;
    }
}

function renderCards() {
    const list = getVisibleCars();
    emptyNote.hidden = list.length !== 0;
    updateLineupCount(list.length);

    collectionContainer.innerHTML = '';
    list.forEach((car, i) => {
        collectionContainer.innerHTML += createCarCard(car, i);
    });

    // Wire up interactions after the HTML lands
    collectionContainer.querySelectorAll('.car-card-container').forEach((cardEl, i) => {
        attachSpotlight(cardEl);
        const open = () => openModal(list[i]);
        cardEl.addEventListener('click', open);
        cardEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });

    observeReveals();
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
            <p>Unlocking the vault…</p>
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

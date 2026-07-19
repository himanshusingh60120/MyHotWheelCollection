// =====================================================================
//  THE 1:64 VAULT — a Hot Wheels collection
//  Data plumbing untouched. Everything else got reupholstered.
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

// Columns that never get displayed anywhere on the site
const PRIVATE_COLUMNS = new Set(['Estimated Value (₹)', 'Collection Value']);

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
const scrollState = { y: 0, progress: 0, boost: 0 };

(function initScroll() {
    let lastY = window.scrollY || 0;

    function onScroll() {
        const y = window.scrollY || 0;
        const docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        scrollState.y = y;
        scrollState.progress = Math.min(y / docH, 1);

        // Scrolling stirs the backdrop — the floating cards flutter
        scrollState.boost = Math.min(3, scrollState.boost + Math.abs(y - lastY) * 0.003);
        lastY = y;

        // Progress car commutes across the top of the page
        const fill = document.getElementById('progress-fill');
        const car = document.getElementById('progress-car');
        if (fill) fill.style.width = (scrollState.progress * 100) + '%';
        if (car) {
            car.style.left = `calc(${(scrollState.progress * 100).toFixed(2)}% - ${(scrollState.progress * 44).toFixed(0)}px)`;
            car.querySelectorAll('.pwheel').forEach(w => {
                w.style.transform = `rotate(${(y * 1.4) % 360}deg)`;
            });
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
})();

// =====================================================================
//  THREE.JS BACKDROP — sealed blister cards drifting through warm air,
//  with a few escaped cars among them. Fixed behind the entire site:
//  it sways with the mouse and flutters when you scroll.
// =====================================================================
(function initBackdrop() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();
    // Fog toward paper-cream so depth fades into the page colour
    scene.fog = new THREE.Fog(0xf6f2ea, 16, 38);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 20);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Soft daylight
    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const sun = new THREE.DirectionalLight(0xfff2dd, 0.7);
    sun.position.set(6, 10, 8);
    scene.add(sun);

    const world = new THREE.Group();
    scene.add(world);

    // Feel-good palette: tomato, marigold, sage, dusty blue, blush, cream, ink
    const TILE_COLORS = [0xe8552e, 0xf2b135, 0x7ba98c, 0x6d8cb3, 0xe5b8a5, 0xefe6d8, 0x2a2522];

    // ---------- Floating blister cards ----------
    const tiles = [];
    const tileGeo = new THREE.BoxGeometry(1.0, 1.36, 0.06);   // portrait, like the real thing
    const bubbleGeo = new THREE.SphereGeometry(0.24, 12, 12); // the blister bubble

    for (let i = 0; i < 34; i++) {
        const color = TILE_COLORS[i % TILE_COLORS.length];
        const tile = new THREE.Group();

        const cardMesh = new THREE.Mesh(
            tileGeo,
            new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05 })
        );
        tile.add(cardMesh);

        // A little clear-ish bubble on the front — sealed forever
        const bubble = new THREE.Mesh(
            bubbleGeo,
            new THREE.MeshStandardMaterial({
                color: 0xffffff, roughness: 0.15, metalness: 0.1,
                transparent: true, opacity: 0.35,
            })
        );
        bubble.scale.set(1, 1, 0.55);
        bubble.position.set(0, -0.12, 0.05);
        tile.add(bubble);

        tile.position.set(
            (Math.random() - 0.5) * 34,
            (Math.random() - 0.5) * 20,
            -2 - Math.random() * 9
        );
        tile.rotation.set(
            (Math.random() - 0.5) * 0.7,
            (Math.random() - 0.5) * 1.2,
            (Math.random() - 0.5) * 0.5
        );

        world.add(tile);
        tiles.push({
            mesh: tile,
            baseY: tile.position.y,
            phase: Math.random() * Math.PI * 2,
            bob: 0.25 + Math.random() * 0.3,
            spin: (Math.random() - 0.5) * 0.0035,
            drift: (0.004 + Math.random() * 0.008) * (Math.random() < 0.5 ? 1 : -1),
        });
    }

    // ---------- A few escaped cars, drifting free ----------
    function buildMiniCar(color) {
        const car = new THREE.Group();
        const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 });
        const dark  = new THREE.MeshStandardMaterial({ color: 0x2a2522, roughness: 0.7 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.26, 0.55), paint);
        car.add(body);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.46), dark);
        cabin.position.set(-0.05, 0.22, 0);
        car.add(cabin);
        [[0.4, 0.3], [0.4, -0.3], [-0.4, 0.3], [-0.4, -0.3]].forEach(([x, z]) => {
            const w = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 14), dark);
            w.rotation.x = Math.PI / 2;
            w.position.set(x, -0.14, z);
            car.add(w);
        });
        car.scale.setScalar(0.85);
        return car;
    }

    const minis = [];
    [0xe8552e, 0x6d8cb3, 0x7ba98c, 0xf2b135, 0xe5b8a5].forEach((c, i) => {
        const m = buildMiniCar(c);
        m.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 16, -3 - Math.random() * 7);
        m.rotation.set(Math.random() * 0.6, Math.random() * Math.PI * 2, Math.random() * 0.4);
        world.add(m);
        minis.push({
            mesh: m,
            baseY: m.position.y,
            phase: i * 1.3,
            spin: 0.002 + Math.random() * 0.003,
            drift: (0.01 + Math.random() * 0.012) * (Math.random() < 0.5 ? 1 : -1),
        });
    });

    // ---------- Mouse sway + resize ----------
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
        const stir = 1 + scrollState.boost * 2;   // scroll stirs the air
        scrollState.boost *= 0.95;

        if (!reduceMotion) {
            tiles.forEach(tl => {
                tl.mesh.position.y = tl.baseY + Math.sin(t * 0.5 + tl.phase) * tl.bob;
                // slow lateral drift; wrap around so the field never empties
                tl.mesh.position.x += tl.drift * stir;
                if (tl.mesh.position.x > 19) tl.mesh.position.x = -19;
                if (tl.mesh.position.x < -19) tl.mesh.position.x = 19;
                tl.mesh.rotation.y += tl.spin * stir;
                tl.mesh.rotation.x += tl.spin * 0.4 * stir;
                // a gentle breathing sway on the roll axis
                tl.mesh.rotation.z = Math.sin(t * 0.3 + tl.phase) * 0.12;
            });
            minis.forEach(mn => {
                mn.mesh.position.y = mn.baseY + Math.sin(t * 0.4 + mn.phase) * 0.4;
                mn.mesh.position.x += mn.drift * stir;
                if (mn.mesh.position.x > 17) mn.mesh.position.x = -17;
                if (mn.mesh.position.x < -17) mn.mesh.position.x = 17;
                mn.mesh.rotation.y += mn.spin * stir;
            });
        }

        // The whole field leans with the cursor and drifts with scroll
        world.rotation.y += ((mouse.x * 0.1) - world.rotation.y) * 0.03;
        world.rotation.x += ((-mouse.y * 0.06) - world.rotation.x) * 0.03;
        world.position.y = scrollState.y * 0.0012;

        renderer.render(scene, camera);
    }
    animate();
})();

// =====================================================================
//  REVEAL ON SCROLL — sections and cards glide in as they arrive
// =====================================================================
const globalRevealObserver = (() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !('IntersectionObserver' in window)) {
        document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('visible'));
        return null;
    }
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('[data-reveal]').forEach(el => obs.observe(el));
    return obs;
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
//  CARD RENDERING — one frame, one ratio, every image the same size
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
                <span class="card-number">#${String(index + 1).padStart(2, '0')}</span>
                <div class="image-container">
                    <img src="${finalImageUrl}" alt="${car["Car Model"]}" loading="lazy"
                         onerror="this.onerror=null;this.src='https://placehold.co/600x800?text=${encodeURIComponent(car["Car Model"])}';">
                </div>
                <div class="card-meta">
                    <h2 class="car-name">${car["Car Model"]}</h2>
                    <div class="card-row">
                        <span class="price-chip">${paidChip}</span>
                        <span class="card-cta">details →</span>
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
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => revealObserver.observe(el));
}

// Gentle tilt: the card leans toward the cursor, politely
function attachTilt(cardEl) {
    const shell = cardEl.querySelector('.card-shell');
    cardEl.addEventListener('mousemove', (e) => {
        const rect = cardEl.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        shell.style.transform =
            `translateY(-8px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg)`;
    });
    cardEl.addEventListener('mouseleave', () => {
        shell.style.transform = '';
    });
}

// =====================================================================
//  MODAL — the spec sheet (valuations stay in the vault's back office)
// =====================================================================
const TAGLINES = [
    'Factory sealed. Emotionally unsealed.',
    'Never opened. Frequently admired.',
    'The blister IS the display case.',
    'Zero miles — all of them imaginary.',
    'Guarded like the last samosa.',
    'Card intact. Corners feared for daily.',
    'Peg-hunted at dawn. Worth it.',
    'Museum rules: look, don\'t unclip.',
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

    // Spec rows: everything from the sheet EXCEPT private or already-shown fields
    const skip = new Set(['Car Model', 'link', 'info', ...PRIVATE_COLUMNS]);
    let specsHTML = '';
    Object.keys(car).forEach((key) => {
        const value = (car[key] || '').toString().trim();
        if (skip.has(key) || !value || value === '-') return;
        const isMoneyCol = key === 'Price Acquired';
        const val = isMoneyCol ? formatter.format(parseCurrency(value)) : value;
        specsHTML += `
            <div class="spec-row">
                <span class="spec-key">${key}</span>
                <span class="spec-val">${val}</span>
            </div>`;
    });
    modalSpecs.innerHTML = specsHTML;

    const infoTxt = (car.info || '').toString().trim();
    modalInfo.textContent = infoTxt === '-' ? '' : infoTxt;

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
        lineupCount.textContent = `All ${total} sealed legends, on display.`;
    } else if (shown === 0) {
        lineupCount.textContent = `0 of ${total}. The vault denies everything.`;
    } else {
        lineupCount.textContent = `${shown} of ${total} made the cut.`;
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
        attachTilt(cardEl);
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
            <p>Rolling the vault door open…</p>
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

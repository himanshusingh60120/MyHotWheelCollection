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
//  THREE.JS HERO — a diecast doing an eternal loop-the-loop
// =====================================================================
(function initHero() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas || typeof THREE === 'undefined') return; // no canvas, no circus

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d0e12, 14, 34);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0.6, 16);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // --- Lights: garage fluorescents + a warm track glow ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(6, 8, 10);
    scene.add(keyLight);
    const trackGlow = new THREE.PointLight(0xff5a1f, 1.2, 30);
    trackGlow.position.set(0, 0, 4);
    scene.add(trackGlow);

    // --- The famous orange loop ---
    const LOOP_R = 5.2;
    const loop = new THREE.Mesh(
        new THREE.TorusGeometry(LOOP_R, 0.55, 20, 120),
        new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.55, metalness: 0.1 })
    );
    loop.scale.z = 0.28; // flatten the tube into a track ribbon
    scene.add(loop);

    // Inner rail stripe, because real track has that ridge
    const rail = new THREE.Mesh(
        new THREE.TorusGeometry(LOOP_R, 0.16, 12, 120),
        new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.4 })
    );
    rail.scale.z = 0.9;
    scene.add(rail);

    // --- Build a tiny diecast out of primitives (forward = +x, up = +y) ---
    function buildCar() {
        const car = new THREE.Group();

        const paint = new THREE.MeshStandardMaterial({ color: 0x2f7bff, roughness: 0.25, metalness: 0.7 });
        const glass = new THREE.MeshStandardMaterial({ color: 0x0d0e12, roughness: 0.15, metalness: 0.9 });
        const tyre  = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9 });
        const rim   = new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.3, metalness: 0.8 });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.34, 0.8), paint);
        body.position.y = 0.28;
        car.add(body);

        // Cabin
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 0.68), glass);
        cabin.position.set(-0.1, 0.58, 0);
        car.add(cabin);

        // Rear spoiler — obviously
        const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.85), paint);
        spoiler.position.set(-0.82, 0.62, 0);
        car.add(spoiler);
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.5), glass);
        strut.position.set(-0.8, 0.5, 0);
        car.add(strut);

        // Wheels: each in a spin-group so the axle math stays sane
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

        return { car, wheels };
    }

    // Pivot spins around the loop; car rides the *inside* like a champ
    const pivot = new THREE.Group();
    const { car, wheels } = buildCar();
    car.position.set(0, LOOP_R - 0.62, 0);
    car.rotation.z = Math.PI; // roof toward the center, wheels on the track
    pivot.add(car);
    scene.add(pivot);

    // --- Drifting dust/spark particles ---
    const starGeo = new THREE.BufferGeometry();
    const starCount = 220;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
        positions[i]     = (Math.random() - 0.5) * 40;
        positions[i + 1] = (Math.random() - 0.5) * 24;
        positions[i + 2] = (Math.random() - 0.5) * 18 - 4;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xff8a50, size: 0.05, transparent: true, opacity: 0.7 })
    );
    scene.add(stars);

    // --- Mouse parallax ---
    const mouse = { x: 0, y: 0 };
    window.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    });

    // --- Keep it crisp on resize ---
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
        if (!reduceMotion) {
            pivot.rotation.z = -t * 0.9;                 // the eternal lap
            wheels.forEach(w => (w.rotation.z = t * 14)); // tyre smoke sold separately
            loop.rotation.y = Math.sin(t * 0.25) * 0.18;  // lazy showroom sway
            rail.rotation.y = loop.rotation.y;
            stars.rotation.y = t * 0.02;
        }

        // Parallax drift toward the cursor
        camera.position.x += ((mouse.x * 1.6) - camera.position.x) * 0.04;
        camera.position.y += ((-mouse.y * 1.0 + 0.6) - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);

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

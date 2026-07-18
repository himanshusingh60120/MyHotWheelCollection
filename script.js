// =====================================================================
//  HIMANSHU'S HOT WHEELS GARAGE — data plumbing untouched, everything
//  else redrawn. Google Sheets connection below is load-bearing: do not
//  touch the key, the spreadsheet ID, or the column names.
// =====================================================================

const GOOGLE_API_KEY = "AIzaSyCGB6F8rosJD_g4e6diqpplrdbkQsj-eQY";
const SPREADSHEET_ID = "1n0xWyZzJ1lDRuAgy4prTy_FxEmzCls2IxcGn7pXKRWg";

// --- DOM refs ---
const cardsEl = document.getElementById('cards');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const emptyNote = document.getElementById('empty-note');

const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalImage = document.getElementById('modal-image');
const modalTitle = document.getElementById('modal-title');
const modalTagline = document.getElementById('modal-tagline');
const modalPaid = document.getElementById('modal-paid');
const modalSpecs = document.getElementById('modal-specs');
const modalInfo = document.getElementById('modal-info');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2,
});
const formatterRound = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});

let allCars = [];

/** Strips symbols/commas so currency strings become real numbers. */
const parseCurrency = (valueString) => {
    if (!valueString) return 0;
    const n = parseFloat(valueString.toString().replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
};

// =====================================================================
//  DRAW RAIL — a pen line that fills in as you scroll, car riding the tip
// =====================================================================
(function initDrawRail() {
    const rail = document.querySelector('.draw-rail');
    if (!rail || prefersReducedMotion) return;

    const basePath = document.getElementById('rail-path');
    const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glowPath.setAttribute('d', basePath.getAttribute('d'));
    glowPath.setAttribute('pathLength', '1000');
    glowPath.setAttribute('class', 'rail-path progress');
    basePath.after(glowPath);
    glowPath.style.strokeDasharray = '1000';

    const railCar = rail.querySelector('.rail-car');
    const pathLen = 1000;

    let ticking = false;
    function update() {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - window.innerHeight;
        const progress = scrollable > 0 ? Math.min(Math.max(window.scrollY / scrollable, 0), 1) : 0;

        glowPath.style.strokeDashoffset = String(pathLen * (1 - progress));

        const railHeight = rail.getBoundingClientRect().height;
        railCar.style.top = (progress * (railHeight - 24)) + 'px';

        ticking = false;
    }
    window.addEventListener('scroll', () => {
        if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
})();

// =====================================================================
//  AURA GLOW — a little cursor-chasing glow in the hero
// =====================================================================
(function initAura() {
    const hero = document.getElementById('hero');
    const blob = document.getElementById('aura-blob');
    if (!hero || !blob || prefersReducedMotion) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    hero.addEventListener('mousemove', (e) => {
        const r = hero.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        blob.style.setProperty('--mx', x + '%');
        blob.style.setProperty('--my', y + '%');
    });
})();

// =====================================================================
//  REVEAL ON SCROLL — squiggle underline + cards draw/settle into view
// =====================================================================
function initReveal(selector, className = 'in-view', once = true) {
    const els = document.querySelectorAll(selector);
    if (!els.length) return;
    if (prefersReducedMotion) { els.forEach(el => el.classList.add(className)); return; }

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add(className);
                if (once) io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });

    els.forEach(el => io.observe(el));
}
initReveal('.squiggle[data-draw]');

// =====================================================================
//  STATS COUNT-UP
// =====================================================================
function countUp(el, target, isMoney) {
    if (prefersReducedMotion) {
        el.textContent = isMoney ? formatterRound.format(target) : Math.round(target);
        return;
    }
    const duration = 1200;
    const start = performance.now();
    function frame(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = target * eased;
        el.textContent = isMoney ? formatterRound.format(val) : Math.round(val);
        if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// =====================================================================
//  CARD RENDERING
// =====================================================================
const TAGLINES = [
    'Certified shelf royalty.',
    'Does 0-60 in one wrist flick.',
    'Undefeated on the dining table circuit.',
    'Mint-ish. The "ish" has stories.',
    'Chosen over groceries at least once.',
    'Loud paint, louder personality.',
    'Survived the great shelf earthquake.',
    'The pegs never saw it coming.',
    'Logged, laminated, non-negotiable.',
    'Runs on vibes and zero fuel.',
];

function taglineFor(name) {
    let seed = 0;
    for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i);
    return TAGLINES[seed % TAGLINES.length];
}

function createCarCard(car, index) {
    const name = car["Car Model"] || 'Unnamed legend';
    const imageUrl = car.link || `https://placehold.co/300x200?text=${encodeURIComponent(name)}`;
    const info = car.info || 'No lore yet. A car of mystery.';
    const paid = car["Price Acquired"];
    const tilt = (index % 5 - 2) * 0.6; // -1.2deg .. 1.2deg, deterministic per card

    const priceTagHTML = paid
        ? `<span class="price-tag">₹${Math.round(parseCurrency(paid)).toLocaleString('en-IN')}<small>paid</small></span>`
        : '';

    return `
        <div class="car-card" data-index="${index}" style="--tilt:${tilt}deg" tabindex="0" role="button" aria-label="View ${name}">
            <span class="card-number">#${String(index + 1).padStart(2, '0')}</span>
            ${priceTagHTML}
            <div class="card-media">
                <img src="${imageUrl}" alt="${name}" loading="lazy"
                     onerror="this.onerror=null;this.src='https://placehold.co/300x200?text=${encodeURIComponent(name)}';">
            </div>
            <h2 class="card-name">${name}</h2>
            <div class="card-back">
                <p>${info}</p>
                <span class="overlay-cta">tap for the full spec sheet -&gt;</span>
            </div>
        </div>
    `;
}

// =====================================================================
//  MODAL — full spec sheet (per-car estimated value stays private)
// =====================================================================
function openModal(car) {
    const name = car["Car Model"] || 'Unnamed legend';
    modalTitle.textContent = name;
    modalImage.src = car.link || `https://placehold.co/600x400?text=${encodeURIComponent(name)}`;
    modalImage.alt = name;
    modalTagline.textContent = taglineFor(name);

    const paid = car["Price Acquired"];
    modalPaid.textContent = paid ? `Paid ${formatter.format(parseCurrency(paid))}` : '';
    modalPaid.style.display = paid ? '' : 'none';

    // Spec rows: everything except what's already shown or kept private
    const skip = new Set(['Car Model', 'link', 'info', 'Estimated Value (₹)', 'Price Acquired']);
    let specsHTML = '';
    Object.keys(car).forEach((key) => {
        if (skip.has(key) || !car[key]) return;
        specsHTML += `
            <div class="spec-row">
                <span class="spec-key">${key}</span>
                <span class="spec-val">${car[key]}</span>
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
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalBackdrop.hidden) closeModal(); });

// =====================================================================
//  SEARCH + SORT
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
    }
    return list;
}

function renderCards() {
    const list = getVisibleCars();
    emptyNote.hidden = list.length !== 0;

    cardsEl.innerHTML = list.map((car, i) => createCarCard(car, i)).join('');

    cardsEl.querySelectorAll('.car-card').forEach((cardEl, i) => {
        const open = () => openModal(list[i]);
        cardEl.addEventListener('click', open);
        cardEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });

    initReveal('.car-card');
}

searchInput.addEventListener('input', renderCards);
sortSelect.addEventListener('change', renderCards);

// =====================================================================
//  DATA — fetch from Google Sheets, compute the hero's three stats
// =====================================================================
async function fetchAndRenderCars() {
    const range = 'Sheet1!A:F';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

    cardsEl.innerHTML = `
        <div class="loading-state">
            <div class="loading-wheel"></div>
            <p>rolling the garage door up...</p>
        </div>`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const rows = data.values;

        if (rows && rows.length > 1) {
            const headers = rows[0].map(h => h.trim());
            const carData = rows.slice(1);
            const carList = carData.map(row => {
                const obj = {};
                headers.forEach((h, i) => { obj[h] = row[i] || ''; });
                return obj;
            });

            allCars = carList;

            const totalSpent = carList.reduce((sum, c) => sum + parseCurrency(c["Price Acquired"]), 0);
            const totalAura = carList.reduce((sum, c) => sum + parseCurrency(c["Estimated Value (₹)"]), 0);

            countUp(document.getElementById('stat-cars'), carList.length, false);
            countUp(document.getElementById('stat-spent'), totalSpent, true);
            countUp(document.getElementById('stat-aura'), totalAura, true);

            renderCards();
        } else {
            cardsEl.innerHTML = '<p class="error-note">The spreadsheet is emptier than a toy aisle on launch day. Add some cars!</p>';
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        cardsEl.innerHTML = '<p class="error-note">Pit stop failure - couldn\'t load the data. Check spreadsheet permissions and the API key, then refresh.</p>';
    }
}

fetchAndRenderCars();

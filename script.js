// --- Google API & Spreadsheet Keys ---
const GOOGLE_API_KEY = "AIzaSyCGB6F8rosJD_g4e6diqpplrdbkQsj-eQY";
const SPREADSHEET_ID = "1n0xWyZzJ1lDRuAgy4prTy_FxEmzCls2IxcGn7pXKRWg";

// --- DOM Element References ---
const collectionContainer = document.querySelector('.collection-container');

/**
 * Robust helper to convert currency strings into numbers.
 * This strips symbols and commas to ensure math operations work.
 */
const parseCurrency = (valueString) => {
    if (!valueString) return 0;
    const numericValue = parseFloat(valueString.toString().replace(/[^0-9.]/g, ''));
    return isNaN(numericValue) ? 0 : numericValue;
};

/**
 * Creates the HTML structure for a single car card.
 * Uses lowercase 'link' and 'info' to match the headers in your spreadsheet.
 */
function createCarCard(car) {
    // Matches Column E: "link"
    const finalImageUrl = car.link || `https://placehold.co/300x200?text=${encodeURIComponent(car["Car Model"])}`;
    
    // Matches Column F: "info"
    const carInfoContent = car.info || 'No additional info provided.';

    return `
        <div class="car-card-container">
            <div class="card-front">
                <div class="image-container">
                    <img src="${finalImageUrl}" alt="${car["Car Model"]}">
                    <div class="info-overlay">
                        <p class="car-info">${carInfoContent}</p>
                    </div>
                </div>
                <h2 class="car-name">${car["Car Model"]}</h2>
            </div>
        </div>
    `;
}

/**
 * Fetches data from Google Sheets, calculates stats, and renders the UI.
 */
async function fetchAndRenderCars() {
    const range = 'Sheet1!A:F';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

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

            // Number formatter for Indian Rupees
            const formatter = new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 2,
            });

            // Update UI Stats
            document.getElementById('total-cars').textContent = totalCars;
            document.getElementById('total-price-acquired').textContent = formatter.format(totalPriceAcquired);
            document.getElementById('total-value').textContent = formatter.format(totalEstimatedValue);

            // Render Cards
            collectionContainer.innerHTML = '';
            carList.forEach(car => {
                collectionContainer.innerHTML += createCarCard(car);
            });
            
        } else {
            collectionContainer.innerHTML = '<p>No car data found in the spreadsheet.</p>';
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        collectionContainer.innerHTML = '<p>Error loading data. Check Spreadsheet permissions and API Key.</p>';
    }
}

// --- Initial Page Load ---
fetchAndRenderCars();

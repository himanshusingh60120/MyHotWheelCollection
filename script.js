// This script now connects to a Google Sheet to fetch data and renders the car collection dynamically.

// --- Google API & Spreadsheet Keys ---
const GOOGLE_API_KEY = "AIzaSyCGB6F8rosJD_g4e6diqpplrdbkQsj-eQY";
const SPREADSHEET_ID = "1n0xWyZzJ1lDRuAgy4prTy_FxEmzCls2IxcGn7pXKRWg";

// --- DOM Element References ---
const collectionContainer = document.querySelector('.collection-container');

// --- Helper function to create a car card ---
function createCarCard(car) {
    const finalImageUrl = car.Link || `https://placehold.co/300x200?text=${encodeURIComponent(car["Car Model"])}`;
    
    // Get the information for the back of the card
    const carInfoContent = car.Information || 'No additional info provided.';

    return `
        <div class="car-card-container">
            <div class="car-card">
                <div class="card-front">
                    <img src="${finalImageUrl}" alt="${car["Car Model"]}">
                    <h2 class="car-name">${car["Car Model"]}</h2>
                </div>
                <div class="card-back">
                    <div class="card-back-content">
                        <p class="car-info">${carInfoContent}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- Function to fetch data from Google Sheet and render cards ---
async function fetchAndRenderCars() {
    const range = 'Sheet1!A:F';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const rows = data.values;
        if (rows && rows.length > 1) {
            const headers = rows[0];
            const carData = rows.slice(1);
            const carList = carData.map(row => {
                let obj = {};
                headers.forEach((header, i) => {
                    obj[header] = row[i] || '';
                });
                return obj;
            });

            // Calculate statistics
            const totalCars = carList.length;

            const removeCurrencyAndComma = (valueString) => {
                return parseFloat(valueString.replace(/₹/g, '').replace(/,/g, '').trim());
            };

            const totalPriceAcquired = carList.reduce((sum, car) => {
                const numericValue = removeCurrencyAndComma(car["Price Acquired"] || "0");
                return sum + (isNaN(numericValue) ? 0 : numericValue);
            }, 0);

            const totalEstimatedValue = carList.reduce((sum, car) => {
                const numericValue = removeCurrencyAndComma(car["Estimated Value (₹)"] || "0");
                return sum + (isNaN(numericValue) ? 0 : numericValue);
            }, 0);

            // Create a number formatter for Indian Rupees
            const formatter = new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });

            // Update the display with the new statistics
            document.getElementById('total-cars').textContent = totalCars;
            document.getElementById('total-price-acquired').textContent = formatter.format(totalPriceAcquired);
            document.getElementById('total-value').textContent = formatter.format(totalEstimatedValue);

            collectionContainer.innerHTML = '';
            carList.forEach(car => {
                collectionContainer.innerHTML += createCarCard(car);
            });
        } else {
            collectionContainer.innerHTML = '<p>No car data found in the spreadsheet.</p>';
        }
    } catch (error) {
        console.error("Error fetching data from Google Sheet:", error);
        collectionContainer.innerHTML = '<p>Error loading data. Please check your Spreadsheet ID and API Key.</p>';
    }
}

// --- Helper function to create a car card ---
function createCarCard(car) {
    const finalImageUrl = car.Link || `https://placehold.co/300x200?text=${encodeURIComponent(car["Car Model"])}`;
    const carInfoContent = car.Information || 'No additional info provided.';

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
// --- Initial Page Load ---
fetchAndRenderCars();

// Corrected PIN code and event handling

const pinInput = document.getElementById('pin-input');
const submitButton = document.getElementById('submit-button');

// Function to handle PIN submission
submitButton.addEventListener('click', () => {
    const pin = pinInput.value;
    if (isValidPin(pin)) {
        // Proceed with submitting the PIN
        console.log('PIN submitted:', pin);
    } else {
        alert('Invalid PIN. Please try again.');
    }
});

function isValidPin(pin) {
    // Validate the PIN code
    return /^\\d{4}$/.test(pin);
}
export function initPIN() {
  const pinScreen = document.getElementById("pinScreen");
  const pinDisplay = document.getElementById("pinDisplay");
  const pinPad = document.getElementById("pinPad");

  if (!pinScreen || !pinDisplay || !pinPad) {
    console.error("Elementos del PIN no encontrados");
    return;
  }

  const savedPIN = localStorage.getItem("arume_pin") || "1010";
  let entered = "";

  const buttons = [1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"];

  pinPad.innerHTML = buttons
    .map(b => {
      const label = b === "C" ? "⌫" : b;
      return `
        <button 
          class="h-20 rounded-3xl bg-white/5 border border-white/10 text-2xl font-bold hover:bg-white/10 active:scale-90 transition"
          data-val="${b}">
          ${label}
        </button>
      `;
    })
    .join("");

  pinPad.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      handle(btn.dataset.val);
    });
  });

  function handle(val) {
    if (val === "C") {
      entered = entered.slice(0, -1);

    } else if (val === "OK") {
      if (entered === savedPIN) {
        pinScreen.classList.add("hidden");
        localStorage.setItem("arume_unlocked", "true");
      } else {
        wrongPIN();
      }

    } else {
      if (entered.length < 4) {
        entered += val;
      }
    }

    updateDisplay();
  }

  function updateDisplay() {
    let dots = "";

    for (let i = 0; i < 4; i++) {
      dots += i < entered.length ? "•" : "○";
    }

    pinDisplay.textContent = dots;
  }

  function wrongPIN() {
    entered = "";
    pinDisplay.classList.add("animate-shake");
    setTimeout(() => {
      pinDisplay.classList.remove("animate-shake");
      updateDisplay();
    }, 400);
  }

  // Mostrar pantalla si no está desbloqueado
  const unlocked = localStorage.getItem("arume_unlocked");

  if (!unlocked) {
    pinScreen.classList.remove("hidden");
  } else {
    pinScreen.classList.add("hidden");
  }

  updateDisplay();
}

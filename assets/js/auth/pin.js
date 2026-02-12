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

  // Crear teclado numérico
  const buttons = [1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"];
  
  pinPad.innerHTML = buttons
    .map(b => {
      const label = b === "C" ? "⌫" : b;
      return `<button class=\"h-20 rounded-3xl bg-white/5 border border-white/10 text-2xl font-bold hover:bg-white/10 active:scale-90 transition\" data-val=\"${b}\">${label}</button>`;
    })
    .join("");

  // Event listeners
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
        alert("PIN incorrecto");
        entered = "";
      }
    } else {
      if (entered.length < 4) {
        entered += val;
      }
    }
    updateDisplay();
  }

  function updateDisplay() {
    if (entered.length === 0) {
      pinDisplay.textContent = "••••";
      pinDisplay.style.opacity = "0.3";
    } else {
      pinDisplay.textContent = "•".repeat(entered.length).padEnd(4, "•");
      pinDisplay.style.opacity = "1";
    }
  }

  // Mostrar pantalla si no está desbloqueado
  if (!localStorage.getItem("arume_unlocked")) {
    pinScreen.classList.remove("hidden");
  } else {
    pinScreen.classList.add("hidden");
  }
  
  updateDisplay();
}
/* =============================================================
   🔐 BLOQUEO SIMPLE POR PIN LOCAL
   ============================================================= */

export function initPIN() {
  const pinScreen = document.getElementById("pinScreen");
  const pinDisplay = document.getElementById("pinDisplay");
  const pinPad = document.getElementById("pinPad");

  const savedPIN = localStorage.getItem("arume_pin") || "1010"; // PIN por defecto
  let entered = "";

  // Crear teclado numérico
  const buttons = [
    ...Array(9).keys().map((i) => i + 1),
    "C",
    0,
    "OK"
  ];
  pinPad.innerHTML = buttons
    .map((b) => `
      <button class="h-20 rounded-3xl bg-white/5 border border-white/10 text-2xl font-bold
                     hover:bg-white/10 active:scale-90 transition"
              data-val="${b}">${b === "C" ? "⌫" : b}</button>
    `)
    .join("");

  [...pinPad.querySelectorAll("button")].forEach((btn) =>
    btn.addEventListener("click", () => handle(btn.dataset.val))
  );

  function handle(val) {
    if (val === "C") {
      entered = entered.slice(0, -1);
    } else if (val === "OK") {
      if (entered === savedPIN) {
        pinScreen.classList.add("hidden");
      } else {
        alert("PIN incorrecto");
        entered = "";
      }
    } else {
      if (entered.length < 4) entered += val;
    }
    updateDisplay();
  }

  function updateDisplay() {
    pinDisplay.style.opacity = entered.length > 0 ? 1 : 0;
    pinDisplay.textContent = "•".repeat(entered.length).padEnd(4, "•");
  }

  // mostrar pantalla de PIN si no está desbloqueado
  pinScreen.classList.remove("hidden");
  updateDisplay();
}

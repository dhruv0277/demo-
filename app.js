let configData = null;
let currentLang = "sk";
let currentMonthDate = new Date();
let selectedDate = null;
let selectedSlotId = null;
let couponState = {
  valid: false,
  status: "none",
  baseTotal: 0,
  finalTotal: 0,
  discountPercent: 0,
  discountFixed: 0
};

const texts = {
  sk: {
    heroKicker: "Horror Factory Booking",
    heroTitle: "Rezervujte si vstup",
    heroSubtitle: "Vyberte dátum, čas a vyplňte svoje údaje.",
    calendarTitle: "Vyberte dátum",
    timeTitle: "Vyberte čas",
    detailsTitle: "Vaše údaje",
    labelName: "Meno a priezvisko",
    labelEmail: "E-mail",
    labelPhone: "Mobilné číslo",
    labelPlayers: "Počet osôb",
    labelCoupon: "Kupón",
    labelNotes: "Poznámka",
    summaryTitle: "Zhrnutie",
    summaryDateLabel: "Dátum",
    summaryTimeLabel: "Čas",
    summaryPlayersLabel: "Počet osôb",
    summaryBaseLabel: "Základná cena",
    summaryDiscountLabel: "Zľava",
    summaryTotalLabel: "Spolu",
    addressTitle: "Miesto",
    bookBtn: "Rezervovať teraz",
    selectDateFirst: "Najprv vyberte dátum.",
    loadingSlots: "Načítavam dostupné časy...",
    allFieldsRequired: "Vyplňte všetky povinné polia a vyberte dátum aj čas.",
    bookingSuccess: "Rezervácia bola úspešne vytvorená. Presmerovávam...",
    bookingFailed: "Rezerváciu sa nepodarilo vytvoriť.",
    couponEmpty: "",
    couponValid: "✅ Kupón je platný.",
    couponInvalid: "❌ Neplatný kupón.",
    couponExpired: "❌ Kupón exspiroval.",
    couponLimit: "❌ Kupón už nie je možné použiť.",
    weekdayShort: ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"]
  },
  en: {
    heroKicker: "Horror Factory Booking",
    heroTitle: "Book your entry",
    heroSubtitle: "Choose a date, time, and fill in your details.",
    calendarTitle: "Choose date",
    timeTitle: "Choose time",
    detailsTitle: "Your details",
    labelName: "Full name",
    labelEmail: "Email",
    labelPhone: "Mobile number",
    labelPlayers: "Number of players",
    labelCoupon: "Coupon",
    labelNotes: "Notes",
    summaryTitle: "Summary",
    summaryDateLabel: "Date",
    summaryTimeLabel: "Time",
    summaryPlayersLabel: "Players",
    summaryBaseLabel: "Base price",
    summaryDiscountLabel: "Discount",
    summaryTotalLabel: "Total",
    addressTitle: "Location",
    bookBtn: "Book now",
    selectDateFirst: "Please select a date first.",
    loadingSlots: "Loading available slots...",
    allFieldsRequired: "Please fill all required fields and choose date and time.",
    bookingSuccess: "Booking created successfully. Redirecting...",
    bookingFailed: "Booking failed.",
    couponEmpty: "",
    couponValid: "✅ Coupon is valid.",
    couponInvalid: "❌ Invalid coupon.",
    couponExpired: "❌ Coupon expired.",
    couponLimit: "❌ Coupon usage limit reached.",
    weekdayShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  }
};

function t(key) {
  return texts[currentLang][key];
}

function setLanguage(lang) {
  currentLang = lang;
  document.getElementById("langSkBtn").classList.toggle("active", lang === "sk");
  document.getElementById("langEnBtn").classList.toggle("active", lang === "en");

  document.getElementById("heroKicker").textContent = t("heroKicker");
  document.getElementById("heroTitle").textContent = t("heroTitle");
  document.getElementById("heroSubtitle").textContent = t("heroSubtitle");
  document.getElementById("calendarTitle").textContent = t("calendarTitle");
  document.getElementById("timeTitle").textContent = t("timeTitle");
  document.getElementById("detailsTitle").textContent = t("detailsTitle");
  document.getElementById("labelName").textContent = t("labelName");
  document.getElementById("labelEmail").textContent = t("labelEmail");
  document.getElementById("labelPhone").textContent = t("labelPhone");
  document.getElementById("labelPlayers").textContent = t("labelPlayers");
  document.getElementById("labelCoupon").textContent = t("labelCoupon");
  document.getElementById("labelNotes").textContent = t("labelNotes");
  document.getElementById("summaryTitle").textContent = t("summaryTitle");
  document.getElementById("summaryDateLabel").textContent = t("summaryDateLabel");
  document.getElementById("summaryTimeLabel").textContent = t("summaryTimeLabel");
  document.getElementById("summaryPlayersLabel").textContent = t("summaryPlayersLabel");
  document.getElementById("summaryBaseLabel").textContent = t("summaryBaseLabel");
  document.getElementById("summaryDiscountLabel").textContent = t("summaryDiscountLabel");
  document.getElementById("summaryTotalLabel").textContent = t("summaryTotalLabel");
  document.getElementById("addressTitle").textContent = t("addressTitle");
  document.getElementById("bookBtn").textContent = t("bookBtn");

  renderWeekdays();
  renderCalendar();
  renderCouponMessage();
}

function setBookMessage(text, type = "") {
  const box = document.getElementById("bookMessage");
  box.textContent = text;
  box.className = "hf-book-message";
  if (type) box.classList.add(type);
}

function renderCouponMessage() {
  const el = document.getElementById("couponMessage");
  let text = "";
  if (couponState.status === "valid") text = t("couponValid");
  if (couponState.status === "invalid") text = t("couponInvalid");
  if (couponState.status === "expired") text = t("couponExpired");
  if (couponState.status === "limit_reached") text = t("couponLimit");
  if (couponState.status === "none") text = t("couponEmpty");
  el.textContent = text;
}

function formatCurrency(n) {
  return `€${Number(n || 0)}`;
}

function formatHumanDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(currentLang === "sk" ? "sk-SK" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function renderWeekdays() {
  const row = document.getElementById("weekdayRow");
  row.innerHTML = texts[currentLang].weekdayShort
    .map(day => `<div class="hf-weekday">${day}</div>`)
    .join("");
}

function getLocalDateString(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  grid.innerHTML = "";

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const firstDayIndex = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  monthLabel.textContent = firstDay.toLocaleDateString(
    currentLang === "sk" ? "sk-SK" : "en-GB",
    { month: "long", year: "numeric" }
  );

  for (let i = 0; i < firstDayIndex; i++) {
    const filler = document.createElement("div");
    filler.className = "hf-day muted";
    grid.appendChild(filler);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(year, month, day);
    const dateStr = getLocalDateString(cellDate);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hf-day";
    btn.textContent = day;

    if (cellDate < today) {
      btn.classList.add("disabled");
      btn.disabled = true;
    }

    if (selectedDate === dateStr) {
      btn.classList.add("selected");
    }

    btn.addEventListener("click", () => {
      selectedDate = dateStr;
      document.getElementById("selectedDateChip").textContent = formatHumanDate(dateStr);
      document.getElementById("summaryDateValue").textContent = formatHumanDate(dateStr);
      selectedSlotId = null;
      document.getElementById("summaryTimeValue").textContent = "—";
      renderCalendar();
      loadAvailability(dateStr);
    });

    grid.appendChild(btn);
  }
}

async function loadAvailability(dateStr) {
  document.getElementById("slotsGrid").innerHTML = "";
  document.getElementById("slotsEmpty").textContent = t("loadingSlots");

  try {
    const res = await fetch(`/api/availability?date=${encodeURIComponent(dateStr)}`);
    const data = await res.json();

    const booked = new Set(data.booked || []);
    const slotsGrid = document.getElementById("slotsGrid");
    const empty = document.getElementById("slotsEmpty");
    empty.textContent = "";

    configData.slots.forEach(slot => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hf-slot-btn";
      btn.textContent = slot.label;

      if (booked.has(slot.id)) {
        btn.classList.add("booked");
        btn.disabled = true;
      } else if (selectedSlotId === slot.id) {
        btn.classList.add("selected");
      }

      btn.addEventListener("click", () => {
        selectedSlotId = slot.id;
        document.getElementById("summaryTimeValue").textContent = slot.label;
        loadAvailability(dateStr);
      });

      slotsGrid.appendChild(btn);
    });
  } catch (err) {
    document.getElementById("slotsEmpty").textContent = "Error loading slots.";
  }
}

function updateSummary() {
  const players = Number(document.getElementById("players").value || 0);
  const base = players > 0 ? players * configData.pricePerPerson : 0;

  const finalTotal =
    couponState.valid && couponState.finalTotal > 0
      ? couponState.finalTotal
      : base;

  const discount = Math.max(0, base - finalTotal);

  document.getElementById("summaryPlayersValue").textContent = players || "—";
  document.getElementById("summaryBaseValue").textContent = formatCurrency(base);
  document.getElementById("summaryDiscountValue").textContent = formatCurrency(discount);
  document.getElementById("summaryTotalValue").textContent = formatCurrency(finalTotal);
}

async function verifyCoupon() {
  const code = document.getElementById("coupon").value.trim();
  const players = Number(document.getElementById("players").value || 0);

  if (!code) {
    couponState = {
      valid: false,
      status: "none",
      baseTotal: players * configData.pricePerPerson,
      finalTotal: players * configData.pricePerPerson,
      discountPercent: 0,
      discountFixed: 0
    };
    renderCouponMessage();
    updateSummary();
    return;
  }

  try {
    const res = await fetch("/api/coupon/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code, players })
    });

    const data = await res.json();

    couponState = {
      valid: !!data.valid,
      status: data.status || "invalid",
      baseTotal: data.baseTotal || 0,
      finalTotal: data.finalTotal || 0,
      discountPercent: data.discountPercent || 0,
      discountFixed: data.discountFixed || 0
    };

    renderCouponMessage();
    updateSummary();
  } catch (err) {
    couponState = {
      valid: false,
      status: "invalid",
      baseTotal: players * configData.pricePerPerson,
      finalTotal: players * configData.pricePerPerson,
      discountPercent: 0,
      discountFixed: 0
    };
    renderCouponMessage();
    updateSummary();
  }
}

async function submitBooking() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const players = document.getElementById("players").value;
  const coupon = document.getElementById("coupon").value.trim();
  const notes = document.getElementById("notes").value.trim();

  if (!name || !email || !phone || !players || !selectedDate || !selectedSlotId) {
    setBookMessage(t("allFieldsRequired"), "err");
    return;
  }

  try {
    const res = await fetch("/api/book", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        players,
        date: selectedDate,
        slot_id: selectedSlotId,
        coupon,
        notes
      })
    });

    const data = await res.json();

    if (!res.ok) {
      setBookMessage(data.error || t("bookingFailed"), "err");
      return;
    }

    setBookMessage(t("bookingSuccess"), "ok");
    window.location.href = `/success.html?id=${data.booking_id}`;
  } catch (err) {
    setBookMessage(t("bookingFailed"), "err");
  }
}

async function init() {
  const res = await fetch("/api/config");
  configData = await res.json();

  document.getElementById("businessName").textContent = configData.businessName;
  document.getElementById("businessAddress").textContent = configData.businessAddress;

  document.getElementById("players").addEventListener("change", () => {
    verifyCoupon();
    updateSummary();
  });

  document.getElementById("coupon").addEventListener("blur", verifyCoupon);
  document.getElementById("bookBtn").addEventListener("click", submitBooking);

  document.getElementById("prevMonthBtn").addEventListener("click", () => {
    currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
    renderCalendar();
  });

  document.getElementById("nextMonthBtn").addEventListener("click", () => {
    currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
    renderCalendar();
  });

  document.getElementById("langSkBtn").addEventListener("click", () => setLanguage("sk"));
  document.getElementById("langEnBtn").addEventListener("click", () => setLanguage("en"));

  setLanguage("sk");
  updateSummary();
}

init();
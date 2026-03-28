const ADMIN_SLOTS = [
  { id: "10:00", label: "10:00 – 11:00" },
  { id: "11:30", label: "11:30 – 12:30" },
  { id: "13:00", label: "13:00 – 14:00" },
  { id: "14:30", label: "14:30 – 15:30" },
  { id: "16:00", label: "16:00 – 17:00" },
  { id: "17:30", label: "17:30 – 18:30" },
  { id: "19:00", label: "19:00 – 20:00" },
  { id: "20:30", label: "20:30 – 21:30" }
];

function slotLabel(slotId) {
  const map = Object.fromEntries(ADMIN_SLOTS.map(s => [s.id, s.label]));
  return map[slotId] || slotId;
}

function setAdminMessage(text, type = "") {
  const box = document.getElementById("adminMessage");
  if (!box) return;
  box.textContent = text;
  box.className = "hf-book-message";
  if (type) box.classList.add(type);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function initAdminUser() {
  try {
    const user = await fetchJson("/api/admin/me");
    document.getElementById("adminUsername").textContent = user.username;
    document.getElementById("adminRole").textContent = user.role;
  } catch (err) {
    window.location.href = "/admin-login.html";
  }
}

async function loadReminders() {
  try {
    const data = await fetchJson("/api/admin/reminders");

    const tg = document.getElementById("todaysGroups");
    const nu = document.getElementById("nextUpcoming");

    if (tg) {
      if (!data.todaysGroups || data.todaysGroups.length === 0) {
        tg.innerHTML = `<div class="widget-empty">No groups today.</div>`;
      } else {
        tg.innerHTML = data.todaysGroups.map(item => `
          <div class="widget-item">
            <strong>${item.slot_id}</strong> — ${item.name} (${item.players})
          </div>
        `).join("");
      }
    }

    if (nu) {
      if (!data.nextUpcoming) {
        nu.innerHTML = `<div class="widget-empty">No upcoming booking.</div>`;
      } else {
        nu.innerHTML = `
          <div class="widget-item">
            <strong>${data.nextUpcoming.date}</strong><br>
            ${slotLabel(data.nextUpcoming.slot_id)}<br>
            ${data.nextUpcoming.name} (${data.nextUpcoming.players})
          </div>
        `;
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function buildCalendar(bookings) {
  const grid = document.getElementById("adminCalendar");
  if (!grid) return;

  const grouped = {};
  bookings.forEach(b => {
    if (!grouped[b.date]) grouped[b.date] = [];
    grouped[b.date].push(b);
  });

  const dates = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  if (dates.length === 0) {
    grid.innerHTML = `<div class="widget-empty">No bookings found.</div>`;
    return;
  }

  grid.innerHTML = dates.map(date => `
    <div class="admin-calendar-day">
      <div class="admin-calendar-date">${date}</div>
      ${grouped[date].map(b => `
        <div class="admin-calendar-event" draggable="true" data-id="${b.id}">
          <div><strong>${slotLabel(b.slot_id)}</strong></div>
          <div>${b.name}</div>
          <div class="event-meta">${b.players} players · ${b.status}</div>
        </div>
      `).join("")}
    </div>
  `).join("");

  grid.querySelectorAll(".admin-calendar-event").forEach(el => {
    el.addEventListener("dragstart", ev => {
      ev.dataTransfer.setData("text/plain", el.dataset.id);
    });
  });

  grid.querySelectorAll(".admin-calendar-day").forEach(dayEl => {
    dayEl.addEventListener("dragover", ev => ev.preventDefault());
    dayEl.addEventListener("drop", async ev => {
      ev.preventDefault();
      const bookingId = ev.dataTransfer.getData("text/plain");
      const newDate = dayEl.querySelector(".admin-calendar-date").textContent.trim();
      const newSlot = prompt("New slot (10:00, 11:30, 13:00, 14:30, 16:00, 17:30, 19:00, 20:30)");
      if (!newSlot) return;

      try {
        await fetchJson("/api/admin/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: bookingId, newDate, newSlot })
        });
        setAdminMessage("Booking moved successfully.", "ok");
        await loadBookings();
      } catch (err) {
        setAdminMessage(err.message, "err");
      }
    });
  });
}

function buildTableRow(b, role) {
  const actions = [];

  actions.push(`<button class="icon-action" title="Cancel" onclick="cancelBooking(${b.id})">❌</button>`);
  actions.push(`<button class="icon-action" title="Paid" onclick="markPaid(${b.id})">✅</button>`);
  actions.push(`<button class="icon-action" title="Move" onclick="moveBooking(${b.id})">🔄</button>`);

  if (role === "MAIN") {
    actions.push(`<button class="icon-action" title="Delete permanently" onclick="deleteBooking(${b.id})">🗑️</button>`);
  }

  return `
    <tr>
      <td>${b.id}</td>
      <td>${b.date}</td>
      <td>${slotLabel(b.slot_id)}</td>
      <td>${b.status}</td>
      <td>${b.name}</td>
      <td>${b.phone}</td>
      <td>${b.players}</td>
      <td>${b.coupon || ""}</td>
      <td>€${b.price_total_eur || 0}</td>
      <td>${actions.join(" ")}</td>
    </tr>
  `;
}

async function loadBookings() {
  try {
    const search = document.getElementById("search")?.value || "";
    const date = document.getElementById("dateFilter")?.value || "";

    let url = "/api/admin/bookings?";
    if (search) url += "q=" + encodeURIComponent(search) + "&";
    if (date) url += "date=" + encodeURIComponent(date);

    const data = await fetchJson(url);
    const user = await fetchJson("/api/admin/me");

    const table = document.getElementById("tableBody");
    if (table) {
      table.innerHTML = data.map(b => buildTableRow(b, user.role)).join("");
    }

    buildCalendar(data);

    if (user.role === "MAIN") {
      loadActivity();
    }
  } catch (err) {
    setAdminMessage(err.message, "err");
  }
}

async function cancelBooking(id) {
  if (!confirm("Cancel booking?")) return;
  try {
    await fetchJson("/api/admin/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    setAdminMessage("Booking cancelled.", "ok");
    loadBookings();
    loadReminders();
  } catch (err) {
    setAdminMessage(err.message, "err");
  }
}

async function markPaid(id) {
  try {
    await fetchJson("/api/admin/paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    setAdminMessage("Booking marked as paid.", "ok");
    loadBookings();
  } catch (err) {
    setAdminMessage(err.message, "err");
  }
}

async function moveBooking(id) {
  const newDate = prompt("New date (YYYY-MM-DD)");
  const newSlot = prompt("New slot (10:00, 11:30, 13:00, 14:30, 16:00, 17:30, 19:00, 20:30)");
  if (!newDate || !newSlot) return;

  try {
    await fetchJson("/api/admin/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, newDate, newSlot })
    });
    setAdminMessage("Booking moved.", "ok");
    loadBookings();
    loadReminders();
  } catch (err) {
    setAdminMessage(err.message, "err");
  }
}

async function deleteBooking(id) {
  if (!confirm("Delete permanently?")) return;
  try {
    await fetchJson("/api/admin/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    setAdminMessage("Booking deleted permanently.", "ok");
    loadBookings();
    loadReminders();
  } catch (err) {
    setAdminMessage(err.message, "err");
  }
}

function exportExcel() {
  const date = document.getElementById("dateFilter")?.value || "";
  let url = "/api/admin/export.xlsx";
  if (date) url += "?date=" + encodeURIComponent(date);
  window.location.href = url;
}

async function loadActivity() {
  try {
    const data = await fetchJson("/api/admin/activity");
    const table = document.getElementById("activityBody");
    if (!table) return;

    table.innerHTML = data.map(a => `
      <tr>
        <td>${a.username || ""}</td>
        <td>${a.role || ""}</td>
        <td>${a.action}</td>
        <td>${a.booking_id || ""}</td>
        <td>${a.details || ""}</td>
        <td>${a.created_at}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error(err);
  }
}

async function logout() {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.href = "/admin-login.html";
}

function setupLiveSearch() {
  const search = document.getElementById("search");
  const dateFilter = document.getElementById("dateFilter");

  if (search) {
    search.addEventListener("input", () => loadBookings());
  }

  if (dateFilter) {
    dateFilter.addEventListener("change", () => loadBookings());
  }
}

initAdminUser();
setupLiveSearch();
loadBookings();
loadReminders();
const patientsTable = document.querySelector("#patientRows");
const appointmentsTable = document.querySelector("#appointmentRows");
const appointmentDialog = document.querySelector("#appointmentDialog");
const patientDialog = document.querySelector("#patientDialog");
const patientDetailDialog = document.querySelector("#patientDetailDialog");
const appointmentForm = document.querySelector("#appointmentForm");
const patientForm = document.querySelector("#patientForm");
let patients = [];
let appointments = [];
let toastTimer;
let editingPatientId = null;
let editingAppointmentId = null;
let detailPatientId = null;
const pageLabels = {
  dashboard: "Dashboard",
  appointments: "Appointments",
  patients: "Patient records",
  doctors: "Our doctors",
  departments: "Departments",
  assistant: "Clinic assistant",
  insights: "Clinic pulse",
  about: "About this project",
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});
const weekdayFormatter = new Intl.DateTimeFormat("en-IN", { weekday: "long" });

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

function showToast(message, success = false) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.toggle("success", success);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3800);
}

function localDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "Not provided";
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}

function formatShortDate(value) {
  return shortDateFormatter.format(new Date(`${value}T12:00:00`));
}

function prettyTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function updateDateLabels() {
  const today = new Date();
  document.querySelector("#todayLabel").textContent = dateFormatter.format(today);
}

function setServerStatus(online) {
  const status = document.querySelector("#serverStatus");
  status.classList.toggle("is-online", online);
  status.classList.toggle("is-offline", !online);
  document.querySelector("#serverStatusLabel").textContent = online ? "Local demo online" : "Server offline";
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function avatarInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

function statusBadge(status) {
  const labels = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled" };
  return makeElement("span", `status-badge status-${status}`, labels[status] || status);
}

function emptyMessage(container, message) {
  container.replaceChildren(makeElement("p", "inline-empty", message));
}

function updateDashboard(dashboard) {
  document.querySelector("#todayCount").textContent = dashboard.todayCount;
  document.querySelector("#patientCount").textContent = dashboard.patientCount;
  document.querySelector("#doctorCount").textContent = dashboard.doctorCount;
  document.querySelector("#upcomingCount").textContent = dashboard.upcomingCount;
  document.querySelector("#completedCount").textContent = dashboard.completedToday;
  document.querySelector("#todaySubtitle").textContent =
    `${weekdayFormatter.format(new Date(`${dashboard.today}T12:00:00`))}, ${formatDate(dashboard.today)}`;

  const todayList = document.querySelector("#todayAppointments");
  todayList.replaceChildren();
  if (!dashboard.todayAppointments.length) {
    emptyMessage(todayList, "No visits booked for today. Your schedule is clear.");
  } else {
    for (const appointment of dashboard.todayAppointments) {
      const row = makeElement("article", "schedule-item");
      const time = makeElement("span", "schedule-time", prettyTime(appointment.appointmentTime));
      const patient = makeElement("span", "patient-avatar", avatarInitials(appointment.patientName));
      const copy = makeElement("span", "schedule-copy");
      copy.append(
        makeElement("strong", "", appointment.patientName),
        makeElement("small", "", `${appointment.department} · ${appointment.doctor}`),
      );
      row.append(time, patient, copy, statusBadge(appointment.status));
      todayList.append(row);
    }
  }

  const upcomingList = document.querySelector("#upcomingAppointments");
  upcomingList.replaceChildren();
  if (!dashboard.upcomingAppointments.length) {
    emptyMessage(upcomingList, "No upcoming appointments in the next 7 days.");
  } else {
    for (const appointment of dashboard.upcomingAppointments) {
      const item = makeElement("article", "upcoming-item");
      const dateBox = makeElement("span", "upcoming-date");
      dateBox.append(
        makeElement("strong", "", new Date(`${appointment.appointmentDate}T12:00:00`).getDate()),
        makeElement("small", "", new Intl.DateTimeFormat("en-IN", { month: "short" })
          .format(new Date(`${appointment.appointmentDate}T12:00:00`))),
      );
      const copy = makeElement("span", "upcoming-copy");
      copy.append(
        makeElement("strong", "", appointment.patientName),
        makeElement("small", "", `${formatShortDate(appointment.appointmentDate)} · ${prettyTime(appointment.appointmentTime)}`),
      );
      const department = makeElement("span", "upcoming-department", appointment.department);
      item.append(dateBox, copy, department);
      upcomingList.append(item);
    }
  }
}

function renderDashboard() {
  apiRequest("/api/dashboard")
    .then(updateDashboard)
    .catch((error) => showToast(`Could not load the clinic dashboard: ${error.message}`));
}

function renderAppointmentRow(appointment) {
  const row = makeElement("tr");
  const dateCell = makeElement("td");
  dateCell.append(
    makeElement("strong", "table-primary", prettyTime(appointment.appointmentTime)),
    makeElement("small", "table-secondary", formatDate(appointment.appointmentDate)),
  );
  const patientCell = makeElement("td");
  const patientLink = makeElement("button", "table-patient-link", appointment.patientName);
  patientLink.type = "button";
  patientLink.addEventListener("click", () => openPatientRecord(appointment.patientId));
  patientCell.append(patientLink, makeElement("small", "table-secondary", appointment.patientCode));
  const doctorCell = makeElement("td", "", appointment.doctor);
  const departmentCell = makeElement("td");
  departmentCell.append(
    makeElement("span", "department-chip", appointment.department),
    makeElement("small", "table-secondary", appointment.reason),
  );
  const statusCell = makeElement("td");
  statusCell.append(statusBadge(appointment.status));
  const actionsCell = makeElement("td");
  const actions = makeElement("div", "row-actions");

  if (appointment.status === "scheduled") {
    const edit = makeElement("button", "row-action", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => openAppointmentDialog(appointment));
    const complete = makeElement("button", "row-action row-action-complete", "Complete");
    complete.type = "button";
    complete.addEventListener("click", () => updateAppointmentStatus(appointment, "completed"));
    const cancel = makeElement("button", "row-action row-action-danger", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => updateAppointmentStatus(appointment, "cancelled"));
    actions.append(edit, complete, cancel);
  } else {
    const remove = makeElement("button", "row-action row-action-danger", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => deleteAppointment(appointment));
    actions.append(remove);
  }

  actionsCell.append(actions);
  row.append(dateCell, patientCell, doctorCell, departmentCell, statusCell, actionsCell);
  return row;
}

function renderAppointments() {
  const query = document.querySelector("#appointmentSearch").value.trim().toLowerCase();
  const status = document.querySelector("#appointmentStatusFilter").value;
  const filtered = appointments.filter((appointment) => {
    const matchesStatus = status === "all" || appointment.status === status;
    const matchesQuery = !query ||
      [appointment.patientName, appointment.patientCode, appointment.doctor, appointment.department, appointment.reason]
        .some((value) => value.toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  });
  appointmentsTable.replaceChildren();
  document.querySelector("#appointmentEmpty").hidden = filtered.length !== 0;
  for (const appointment of filtered) appointmentsTable.append(renderAppointmentRow(appointment));
}

function updateInsightBars(containerId, items, emptyText) {
  const container = document.querySelector(`#${containerId}`);
  container.replaceChildren();
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (!total) {
    emptyMessage(container, emptyText);
    return;
  }
  for (const item of items) {
    const percent = Math.round((item.count / total) * 100);
    const row = makeElement("div", "insight-bar-row");
    const heading = makeElement("div", "insight-bar-heading");
    heading.append(makeElement("span", "insight-bar-label", item.label));
    heading.append(makeElement("strong", "insight-bar-value", `${item.count} · ${percent}%`));
    const track = makeElement("div", "insight-bar-track");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `${item.label}: ${item.count} appointments`);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(percent));
    const fill = makeElement("span", `insight-bar-fill ${item.color}`);
    fill.style.width = `${percent}%`;
    track.append(fill);
    row.append(heading, track);
    container.append(row);
  }
}

function renderInsights() {
  const statusCounts = {
    scheduled: appointments.filter((appointment) => appointment.status === "scheduled").length,
    completed: appointments.filter((appointment) => appointment.status === "completed").length,
    cancelled: appointments.filter((appointment) => appointment.status === "cancelled").length,
  };
  document.querySelector("#insightTotal").textContent = String(appointments.length);
  document.querySelector("#insightScheduled").textContent = String(statusCounts.scheduled);
  document.querySelector("#insightCompleted").textContent = String(statusCounts.completed);
  document.querySelector("#insightCancelled").textContent = String(statusCounts.cancelled);

  const statusItems = [
    { label: "Scheduled", count: statusCounts.scheduled, color: "fill-purple" },
    { label: "Completed", count: statusCounts.completed, color: "fill-green" },
    { label: "Cancelled", count: statusCounts.cancelled, color: "fill-coral" },
  ];
  const bubbleChart = document.querySelector("#statusBubbleChart");
  bubbleChart.replaceChildren();
  for (const item of statusItems) {
    const bubble = makeElement("div", `status-bubble-item ${item.color}`);
    const percent = appointments.length ? Math.round((item.count / appointments.length) * 100) : 0;
    const size = 58 + Math.round((item.count / Math.max(appointments.length, 1)) * 30);
    const circle = makeElement("span", "status-bubble-circle", String(item.count));
    circle.style.setProperty("--bubble-size", `${size}px`);
    circle.setAttribute("role", "img");
    circle.setAttribute("aria-label", `${item.label}: ${item.count} appointments, ${percent}%`);
    bubble.append(
      circle,
      makeElement("strong", "status-bubble-label", item.label),
      makeElement("small", "status-bubble-percent", `${percent}%`),
    );
    bubbleChart.append(bubble);
  }
  updateInsightBars("statusInsightList", statusItems, "No appointments to summarize yet.");

  const departments = [
    { label: "General Medicine", color: "fill-purple" },
    { label: "Cardiology", color: "fill-green" },
    { label: "Dermatology", color: "fill-coral" },
    { label: "Pediatrics", color: "fill-blue" },
    { label: "Dental", color: "fill-rose" },
  ].map((department) => ({
    ...department,
    count: appointments.filter((appointment) =>
      appointment.department === department.label && appointment.status !== "cancelled",
    ).length,
  }));
  updateInsightBars("departmentInsightList", departments, "No scheduled or completed visits to summarize.");

  const busiest = departments.reduce((top, department) =>
    department.count > top.count ? department : top,
  { label: "", count: 0 });
  document.querySelector("#insightHighlightTitle").textContent = busiest.count
    ? busiest.label
    : "Your clinic snapshot is ready";
  document.querySelector("#insightHighlightCopy").textContent = busiest.count
    ? `${busiest.count} scheduled or completed ${busiest.count === 1 ? "visit is" : "visits are"} in this department. Cancelled appointments are excluded from this highlight.`
    : "Create or book demo appointments to see the schedule patterns here.";
}

function renderPatientRow(patient) {
  const row = makeElement("tr");
  const patientCell = makeElement("td");
  const patientInfo = makeElement("button", "patient-table-profile");
  patientInfo.type = "button";
  patientInfo.append(
    makeElement("span", "patient-avatar", avatarInitials(patient.fullName)),
    makeElement("span", "patient-table-copy"),
  );
  const copy = patientInfo.lastElementChild;
  copy.append(
    makeElement("strong", "", patient.fullName),
    makeElement("small", "", patient.patientCode),
  );
  patientInfo.addEventListener("click", () => openPatientRecord(patient.id));
  patientCell.append(patientInfo);

  const contact = makeElement("td");
  contact.append(
    makeElement("span", "contact-line", patient.phone || "No phone added"),
    makeElement("small", "table-secondary", patient.email || "No email added"),
  );
  const birthday = makeElement("td", "table-muted", formatDate(patient.dateOfBirth));
  const visits = makeElement("td");
  visits.append(
    makeElement("span", "visit-count", patient.appointmentCount),
    makeElement("small", "table-secondary", `${patient.appointmentCount === 1 ? "appointment" : "appointments"}`),
  );
  const record = makeElement("td");
  record.append(
    makeElement("span", `record-indicator ${patient.recordNotes ? "record-present" : ""}`),
    makeElement("span", "table-muted", patient.recordNotes ? "Notes saved" : "No notes"),
  );
  const actionsCell = makeElement("td");
  const actions = makeElement("div", "row-actions");
  const view = makeElement("button", "row-action", "View");
  view.type = "button";
  view.addEventListener("click", () => openPatientRecord(patient.id));
  const edit = makeElement("button", "row-action", "Edit");
  edit.type = "button";
  edit.addEventListener("click", () => openPatientDialog(patient));
  actions.append(view, edit);
  if (patient.appointmentCount === 0) {
    const remove = makeElement("button", "row-action row-action-danger", "Delete");
    remove.type = "button";
    remove.addEventListener("click", () => deletePatient(patient));
    actions.append(remove);
  }
  actionsCell.append(actions);
  row.append(patientCell, contact, birthday, visits, record, actionsCell);
  return row;
}

function renderPatients() {
  const query = document.querySelector("#patientSearch").value.trim().toLowerCase();
  const filtered = patients.filter((patient) =>
    [patient.fullName, patient.patientCode, patient.phone, patient.email]
      .some((value) => value.toLowerCase().includes(query)),
  );
  patientsTable.replaceChildren();
  document.querySelector("#patientEmpty").hidden = filtered.length !== 0;
  for (const patient of filtered) patientsTable.append(renderPatientRow(patient));
}

async function refreshData() {
  const [dashboard, patientData, appointmentData, health] = await Promise.all([
    apiRequest("/api/dashboard"),
    apiRequest("/api/patients"),
    apiRequest("/api/appointments"),
    apiRequest("/api/health"),
  ]);
  patients = patientData.patients;
  appointments = appointmentData.appointments;
  updateDashboard(dashboard);
  renderPatients();
  renderAppointments();
  renderInsights();
  const assistantStatus = document.querySelector("#assistantStatus");
  assistantStatus.textContent = health.aiConfigured ? "● AI ready" : "● API key needed";
  assistantStatus.classList.toggle("is-offline", !health.aiConfigured);
  setServerStatus(true);
}

function navigateTo(viewName) {
  if (!Object.hasOwn(pageLabels, viewName)) return;
  for (const view of document.querySelectorAll(".view")) {
    const active = view.id === `${viewName}View`;
    view.hidden = !active;
    view.classList.toggle("active", active);
  }
  document.querySelectorAll(".nav-link").forEach((link) => {
    const active = link.dataset.view === viewName;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelector("#breadcrumbCurrent").textContent = pageLabels[viewName];
  document.querySelector("#sidebar").classList.remove("open");
  document.querySelector("#menuToggle").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function addChatMessage(message, sender) {
  const row = document.createElement("div");
  row.className = `chat-message ${sender}-message`;
  if (sender === "assistant") {
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "✦";
    row.append(avatar);
  }
  const text = document.createElement("p");
  text.textContent = message;
  row.append(text);
  document.querySelector("#chatMessages").append(row);
  row.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

document.querySelector("#chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#chatInput");
  const sendButton = document.querySelector("#chatSend");
  const message = input.value.trim();
  if (!message) return;
  addChatMessage(message, "user");
  input.value = "";
  input.disabled = true;
  sendButton.disabled = true;
  sendButton.textContent = "Thinking…";
  try {
    const result = await apiRequest("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    addChatMessage(result.reply, "assistant");
  } catch (error) {
    addChatMessage(`I couldn't get an answer: ${error.message}`, "assistant");
  } finally {
    input.disabled = false;
    sendButton.disabled = false;
    sendButton.innerHTML = "<span>↑</span> Send";
    input.focus();
  }
});
document.querySelectorAll(".chat-suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.querySelector("#chatInput");
    input.value = button.textContent;
    document.querySelector("#chatForm").requestSubmit();
  });
});

function updatePatientSelect(selectedId = "") {
  const select = document.querySelector("#appointmentPatient");
  select.replaceChildren();
  const placeholder = makeElement("option", "", "Choose a patient");
  placeholder.value = "";
  select.append(placeholder);
  for (const patient of patients) {
    const option = makeElement("option", "", `${patient.fullName} · ${patient.patientCode}`);
    option.value = patient.id;
    option.selected = patient.id === selectedId;
    select.append(option);
  }
  if (!patients.length) {
    const empty = makeElement("option", "", "Add a patient record first");
    empty.value = "";
    select.append(empty);
  }
}

function updateDoctorAvailability() {
  const doctor = appointmentForm.elements.doctor.value;
  const appointmentDate = appointmentForm.elements.appointmentDate.value;
  const appointmentTime = appointmentForm.elements.appointmentTime.value;
  const hint = document.querySelector("#doctorAvailability");
  hint.classList.remove("availability-free", "availability-busy");
  if (!doctor || !appointmentDate || !appointmentTime) {
    hint.textContent = "Choose a doctor, date and time to check availability.";
    return;
  }
  const conflict = appointments.some((appointment) =>
    appointment.id !== editingAppointmentId &&
    appointment.status === "scheduled" &&
    appointment.doctor === doctor &&
    appointment.appointmentDate === appointmentDate &&
    appointment.appointmentTime === appointmentTime,
  );
  hint.classList.add(conflict ? "availability-busy" : "availability-free");
  hint.textContent = conflict
    ? "This doctor already has a scheduled visit at that time. Choose another slot."
    : "This doctor’s demo schedule is free at that time.";
}

function openAppointmentDialog(appointment = null, patientId = "", doctor = "", department = "") {
  editingAppointmentId = appointment?.id || null;
  appointmentForm.reset();
  document.querySelector("#appointmentDialogTitle").textContent =
    appointment ? "Edit appointment" : "Book an appointment";
  document.querySelector("#appointmentError").hidden = true;
  updatePatientSelect(appointment?.patientId || patientId);
  appointmentForm.elements.doctor.value = appointment?.doctor || doctor;
  appointmentForm.elements.department.value = appointment?.department || department;
  appointmentForm.elements.appointmentDate.value = appointment?.appointmentDate || localDateOffset(0);
  appointmentForm.elements.appointmentTime.value = appointment?.appointmentTime || "";
  appointmentForm.elements.reason.value = appointment?.reason || "";
  updateDoctorAvailability();
  appointmentDialog.showModal();
}

function openPatientDialog(patient = null) {
  editingPatientId = patient?.id || null;
  patientForm.reset();
  document.querySelector("#patientDialogTitle").textContent =
    patient ? "Edit patient record" : "Add patient record";
  document.querySelector("#patientError").hidden = true;
  if (patient) {
    patientForm.elements.fullName.value = patient.fullName;
    patientForm.elements.dateOfBirth.value = patient.dateOfBirth || "";
    patientForm.elements.phone.value = patient.phone;
    patientForm.elements.email.value = patient.email;
    patientForm.elements.recordNotes.value = patient.recordNotes;
  }
  patientDialog.showModal();
}

function detailLine(label, value) {
  const line = makeElement("div", "detail-line");
  line.append(makeElement("dt", "", label), makeElement("dd", "", value || "Not provided"));
  return line;
}

async function openPatientRecord(patientId) {
  try {
    const { patient } = await apiRequest(`/api/patients/${encodeURIComponent(patientId)}`);
    detailPatientId = patient.id;
    const content = document.querySelector("#patientDetailContent");
    content.replaceChildren();
    const heading = makeElement("div", "detail-heading");
    const avatar = makeElement("span", "detail-avatar", avatarInitials(patient.fullName));
    const intro = makeElement("div", "detail-intro");
    intro.append(
      makeElement("span", "dialog-kicker", `PATIENT RECORD · ${patient.patientCode}`),
      makeElement("h2", "", patient.fullName),
      makeElement("p", "", `${patient.appointments.length} appointment${patient.appointments.length === 1 ? "" : "s"} on record`),
    );
    heading.append(avatar, intro);

    const actions = makeElement("div", "detail-actions");
    const book = makeElement("button", "primary-button", "＋ Book appointment");
    book.type = "button";
    book.addEventListener("click", () => {
      patientDetailDialog.close();
      openAppointmentDialog(null, patient.id);
    });
    const edit = makeElement("button", "secondary-button", "Edit record");
    edit.type = "button";
    edit.addEventListener("click", () => {
      patientDetailDialog.close();
      openPatientDialog(patient);
    });
    actions.append(book, edit);

    const contact = makeElement("dl", "detail-grid");
    contact.append(
      detailLine("Date of birth", patient.dateOfBirth ? formatDate(patient.dateOfBirth) : ""),
      detailLine("Phone", patient.phone),
      detailLine("Email", patient.email),
    );
    const notesHeading = makeElement("h3", "detail-section-title", "Administrative demo notes");
    const note = makeElement("p", "detail-note", patient.recordNotes || "No notes have been added to this demo record.");
    const visitsHeading = makeElement("h3", "detail-section-title", "Appointment history");
    const history = makeElement("div", "detail-history");
    if (!patient.appointments.length) {
      emptyMessage(history, "No appointments on record.");
    } else {
      for (const appointment of patient.appointments) {
        const row = makeElement("article", "history-item");
        const copy = makeElement("div", "");
        copy.append(
          makeElement("strong", "", `${formatDate(appointment.appointmentDate)} · ${prettyTime(appointment.appointmentTime)}`),
          makeElement("small", "", `${appointment.department} · ${appointment.doctor}`),
          makeElement("small", "", appointment.reason),
        );
        row.append(copy, statusBadge(appointment.status));
        history.append(row);
      }
    }
    content.append(heading, actions, contact, notesHeading, note, visitsHeading, history);
    patientDetailDialog.showModal();
  } catch (error) {
    showToast(`Could not open patient record: ${error.message}`);
  }
}

async function updateAppointmentStatus(appointment, status) {
  const action = status === "completed" ? "mark this visit complete" : "cancel this appointment";
  if (!window.confirm(`Are you sure you want to ${action} for ${appointment.patientName}?`)) return;
  try {
    await apiRequest(`/api/appointments/${encodeURIComponent(appointment.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await refreshData();
    if (detailPatientId) await openPatientRecord(detailPatientId);
    showToast(status === "completed" ? "Appointment marked complete." : "Appointment cancelled.", true);
  } catch (error) {
    showToast(`Could not update appointment: ${error.message}`);
  }
}

async function deleteAppointment(appointment) {
  if (!window.confirm(`Remove this demo appointment for ${appointment.patientName}?`)) return;
  try {
    await apiRequest(`/api/appointments/${encodeURIComponent(appointment.id)}`, { method: "DELETE" });
    await refreshData();
    showToast("Demo appointment removed.", true);
  } catch (error) {
    showToast(`Could not remove appointment: ${error.message}`);
  }
}

async function deletePatient(patient) {
  if (!window.confirm(`Delete the demo patient record for ${patient.fullName}? This cannot be undone.`)) return;
  try {
    await apiRequest(`/api/patients/${encodeURIComponent(patient.id)}`, { method: "DELETE" });
    await refreshData();
    showToast("Demo patient record deleted.", true);
  } catch (error) {
    showToast(`Could not delete patient record: ${error.message}`);
  }
}

appointmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(appointmentForm);
  const button = appointmentForm.querySelector('button[type="submit"]');
  const errorElement = document.querySelector("#appointmentError");
  errorElement.hidden = true;
  button.disabled = true;
  try {
    const path = editingAppointmentId
      ? `/api/appointments/${encodeURIComponent(editingAppointmentId)}`
      : "/api/appointments";
    await apiRequest(path, {
      method: editingAppointmentId ? "PUT" : "POST",
      body: JSON.stringify({
        patientId: data.get("patientId"),
        doctor: data.get("doctor"),
        department: data.get("department"),
        appointmentDate: data.get("appointmentDate"),
        appointmentTime: data.get("appointmentTime"),
        reason: data.get("reason"),
      }),
    });
    appointmentDialog.close();
    await refreshData();
    showToast(editingAppointmentId ? "Appointment updated." : "Appointment booked.", true);
    editingAppointmentId = null;
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.hidden = false;
  } finally {
    button.disabled = false;
  }
});

patientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(patientForm);
  const button = patientForm.querySelector('button[type="submit"]');
  const errorElement = document.querySelector("#patientError");
  errorElement.hidden = true;
  button.disabled = true;
  try {
    const path = editingPatientId
      ? `/api/patients/${encodeURIComponent(editingPatientId)}`
      : "/api/patients";
    const saved = await apiRequest(path, {
      method: editingPatientId ? "PUT" : "POST",
      body: JSON.stringify({
        fullName: data.get("fullName"),
        dateOfBirth: data.get("dateOfBirth"),
        phone: data.get("phone"),
        email: data.get("email"),
        recordNotes: data.get("recordNotes"),
      }),
    });
    patientDialog.close();
    await refreshData();
    showToast(editingPatientId ? "Patient record updated." : `Patient record saved as ${saved.patient.patientCode}.`, true);
    editingPatientId = null;
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.hidden = false;
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo(link.dataset.view);
  });
});
document.querySelectorAll("[data-navigate]").forEach((button) => {
  button.addEventListener("click", () => navigateTo(button.dataset.navigate));
});
document.querySelectorAll("[data-doctor]").forEach((button) => {
  button.addEventListener("click", () => openAppointmentDialog(
    null,
    "",
    button.dataset.doctor,
    button.dataset.department || "",
  ));
});
document.querySelectorAll(".doctor-photo").forEach((photo) => {
  photo.addEventListener("error", () => photo.closest(".doctor-photo-wrap").classList.add("has-photo-error"));
});
document.querySelector("#menuToggle").addEventListener("click", (event) => {
  const open = document.querySelector("#sidebar").classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});
document.querySelector("#bookAppointmentTop").addEventListener("click", () => openAppointmentDialog());
document.querySelector("#bookAppointmentList").addEventListener("click", () => openAppointmentDialog());
document.querySelector("#quickBook").addEventListener("click", () => openAppointmentDialog());
document.querySelector("#quickPatient").addEventListener("click", () => openPatientDialog());
document.querySelector("#addPatient").addEventListener("click", () => openPatientDialog());
document.querySelector("#workflowPatient").addEventListener("click", () => openPatientDialog());
document.querySelector("#workflowBook").addEventListener("click", () => openAppointmentDialog());
document.querySelector("#workflowManage").addEventListener("click", () => navigateTo("appointments"));
document.querySelector("#appointmentSearch").addEventListener("input", renderAppointments);
document.querySelector("#appointmentStatusFilter").addEventListener("change", renderAppointments);
for (const field of [
  appointmentForm.elements.doctor,
  appointmentForm.elements.appointmentDate,
  appointmentForm.elements.appointmentTime,
]) {
  field.addEventListener("input", updateDoctorAvailability);
  field.addEventListener("change", updateDoctorAvailability);
}
document.querySelector("#patientSearch").addEventListener("input", renderPatients);
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close());
});
for (const dialogElement of document.querySelectorAll("dialog")) {
  dialogElement.addEventListener("click", (event) => {
    if (event.target === dialogElement) dialogElement.close();
  });
}

updateDateLabels();
refreshData().catch((error) => {
  setServerStatus(false);
  document.querySelector("#todaySubtitle").textContent = "Start the local demo server to load clinic records.";
  showToast(`Could not connect to the local clinic demo: ${error.message}`);
});

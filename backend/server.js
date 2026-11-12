import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATABASE_PATH = resolve(process.env.CARENEST_DB_PATH || resolve(ROOT, "carenest-demo.sqlite"));
const REQUESTED_PORT = Number(process.env.PORT || 3000);
const BODY_LIMIT = 16 * 1024;
const DOCTORS = new Set(["Dr. Maya Patel", "Dr. Arjun Rao", "Dr. Sofia Thomas", "Dr. Noah Williams", "Dr. Nina Kapoor"]);
const DEPARTMENTS = new Set(["General Medicine", "Cardiology", "Dermatology", "Pediatrics", "Dental"]);
const STATUSES = new Set(["scheduled", "completed", "cancelled"]);

const database = new DatabaseSync(DATABASE_PATH);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    patient_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    date_of_birth TEXT,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    record_notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    doctor TEXT NOT NULL,
    department TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled'
      CHECK(status IN ('scheduled', 'completed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS appointments_schedule_idx
    ON appointments(appointment_date, appointment_time);
  CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments(patient_id);
`);

function localDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function seedDemoData() {
  if (database.prepare("SELECT COUNT(*) AS count FROM patients").get().count > 0) return;

  const people = [
    ["CN-1001", "Jamie Parker", -1, "555-0101", "jamie@example.test", "Demo note: routine visit follow-up."],
    ["CN-1002", "Taylor Morgan", -8, "555-0102", "taylor@example.test", "Demo note: prefers morning appointments."],
    ["CN-1003", "Riley Jordan", -19, "555-0103", "riley@example.test", ""],
    ["CN-1004", "Avery Quinn", -35, "555-0104", "avery@example.test", "Demo note: first clinic visit."],
    ["CN-1005", "Casey Ellis", -11, "555-0105", "casey@example.test", ""],
    ["CN-1006", "Robin Lee", -46, "555-0106", "robin@example.test", "Demo note: follow-up requested."],
    ["CN-1007", "Drew Parker", -70, "555-0107", "drew@example.test", ""],
  ];
  const patientIds = new Map();
  const insertPatient = database.prepare(`
    INSERT INTO patients (id, patient_code, full_name, date_of_birth, phone, email, record_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAppointment = database.prepare(`
    INSERT INTO appointments
      (id, patient_id, doctor, department, appointment_date, appointment_time, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const visits = [
    [0, 0, "Dr. Maya Patel", "General Medicine", 0, "09:15", "Routine check-up", "scheduled"],
    [1, 1, "Dr. Arjun Rao", "Dental", 0, "10:00", "Routine dental visit", "scheduled"],
    [2, 2, "Dr. Sofia Thomas", "Dermatology", 0, "11:30", "Follow-up visit", "completed"],
    [3, 3, "Dr. Noah Williams", "Pediatrics", 1, "09:45", "Routine check-up", "scheduled"],
    [4, 4, "Dr. Maya Patel", "General Medicine", 1, "13:15", "Annual visit", "scheduled"],
    [5, 5, "Dr. Arjun Rao", "Cardiology", 2, "10:30", "Follow-up visit", "scheduled"],
    [6, 6, "Dr. Sofia Thomas", "Dermatology", 4, "14:00", "Routine consultation", "scheduled"],
    [1, 1, "Dr. Maya Patel", "General Medicine", -2, "09:30", "Previous demo visit", "completed"],
    [5, 5, "Dr. Arjun Rao", "Cardiology", -4, "13:00", "Previous demo visit", "completed"],
  ];

  database.exec("BEGIN");
  try {
    for (const [code, name, birthdayOffset, phone, email, notes] of people) {
      const id = crypto.randomUUID();
      patientIds.set(code, id);
      insertPatient.run(
        id,
        code,
        name,
        localDateOffset(birthdayOffset * 365),
        phone,
        email,
        notes,
      );
    }
    for (const [patientIndex, , doctor, department, dayOffset, time, reason, status] of visits) {
      const patient = people[patientIndex];
      insertAppointment.run(
        crypto.randomUUID(),
        patientIds.get(patient[0]),
        doctor,
        department,
        localDateOffset(dayOffset),
        time,
        reason,
        status,
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

seedDemoData();

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > BODY_LIMIT) {
        rejectBody(Object.assign(new Error("Request body is too large."), { status: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(body));
      } catch {
        rejectBody(Object.assign(new Error("Send a valid JSON request body."), { status: 400 }));
      }
    });
    request.on("error", rejectBody);
  });
}

function validDate(value, allowPast = true) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return allowPast || value >= localDateOffset(0);
}

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function validatePatient(data) {
  const input = ensureObject(data);
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const dateOfBirth = input.dateOfBirth || "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const recordNotes = typeof input.recordNotes === "string" ? input.recordNotes.trim() : "";

  if (fullName.length < 2 || fullName.length > 80) {
    return { error: "Enter a patient name between 2 and 80 characters." };
  }
  if (dateOfBirth && (!validDate(dateOfBirth) || dateOfBirth > localDateOffset(0))) {
    return { error: "Enter a valid date of birth that is not in the future." };
  }
  if (phone.length > 30 || (phone && !/^[+()\d.\-\s]+$/.test(phone))) {
    return { error: "Enter a valid phone number up to 30 characters." };
  }
  if (email.length > 120 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { error: "Enter a valid email address up to 120 characters." };
  }
  if (recordNotes.length > 1000) {
    return { error: "Record notes must be 1,000 characters or fewer." };
  }
  return {
    value: {
      fullName,
      dateOfBirth: dateOfBirth || null,
      phone,
      email,
      recordNotes,
    },
  };
}

function validateAppointment(data) {
  const input = ensureObject(data);
  const patientId = typeof input.patientId === "string" ? input.patientId : "";
  const doctor = input.doctor;
  const department = input.department;
  const appointmentDate = input.appointmentDate;
  const appointmentTime = input.appointmentTime;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";

  if (!patientId || !database.prepare("SELECT 1 FROM patients WHERE id = ?").get(patientId)) {
    return { error: "Choose an existing patient record." };
  }
  if (!DOCTORS.has(doctor) || !DEPARTMENTS.has(department)) {
    return { error: "Choose a doctor and department from the list." };
  }
  if (!validDate(appointmentDate, false)) {
    return { error: "Choose a valid appointment date today or later." };
  }
  if (typeof appointmentTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime)) {
    return { error: "Choose a valid appointment time." };
  }
  if (!reason || reason.length > 160) {
    return { error: "Enter a visit reason between 1 and 160 characters." };
  }
  return { value: { patientId, doctor, department, appointmentDate, appointmentTime, reason } };
}

const APPOINTMENT_SELECT = `
  SELECT a.id, a.patient_id AS patientId, p.patient_code AS patientCode,
    p.full_name AS patientName, p.phone AS patientPhone, p.email AS patientEmail,
    a.doctor, a.department, a.appointment_date AS appointmentDate,
    a.appointment_time AS appointmentTime, a.reason, a.status
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
`;

function getAppointments() {
  return database.prepare(`${APPOINTMENT_SELECT}
    ORDER BY a.appointment_date ASC, a.appointment_time ASC, a.created_at ASC
  `).all();
}

function findDoctorSlotConflict(appointment, excludedId = "") {
  return database.prepare(`
    SELECT 1 FROM appointments
    WHERE doctor = ? AND appointment_date = ? AND appointment_time = ?
      AND status = 'scheduled' AND id != ?
    LIMIT 1
  `).get(appointment.doctor, appointment.appointmentDate, appointment.appointmentTime, excludedId);
}

function getPatients() {
  return database.prepare(`
    SELECT p.id, p.patient_code AS patientCode, p.full_name AS fullName,
      p.date_of_birth AS dateOfBirth, p.phone, p.email, p.record_notes AS recordNotes,
      COUNT(a.id) AS appointmentCount
    FROM patients p
    LEFT JOIN appointments a ON a.patient_id = p.id
    GROUP BY p.id
    ORDER BY p.full_name COLLATE NOCASE
  `).all();
}

function getPatientRecord(id) {
  const patient = database.prepare(`
    SELECT id, patient_code AS patientCode, full_name AS fullName,
      date_of_birth AS dateOfBirth, phone, email, record_notes AS recordNotes
    FROM patients WHERE id = ?
  `).get(id);
  if (!patient) return null;
  const appointments = database.prepare(`${APPOINTMENT_SELECT}
    WHERE a.patient_id = ?
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `).all(id);
  return { ...patient, appointments };
}

function getDashboard() {
  const today = localDateOffset(0);
  const inSevenDays = localDateOffset(7);
  const patientCount = database.prepare("SELECT COUNT(*) AS count FROM patients").get().count;
  const todayAppointments = database.prepare(`${APPOINTMENT_SELECT}
    WHERE a.appointment_date = ? AND a.status != 'cancelled'
    ORDER BY a.appointment_time ASC
  `).all(today);
  const completedToday = database.prepare(`
    SELECT COUNT(*) AS count FROM appointments
    WHERE appointment_date = ? AND status = 'completed'
  `).get(today).count;
  const upcomingAppointments = database.prepare(`${APPOINTMENT_SELECT}
    WHERE a.appointment_date >= ? AND a.appointment_date <= ? AND a.status = 'scheduled'
    ORDER BY a.appointment_date ASC, a.appointment_time ASC
    LIMIT 6
  `).all(today, inSevenDays);
  const upcomingCount = database.prepare(`
    SELECT COUNT(*) AS count FROM appointments
    WHERE appointment_date >= ? AND appointment_date <= ? AND status = 'scheduled'
  `).get(today, inSevenDays).count;
  return {
    today,
    patientCount,
    doctorCount: DOCTORS.size,
    todayCount: todayAppointments.filter((item) => item.status === "scheduled").length,
    completedToday,
    upcomingCount,
    todayAppointments,
    upcomingAppointments,
  };
}

function nextPatientCode() {
  const last = database.prepare(`
    SELECT MAX(CAST(SUBSTR(patient_code, 4) AS INTEGER)) AS number
    FROM patients WHERE patient_code GLOB 'CN-[0-9]*'
  `).get().number || 1000;
  return `CN-${last + 1}`;
}

function createPatient(data) {
  const validated = validatePatient(data);
  if (validated.error) return { error: validated.error };
  const patient = {
    id: crypto.randomUUID(),
    patientCode: nextPatientCode(),
    ...validated.value,
  };
  database.prepare(`
    INSERT INTO patients (id, patient_code, full_name, date_of_birth, phone, email, record_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    patient.id,
    patient.patientCode,
    patient.fullName,
    patient.dateOfBirth,
    patient.phone,
    patient.email,
    patient.recordNotes,
  );
  return { patient };
}

async function handleApi(request, response, url) {
  const { pathname, searchParams } = url;
  if (pathname === "/api/chat" && request.method === "POST") {
    const input = ensureObject(await readJson(request));
    const message = typeof input.message === "string" ? input.message.trim() : "";
    if (!message || message.length > 1000) {
      sendJson(response, 400, { error: "Enter a message between 1 and 1,000 characters." });
      return;
    }
    if (!process.env.OPENAI_API_KEY) {
      sendJson(response, 503, { error: "AI chat is not configured. Set OPENAI_API_KEY on the server." });
      return;
    }
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are the CareNest Clinic demo assistant. Answer clearly and helpfully about using this fictional clinic administration demo. Do not claim to access clinic records or perform actions. Do not provide diagnosis, treatment, medication, or other medical advice. For emergencies, tell the user to contact local emergency services. The app contains fictional doctors and departments: General Medicine, Cardiology, Dermatology, Pediatrics, and Dental. Never request real patient or health information.",
          },
          { role: "user", content: message },
        ],
        max_completion_tokens: 400,
      }),
    });
    if (!aiResponse.ok) {
      console.error(`OpenAI chat request failed with status ${aiResponse.status}.`);
      sendJson(response, 502, { error: "The AI provider could not answer right now. Please try again." });
      return;
    }
    const result = await aiResponse.json();
    const reply = result.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      console.error("OpenAI chat response did not contain a text reply.");
      sendJson(response, 502, { error: "The AI provider returned an empty answer. Please try again." });
      return;
    }
    sendJson(response, 200, { reply: reply.trim() });
    return;
  }
  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      status: "ok",
      mode: "local-student-demo",
      fictionalData: true,
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    });
    return;
  }
  if (pathname === "/api/dashboard" && request.method === "GET") {
    sendJson(response, 200, getDashboard());
    return;
  }
  if (pathname === "/api/patients" && request.method === "GET") {
    const query = (searchParams.get("q") || "").trim();
    const patients = getPatients();
    const filtered = query
      ? patients.filter((patient) =>
        [patient.fullName, patient.patientCode, patient.phone, patient.email]
          .some((value) => value.toLowerCase().includes(query.toLowerCase())),
      )
      : patients;
    sendJson(response, 200, { patients: filtered });
    return;
  }
  if (pathname === "/api/patients" && request.method === "POST") {
    const result = createPatient(await readJson(request));
    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }
    sendJson(response, 201, { patient: getPatientRecord(result.patient.id) });
    return;
  }
  const patientMatch = pathname.match(/^\/api\/patients\/([0-9a-f-]{36})$/i);
  if (patientMatch && request.method === "GET") {
    const patient = getPatientRecord(patientMatch[1]);
    sendJson(response, patient ? 200 : 404, patient ? { patient } : { error: "Patient record not found." });
    return;
  }
  if (patientMatch && request.method === "PUT") {
    const id = patientMatch[1];
    if (!database.prepare("SELECT 1 FROM patients WHERE id = ?").get(id)) {
      sendJson(response, 404, { error: "Patient record not found." });
      return;
    }
    const validated = validatePatient(await readJson(request));
    if (validated.error) {
      sendJson(response, 400, { error: validated.error });
      return;
    }
    const patient = validated.value;
    database.prepare(`
      UPDATE patients SET full_name = ?, date_of_birth = ?, phone = ?, email = ?, record_notes = ?
      WHERE id = ?
    `).run(patient.fullName, patient.dateOfBirth, patient.phone, patient.email, patient.recordNotes, id);
    sendJson(response, 200, { patient: getPatientRecord(id) });
    return;
  }
  if (patientMatch && request.method === "DELETE") {
    const id = patientMatch[1];
    if (!database.prepare("SELECT 1 FROM patients WHERE id = ?").get(id)) {
      sendJson(response, 404, { error: "Patient record not found." });
      return;
    }
    const hasAppointments = database.prepare("SELECT 1 FROM appointments WHERE patient_id = ? LIMIT 1").get(id);
    if (hasAppointments) {
      sendJson(response, 409, { error: "This patient has appointment records. Cancel or remove those appointments before deleting the demo record." });
      return;
    }
    database.prepare("DELETE FROM patients WHERE id = ?").run(id);
    sendJson(response, 200, { deleted: true });
    return;
  }
  if (pathname === "/api/appointments" && request.method === "GET") {
    const date = searchParams.get("date");
    const status = searchParams.get("status");
    let appointments = getAppointments();
    if (date && validDate(date)) {
      appointments = appointments.filter((item) => item.appointmentDate === date);
    }
    if (status && STATUSES.has(status)) {
      appointments = appointments.filter((item) => item.status === status);
    }
    sendJson(response, 200, { appointments });
    return;
  }
  if (pathname === "/api/appointments" && request.method === "POST") {
    const validated = validateAppointment(await readJson(request));
    if (validated.error) {
      sendJson(response, 400, { error: validated.error });
      return;
    }
    if (findDoctorSlotConflict(validated.value)) {
      sendJson(response, 409, { error: "That doctor already has a scheduled appointment at this time. Choose another time or doctor." });
      return;
    }
    const appointment = { id: crypto.randomUUID(), ...validated.value, status: "scheduled" };
    database.prepare(`
      INSERT INTO appointments
        (id, patient_id, doctor, department, appointment_date, appointment_time, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      appointment.id,
      appointment.patientId,
      appointment.doctor,
      appointment.department,
      appointment.appointmentDate,
      appointment.appointmentTime,
      appointment.reason,
      appointment.status,
    );
    const saved = database.prepare(`${APPOINTMENT_SELECT} WHERE a.id = ?`).get(appointment.id);
    sendJson(response, 201, { appointment: saved });
    return;
  }
  const appointmentMatch = pathname.match(/^\/api\/appointments\/([0-9a-f-]{36})$/i);
  if (appointmentMatch && request.method === "PUT") {
    const id = appointmentMatch[1];
    const current = database.prepare("SELECT status FROM appointments WHERE id = ?").get(id);
    if (!current) {
      sendJson(response, 404, { error: "Appointment not found." });
      return;
    }
    if (current.status !== "scheduled") {
      sendJson(response, 409, { error: "Only scheduled appointments can be edited." });
      return;
    }
    const validated = validateAppointment(await readJson(request));
    if (validated.error) {
      sendJson(response, 400, { error: validated.error });
      return;
    }
    const item = validated.value;
    if (findDoctorSlotConflict(item, id)) {
      sendJson(response, 409, { error: "That doctor already has a scheduled appointment at this time. Choose another time or doctor." });
      return;
    }
    database.prepare(`
      UPDATE appointments
      SET patient_id = ?, doctor = ?, department = ?, appointment_date = ?,
        appointment_time = ?, reason = ?
      WHERE id = ?
    `).run(item.patientId, item.doctor, item.department, item.appointmentDate, item.appointmentTime, item.reason, id);
    sendJson(response, 200, {
      appointment: database.prepare(`${APPOINTMENT_SELECT} WHERE a.id = ?`).get(id),
    });
    return;
  }
  if (appointmentMatch && request.method === "PATCH") {
    const id = appointmentMatch[1];
    const current = database.prepare("SELECT status FROM appointments WHERE id = ?").get(id);
    if (!current) {
      sendJson(response, 404, { error: "Appointment not found." });
      return;
    }
    const data = await readJson(request);
    const payload = ensureObject(data);
    if (!STATUSES.has(payload.status)) {
      sendJson(response, 400, { error: "Choose scheduled, completed or cancelled." });
      return;
    }
    if (current.status !== "scheduled" && current.status !== payload.status) {
      sendJson(response, 409, { error: "Completed or cancelled appointments cannot be reopened in this demo." });
      return;
    }
    database.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(payload.status, id);
    sendJson(response, 200, {
      appointment: database.prepare(`${APPOINTMENT_SELECT} WHERE a.id = ?`).get(id),
    });
    return;
  }
  if (appointmentMatch && request.method === "DELETE") {
    const result = database.prepare("DELETE FROM appointments WHERE id = ?").run(appointmentMatch[1]);
    sendJson(response, result.changes ? 200 : 404, result.changes ? { deleted: true } : { error: "Appointment not found." });
    return;
  }
  sendJson(response, 404, { error: "API route not found." });
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};
const PUBLIC_FILES = new Set(["index.html", "styles.css", "app.js"]);

async function serveStatic(response, pathname) {
  const fileName = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!PUBLIC_FILES.has(fileName)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  try {
    const contents = await readFile(resolve(ROOT, fileName));
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extname(fileName)],
      "X-Content-Type-Options": "nosniff",
    });
    response.end(contents);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }
    await serveStatic(response, decodeURIComponent(url.pathname));
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("Request failed:", error);
    if (!response.headersSent) {
      sendJson(response, status, {
        error: status === 500 ? "The server could not complete that request." : error.message,
      });
    }
  }
});

server.listen(REQUESTED_PORT, "127.0.0.1", () => {
  const address = server.address();
  console.log(`CareNest Clinic demo is ready at http://127.0.0.1:${address.port}`);
  console.log("Fictional demo data only. Do not enter real patient information.");
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

let server;
let baseUrl;
let databaseDirectory;

async function request(path, options) {
  return fetch(`${baseUrl}${path}`, options);
}

function jsonOptions(method, body) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

before(async () => {
  databaseDirectory = await mkdtemp(join(tmpdir(), "carenest-clinic-test-"));
  server = spawn(process.execPath, ["backend/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "0",
      CARENEST_DB_PATH: join(databaseDirectory, "test.sqlite"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  let serverError = "";
  const ready = new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(
      () => rejectReady(new Error(`Server did not start.\n${output}\n${serverError}`)),
      10000,
    );
    server.stdout.setEncoding("utf8");
    server.stderr.setEncoding("utf8");
    server.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/ready at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timer);
        resolveReady(match[1]);
      }
    });
    server.stderr.on("data", (chunk) => { serverError += chunk; });
    server.once("error", (error) => {
      clearTimeout(timer);
      rejectReady(error);
    });
    server.once("exit", (code) => {
      if (!baseUrl) {
        clearTimeout(timer);
        rejectReady(new Error(`Server exited before starting (${code}).\n${output}\n${serverError}`));
      }
    });
  });
  baseUrl = await ready;
});

after(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    await exited;
  }
  if (databaseDirectory) await rm(databaseDirectory, { recursive: true, force: true });
});

test("the project page and fictional clinic dashboard are available", async () => {
  const [page, health, dashboard, patients, appointments] = await Promise.all([
    request("/"),
    request("/api/health").then((response) => response.json()),
    request("/api/dashboard").then((response) => response.json()),
    request("/api/patients").then((response) => response.json()),
    request("/api/appointments").then((response) => response.json()),
  ]);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /fictional records only/i);
  assert.deepEqual(health, { status: "ok", mode: "local-student-demo", fictionalData: true });
  assert.ok(patients.patients.length >= 5);
  assert.ok(appointments.appointments.length >= 5);
  assert.equal(dashboard.patientCount, patients.patients.length);
  assert.equal(dashboard.doctorCount, 5);
  assert.ok(dashboard.todayAppointments.length >= 1);
  assert.ok(dashboard.upcomingCount >= 1);
});

test("patient records can be created, searched, viewed and updated", async () => {
  const createdResponse = await request("/api/patients", jsonOptions("POST", {
    fullName: "Demo Test Patient",
    dateOfBirth: "1998-06-12",
    phone: "555-0199",
    email: "demo.patient@example.test",
    recordNotes: "Fictional test note.",
  }));
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).patient;
  assert.match(created.patientCode, /^CN-\d+$/);
  assert.equal(created.fullName, "Demo Test Patient");

  const search = await request("/api/patients?q=demo.patient").then((response) => response.json());
  assert.ok(search.patients.some((patient) => patient.id === created.id));

  const updatedResponse = await request(
    `/api/patients/${created.id}`,
    jsonOptions("PUT", {
      fullName: "Updated Demo Patient",
      dateOfBirth: "1998-06-12",
      phone: "555-0188",
      email: "demo.patient@example.test",
      recordNotes: "Updated fictional note.",
    }),
  );
  assert.equal(updatedResponse.status, 200);
  assert.equal((await updatedResponse.json()).patient.fullName, "Updated Demo Patient");
});

test("appointment booking validates inputs and patient references", async () => {
  const invalid = await request("/api/appointments", jsonOptions("POST", {
    patientId: "not-a-patient",
    doctor: "Unknown",
    department: "Unknown",
    appointmentDate: "2099-01-01",
    appointmentTime: "25:61",
    reason: "",
  }));
  assert.equal(invalid.status, 400);

  const patient = (await request("/api/patients").then((response) => response.json())).patients[0];
  const bookedResponse = await request("/api/appointments", jsonOptions("POST", {
    patientId: patient.id,
    doctor: "Dr. Maya Patel",
    department: "General Medicine",
    appointmentDate: "2099-02-14",
    appointmentTime: "10:30",
    reason: "Fictional test booking",
  }));
  assert.equal(bookedResponse.status, 201);
  const booked = (await bookedResponse.json()).appointment;
  assert.equal(booked.patientId, patient.id);
  assert.equal(booked.status, "scheduled");

  const duplicateSlot = await request("/api/appointments", jsonOptions("POST", {
    patientId: patient.id,
    doctor: "Dr. Maya Patel",
    department: "General Medicine",
    appointmentDate: "2099-02-14",
    appointmentTime: "10:30",
    reason: "Conflicting fictional test booking",
  }));
  assert.equal(duplicateSlot.status, 409);
  assert.match((await duplicateSlot.json()).error, /already has a scheduled appointment/i);

  const secondBooking = await request("/api/appointments", jsonOptions("POST", {
    patientId: patient.id,
    doctor: "Dr. Maya Patel",
    department: "General Medicine",
    appointmentDate: "2099-02-14",
    appointmentTime: "11:30",
    reason: "Second fictional test booking",
  }));
  assert.equal(secondBooking.status, 201);
  const conflictingEdit = await request(
    `/api/appointments/${(await secondBooking.json()).appointment.id}`,
    jsonOptions("PUT", {
      patientId: patient.id,
      doctor: "Dr. Maya Patel",
      department: "General Medicine",
      appointmentDate: "2099-02-14",
      appointmentTime: "10:30",
      reason: "Conflicting fictional edit",
    }),
  );
  assert.equal(conflictingEdit.status, 409);

  const dentistBooking = await request("/api/appointments", jsonOptions("POST", {
    patientId: patient.id,
    doctor: "Dr. Nina Kapoor",
    department: "Dental",
    appointmentDate: "2099-02-15",
    appointmentTime: "11:00",
    reason: "Fictional dental demo booking",
  }));
  assert.equal(dentistBooking.status, 201);

  const search = await request("/api/appointments?status=scheduled")
    .then((response) => response.json());
  assert.ok(search.appointments.some((appointment) => appointment.id === booked.id));
});

test("appointments can be edited and marked complete", async () => {
  const appointment = (await request("/api/appointments").then((response) => response.json()))
    .appointments.find((item) => item.status === "scheduled");
  assert.ok(appointment);

  const updatedResponse = await request(
    `/api/appointments/${appointment.id}`,
    jsonOptions("PUT", {
      patientId: appointment.patientId,
      doctor: "Dr. Sofia Thomas",
      department: "Dermatology",
      appointmentDate: "2099-03-11",
      appointmentTime: "11:45",
      reason: "Updated fictional visit",
    }),
  );
  assert.equal(updatedResponse.status, 200);
  assert.equal((await updatedResponse.json()).appointment.doctor, "Dr. Sofia Thomas");

  const completedResponse = await request(
    `/api/appointments/${appointment.id}`,
    jsonOptions("PATCH", { status: "completed" }),
  );
  assert.equal(completedResponse.status, 200);
  assert.equal((await completedResponse.json()).appointment.status, "completed");
});

test("invalid JSON payloads return validation errors instead of crashing", async () => {
  const nullPatient = await request("/api/patients", jsonOptions("POST", null));
  assert.equal(nullPatient.status, 400);
  assert.match((await nullPatient.json()).error, /enter a patient name|valid/i);

  const appointment = (await request("/api/appointments").then((response) => response.json()))
    .appointments.find((item) => item.status === "scheduled");
  assert.ok(appointment);

  const nullStatus = await request(
    `/api/appointments/${appointment.id}`,
    jsonOptions("PATCH", null),
  );
  assert.equal(nullStatus.status, 400);
  assert.match((await nullStatus.json()).error, /choose scheduled, completed or cancelled/i);
});

test("patient records with appointments cannot be deleted", async () => {
  const patient = (await request("/api/patients").then((response) => response.json()))
    .patients.find((item) => item.appointmentCount > 0);
  const response = await request(`/api/patients/${patient.id}`, { method: "DELETE" });
  assert.equal(response.status, 409);
});

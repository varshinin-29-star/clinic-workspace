# CareNest Clinic

CareNest is an Open Innovation student-project prototype for clinic appointment scheduling and patient-record administration. It includes a responsive dashboard, a Node.js HTTP/JSON API, and local SQLite storage.

## Important privacy notice

This prototype has **no login, encryption, or production-grade health-data protections**. The preloaded patients are fictional, but new records are saved to a local database file. Use fictional information only. Do not enter real patient information or use this application for healthcare delivery.

## Run locally

1. Install Node.js 22.13 or newer.
2. Double-click `start-carenest.bat`, or run `npm.cmd start` in Windows PowerShell.
3. Open `http://127.0.0.1:3000`. Keep the server window open.

Do not open `index.html` directly; the frontend calls the local API. The server creates `carenest-demo.sqlite` next to the project and seeds clearly fictional demo records when no patient records exist. No extra npm dependencies are required.

## Features

- Clinic overview with today's appointments, patient and doctor counts, upcoming appointments and completed visits.
- Schedule an appointment for a patient and choose a doctor, department, date, time and visit reason.
- Check a doctor's live demo availability while booking; the server prevents two scheduled visits for the same doctor at the same date and time.
- Search/filter appointments, edit scheduled visits, mark them complete, cancel them or remove demo appointments.
- Search, add, view and edit patient records with contact details, administrative demo notes and appointment history.
- Browse a featured Doctor Spotlight and five fictional doctor profiles with illustrative photos and sample clinic days/hours, and start an appointment with a doctor or department preselected. All profile details and hours are demo information.
- Explore colorful Departments and About this project pages explaining the sample services, problem, solution and technology stack.
- View Clinic Pulse, with animated status bubbles and colorful charts summarizing the saved demo schedule and department activity.
- Patient records with appointment history cannot be deleted until their appointments have been removed.
- Responsive layouts and colorful clinic-themed cards for desktop and mobile. Doctor portraits are served by Unsplash and require an internet connection; initials appear if a photo cannot load.
- Clinic Pulse reports operational appointment counts only; it does not provide medical or diagnostic insights.

## API

- `GET /api/health` — local-demo status
- `GET /api/dashboard` — today's schedule and clinic summary
- `GET /api/patients?q=search` — patient directory
- `POST /api/patients` — create a fictional demo patient
- `GET /api/patients/:id` — patient details and appointment history
- `PUT /api/patients/:id` — edit a patient record
- `DELETE /api/patients/:id` — delete a patient without appointment records
- `GET /api/appointments` — appointment schedule
- `POST /api/appointments` — book an appointment
- `PUT /api/appointments/:id` — edit a scheduled appointment
- `PATCH /api/appointments/:id` — change a scheduled appointment's status
- `DELETE /api/appointments/:id` — remove an appointment

## Tests

Run `npm.cmd test` in Windows PowerShell. Tests use an isolated temporary database and cover the frontend server, seeded demo data, patient-record operations, appointment booking, validation and schedule status.

## Project submission guide

See [PROJECT-GUIDE.md](./PROJECT-GUIDE.md) for the project proposal, problem statement, system architecture, features, demo steps, scope and future improvements.

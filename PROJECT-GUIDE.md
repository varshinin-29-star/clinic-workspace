# CareNest Clinic
### Clinic Appointment Booking & Patient Records

**Category:** Open Innovation  
**Project type:** Responsive web application with a local backend and database  
**Prototype:** Fictional sample information only

## Project summary

CareNest is a student-built clinic workflow prototype. It gives a clinic front desk a simple place to review the daily schedule, book appointments, and manage patient profiles and appointment history.

## Problem statement

Small clinics may use separate notebooks or spreadsheets to track appointment times and patient contact details. This can make it harder to find a record, see a day's schedule, or keep appointment status up to date.

## Proposed solution

CareNest brings these basic administrative tasks into one dashboard. Staff can create a demo patient profile, book an appointment with a selected doctor and department, search schedules, update a scheduled appointment, record its completion or cancellation, and review a patient's appointment history.

## Main features

- **Clinic dashboard:** Counts today's visits and patient records, shows completed appointments, and previews upcoming visits.
- **Appointment booking:** Select a patient, doctor, department, date, time and visit reason.
- **Smart slot check:** Shows whether a doctor’s selected demo time is free and blocks duplicate scheduled bookings for the same doctor and time.
- **Schedule management:** Search and filter appointments; edit, complete, cancel or remove demo visits.
- **Patient directory:** Search profiles; add, view and edit contact information and administrative demo notes.
- **Patient history:** Review the appointment history associated with a patient.
- **Doctor directory:** See a featured Doctor Spotlight, then browse five fictional clinicians with illustrative portraits, sample weekly clinic hours and one-click appointment shortcuts. Profile details and hours are demonstration-only.
- **Departments:** Review the appointment categories represented in the demo.
- **Clinic Pulse:** See live counts, animated status bubbles and colorful charts of appointment statuses and department activity.
- **Project overview:** Explain the problem, proposed solution and frontend/backend/database architecture.
- **Persistent data:** Changes are saved to a local SQLite database.
- **Responsive frontend:** Colorful clinic-themed pages adapt to desktop and mobile layouts.

## System architecture

```text
Clinic front desk
       ↓
HTML, CSS and JavaScript dashboard
       ↓ JSON over HTTP
Node.js API ───── SQLite database
   ├── Patient-record endpoints
   └── Appointment-booking and schedule endpoints
```

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML, CSS, JavaScript | Dashboard, responsive tables, forms and search |
| Backend | Node.js built-in HTTP server | JSON API and server-side validation |
| Database | SQLite (`node:sqlite`) | Local storage for appointments and patient demo profiles |

## How to demonstrate the project

1. Start the server with `start-carenest.bat` and open the local address it prints.
2. Point out the privacy banner and explain that the profiles are fictional sample data.
3. Follow the dashboard’s **How to use this demo** guide: create a fictional patient profile, book an appointment for that patient, then update its status.
4. Open **Appointments** and demonstrate search, the status explanations, editing, completion or cancellation. When booking, show the live doctor-slot hint and that conflicting visits are blocked.
5. Open **Patient records** and show patient search, administrative demo notes, appointment history and editing a record.
6. Visit **Our doctors** to show the featured Doctor Spotlight, fictional team profiles, sample hours and booking shortcuts. Doctor portraits are illustrative Unsplash photos.
7. Open **Clinic Pulse** to explain the live status bubbles and department charts. These are operational counts, not medical insights.
8. Finish on **About this project** to explain the problem and technology stack. Remind the audience that the prototype must not be used with real patient information.

## Run and test

Requirements: Node.js 22.13 or later. No third-party npm packages are required.

```powershell
npm.cmd start
npm.cmd test
```

## Privacy, safety and limitations

- This is a classroom prototype, **not a medical or production system**.
- It has no authentication, authorization, encryption, audit log, backups or production-grade protection for sensitive health information.
- Do not enter real names, contact details, appointment reasons or health information.
- The sample patients and visit reasons are fictional and included only to demonstrate application behavior.
- Appointment reasons and record notes are administrative demo fields. The application does not diagnose, recommend treatment or provide clinical guidance.
- A production deployment would require security and privacy engineering, access controls, appropriate operational processes and qualified review before any real health information could be considered.

## Future improvements

- Add authenticated staff accounts with role-based access.
- Add audit history, secure deployment, encrypted backups and privacy review.
- Add availability and scheduling rules for each doctor.
- Add consent, retention and secure export workflows after requirements review.
- Add accessibility testing and additional appointment filters.

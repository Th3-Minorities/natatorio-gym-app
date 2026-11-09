---
title: Natatorio Gym App
---

An installable web app for the Weight Gym at the UPRM Natatorio Complex, built as a Capstone project for CIIC 4151 at the University of Puerto Rico at Mayagüez.

<nav aria-label="On this page" markdown="1">

**On this page**

[Overview](#overview) · [Progress](#objectives-and-status) · [Team](#team) · [Resources](#links)

</nav>

## Overview

<p id="the-problem">The gym uses paper records and checks paid memberships and the athlete roster by hand. The department estimates about 150 people use the gym each day. The app brings both access checks into one place and keeps payments in the gym's online store.</p>

<p id="how-the-app-solves-it">Members register with an Authorization Number from their payment, and eligible users check in from inside the gym. They can show a digital Gym ID and see current occupancy. Staff verify Gym IDs and check people out. Visits close after two hours if they are still open, and the app saves them for usage statistics. Administrators manage the athlete roster, schedules and notices.</p>

## Objectives and status

| Objective | Status |
|---|---|
| 1. Decide who may enter, from paid memberships and the athlete roster | Paid member path built. Athlete registration and the store sync are planned for the Final report |
| 2. Check In that opens a visit and closes it on its own | Built for the User |
| 3. Show the same occupancy estimate across the app | Built for the User |
| 4. Tools for Staff and Administrators | Partly built ahead, the rest planned |
| 5. Gym use statistics | Planned |

## How it is built

The app uses React, TypeScript and Vite, with a Laravel backend and a PostgreSQL database. It runs with Docker Compose on a server from CTI, UPRM's technology office.

## Team

- Carlos J. Pepin Delgado
- Pierre G Vales Torres
- Viviana V Ramos Vivoni

## Links

- [Source code](https://github.com/Th3-Minorities/natatorio-gym-app)
- [Documentation](docs/README.md)

The progress report, the elevator pitch video and the final slides will be linked here when they are ready.

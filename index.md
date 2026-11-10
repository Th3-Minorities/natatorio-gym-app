---
title: Natatorio Gym App
---

An installable web app for the Weight Gym at the UPRM Natatorio Complex, built as a Capstone project for CIIC 4151 at the University of Puerto Rico at Mayagüez.

<nav aria-label="On this page" markdown="1">

**On this page**

[Overview](#overview) · [Progress](#objectives-and-status) · [Demo](#demo) · [Coming soon](#coming-soon) · [Team](#team) · [Resources](#links)

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

## Demo

Two short videos will show the app working. They are not recorded yet.

| Dashboard (desktop) | User app (phone) |
|---|---|
| Video coming soon. The dashboard that Staff and Administrators use on a computer. | Video coming soon. A User registering, checking in and opening the Gym ID on a phone. |

<!-- When a video exists, put the file in a media folder and replace its cell with:
<video controls preload="none" width="100%" src="media/FILE.mp4"></video> -->

## Coming soon

These parts are not built yet.

For Staff and Administrators:

- A front desk screen to see who is inside and check people out
- Screens to add terms and manage the athlete roster
- Tools to grant or release access by hand, and to delete an account
- Screens to edit the hours, closures and notices
- A screen to read the log of what Staff and Administrators did

For Users:

- Athletes: add athlete access to an existing account, and renew each term
- Paid memberships synced from the gym's online store
- My visits, a list of your past Check Ins
- Edit your emergency contact in My account
- Draw your signature on the waiver

For the gym:

- Statistics on when the gym is busy, and a way for other services to read them
- Backups, restore, and removal of old data
- A way to enter the paper log after an outage
- Mail through the CTI mail gateway, and the app running on a CTI server
- Manuals for Users, Staff, Administrators and developers, in Spanish and English
- A security scan and an acceptance test with the gym

## How it is built

The app uses React, TypeScript and Vite, with a Laravel backend and a PostgreSQL database. It runs with Docker Compose on a server from CTI, UPRM's technology office.

## Team

- Carlos J. Pepin Delgado
- Pierre G Vales Torres
- Viviana V Ramos Vivoni

## Links

- [Source code](https://github.com/Th3-Minorities/natatorio-gym-app)
- [Documentation](docs/README.md)
- Progress report: coming soon

The elevator pitch video and the final slides will be linked here when they are ready.

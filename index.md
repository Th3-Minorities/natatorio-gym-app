---
title: Natatorio Gym App
---

An installable web app for the Weight Gym at the UPRM Natatorio Complex, built as a Capstone project for CIIC 4151 at the University of Puerto Rico at Mayagüez.

<nav aria-label="On this page" markdown="1">

**On this page**

[Overview](#overview) · [Progress](#progress) · [Demo](#demo) · [Coming soon](#coming-soon) · [How it is built](#how-it-is-built) · [Team](#team) · [Resources](#resources)

</nav>

## Overview

<p id="the-problem">The gym uses paper records and checks paid memberships and the athlete roster by hand. The department estimates about 150 people use the gym each day. The app brings both access checks into one place and keeps payments in the gym's online store.</p>

<p id="how-the-app-solves-it">Members register with an Authorization Number from their payment, and eligible users check in from inside the gym. They can show a digital Gym ID and see current occupancy. Staff verify Gym IDs and check people out. Visits close after two hours if they are still open, and the app saves them for usage statistics. Administrators manage the athlete roster, schedules and notices.</p>

## Progress

| Objective | Status |
|---|---|
| 1. Decide who may enter, from paid memberships and the athlete roster | We built paid member and athlete registration. Renewal and the store sync come in the Final report |
| 2. Check In that opens a visit and closes it on its own | We built Check In, the Gym ID, Staff check-out and the 2-hour close. We still have to measure the location boundary at the gym |
| 3. Show the same occupancy estimate across the app | Built in the User app and on the Staff dashboard |
| 4. Tools for Staff and Administrators | We built Staff and Administrator accounts, the front desk screens, terms and the athlete roster. Hours and notices, access tools and the audit log screen come next |
| 5. Gym use statistics | Planned |

## Demo

Three recordings of the app running on test data, with no editing and no sound.

### Dashboard (desktop)

Staff check a person out, find a member and check them in after comparing the photo, and look up an athlete on the roster. An Administrator then opens terms, the athlete roster and the Staff accounts.

<video controls preload="none" width="100%" poster="media/poster-1.png" src="media/demo-1.webm"></video>

### Paid member (phone)

A member registers with the Authorization Number from their payment, adds a photo and accepts the waiver. They sign in, check in from inside the gym and show their Gym ID, and occupancy goes up by one.

<video controls preload="none" width="320" poster="media/poster-2.png" src="media/demo-2.webm"></video>

### Athlete (phone)

An athlete enters their student number, gets a link at their university email and finishes registration. They check in, and the Gym ID shows that they are an athlete and their sport.

<video controls preload="none" width="320" poster="media/poster-3.png" src="media/demo-3.webm"></video>

## Coming soon

For Staff and Administrators:

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

The app uses React, TypeScript and Vite, with a Laravel backend and a PostgreSQL database. It runs with Docker Compose, and for the release it moves to a server from CTI, UPRM's technology office.

## Team

- Carlos J. Pepin Delgado
- Pierre G. Vales Torres
- Viviana V. Ramos Vivoni

## Resources

- [Source code](https://github.com/Th3-Minorities/natatorio-gym-app)
- [Documentation](docs/README.md)
- Progress report: coming soon

The elevator pitch video and the final slides will be linked here when they are ready.

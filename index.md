---
title: Natatorio Gym App
---

An app for the Weight Gym (Gimnasio de Pesas) at the UPRM Natatorio Complex. It is our Capstone project for CIIC 4151 at the University of Puerto Rico at Mayagüez.

People open it on their phone like a website, and can also install it like an app. With it they can:

- Register with the Authorization Number from their membership payment.
- Check In when they arrive. The app checks that they are inside the gym.
- Show a digital gym card (the Gym ID) at the front desk.
- See about how full the gym is right now.

Front desk Staff check Gym IDs and see who is inside. Administrators manage the athlete roster, schedules and notices.

## The problem

Today the gym registers people on paper and checks access by hand. A person can enter with a paid membership or as an athlete on the roster. Those two lists come from different places, so Staff check several records before letting someone in. Nothing counts how many people are inside, and there are no numbers on how the gym is used. The department estimates about 150 people use the gym each day.

## How the app solves it

The app checks both kinds of access in one place. Paid memberships come from the gym's online store, which keeps handling payments as it does today. A Check In opens a visit that stays open until Staff check the person out, or closes on its own after 2 hours. The open visits give the occupancy everyone sees. Every visit is saved, so the gym can later see when it is busy and who uses it.

## Objectives and status

| Objective | Status |
|---|---|
| 1. Decide who may enter, from paid memberships and the athlete roster | Paid member path built. Athlete registration and the store sync are planned for the Final report |
| 2. Check In that opens a visit and closes it on its own | Built for the User |
| 3. Show the same occupancy estimate across the app | Built for the User |
| 4. Tools for Staff and Administrators | Partly built ahead, the rest planned |
| 5. Gym use statistics | Planned |

## How it is built

- React, TypeScript and Vite, as an installable web app (PWA)
- Laravel backend
- PostgreSQL database
- Everything runs with docker-compose, on a server from CTI (UPRM's technology office)

## Team

- Carlos J. Pepin Delgado
- Pierre G Vales Torres
- Viviana V Ramos Vivoni

## Links

- [Source code](https://github.com/Th3-Minorities/natatorio-gym-app)
- [Documentation](docs/README.md)

The progress report, the elevator pitch video and the final slides will be linked here when they are ready.

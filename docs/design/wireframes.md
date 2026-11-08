# Wireframes

The wireframes live in the Figma file [MOCKUPS-GYM](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM). This page links each screen to its frame, grouped by issue, so the feature issues can find the design they build. Screen IDs follow the [screen map](screen-map.md).

Every main frame has a note under it with its issue and the decisions it follows. The states of each screen sit below the main frame, under "Estados y acciones".

## Check In and Gym ID (#41)

Phone first. Figma page "#41 Gym ID and Check in". U-01 is the Check-in tab; C-01 is on Gimnasio.

| Screen | Start / active | Loading | Empty | Error | No connection |
|---|---|---|---|---|---|
| U-01 Member | [Start](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4104-95), [Gym ID](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4104-648) | [Location](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4363-4027), [Registering](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4363-4121) | Start, no session | [Registration error](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4363-4215) | [Check In](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4106-1789), [Gym ID](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4105-1202) |
| U-01 Athlete | [Start](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4104-173), [Gym ID](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4104-577) | [Location](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4363-4382), [Registering](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4363-4476) | Start, no session | [Registration error](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4363-4570) | [Check In](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4199-4734), [Gym ID](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4199-3897) |
| C-01 Occupancy | [Available](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4106-1869) | [Loading](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4106-2111) | [Zero people](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4106-1990) | [Error](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4106-2242) | [No connection](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4106-2363) |

- Check In rejections: [authorization, gym closed and new-term photo](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4106-1274); [photo pending and location permission/availability](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4106-1466); [accuracy and boundary](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4106-1659); [athletes-only period](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4105-639). The [athlete variants](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4199-4004) continue on [permissions and location](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4199-4294) and [boundary and connection](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4199-4590).
- Session ended: [member causes](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4106-1076) and [athlete causes](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4160-2520) cover Staff check-out, the two-hour close and closure. [Continue](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4390-4232) returns to Registra tu entrada; a new visit follows normal Check In.
- [Athletes-only notices](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4105-544) include the start time. [Member](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4105-1038) and [athlete](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4199-3607) active-session variants keep the session running. [Roster removal](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4106-2491) blocks athlete access.
- E-163: elapsed HH:MM:SS advances at most once per second without flashing. There is no countdown or term on the Gym ID. Offline, the duration stops and the last successful update time stays visible.
- E-164: C-01 on Gimnasio shows its update time, polls every 20–30 seconds and hides the number on error or disconnection. Tapping it opens today's analytics. The existing [S-01 dashboard](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=121-2841) shows the desktop placement.

## Staff screens (#43)

Desktop first. Figma page "#43 20 · Staff".

| Screen | Frame | Loading | Empty | Error | No connection |
|---|---|---|---|---|---|
| S-01 Active sessions | [121:2841](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=121-2841) | 122:2957 | 122:2965 | 122:2972 | 122:2983 |
| S-02 Person and session detail | [121:3142](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=121-3142) | [4228:1557](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4228-1557) | Not needed | [4228:1671](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4228-1671) | 122:3180 |
| S-03 Person lookup and Staff-assisted Check In | [4283:1011](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4283-1011) | 4288:1088 | 4288:1105 | 4288:1135 | 4288:1160 |
| S-05 Athlete roster, read only | [121:3383](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=121-3383) | 122:3214 | 122:3222 | 122:3280 | 122:3253 |

- S-01: active sessions, Check In time and "Marcar salida". [Successful Check In](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4319-1663) shows a notice and highlights the person's row. Offline notice with the last update time. [Administrator menu](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4125-6610) on page "21 · Admin · Cuentas y acceso".
- S-02: person and session details, "Marcar foto pendiente" with confirmation (122:3094), and the checked-out state (4005:1486). Photo loading (122:3171) and session conflict (122:3141) are separate states.
- S-03: person lookup, photo and authorization verification, confirmation and active-session handling. Successful Check In returns to S-01. [States](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4288-1085) include authorization, photo and schedule rejections. [Mark photo pending confirmation](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4288-2029).
- S-05: read-only roster. "Check in" opens S-03 with the athlete's number. An [active session](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4265-2957) shows "Entrada registrada" and the entry time.

## Administration screens (#45)

Desktop. Figma pages "21" to "24 · Admin".

| Screen | Frame | Loading | Empty | Error | No connection |
|---|---|---|---|---|---|
| A-04 Academic terms | [101:1525](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=101-1525) | 101:1918 | 101:1921 | 132:3877 | 101:1935 |
| A-05 Athlete roster | [101:696](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=101-696) | 101:1400 | 101:1386 | 132:3879 | 101:1403 |
| A-07 Store sync | [106:1350](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=106-1350) | 132:3801 | 106:1533 | 106:1545 | 106:1557 |
| A-08 Accounts | [107:1560](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=107-1560) | 107:1883 | 107:1897 | 132:3763 | 132:3782 |
| A-09 Release Authorization Number | [108:1782](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=108-1782) | 108:1946 | 108:1966 | 132:3769 | 132:3789 |
| A-13 Audit log | [115:2088](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=115-2088) | 115:2347 | 115:2359 | 115:2376 | 132:3796 |
| A-15 Staff accounts | [100:841](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=100-841) | 100:1255 | 100:1258 | 132:3881 | 100:1272 |
| A-16 Backups | [116:2328](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=116-2328) | 132:3806 | 116:2569 | 116:2581 | 116:2605 |
| A-17 Manual entries | [117:2653](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=117-2653) | 117:3022 | 117:2936 | 132:3775 | 117:2983 |

- Every Administrator page also has the "Sin término activo" notice (E-85).
- A-05: the quick form stays open after saving, and the sport stays with the last value, shown large at the top (101:1150, E-139).
- A-13: date range, action filter, staff account filter and export to CSV or Excel (115:2330).
- A-16: restoring asks the Administrator to type RESTAURAR (116:2542).
- A-17: people without an account are entered only as a count.
- A-05: "Descargar roster" opens the Word or PDF choice (4039:2032), then "Preparando archivo" (4039:2077). Only Administrators see it (E-140).
- A-15: "Cambiar rol" (4039:3226), "Rol cambiado" (4039:3252), an Administrator cannot change their own role (4039:3285), and "Reenviar invitación" on invited rows (4039:3311).

## Staff sign in (N-11)

Desktop, on the dashboard path, with no link from the User sign in. Figma page "#43 20 · Staff".

| Screen | Frame |
|---|---|
| N-11 Staff sign in | [4039:3721](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-3721) |
| Forgot password | [4039:4170](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-4170), then "Revisa tu correo" 4039:4224 |
| Set a password from the invitation | [4039:4264](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-4264) |
| Invitation link expired or used | [4039:4325](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-4325) |
| Signed out for inactivity | [4039:4365](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-4365) |

States of N-11: signing in 4039:3798, wrong email or password 4039:3871, wait after too many attempts 4039:3942, no connection 4039:4018, deactivated account 4039:4094.

## Phone screens drawn so far (#40, #42)

Figma page "login/signup logics". These issues stay open: the screens below are only part of their scope.

| Screen | Frame |
|---|---|
| N-01 Landing | [179:6068](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=179-6068) |
| N-02 Sign in | [179:6164](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=179-6164) |
| N-03 Register as paid member | [179:6324](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=179-6324) |
| N-04 Register as athlete | [179:6356](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=179-6356) |
| N-06 Forgot password | [179:6186](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=179-6186) |
| N-07 Set new password | [179:6199](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=179-6199) |
| N-08 Privacy notice (draft text) | [179:6122](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=179-6122) |
| N-09 Install help | [179:6242](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=179-6242) |

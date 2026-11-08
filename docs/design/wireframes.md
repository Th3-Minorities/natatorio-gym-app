# Wireframes

The wireframes live in the Figma file [MOCKUPS-GYM](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM). This page links each screen to its frame, grouped by issue, so the feature issues can find the design they build. Screen IDs follow the [screen map](screen-map.md).

The sections below link the main screens and their states. Use the current page and frame links for each issue when reviewing or implementing a screen.

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
- E-164: C-01 on Gimnasio shows its update time, polls every 20 to 30 seconds and hides the number on error or disconnection. Tapping it opens today's analytics. The existing [S-01 dashboard](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=121-2841) shows the desktop placement.

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

Part of #42. Desktop, on the dashboard path, with no link from the User sign in. Figma page "#43 20 · Staff".

| Screen | Frame |
|---|---|
| N-11 Staff sign in | [4039:3721](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-3721) |
| Forgot password | [4039:4170](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-4170), then "Revisa tu correo" 4039:4224 |
| Set a password from the invitation | [4039:4264](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-4264) |
| Invitation link expired or used | [4039:4325](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-4325) |
| Signed out for inactivity | [4039:4365](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-4365) |

States of N-11: [Signing in](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-3798), [Wrong email or password](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-3871), [Wait after too many attempts](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-3942), [No connection](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-4018), [Deactivated account](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4039-4094).

## Sign in and account (#42)

Phone first. Current Figma page: [#40 y #42 · Acceso, registro y cuenta](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-2). The old `login/signup logics` page is historical; use the links below for the current handoff. A dash means no separate frame is indexed for that state. N-11 is desktop first and is indexed under [Staff sign in](#staff-sign-in-n-11).

E-165 removes schedules and notices from all signed-out flows. E-166 keeps the original Welcome layout and places the registration prerequisite, membership purchase and help number on the N-03 number-entry step. The store URL remains a pending setting; its button shows only during an active term.

### Entry, recovery, privacy and installation

| Screen | Main | Loading | Error | No connection |
|---|---|---|---|---|
| N-01 Welcome | [Collapsed](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-11), [Expanded ES](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-95) | [Loading](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4489-2791) | — | [Offline](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4546-2929) |
| N-02 Sign in | [Form](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-637) | [Signing in](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4490-3038) | [Wrong credentials](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4490-3099), [Invalid fields](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4256-1822) | [Offline](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-2136) |
| N-06 Forgot password | [Form](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-695) | [Sending link](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-2231) | [Server error](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-2260), [Invalid email](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4256-1846) | [Offline](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-2295) |
| N-07 New password | [Form](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-732) | [Checking link](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-2359) | [Invalid password](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4256-1861), [Expired or used link](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-2377) | [Offline](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4490-3162) |
| N-08 Privacy notice (draft) | [Before registration](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-334), [From Mi cuenta](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4468-2653) | — | — | Same static notice |
| N-09 Install help | [Registration: iPhone](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-792), [Android](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-869), [Mi cuenta: iPhone](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4453-2499), [Android](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4453-2595) | — | — | Same static instructions |

- N-01: the offline state follows the original Welcome layout, with a full-width connection banner and both Comenzar and Iniciar sesión disabled. Both actions become available when the connection returns. Purchase and help stay on N-03 at number entry (E-166); schedules and notices require sign in (E-165).
- N-02: [Wait after failed attempts](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-2091), [Signed in on another device](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-2180). Wrong credentials use red field outlines and one generic message, without revealing whether the email has an account.
- N-06: [Request received](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-2335) gives the same answer whether or not the email has an account.
- N-08: the text is a draft pending gym approval (G-24); it remains readable without a connection.
- N-09: [Already installed: after registration](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-919), [From Mi cuenta](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4453-2666). Hide the direct install button when the browser has no install event; the platform instructions remain available.

### Account and preferences

These screens use Gimnasio, Check-in and Mi cuenta tabs (E-164).

| Screen | Main | Loading | Error | No connection |
|---|---|---|---|---|
| U-03 Account | [Active authorization](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-626), [No active authorization](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-683) | [Loading](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-800) | [Error](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-835) | [Offline](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-875) |
| U-04 Emergency contact | [View and edit](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-937) | [Loading](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-993) | [Invalid fields](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1028) | [Offline](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1092) |
| U-05 Delete account | [No active authorization](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1533) | — | [Active authorization: refused](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1634) | [Offline](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1680) |
| U-09 My visits | [History](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1272) | [Loading](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1315) | [Error](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1396) | [With history](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1436), [No loaded data](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1483) |
| U-09 Member variant | [History](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4303-1978) | [Loading](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4303-1994) | [Error](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4303-2207) | [With history](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4303-2220), [No loaded data](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4303-2241) |
| C-06 Language setting | [Spanish](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-740), [English](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1153) | — | — | [Offline](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1207) |

- U-05: [Confirm deletion](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1587). A successful deletion returns to N-01.
- U-09: [No visits](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1350), [Member: no visits](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4303-2015). History is kept for five years; loaded history stays visible offline with its update time.
- C-06: [Language saved](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4099-1774). The setting is stored per account.

## Registration handoff (#40; shared entry and installation with #42)

The main sequence confirmed in E-166 is Welcome → enter number → create password → identification photo → waiver → install help after saving the account. The privacy notice is shown before collecting personal data; language choice and emergency contact remain part of registration.

| Step | Current frame |
|---|---|
| 1. Welcome | [Expanded ES](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-95) |
| 2. Enter number; membership purchase and help | [Unified number entry](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-576) |
| 3. Create password | [Password](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-411) |
| 4. Identification photo | [Not selected](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4445-6805), [Selected](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4445-6885) |
| 5. Waiver and emergency contact | [Form](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4445-6948), [Accepted](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4445-7085) |
| 6. Save account, then install help | [Saving](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4445-7162), [iPhone](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-792), [Android](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4078-869) |

The number-entry frame contains “¿Aún no tienes membresía?”, the registration prerequisite, “Comprar membresía” and “Ayuda: 265-3866”. The purchase button opens the external store on a tap. Registration uses one field for both paid members and athletes (E-153); N-04 was removed and must not be used as a separate registration screen.

[Photo or save error](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4445-7223), [Waiver and contact offline](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM?node-id=4445-7287). Athlete email-link rules and registration edge cases remain in [Registration flows](registration-flows.md).

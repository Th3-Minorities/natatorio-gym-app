# Meeting minutes: Athletic Activities meeting

- Date: 2026-11-04
- Length: about 32 minutes recorded. Part of the meeting was not recorded; those answers come from notes a team member took in the room and are marked "(not recorded)".
- Attended: the two department secretaries who handle the gym, a third person from the department for part of the meeting, and team members.
- Purpose: answer the gym questions posted in Announcements before the database tables are final and before the CTI request goes out.

The Athletic Activities Department runs the gym. Topics follow the order they came up. Where the recording was unclear, the text says so. Each "For the project" line says what the team decided after the meeting (team decisions E-114 to E-126).

## 3. What was said, by topic

### 3.1 Manual access when someone paid but does not appear

- The team asked whether the desk staff can give access by hand after seeing a receipt. The department said it has never done that, and that from now on only the two secretaries should add people, because the desk staff change often: "yo puedo tener un estudiante jornal ahora un par de horas, después me entro un estudiante de estudio y trabajo y después tengo otro jornal".
- The team restated it as "administrador puede añadir" and the department agreed: "Exacto."

For the project: G-09 and question 5 are answered: only Administrators give manual access. Staff stay read and Check In only.

### 3.2 What the desk staff do today

The staff check that each person has a receipt, write them on the paper list, watch that people follow the gym rules and do light machine care ("un poquito de aceite, quizás un pañito").

For the project: no change. This confirms the desk screen is about checking and Check In.

### 3.3 Returning the same day and the 60 minutes

- A person who paid for the semester can come as often as they want. The hour is limited by how full the gym is: "Limitamos la hora dependiendo el flujo." If the gym is not full, the person can stay.
- For the daily count, a person who comes in the morning and again in the afternoon counts twice. Stepping out to the car and coming back is the same session. The recording is not clear about who said this second part.

For the project: G-32 and question 6 are answered: re-entry is allowed and each separate visit counts. The 60 minutes are a guide the staff apply, not a rule the app enforces. Question 27 (several entries inside one hour) is partly answered by the car example.

### 3.4 Check-out

- The team asked whether sessions should close on their own after the hour or whether staff mark people out. The department said: "Sí, el staff debería hacerlo."
- The department admitted the staff do not always do it today: "Se supone que lo hagan." A team member explained why the team had proposed sessions that close after about 60 minutes: if a session stays open, the student will not close it. The department answered that it would be one more task for whoever is at the desk: "Por eso pensé que fuera entonces como una tarea adicional del estudiante que esté en ese momento."
- (Not recorded) The staff would use the check-out to verify people, as they already do by hand.

For the project: desk staff mark the check-out. A session nobody closes ends by itself after 2 hours with the note "closed automatically", and a published closure ends every active session at once (E-115).

### 3.5 Check In from mobile data

The team asked whether people can Check In with their phone's data when there is no Wi-Fi. The department said: "Sí, podría ser."

For the project: Check In works from any network. Limiting the admin screens to some networks is not planned.

### 3.6 CTI request and domain

- The team said it met CTI, that CTI asked for the resources the app needs, and that the department has to file the request. The team will send the text next week. The department asked whether it files it now or the team sends something; the team said it will send it.
- On the name, the department said it should be the same as the gym's current page: "No, debe ser el mismo." Today that page is a path under uprm.edu/actividadesatleticas, not its own name.

For the project: question 9 is partly answered: the department files the request with the team's text. Who receives the first server account was not discussed. Question 10: the app gets its own UPRM subdomain and does not replace the department's site; the dashboard is a path under it (E-124). The name is still to pick.

### 3.7 Who looks after the system after December

The team said CTI has no people for it. The department answered that it will, and the team restated: "Okay, so ustedes." (Not recorded) The two secretaries will be in charge.

For the project: G-01 and question 11 are answered: the two secretaries.

### 3.8 Backups

- The team offered three options: a copy on the same VM, a second service, or a button that downloads a copy to a gym computer. The department chose automatic copies: "Yo diría que existe automáticamente."
- Asked whether the automatic copy goes on the same server or another machine, the department said the server: "Pues si se puede en el servidor".
- (Not recorded) The secretaries would be in charge of it.

For the project: automatic copies on a second virtual disk in the same VM, asked for in the same CTI request, every two weeks, keeping the 2 most recent. The Administrator panel can also download and restore a copy (E-122). Losing the whole VM loses the copies too; the team accepts that risk.

### 3.9 Gym status this semester and member counts

- The gym is closed to the public now. From Monday, November 9, it opens for athletes only for the rest of the semester, and it opens to everyone in January. The athletes' hours were not clear in the recording; athletes usually ask for 6 in the morning or after 4:30.
- The team asked for the number of active members. No number was given. Athletes are not registered on the store; their lists go to the department. Of the people who pay and register, "el 97% son estudiantes"; a few register as employees.
- The department described a recent problem: people paid while the gym was closed, so it turned off the store and gave refunds. One refund went to an employee who is also a graduate student and had paid the student price. The department told her to pay as an employee next time, because the student price needs an active enrollment for that semester. The semester fee is about 45 dollars.
- The team asked to visit to see the machines for the app's pictures. The department said to call ahead so someone opens the room.

For the project: G-05 has no numbers from the department; the team takes last term's paid count from the store, which it can access. Question 34 is partly answered: the rest of this semester is athletes only. The store sells at least a student price and an employee price; the order sync (G-19) needs to know the difference.

### 3.10 The athlete list

- The list is a Word document, not Excel. The department can send it as Excel: "Se la puedo pasar en Excel".
- Each coach sends a new list every semester, because athletes leave, fail to meet credits or quit the team. The department asks for the lists before the last payment day, because it marks the merit scholarships ("becas mérito") then. One coach is always late.
- The office checks who left and who stays, cleans the list and keeps it in Word. A secretary said the gym list is the merit scholarship list plus anyone the coach certifies as training with the team without a scholarship.
- Only the two secretaries edit the list. They said the third person present "no entra a los sistemas".
- Each list is by sport and has the name, the student number and the sport. Some coaches want the whole team to come together (the example was volleyball after 4:30); individual athletes come on their own. The list does not keep the email, but the office can add it: "sí solo puedes poner el email".
- The department will send the lists by email to a team member.

For the project: the lists exist only in Word, so Administrators enter athletes by hand and there is no roster import (E-116). Each record has name, sport, student number and institutional email. The two secretaries are the Administrators (question 2, partly).

### 3.11 People who leave the list

- When a student stops being an athlete, the secretaries remove them by hand: "Este no está. Tachame a la vista."
- (Not recorded) The lists are updated at the start of each semester.

For the project: the roster is one list, not one per term. Athletes stay until an Administrator removes them, and Administrators add athletes during the term by hand. Each new term an athlete only uploads a new photo (E-116).

### 3.12 Other groups

- Band students pay as students. Only athletes are exempt. Employees pay as employees.
- Some employees with keys let themselves in, but that is outside any system and the department does not want it in the app.
- The fee pays for gym upkeep and new equipment; the new floor was paid with it.
- (Not recorded) Employees also have access to the gym.

For the project: no special groups. Employees are paying members; each order stores whether the buyer is a student or an employee, for statistics. A refunded order makes its authorization invalid at the next sync (E-120).

### 3.13 Summer

There is no summer membership: there is no student worker to staff it, the summer camp runs then, and the gym gets cleaned. "mucho revolú".

For the project: G-26 and question 19 are answered: no summer term.

### 3.14 Waiver and its text

- The team asked whether people accept the waiver on screen or sign digitally. The department said: "Si pone acepto eso cuenta como firma, ¿no?" and nobody objected.
- Asked who writes it, a secretary said she had not known about the waiver, and that she will sit down with the person who asked for it, prepare the text and send it. At the end she said she would send the consent text by email.
- (Not recorded) The secretaries write the privacy notice shown at registration.

For the project: G-21 and question 20 are answered: accepting on screen is enough. The record keeps the account, the time and the text version. The team drafts the privacy notice and the department approves it (G-24).

### 3.15 Accounts, photos and errors

- The team said each staff member would have an account, as the secretaries would. Nobody objected.
- People take and upload their own photo, since they register themselves: "Como ellos mismos hacen el registro, que yo mismo se tiren la foto."
- What staff do when a photo does not match the person was not answered clearly.
- The help number shown when a lookup fails is the office's direct line, 265-3866, "directamente entonces a la oficina".
- The team asked who fixes a session that stayed open by mistake and is found the next day. The answer in the recording is unclear. (Not recorded) The staff on duty at that moment fix it.

For the project: one account per person; the Administrators are the two secretaries and the department director (E-114). When a photo does not match, Staff mark the account "photo pending" and it cannot Check In until the person uploads a new one (E-118). Question 28 is answered only in the notes; how a closed session is corrected is still to design.

### 3.16 Desk device and data retention

- The team asked what device the staff use at the desk. The answer was not recorded. (Not recorded) A desktop computer.
- The team asked how long to keep accounts and Check In records. The recording has "5 años, 5 años", but it is not clear who said it. (Not recorded) All data is kept for 5 years.

For the project: question 29 is answered (desktop). Every kind of data is kept 5 years (E-125), counted as in E-131. Only the current photo is kept (E-135) and each one is shrunk to about 0.5 MB (E-138); the storage estimate was redone on 2026-11-05 (E-111).

### 3.17 Announcements

When the gym opens again or changes hours, a secretary makes a poster and posts it on social media and the department page. They would also post it in the app.

For the project: Administrators write the announcements in the app, as designed. Who writes the English version (question 35) was not asked.

### 3.18 Next steps

- The team has the midterm report next week and plans to show the department the screens then.
- The team will send the CTI request text next week.
- After the meeting, a team member said the team must give the department a detailed guide: what to do if the app goes down, how to add things and how to upload the lists.

For the project: question 38 was not asked; the team intends to write the guides anyway.

## Action items

- Department: send the athlete lists in Word, with emails, to the team member who gave his address.
- Department: send the waiver text.
- Team: send the CTI request text next week, with the subdomain and the second disk.
- Team: show the screens next week.
- Team: call the department before visiting the gym to see the machines.
- Team: when the gym is open again, measure the location area and confirm the waiver and notice texts with the department.

## Key dates

- November 9: the gym opens for athletes only until the end of the semester.
- Week of November 9: midterm report, screen demo to the department and the CTI request text.
- January: the gym opens to everyone.

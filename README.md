# BML Development Hub v4

Replace the old prototype files with:
- `index.html`
- `styles.css`
- `app.js`

## What changed

- All previous generic Mentoring wording is now **Flash Mentoring**.
- **Coaching**, **Flash Mentoring**, and **Growth Mentorship** can each be enabled/disabled by HR Admin.
- Removed the public "choose Staff / Mentor / HR" landing screen.
- Role switching only displays roles already assigned to the signed-in user.
- Replaced the old hard-coded `mentors` directory with a generic **Provider Directory**.
- No hard-coded mentor/coach profiles.
- No hard-coded categories or expertise.
- HR Admin can add provider photos, details, programmes, provider roles, categories and expertise.
- Provider roles are dynamic: Flash Mentor, ICF Coach, Growth Mentor, Counsellor, Executive Mentor, etc.
- Provider cards are compact by default and expand to show bio, expertise and available times.
- Added **Growth Mentorship** batch management with staff participant lists, facilitator, meeting details, notification status and `.ics` calendar export.
- Added HR booking and availability oversight.
- Added audit trail for programme, provider, booking, availability, category, Growth Mentorship and export actions.
- Added Excel-compatible `.xls` exports without requiring an external library.

## Important production integration points

### Authentication / role mapping
At the top of `app.js`, replace `APP_CONTEXT.currentUser` with your signed-in Microsoft Entra / application user. Populate `roles` from security groups or your role table. The UI role toggle does not grant roles; it only switches between roles already present in that array.

### Meeting notifications
`sendBatchNotification()` currently records the notification inside the prototype. Replace the integration hook in that function with a call to Power Automate, Microsoft Graph or your backend API to send Outlook / Teams invitations.

### Database
This prototype still uses `localStorage`. For production, move the state collections into SharePoint Lists, Dataverse, SQL, Supabase, or your selected backend and replace `load()` / `save()` with API calls.

### Photos
Prototype photos are stored as base64 in localStorage. Production should store images in SharePoint, Blob Storage, Dataverse, or another file store and save only the image URL in the provider record.

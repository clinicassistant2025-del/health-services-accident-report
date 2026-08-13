# Health Services Accident Reporting System

Static GitHub Pages frontend + Supabase Auth/Postgres/Storage backend.

## Features

- Login by company: CGSI, CLMC, VFI, MVBI
- Username/password authentication
- Company-level record separation using Row Level Security
- New accident encoding
- Date/time of accident
- Place of accident
- Date/time reported
- Employee, age, sex, department
- Nature/history of accident
- Intervention
- Fit-to-work
- Private accident-picture storage
- Search
- Edit/delete
- Monthly report filtering
- Print/PDF-ready report layout

## 1. Create Supabase project

Create a Supabase project.

In SQL Editor, run `supabase.sql`.

In Storage, create a PRIVATE bucket:

`accident-pictures`

Do not make it public.

## 2. Create users

In Supabase Authentication > Users, create each user with an email that matches:

`username@company.healthservices.local`

Examples:

- `john@mvbi.healthservices.local`
- `maria@cgsi.healthservices.local`

Use a strong password.

When creating the user, set User Metadata:

```json
{
  "username": "john",
  "company": "MVBI",
  "role": "encoder",
  "full_name": "John Melvic"
}
```

Allowed company values:

- CGSI
- CLMC
- VFI
- MVBI

Allowed role values:

- encoder
- admin

The SQL trigger creates the matching profile automatically.

If your Supabase dashboard does not let you enter metadata when creating a user, create the Auth user first, then insert the profile manually in SQL:

```sql
insert into public.profiles(id, username, company, role, full_name)
values (
  'AUTH-USER-UUID-HERE',
  'john',
  'MVBI',
  'encoder',
  'John Melvic'
);
```

## 3. Configure the frontend

Edit `config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_KEY: "YOUR-PUBLISHABLE-OR-ANON-KEY"
};
```

Use only the browser-safe publishable/anon key.

NEVER put a Supabase secret/service_role key in this repository.

## 4. Test locally

Because this is a static site, you can open it with a local web server. VS Code Live Server is easiest.

Or with Node:

```bash
npx serve .
```

## 5. Put it on GitHub

Create a new repository, for example:

`health-services-accident-report`

Upload:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `supabase.sql`
- `README.md`
- `assets/logo-mvbi.png`

Then enable GitHub Pages from Settings > Pages.

For a plain static site, choose the branch/folder publishing option available in your repository.

## Security

GitHub Pages is only the frontend. Employee accident records and pictures are stored in Supabase.

RLS policies ensure that a CGSI user sees CGSI records, CLMC sees CLMC, VFI sees VFI, and MVBI sees MVBI. Admins can see all companies.

Do not put the Supabase secret/service_role key in `config.js`.

## Report format

The generated monthly report includes:

- Company/header
- Monthly Accident Report title
- Revision/document information
- Accident table
- Male/Female/Total count
- Prepared/Reviewed/Received section
- Footer
- Accident pictures
- Print layout in landscape

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Insight360

Insight360 combines customer profiles, sales workflows, account sentiment, and retention planning in one workspace.

## Run locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

Insight360 Plus hosted checkout can be enabled by setting `VITE_INSIGHT360_PLUS_CHECKOUT_URL` to the workspace owner's payment-provider checkout URL. The customer payment QR can be provided through `VITE_INSIGHT360_CUSTOMER_PAYMENT_QR`. Customer accounts remain free; paid subscription checkout is separate from customer payments.

For an isolated local database, set `CRM_DB_FILE` to a separate SQLite file path before starting the server. Without it, Insight360 uses `data/crm.sqlite`.

Customer reminder emails are checked twice daily and are delivered only when SMTP is configured in the server environment: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and optionally `SMTP_SECURE=true` and `INSIGHT360_EMAIL_FROM`. In-app reminders work without SMTP. Customers receive an inactivity check-in after one week or one month without account activity, and invoice reminders when payment is due within seven days or overdue. Managers can also send an immediate due-invoice reminder from the customer's 360 profile.

## Customer Submission / Request Workflow

Insight360 now includes a manager-scoped Customer Submission workflow:
- Customer submissions are stored separately as `Pending` requests and never auto-create customers.
- Managers can generate tokenized shareable forms, review their requests, and export requests to Excel/CSV.
- Managers can import `.xlsx`, `.xls`, or `.csv` customer files with a preview and duplicate warnings before confirmation.
- Install dependencies before building after extracting the project: `npm install`, then `npm run build`.


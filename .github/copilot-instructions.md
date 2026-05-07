# Copilot Instructions for TiGeR ERP

You are working on a production ERP system.

## Main Goal
Build a secure, scalable, maintainable ERP system for real business operations.

## Business Modules
The system may include:
- Authentication and user roles
- Companies / branches
- Customers
- Suppliers
- Products
- Inventory
- Sales invoices
- Purchase invoices
- Payments
- Expenses
- Reports
- Audit logs
- Settings

## Coding Rules
- Do not make random large changes.
- Always understand the existing structure before editing.
- Prefer small, safe, reviewable changes.
- Do not delete existing logic unless clearly obsolete.
- Keep code clean, typed, and readable.
- Avoid duplicate business logic.
- Reuse existing components and services when possible.

## Supabase Rules
- Treat Supabase as the production backend.
- Never suggest disabling RLS.
- Never create broad policies like:
  - USING (true)
  - WITH CHECK (true)
  - FOR ALL TO authenticated
- All tables must have clear RLS policies.
- Always consider company_id / branch_id isolation if present.
- Use auth.uid() carefully.
- Do not expose service_role key in frontend code.
- Use Edge Functions for sensitive operations.
- Validate user role and status before sensitive writes.

## Security Rules
- Security is more important than speed.
- Do not expose secrets in code.
- Do not trust frontend-only validation.
- Add audit logs for important operations:
  - create invoice
  - update invoice
  - delete invoice
  - stock change
  - payment change
  - user permission change

## ERP Business Rules
- Inventory must stay consistent.
- Invoice totals must be calculated reliably.
- Payments must affect balances correctly.
- Deleting financial records should be avoided. Prefer status = cancelled or voided.
- Reports must match real stored data.
- Use transactions or database functions for critical operations when needed.

## UI/UX Rules
- ERP screens should be simple and fast.
- Forms must have validation and clear error messages.
- Tables should support search, filters, pagination, and export where useful.
- Dashboards should show actionable business numbers.

## Testing Rules
- Add tests for business-critical calculations.
- Test invoice totals, stock movements, customer balances, and permissions.
- Do not mark work as complete unless build/typecheck passes.

## Before Making Changes
Always provide:
1. What you found
2. What you will change
3. Files affected
4. Risks
5. How to test

## Pull Request Standard
Every PR should include:
- Summary
- Screens changed
- Database changes
- Security impact
- Testing steps
- Rollback notes

# Database / Supabase SQL Rules

## Project Identity

This ERP system is called **TiGeR For Trading & Distribution ERP**.

The business specializes in trading and distributing snack and entertainment food products, including:
- candy
- marshmallow
- biscuits
- wafers
- chocolate
- chips
- sweets
- packaged food items

The ERP must be designed for a real trading and distribution workflow, not a generic demo app.

---

## Supabase Database Requirement

The Supabase project may start with an empty database.

Whenever database support is needed, Copilot must provide a complete SQL schema script suitable for Supabase/PostgreSQL.

The SQL script must include all required tables, relationships, indexes, constraints, default values, timestamps, and Row Level Security policies.

The database schema must match the current repository code and the business modules being implemented.

---

## Required Core ERP Tables

The SQL schema should support these core modules when relevant:

- users / profiles
- roles and permissions
- companies
- branches
- customers
- suppliers
- product categories
- products
- product units
- warehouses
- inventory balances
- stock movements
- sales invoices
- sales invoice items
- purchase invoices
- purchase invoice items
- payments
- expenses
- cashboxes / treasury
- audit logs
- app settings

---

## Supabase SQL Script Rules

When generating or changing database structure, Copilot must always:

1. Provide the full updated SQL script
2. Explain what changed
3. Mention whether the script is for:
   - fresh database setup
   - migration on existing database
   - destructive reset
4. Warn before destructive operations such as:
   - DROP TABLE
   - DELETE data
   - TRUNCATE
   - DROP POLICY
   - DROP COLUMN
5. Provide rollback notes when possible
6. Never assume the SQL has already been applied
7. Clearly tell the user when they must copy the SQL into Supabase SQL Editor

---

## Mandatory Warning After SQL Changes

If any code change requires a database change, Copilot must clearly say:

> Database update required: copy and run the updated SQL script in Supabase SQL Editor before testing this feature.

Copilot must not mark the task as complete until it has provided the required SQL.

---

## Empty Database Setup Rule

If the Supabase database is empty, Copilot must generate a clean initial setup script named:

```text
supabase/schema.sql

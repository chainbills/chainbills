# ZeptoMail setup guide

## What ZeptoMail is

ZeptoMail is Zoho's transactional email service (separate from Zoho Mail, which is mailbox hosting). The backend sends all transactional email (OTP codes, payment notifications) through ZeptoMail's REST API.

## Setup steps

1. **Sign in to Zoho Mail** and go to [zeptomail.com](https://www.zeptomail.com). Click "Get Started" under the ZeptoMail product.

2. **Create a Mail Agent.** A Mail Agent is an isolated sending identity. Name it after the environment (e.g. `chainbills-production`).

3. **Add a sending domain.** Go to **Mail Agents -> your agent -> Domains -> Add Domain**. Enter the subdomain you will send from, e.g. `notify.chainbills.xyz`.

   Important: use a dedicated sending subdomain (like `notify.chainbills.xyz`) that is **different** from your Zoho Mail mailbox domain (e.g. `chainbills.xyz`). ZeptoMail's DKIM key sits on the sending subdomain; Zoho Mail's DKIM key sits on the mailbox domain. Publishing both on the same domain is technically possible but creates fragile key-management overhead. Keeping them on separate subdomains means each product manages its own DNS records independently.

4. **Add DNS records.** ZeptoMail shows you three records to add to your DNS:
   - **SPF** TXT record on `notify.chainbills.xyz` (or extend an existing SPF record if one already exists on the apex).
   - **DKIM** CNAME record (the ZeptoMail console tells you the exact host and value).
   - **Bounce CNAME** record (routes bounces back to ZeptoMail for tracking). The console shows the exact host and value.

   After adding the records, click **Verify** in the ZeptoMail console. DNS propagation can take up to 48 h; most providers propagate in under 15 min.

5. **Create a Send Mail token.** Go to **Mail Agents -> your agent -> SMTP/API -> API tokens -> Add New Token**. Choose "Send Mail" as the scope. Copy the generated token — this is `ZEPTOMAIL_API_KEY`. The token is shown only once.

6. **Pick the right region URL.** Your account region determines the API host:
   - Global (US): `https://api.zeptomail.com`
   - EU: `https://api.zeptomail.eu`
   - India: `https://api.zeptomail.in`
   - Australia: `https://api.zeptomail.com.au`

   Use the region that matches your Zoho account's data residency. Set `ZEPTOMAIL_API_URL` to this value.

7. **Configure env vars:**

   ```
   MAIL_PROVIDER=zeptomail
   ZEPTOMAIL_API_URL=https://api.zeptomail.com   # adjust for your region
   ZEPTOMAIL_API_KEY=<paste the Send Mail token>
   MAIL_FROM_ADDRESS=notify@notify.chainbills.xyz
   MAIL_FROM_NAME=Chainbills
   ```

## Testing locally with `console`

Set `MAIL_PROVIDER=console` (the default). The service logs every outgoing email (including the OTP code) to stdout via pino at `debug` level. No ZeptoMail account or DNS setup needed.

`MAIL_PROVIDER=console` is rejected when `NODE_ENV=production` — the config validation step at boot exits with code 1 before any module initialises.

## Why the sending subdomain should differ from the Zoho Mail mailbox domain

ZeptoMail and Zoho Mail each publish their own DKIM public key. If both share the same domain, you end up with two `mail._domainkey` CNAME or TXT records, which is not valid DNS. Separate subdomains (`notify.chainbills.xyz` for ZeptoMail, `chainbills.xyz` for Zoho Mail) keep each product's DKIM keys on their own DNS namespace, so both can be active at the same time without conflict.

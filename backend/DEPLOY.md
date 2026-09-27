# Chainbills Backend - Cloud Run deployment

Target: one Cloud Run service (`chainbills-backend`) in GCP project
`cal1-1610628692221`, region `us-east1`. Runs `ROLE=all` with
`min-instances=1`, `max-instances=1`, and CPU always allocated because the
service also owns the indexer and cross-chain relay loops. A Postgres
advisory lock prevents duplicate work if a second instance ever comes up.

Secrets live in Secret Manager and are mounted into the container as env
vars. Non-secret config is set as plain env vars at deploy time.

The `CMD` in the Dockerfile runs `prisma migrate deploy` before starting
the server, so a new revision applies pending migrations automatically.
Prisma uses `DATABASE_URL` for both the runtime pg-adapter connection and
CLI migrations. There is no separate `DIRECT_URL`.

## One-time setup

Every step below runs from your laptop, once.

### 1. Verify project + region

```bash
gcloud config get-value project
# should print: cal1-1610628692221
```

APIs already enabled on this project: Cloud Run, Cloud Build, Artifact
Registry, Secret Manager, IAM, IAM Credentials. If a fresh project is ever
used, enable them with:

```bash
gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com iamcredentials.googleapis.com \
  --project=cal1-1610628692221
```

### 2. Verify (or complete) domain verification for chainbills.xyz

Cloud Run requires domain-of-record verification before mapping a subdomain.
Add `chainbills.xyz` as a Domain property in Google Search Console at
`search.google.com/search-console` and add the TXT record it prints on
whichever DNS provider owns the zone.

### 3. Create the Artifact Registry repo

```bash
gcloud artifacts repositories create chainbills \
  --repository-format=docker \
  --location=us-east1 \
  --project=cal1-1610628692221 \
  --description="Chainbills container images"
```

### 4. Push the eight secrets to Secret Manager

Every value here comes from your local `backend/.env`. Run from the repo
root. `printf '%s'` avoids the trailing newline that `echo` would append
(matters for exact-value secrets like private keys and connection strings).

```bash
# read every value once
set -a; source ./backend/.env; set +a

printf '%s' "$DATABASE_URL" | \
  gcloud secrets create chainbills-database-url --data-file=- \
    --replication-policy=automatic --project=cal1-1610628692221

printf '%s' "$JWT_ACCESS_SECRET" | \
  gcloud secrets create chainbills-jwt-access-secret --data-file=- \
    --replication-policy=automatic --project=cal1-1610628692221

printf '%s' "$OTP_HMAC_SECRET" | \
  gcloud secrets create chainbills-otp-hmac-secret --data-file=- \
    --replication-policy=automatic --project=cal1-1610628692221

printf '%s' "$UNSUBSCRIBE_SECRET" | \
  gcloud secrets create chainbills-unsubscribe-secret --data-file=- \
    --replication-policy=automatic --project=cal1-1610628692221

printf '%s' "$EVM_TESTNETS_RELAYER_PRIVATE_KEY" | \
  gcloud secrets create chainbills-evm-testnets-relayer-key --data-file=- \
    --replication-policy=automatic --project=cal1-1610628692221

printf '%s' "$EVM_MAINNETS_RELAYER_PRIVATE_KEY" | \
  gcloud secrets create chainbills-evm-mainnets-relayer-key --data-file=- \
    --replication-policy=automatic --project=cal1-1610628692221

printf '%s' "$SOLANA_RELAYER_KEYPAIR" | \
  gcloud secrets create chainbills-solana-relayer-keypair --data-file=- \
    --replication-policy=automatic --project=cal1-1610628692221

printf '%s' "$ZEPTOMAIL_API_KEY" | \
  gcloud secrets create chainbills-zeptomail-api-key --data-file=- \
    --replication-policy=automatic --project=cal1-1610628692221
```

If a secret already exists (repeated setup) add a new version instead:

```bash
printf '%s' "$JWT_ACCESS_SECRET" | \
  gcloud secrets versions add chainbills-jwt-access-secret \
    --data-file=- --project=cal1-1610628692221
```

### 5. Grant the runtime service account read access to those secrets

Cloud Run revisions run as the compute default SA
(`470664228108-compute@developer.gserviceaccount.com`). Grant it Secret
Accessor on each chainbills secret:

```bash
RUNTIME_SA=470664228108-compute@developer.gserviceaccount.com

for s in chainbills-database-url \
         chainbills-jwt-access-secret chainbills-otp-hmac-secret \
         chainbills-unsubscribe-secret \
         chainbills-evm-testnets-relayer-key chainbills-evm-mainnets-relayer-key \
         chainbills-solana-relayer-keypair \
         chainbills-zeptomail-api-key; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role=roles/secretmanager.secretAccessor \
    --project=cal1-1610628692221
done
```

### 6. Cap Artifact Registry storage

Every `gcloud run deploy --source .` pushes a new image (around 200-400 MB).
The free tier is 0.5 GB per region. Attach a cleanup policy so the repo
stays bounded:

```bash
cat > /tmp/chainbills-cleanup.json <<'EOF'
[
  { "name": "keep-recent", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 5} },
  { "name": "delete-old",  "action": {"type": "Delete"}, "condition": {"olderThan": "30d"} }
]
EOF

gcloud artifacts repositories set-cleanup-policies chainbills \
  --project=cal1-1610628692221 \
  --location=us-east1 \
  --policy=/tmp/chainbills-cleanup.json
```

## First deploy

This is the only deploy that carries every env var and secret. Later
deploys just replace the image; Cloud Run keeps the previous revision's
env + secret bindings when they are not passed again.

Run from `backend/`:

```bash
cd backend

gcloud run deploy chainbills-backend \
  --source . \
  --region=us-east1 \
  --project=cal1-1610628692221 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --min-instances=1 \
  --max-instances=1 \
  --no-cpu-throttling \
  --cpu=1 \
  --memory=1Gi \
  --timeout=300 \
  --set-env-vars="^##^NODE_ENV=production##ROLE=all##LOG_LEVEL=info##APP_URL=https://chainbills.xyz##PUBLIC_API_URL=https://api.chainbills.xyz##CORS_ORIGINS=https://chainbills.xyz,http://localhost:5173##COOKIE_SECURE=true##COOKIE_DOMAIN=.chainbills.xyz##EMAILS_ENABLED=false##MAIL_PROVIDER=zeptomail##ZEPTOMAIL_API_URL=https://cpaas.zoho.com##MAIL_FROM_ADDRESS=updates@notify.chainbills.com##MAIL_FROM_NAME=Chainbills" \
  --set-secrets="DATABASE_URL=chainbills-database-url:latest,JWT_ACCESS_SECRET=chainbills-jwt-access-secret:latest,OTP_HMAC_SECRET=chainbills-otp-hmac-secret:latest,UNSUBSCRIBE_SECRET=chainbills-unsubscribe-secret:latest,EVM_TESTNETS_RELAYER_PRIVATE_KEY=chainbills-evm-testnets-relayer-key:latest,EVM_MAINNETS_RELAYER_PRIVATE_KEY=chainbills-evm-mainnets-relayer-key:latest,SOLANA_RELAYER_KEYPAIR=chainbills-solana-relayer-keypair:latest,ZEPTOMAIL_API_KEY=chainbills-zeptomail-api-key:latest"
```

What happens: gcloud uploads `backend/` (respecting `.dockerignore`) to
Cloud Build, Cloud Build builds using the `Dockerfile`, pushes the image to
Artifact Registry, then Cloud Run creates a new revision and routes 100%
of traffic to it once healthy.

Flag notes:

- `--min-instances=1 --max-instances=1` pins to exactly one warm instance.
  Required for the indexer + relay loops.
- `--no-cpu-throttling` keeps CPU allocated between requests so background
  loops keep ticking.
- `--allow-unauthenticated` is required. The API's own JWT auth gates every
  protected route; Cloud Run's platform auth would double-gate.
- `EMAILS_ENABLED=false` on first deploy. Outbox rows are skipped rather
  than delivered. Flip to `true` after confirming ZeptoMail works (see
  "Enable emails" below).
- `--timeout=300` is the request timeout ceiling. Background loops are not
  bounded by this.
- `--set-env-vars="^##^K1=v1##K2=v2##..."` uses `##` as the pair separator
  instead of the default `,`. Needed because `CORS_ORIGINS` is itself a
  comma-separated list, which would otherwise be parsed as multiple pairs.

## Custom domain

After the first deploy, map `api.chainbills.xyz`:

```bash
gcloud beta run domain-mappings create \
  --service=chainbills-backend \
  --domain=api.chainbills.xyz \
  --region=us-east1 \
  --project=cal1-1610628692221
```

Read the DNS record it expects:

```bash
gcloud beta run domain-mappings describe \
  --domain=api.chainbills.xyz \
  --region=us-east1 \
  --project=cal1-1610628692221
```

Add the `ghs.googlehosted.com` CNAME on your DNS provider for
`api.chainbills.xyz`. If the DNS host is Cloudflare, keep the record grey
(DNS-only) until the managed cert issues. Orange-cloud proxying interferes
with Google's cert provisioning. TLS is provisioned automatically within a
few minutes of the CNAME resolving.

Verify:

```bash
curl -sI https://api.chainbills.xyz/health
```

## Every deploy after the first

Two ways. Either works.

### From your laptop

```bash
cd backend

gcloud run deploy chainbills-backend \
  --source . \
  --region=us-east1 \
  --project=cal1-1610628692221 \
  --quiet
```

No `--set-env-vars`, no `--set-secrets`. Cloud Run copies both from the
previous revision.

### From GitHub Actions

Any push to `main` that changes `backend/**` triggers
`.github/workflows/deploy-backend.yml`, which runs the same short-form
`gcloud run deploy` above. Section "GitHub Actions setup" covers the
one-time SA key + GH secret plumbing.

## Update a single env var

```bash
gcloud run services update chainbills-backend \
  --region=us-east1 \
  --project=cal1-1610628692221 \
  --update-env-vars EMAILS_ENABLED=true
```

Cloud Run creates a new revision that inherits every previous env + secret
binding and overwrites only the ones passed.

## Rotate a secret

```bash
printf '%s' 'NEW-VALUE' | \
  gcloud secrets versions add chainbills-jwt-access-secret \
    --data-file=- --project=cal1-1610628692221

# force a new revision so the container picks up the new version
gcloud run services update chainbills-backend \
  --region=us-east1 \
  --project=cal1-1610628692221 \
  --update-secrets JWT_ACCESS_SECRET=chainbills-jwt-access-secret:latest
```

## Enable emails

Once ZeptoMail is confirmed working (send a test through the `/docs`
Swagger UI or a curl to a dev route), flip:

```bash
gcloud run services update chainbills-backend \
  --region=us-east1 \
  --project=cal1-1610628692221 \
  --update-env-vars EMAILS_ENABLED=true
```

## GitHub Actions setup

One-time work to let the deploy workflow authenticate to GCP.

### Deploy service account

```bash
PROJECT=cal1-1610628692221

gcloud iam service-accounts create chainbills-deployer \
  --project=$PROJECT \
  --display-name="Chainbills Cloud Run deployer"

DEPLOY_SA=chainbills-deployer@$PROJECT.iam.gserviceaccount.com

for role in roles/run.admin roles/artifactregistry.writer \
            roles/cloudbuild.builds.editor roles/storage.admin; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$DEPLOY_SA" --role="$role"
done

# actAs on the runtime (compute default) SA so the deployer can launch revisions
COMPUTE_SA=470664228108-compute@developer.gserviceaccount.com
gcloud iam service-accounts add-iam-policy-binding $COMPUTE_SA \
  --project=$PROJECT \
  --member="serviceAccount:$DEPLOY_SA" \
  --role=roles/iam.serviceAccountUser

# mint a JSON key for GitHub
gcloud iam service-accounts keys create /tmp/chainbills-deployer.json \
  --iam-account=$DEPLOY_SA
```

### GitHub repo secret

```bash
gh secret set GCP_DEPLOY_SA_KEY --repo chainbills/chainbills < /tmp/chainbills-deployer.json
rm /tmp/chainbills-deployer.json
```

Or paste the file contents into GitHub, Settings, Secrets and variables,
Actions, New repository secret, name `GCP_DEPLOY_SA_KEY`.

Rotate the key by rerunning `keys create` with a new file, uploading it to
GitHub, and deleting the old key:

```bash
gcloud iam service-accounts keys list --iam-account=$DEPLOY_SA
gcloud iam service-accounts keys delete <old-key-id> --iam-account=$DEPLOY_SA
```

## Verify

```bash
SERVICE_URL=https://api.chainbills.xyz
curl "$SERVICE_URL/health"
curl -I "$SERVICE_URL/docs"
```

Check which revision is serving:

```bash
gcloud run services describe chainbills-backend \
  --region=us-east1 \
  --project=cal1-1610628692221 \
  --format="value(status.latestReadyRevisionName,status.url,status.traffic[0].percent)"
```

Tail logs (Cloud Run streams pino JSON):

```bash
gcloud run services logs read chainbills-backend \
  --region=us-east1 \
  --project=cal1-1610628692221 \
  --limit=100
```

# LevvAI Website

## Deploy To Cloud Run

Run this command to deploy the `levvai-website` service to Cloud Run:

```bash
gcloud run deploy levvai-website \
    --source . \
    --region us-east1 \
    --allow-unauthenticated \
    --env-vars-file cloudrun.env
```

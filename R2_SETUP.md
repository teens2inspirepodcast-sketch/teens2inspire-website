# Connect Cloudflare R2

1. In Cloudflare, open **R2 Object Storage** and create a bucket named `teens2inspire-media`. Leave public access off.
2. Create an R2 API token with **Object Read & Write** access for this bucket only. Copy the account ID, Access Key ID, and Secret Access Key. Keep the secret private.
3. In Vercel, open the Teens2Inspire project **Settings → Environment Variables**. Add these four variables for Production (and Preview if you use preview deployments):

   ```text
   CLOUDFLARE_ACCOUNT_ID = your Cloudflare account ID
   R2_ACCESS_KEY_ID = the R2 token's Access Key ID
   R2_SECRET_ACCESS_KEY = the R2 token's Secret Access Key
   R2_BUCKET_NAME = teens2inspire-media
   ```

   These must not start with `NEXT_PUBLIC_`. Redeploy the app after saving them.

4. In the bucket, open **Settings → CORS Policy → Add CORS policy → JSON** and paste:

   ```json
   [
     {
       "AllowedOrigins": [
         "https://teens2inspire-website-ra8kiujs6.vercel.app",
         "http://localhost:3000"
       ],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["Content-Type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   If Vercel gives the project a different site URL, use that exact origin instead. When you connect your custom domain, add its origin here too. An origin is just `https://your-domain.com`—no page path or trailing slash.

5. Sign in to Teens2Inspire Studio and try uploading a small image. The app asks the server for a five-minute, single-file upload URL and sends the file directly to the private R2 bucket.

## Move the existing files

Existing Supabase Storage files continue working until you move them. To copy them to R2 too, add the Supabase service-role key to your local `.env.local` (server-only; never paste it into a browser variable), then run:

```powershell
node --env-file=.env.local scripts/migrate-supabase-media-to-r2.mjs
```

The script copies the files first, then updates their Supabase references. It leaves the original Supabase objects in place as a rollback copy. Check the site and the R2 bucket before removing any old Supabase buckets.

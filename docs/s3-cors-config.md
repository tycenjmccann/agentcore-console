# S3 CORS Configuration for Profile Photo Uploads

The S3 bucket used for profile photo uploads must have CORS configured to allow browser-based PUT requests from the application origin.

## Recommended CORS Configuration

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["Content-Type", "Content-Length"],
      "AllowedMethods": ["PUT"],
      "AllowedOrigins": ["https://your-app-domain.com"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

## Applying via AWS CLI

```bash
aws s3api put-bucket-cors \
  --bucket YOUR_BUCKET_NAME \
  --cors-configuration file://cors-config.json
```

## Notes

- Replace `https://your-app-domain.com` with your actual application origin(s).
- For local development, add `http://localhost:3000` to `AllowedOrigins`.
- Only `PUT` is needed since uploads use presigned URLs directly from the browser.
- `ETag` is exposed so the client can verify upload integrity if needed.

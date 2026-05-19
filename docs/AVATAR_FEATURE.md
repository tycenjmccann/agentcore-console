# Avatar Upload Feature

## Overview
This feature allows users to upload, display, and manage profile avatars throughout the application.

## Features
- **Upload**: Upload JPEG or PNG images up to 5MB
- **Compression**: Automatic image compression and resizing to 512x512px
- **Display**: Avatar displayed in header with click-to-settings navigation
- **Remove**: Delete current avatar
- **Persistence**: Avatar stored in S3 and cached in localStorage

## Files Created

### Frontend Components
- `src/components/profile/AvatarUpload.tsx` - Main avatar upload component
- `src/app/settings/page.tsx` - Settings page containing avatar upload

### API Routes
- `src/app/api/profile/avatar/route.ts` - REST API for avatar operations (GET, POST, DELETE)

### Utilities
- `src/lib/s3-utils.ts` - S3 upload/download utilities

### Modified Files
- `src/components/layout/Header.tsx` - Added avatar display
- `src/components/layout/Sidebar.tsx` - Added Settings link
- `package.json` - Added image compression dependencies
- `.env.example` - Added avatar bucket configuration

## Dependencies

### New Dependencies
```json
{
  "browser-image-compression": "^2.0.2",
  "react-image-crop": "^11.0.0"
}
```

Install with:
```bash
npm install browser-image-compression react-image-crop
```

## Environment Variables

Add to your `.env` file:
```bash
AVATAR_BUCKET_NAME=agentcore-user-avatars
AWS_REGION=us-east-1
```

## API Endpoints

### GET /api/profile/avatar
Fetch the current user's avatar URL.

**Response:**
```json
{
  "avatarUrl": "https://agentcore-user-avatars.s3.us-east-1.amazonaws.com/user-avatars/user-123/1234567890.jpg"
}
```

### POST /api/profile/avatar
Upload a new avatar image.

**Request:** FormData with `file` field
**Response:**
```json
{
  "avatarUrl": "https://...",
  "status": "success"
}
```

### DELETE /api/profile/avatar
Remove the current avatar.

**Response:**
```json
{
  "status": "success"
}
```

## Usage

### Accessing Settings
1. Click the avatar icon in the header (top right)
2. Or navigate to the Settings link in the sidebar
3. Upload or remove your avatar

### Upload Flow
1. Click "Choose File" button
2. Select JPEG or PNG image (max 5MB)
3. Preview appears with Upload/Cancel buttons
4. Click "Upload" to save
5. Image is automatically compressed to 512x512px
6. Avatar appears in header immediately

### Remove Flow
1. Click "Remove" button
2. Avatar is deleted from S3
3. Header updates to show default user icon

## Implementation Details

### Image Processing
- Client-side compression using `browser-image-compression`
- Maximum dimensions: 512x512px
- Maximum file size: 1MB (after compression)
- Original file size limit: 5MB (before compression)

### Storage
- S3 bucket: `agentcore-user-avatars`
- Key format: `user-avatars/{userId}/{timestamp}.{ext}`
- Public read access (or use presigned URLs in production)

### State Management
- Avatar URL cached in localStorage
- Custom event `avatar-updated` for cross-component updates
- Automatic header refresh on upload/delete

### Security Considerations
- File type validation (JPEG/PNG only)
- File size validation (5MB limit)
- TODO: Add user authentication
- TODO: Implement presigned URLs for production
- TODO: Add CSRF protection

## Future Enhancements

### Authentication
Currently uses placeholder user ID `user-123`. In production:
- Integrate with authentication system (JWT, session, etc.)
- Validate user owns the avatar they're modifying
- Add authentication middleware to API routes

### Security
- Implement presigned URLs instead of public-read
- Add rate limiting on upload endpoint
- Scan uploaded images for malware
- Add CSRF token validation

### Features
- Image cropping UI with drag/zoom controls
- Multiple avatar sizes (thumbnail, medium, large)
- Avatar history/undo functionality
- Gravatar fallback option

## Testing

### Manual Testing Checklist
- [ ] Upload JPEG < 5MB → success
- [ ] Upload PNG < 5MB → success
- [ ] Upload file > 5MB → validation error
- [ ] Upload non-image → validation error
- [ ] Avatar displays in header
- [ ] Click avatar → navigate to settings
- [ ] Remove button works
- [ ] Page reload preserves avatar
- [ ] Error handling works

### Integration Testing
Run with Playwright or Jest:
```bash
npm run test
```

## Troubleshooting

### Avatar not appearing after upload
1. Check browser console for errors
2. Verify S3 bucket exists and has correct permissions
3. Check `AVATAR_BUCKET_NAME` environment variable
4. Clear localStorage and try again

### Upload fails with 500 error
1. Check API route logs
2. Verify AWS credentials are configured
3. Check S3 bucket permissions
4. Ensure IAM role has `s3:PutObject` permission

### Image too large error
1. Verify file is under 5MB
2. Try a different image format (JPEG vs PNG)
3. Manually compress image before upload

## Support

For issues or questions, contact the development team or file an issue in the repository.

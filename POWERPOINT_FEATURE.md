# PowerPoint Presentation Feature

## Overview
This feature allows teachers to upload and present PowerPoint files (.pptx) directly in the group session interface, synchronized across all students viewing the session link.

## Features
- **PowerPoint Upload**: Teachers can upload .pptx files before or during a session
- **Fullscreen Presentation**: PowerPoint slides display fullscreen to students
- **Teacher Controls**: Navigate slides with next/previous buttons (keyboard arrow keys supported)
- **Real-time Sync**: All students see the same slide simultaneously
- **Toggle Discussion View**: Teachers can hide/show the discussion panel while presenting
- **Thin Status Bar**: When discussion is hidden, an elegant 4% width status bar shows group submission status
- **Visual Feedback**: Groups change from red (pending) to green (submitted) with audio notification
- **Persistent State**: Show/hide state is saved to localStorage across page reloads
- **Sound Notifications**: Audio "ding" plays when groups submit

## Setup Instructions

### 1. Create Database Tables
Run the following SQL in your Supabase dashboard or using the Supabase CLI:

```bash
# From the project root:
cd scripts
# Run the migrations via Supabase dashboard SQL editor, or:
supabase db push 020_presentations.sql
```

Alternatively, copy the SQL from `/scripts/020_presentations.sql` and run it in the Supabase SQL editor.

### 2. Create Storage Bucket
The app requires a "presentations" storage bucket in Supabase:

1. Go to your Supabase dashboard
2. Navigate to Storage section
3. Click "Create a new bucket"
4. Name it: `presentations`
5. Set to "Private" (for security)
6. Click "Save"

Or use the Supabase CLI:
```bash
supabase bucket create presentations --project-ref=<your-project-ref>
```

### 3. RLS Policy (Optional but Recommended)
Set up Row Level Security to ensure teachers can only access their own presentations:

```sql
-- Add RLS policy for presentations table
ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their own presentations"
  ON presentations
  FOR ALL
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- For slide access
ALTER TABLE presentation_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to slides"
  ON presentation_slides
  FOR SELECT
  USING (true);
```

## File Structure

### New Files Created:
- `app/api/presentations/upload/route.ts` - PowerPoint file upload handler
- `app/api/presentations/[id]/slide/route.ts` - Slide navigation API
- `components/presentation-viewer.tsx` - Main presentation display component
- `components/presentation-upload.tsx` - Upload UI component
- `lib/presentation-utils.ts` - Utility functions (sound, colors, labels)
- `scripts/020_presentations.sql` - Database migrations
- `scripts/030_create_presentation_bucket.sql` - Storage bucket setup reference

### Modified Files:
- `app/classes/[id]/sessions/[sid]/group-board.tsx` - Integrated presentation viewer and upload UI

## How It Works

### Teacher Flow:
1. Open a group session
2. In the left sidebar, expand the "PowerPoint" section (only visible to teachers)
3. Upload a .pptx file by dragging/dropping or clicking to select
4. The file is parsed and slides are created as placeholder images
5. Presentation enters fullscreen mode automatically
6. Use arrow keys or buttons to navigate slides
7. Click "Hide" button to minimize discussion panel
8. When hidden, groups appear as colored segments on the left edge (red = pending, green = submitted)

### Student Flow:
1. Join the session using the teacher's shared link
2. If teacher has uploaded a presentation, students see it fullscreen
3. When teacher shares the link, students can see the current slide
4. Real-time updates via Supabase Realtime channel

### Key Features:

#### Fullscreen Mode
- PowerPoint fills entire screen when active
- Discussion panel is hidden by default
- Teacher controls visible at bottom (for teachers only)

#### Slide Navigation
- Click next/previous buttons OR use arrow keys
- Slide count displayed (e.g., "3 / 12")
- Disabled buttons when at first/last slide

#### Hide/Show Toggle
- "Eye" icon button toggles discussion visibility
- When hidden: thin 4% width bar appears on left
- State saved to localStorage with key: `pres-hidden-{presentationId}`

#### Status Bar (4% width when hidden)
- Divided into 8 segments (top 4 groups, bottom 4 groups)
- Colors: Red = not submitted, Green = submitted
- Smooth transitions between states
- Hover to see "Nhóm X - Đã nộp/Chưa nộp"
- Click X button to re-expand discussion

#### Sound Notifications
- Audio "ding" plays when any group submits
- Uses Web Audio API to synthesize pleasant tone
- Tracked via localStorage to avoid duplicate notifications

## API Endpoints

### Upload Presentation
```
POST /api/presentations/upload
Content-Type: multipart/form-data

Body:
- file: File (the .pptx file)
- sessionId: string (session UUID)

Response:
{
  success: true,
  presentation: {
    id: string,
    fileName: string,
    slideCount: number
  }
}
```

### Update Current Slide
```
PATCH /api/presentations/{id}/slide
Content-Type: application/json

Body:
{
  slideNumber: number (1-indexed)
}

Response:
{
  success: true,
  currentSlide: number
}
```

## Real-time Updates
Uses Supabase Realtime channels to broadcast slide changes:
- Channel name: `presentation-{presentationId}`
- Event: `UPDATE` on `presentations` table
- Field watched: `current_slide`

## Browser Compatibility
- Works on all modern browsers supporting:
  - Web Audio API (for notification sounds)
  - Fetch API
  - LocalStorage
  - CSS Grid/Flexbox

## Known Limitations
- Slide images are currently placeholders (gray backgrounds)
- Does not extract actual slide content from .pptx files
- For production, consider using a library like `libreoffice-convert` or cloud service for proper PPTX → image conversion
- Maximum file size depends on Supabase storage configuration

## Future Enhancements
- [ ] Real PPTX to image conversion (currently uses placeholder images)
- [ ] Slide thumbnails in sidebar
- [ ] Presentation preview before upload
- [ ] Speaker notes display
- [ ] Presentation recording
- [ ] Custom transition animations
- [ ] Pointer/laser pointer tool for emphasis
- [ ] Drawing on slides
- [ ] Slide annotations

## Troubleshooting

### Presentation doesn't appear
1. Check that the storage bucket "presentations" exists and is accessible
2. Verify user is logged in and is the session teacher
3. Check browser console for errors
4. Ensure SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set

### Sound doesn't play
1. Check browser audio permissions
2. Verify audio isn't muted (system or browser)
3. Try refreshing the page
4. Check that Sonner toast library is working (used for notifications)

### Upload fails
1. Ensure file is actually a .pptx file
2. Check file is not corrupted
3. Verify session exists and you're the teacher
4. Check Supabase storage bucket has sufficient space
5. Check network requests in browser DevTools for detailed error messages

## Dependencies
- `jszip` - For parsing PPTX file structure
- `sharp` - For image processing (already in project)
- `sonner` - For toast notifications (already in project)
- Supabase JS client (already in project)

# API Endpoints and ID Usage Documentation

## Overview

This document explains the correct usage of file IDs versus parsed data IDs when working with the HireLens API endpoints. Understanding this distinction is crucial for proper API integration and avoiding 404 errors.

## Key Concepts

### File ID
- A UUID generated when a file is uploaded
- Used to identify files throughout the system
- Stored in the file metadata (`file_metadata.json`)
- Used as the filename for parsed data storage (`{file_id}.json`)

### Parsed Data ID
- An ID that may be contained within the parsed resume data itself
- Not used for API endpoint routing
- Should not be used when calling API endpoints

## File Storage Structure

```
uploads/
├── file_metadata.json          # Contains mapping of file_id to file metadata
├── {file_id}.{ext}             # Original uploaded files
└── parsed_resumes/
    └── {file_id}.json          # Parsed resume data stored by file_id
```

## API Endpoints

### Resume Parsing Endpoints

#### Parse a Single Resume
```
POST /api/parse/single/{file_id}
```
- Uses the file ID from metadata
- Correct: `POST /api/parse/single/27e164f3-9c8f-4949-b872-2dc404e0428b`
- Incorrect: `POST /api/parse/single/774685` (using parsed data ID)

#### Get Parse Status
```
GET /api/parse/status/{file_id}
```
- Uses the file ID from metadata

#### Get Parsed Resume Data
```
GET /api/parse/result/{file_id}
GET /api/parse/parsed-resumes/{file_id}
```
- Both endpoints use the file ID from metadata
- The second endpoint is an alias for backward compatibility

#### Delete Parsed Resume
```
DELETE /api/parse/result/{file_id}
```
- Uses the file ID from metadata

### Example File Metadata
```json
{
  "27e164f3-9c8f-4949-b872-2dc404e0428b": {
    "file_id": "27e164f3-9c8f-4949-b872-2dc404e0428b",
    "original_filename": "resume.pdf",
    "filename": "27e164f3-9c8f-4949-b872-2dc404e0428b.pdf",
    "status": "completed"
  }
}
```

### Example Parsed Resume Data
```json
{
  "id": "774685",  // This is the parsed data ID - DO NOT use for API calls
  "filename": "27e164f3-9c8f-4949-b872-2dc404e0428b.pdf",
  "file_id": "27e164f3-9c8f-4949-b872-2dc404e0428b",  // This is the file ID - USE THIS
  // ... other parsed data
}
```

## Common Mistakes and Solutions

### Mistake 1: Using Parsed Data ID for API Calls
**Incorrect:**
```
GET /api/parse/parsed-resumes/774685
```

**Correct:**
```
GET /api/parse/parsed-resumes/27e164f3-9c8f-4949-b872-2dc404e0428b
```

### Mistake 2: Confusing File ID with Internal Data ID
When working with parsed resume data, always use the `file_id` field for API calls, not the `id` field.

## Frontend Implementation

The frontend correctly implements this by:
1. Using file IDs from the metadata when calling API endpoints
2. Mapping parsed data to client-side types while preserving the correct ID

Example from `client/lib/api.ts`:
```typescript
async getParsedResume(id: string): Promise<ParsedResume> {
  // Uses the file ID passed as parameter
  const response = await this.fetchWithAuth(`/api/parse/parsed-resumes/${id}`);
  // ... process response
}
```

## Backend Implementation

The backend correctly implements this by:
1. Using the file ID parameter to locate parsed data files
2. Storing parsed data with filenames based on file IDs

Example from `server/app/services/file_service.py`:
```python
def get_parsed_data(self, file_id: str) -> Optional[Dict[str, Any]]:
    """Get parsed resume data for a file"""
    try:
        # Constructs filename using the file_id parameter
        parsed_file = self.parsed_data_dir / f"{file_id}.json"
        # ... rest of implementation
```

## Verification

To verify correct implementation:
1. Ensure API calls use file IDs from metadata
2. Check that parsed data files are stored as `{file_id}.json`
3. Confirm that 404 errors are not occurring due to ID mismatches

## Troubleshooting

If you encounter 404 errors when accessing parsed resume data:

1. **Check the file ID**: Ensure you're using the file ID from metadata, not the ID from within the parsed data
2. **Verify file existence**: Check that the parsed data file exists in `uploads/parsed_resumes/`
3. **Check file permissions**: Ensure the application has read access to the parsed data files
4. **Review logs**: Check server logs for specific error messages

### Example of Correct Usage
```bash
# This works - using the correct file ID
curl http://localhost:8000/api/parse/result/27e164f3-9c8f-4949-b872-2dc404e0428b

# This fails - using the wrong ID from parsed data
curl http://localhost:8000/api/parse/result/774685  # Returns 404
```
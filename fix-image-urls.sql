-- Fix old image URLs to use absolute paths
UPDATE attachments
SET url = 'https://goproj-backend.yusuzhan.workers.dev/api/images/' || r2_key
WHERE url NOT LIKE 'https://%';

-- Verify the changes
SELECT id, filename, url, r2_key FROM attachments;

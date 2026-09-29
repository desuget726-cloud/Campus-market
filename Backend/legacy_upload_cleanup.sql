-- Legacy upload cleanup note: these old local paths are already lost on Render/ephemeral disks
-- and should be re-uploaded or replaced with durable Cloudinary URLs.

SELECT id, username AS student_id, avatar_url AS image_value, 'admins' AS table_name
FROM admins
WHERE avatar_url LIKE '%/static/uploads/%' OR avatar_url LIKE '%http://127.0.0.1%'
UNION ALL
SELECT id, student_id, avatar_url AS image_value, 'students' AS table_name
FROM students
WHERE avatar_url LIKE '%/static/uploads/%' OR avatar_url LIKE '%http://127.0.0.1%'
UNION ALL
SELECT id, student_id, id_card_url AS image_value, 'students' AS table_name
FROM students
WHERE id_card_url LIKE '%/static/uploads/%' OR id_card_url LIKE '%http://127.0.0.1%'
UNION ALL
SELECT id, student_id, image AS image_value, 'products' AS table_name
FROM products
WHERE image LIKE '%/static/uploads/%' OR image LIKE '%http://127.0.0.1%'
UNION ALL
SELECT id, student_id, evidence_image AS image_value, 'reports' AS table_name
FROM reports
WHERE evidence_image LIKE '%/static/uploads/%' OR evidence_image LIKE '%http://127.0.0.1%'
UNION ALL
SELECT id, student_id, evidence_url AS image_value, 'student_id_change_requests' AS table_name
FROM student_id_change_requests
WHERE evidence_url LIKE '%/static/uploads/%' OR evidence_url LIKE '%http://127.0.0.1%'
UNION ALL
SELECT id, user_id AS student_id, attachment_url AS image_value, 'support_tickets' AS table_name
FROM support_tickets
WHERE attachment_url LIKE '%/static/uploads/%' OR attachment_url LIKE '%http://127.0.0.1%'
UNION ALL
SELECT id, sender_id AS student_id, attachment_url AS image_value, 'messages' AS table_name
FROM messages
WHERE attachment_url LIKE '%/static/uploads/%' OR attachment_url LIKE '%http://127.0.0.1%'
UNION ALL
SELECT id, buyer_id AS student_id, evidence_image AS image_value, 'disputes' AS table_name
FROM disputes
WHERE evidence_image LIKE '%/static/uploads/%' OR evidence_image LIKE '%http://127.0.0.1%'
UNION ALL
SELECT id, buyer_id AS student_id, seller_response AS image_value, 'disputes' AS table_name
FROM disputes
WHERE seller_response LIKE '%/static/uploads/%' OR seller_response LIKE '%http://127.0.0.1%';

-- Optional bulk update example if you want to clear stale entries after re-uploading:
-- UPDATE students SET avatar_url = NULL WHERE avatar_url LIKE '/static/uploads/%' OR avatar_url LIKE 'http://127.0.0.1:%';
-- UPDATE students SET id_card_url = NULL WHERE id_card_url LIKE '/static/uploads/%' OR id_card_url LIKE 'http://127.0.0.1:%';
-- UPDATE products SET image = NULL WHERE image LIKE '/static/uploads/%' OR image LIKE 'http://127.0.0.1:%';

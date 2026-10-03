-- Run once to remove duplicate ID-approval notices and legacy payment-category notices.
DROP TEMPORARY TABLE IF EXISTS id_verification_notification_keep;

CREATE TEMPORARY TABLE id_verification_notification_keep AS
SELECT student_id, MIN(id) AS keep_id
FROM notifications
WHERE (
    LOWER(COALESCE(title, '')) LIKE '%verification%approved%'
    OR LOWER(COALESCE(message, '')) LIKE '%student identity%successfully verified%'
)
AND LOWER(COALESCE(type, '')) NOT LIKE '%payment%'
AND (
    LOWER(COALESCE(title, '')) = 'id verification approved'
    OR NOT (
        LOWER(COALESCE(title, '')) LIKE '%payment%'
        OR LOWER(COALESCE(title, '')) LIKE '%wallet%'
        OR LOWER(COALESCE(title, '')) LIKE '%chapa%'
        OR LOWER(COALESCE(title, '')) LIKE '%transaction%'
        OR LOWER(COALESCE(title, '')) LIKE '%refund%'
        OR LOWER(COALESCE(title, '')) LIKE '%payout%'
        OR LOWER(COALESCE(title, '')) LIKE '%withdraw%'
        OR LOWER(COALESCE(message, '')) LIKE '%payment%'
        OR LOWER(COALESCE(message, '')) LIKE '%wallet%'
        OR LOWER(COALESCE(message, '')) LIKE '%chapa%'
        OR LOWER(COALESCE(message, '')) LIKE '%transaction%'
        OR LOWER(COALESCE(message, '')) LIKE '%refund%'
        OR LOWER(COALESCE(message, '')) LIKE '%payout%'
        OR LOWER(COALESCE(message, '')) LIKE '%withdraw%'
    )
)
GROUP BY student_id;

DELETE notification
FROM notifications AS notification
LEFT JOIN id_verification_notification_keep AS keep_notification
    ON keep_notification.student_id = notification.student_id
WHERE (
    LOWER(COALESCE(notification.title, '')) LIKE '%verification%approved%'
    OR LOWER(COALESCE(notification.message, '')) LIKE '%student identity%successfully verified%'
)
AND (
    LOWER(COALESCE(notification.type, '')) LIKE '%payment%'
    OR (
        LOWER(COALESCE(notification.title, '')) <> 'id verification approved'
        AND (
            LOWER(COALESCE(notification.title, '')) LIKE '%payment%'
            OR LOWER(COALESCE(notification.title, '')) LIKE '%wallet%'
            OR LOWER(COALESCE(notification.title, '')) LIKE '%chapa%'
            OR LOWER(COALESCE(notification.title, '')) LIKE '%transaction%'
            OR LOWER(COALESCE(notification.title, '')) LIKE '%refund%'
            OR LOWER(COALESCE(notification.title, '')) LIKE '%payout%'
            OR LOWER(COALESCE(notification.title, '')) LIKE '%withdraw%'
            OR LOWER(COALESCE(notification.message, '')) LIKE '%payment%'
            OR LOWER(COALESCE(notification.message, '')) LIKE '%wallet%'
            OR LOWER(COALESCE(notification.message, '')) LIKE '%chapa%'
            OR LOWER(COALESCE(notification.message, '')) LIKE '%transaction%'
            OR LOWER(COALESCE(notification.message, '')) LIKE '%refund%'
            OR LOWER(COALESCE(notification.message, '')) LIKE '%payout%'
            OR LOWER(COALESCE(notification.message, '')) LIKE '%withdraw%'
        )
    )
    OR notification.id <> COALESCE(keep_notification.keep_id, 0)
);

DROP TEMPORARY TABLE id_verification_notification_keep;

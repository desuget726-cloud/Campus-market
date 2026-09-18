-- Allow an approved OAuth student ID change to propagate to dependent records.
ALTER TABLE ai_recommendation_logs
    DROP FOREIGN KEY ai_recommendation_logs_ibfk_1,
    ADD CONSTRAINT fk_campus_ai_recommendation_student_id
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE cart_items
    DROP FOREIGN KEY cart_items_ibfk_1,
    ADD CONSTRAINT fk_campus_cart_student_id
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE notifications
    DROP FOREIGN KEY FK_NOTIFICATION_STUDENTS_ID,
    ADD CONSTRAINT fk_campus_notifications_student_id
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE orders
    DROP FOREIGN KEY orders_ibfk_1,
    ADD CONSTRAINT fk_campus_orders_student_id
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE payout_transactions
    DROP FOREIGN KEY payout_transactions_ibfk_1,
    ADD CONSTRAINT fk_campus_payout_transactions_student_id
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE reports
    DROP FOREIGN KEY fk_reports_student_id,
    ADD CONSTRAINT fk_campus_reports_student_id
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE reviews
    DROP FOREIGN KEY reviews_ibfk_2,
    ADD CONSTRAINT fk_campus_reviews_student_id
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE seller_payment_accounts
    DROP FOREIGN KEY seller_payment_accounts_ibfk_1,
    ADD CONSTRAINT fk_campus_seller_payment_accounts_student_id
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE transactions
    DROP FOREIGN KEY transactions_ibfk_1,
    ADD CONSTRAINT fk_campus_transactions_student_id
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE wishlist_items
    DROP FOREIGN KEY FK_WISHLIST_STUDENTS_ID,
    ADD CONSTRAINT fk_campus_wishlist_student_id
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE;
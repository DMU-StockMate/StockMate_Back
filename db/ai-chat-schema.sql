ALTER TABLE ai_chat_sessions
  ADD COLUMN question_id INT NULL AFTER user_id,
  ADD INDEX idx_chat_question (question_id),
  ADD CONSTRAINT fk_ai_chat_sessions_question
    FOREIGN KEY (question_id)
    REFERENCES quiz_questions(question_id)
    ON DELETE SET NULL;

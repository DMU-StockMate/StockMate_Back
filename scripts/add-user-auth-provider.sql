ALTER TABLE users
  ADD COLUMN auth_provider enum('LOCAL','GOOGLE','BOTH') DEFAULT 'LOCAL' AFTER phone;

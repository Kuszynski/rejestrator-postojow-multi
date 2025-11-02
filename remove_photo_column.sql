-- Usuń kolumnę photo_url z tabeli downtimes
ALTER TABLE downtimes DROP COLUMN IF EXISTS photo_url;
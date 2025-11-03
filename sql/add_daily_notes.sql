-- Tabela dla dziennych notatek operatorów
CREATE TABLE IF NOT EXISTS daily_notes (
  id BIGSERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  note TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index dla szybszego wyszukiwania
CREATE INDEX IF NOT EXISTS idx_daily_notes_department_date ON daily_notes(department_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON daily_notes(date DESC);

-- RLS policies
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON daily_notes FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON daily_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON daily_notes FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON daily_notes FOR DELETE USING (true);

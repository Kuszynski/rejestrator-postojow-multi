const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function removePhotoColumn() {
  try {
    console.log('Usuwam kolumnę photo_url z tabeli downtimes...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE downtimes DROP COLUMN IF EXISTS photo_url;'
    });

    if (error) {
      console.error('Błąd podczas usuwania kolumny:', error);
      // Spróbuj alternatywną metodę
      console.log('Próbuję alternatywną metodę...');
      
      const { data: result, error: error2 } = await supabase
        .from('downtimes')
        .select('*')
        .limit(1);
        
      if (error2) {
        console.error('Błąd połączenia z bazą:', error2);
      } else {
        console.log('Połączenie z bazą OK. Kolumna photo_url może nie istnieć lub została już usunięta.');
      }
    } else {
      console.log('✅ Kolumna photo_url została usunięta pomyślnie');
    }
  } catch (err) {
    console.error('Nieoczekiwany błąd:', err);
  }
}

removePhotoColumn();
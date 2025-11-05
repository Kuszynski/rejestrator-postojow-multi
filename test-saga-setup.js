const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testSagaSetup() {
  try {
    console.log('🔍 Testing Saga department setup...\n');

    // 1. Check if saga department exists
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .eq('name', 'saga');

    if (deptError) {
      console.error('❌ Error checking departments:', deptError.message);
      return;
    }

    if (departments.length === 0) {
      console.log('⚠️  Saga department not found in database');
      console.log('📝 Run the add_saga_department.sql script to add it');
    } else {
      console.log('✅ Saga department found:', departments[0]);
    }

    // 2. Check all departments
    const { data: allDepts } = await supabase
      .from('departments')
      .select('*')
      .order('id');

    console.log('\n📋 All departments:');
    allDepts?.forEach(dept => {
      console.log(`  - ${dept.id}: ${dept.name} (${dept.display_name})`);
    });

    // 3. Check users in saga department (if exists)
    if (departments.length > 0) {
      const sagaDeptId = departments[0].id;
      const { data: sagaUsers } = await supabase
        .from('user_passwords')
        .select('user_id, role, display_name, department_id')
        .eq('department_id', sagaDeptId);

      console.log('\n👥 Saga department users:');
      if (sagaUsers?.length > 0) {
        sagaUsers.forEach(user => {
          console.log(`  - ${user.user_id} (${user.role}): ${user.display_name}`);
        });
      } else {
        console.log('  No users found in saga department');
      }

      // 4. Check machines in saga department
      const { data: sagaMachines } = await supabase
        .from('machines')
        .select('id, name, department_id')
        .eq('department_id', sagaDeptId);

      console.log('\n🏭 Saga department machines:');
      if (sagaMachines?.length > 0) {
        sagaMachines.forEach(machine => {
          console.log(`  - ${machine.id}: ${machine.name}`);
        });
      } else {
        console.log('  No machines found in saga department');
      }
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testSagaSetup();
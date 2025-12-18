// Script para obtener IDs de puntos FastClock
// Ejecuta esto en la consola del navegador cuando estés autenticado

// Opción 1: Obtener todos los puntos de tu empresa
const getFastClockPoints = async () => {
  const { data, error } = await supabase
    .from('fastclock_points')
    .select('id, name, active, created_at')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('📍 Puntos FastClock encontrados:');
  console.table(data);
  
  if (data && data.length > 0) {
    console.log('\n🔗 URLs de FastClock:');
    data.forEach(point => {
      const url = `http://localhost:5173/fastclock/${point.id}`;
      console.log(`- ${point.name}: ${url}`);
    });
    
    // Devolver el primer punto activo
    const activePoint = data.find(p => p.active);
    if (activePoint) {
      console.log(`\n✅ Usa este punto activo: http://localhost:5173/fastclock/${activePoint.id}`);
      return activePoint.id;
    } else {
      console.log(`\n⚠️  No hay puntos activos. Usa este: http://localhost:5173/fastclock/${data[0].id}`);
      return data[0].id;
    }
  } else {
    console.log('❌ No se encontraron puntos. Crea uno desde /owner/fastclock');
  }
};

// Ejecutar
getFastClockPoints();


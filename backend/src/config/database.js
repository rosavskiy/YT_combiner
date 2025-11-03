import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log('ℹ️ MongoDB отключена (переменная MONGODB_URI не задана). Приложение работает без MongoDB.');
    return;
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB подключена: ${conn.connection.host}`);
  } catch (error) {
    console.error('⚠️  MongoDB не подключена:', error.message);
    console.log('💡 Приложение будет работать без сохранения данных');
    console.log('💡 Установите MongoDB или используйте MongoDB Atlas и задайте MONGODB_URI');
    // Не останавливаем приложение, позволяем работать без БД
  }
}

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB отключена');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Ошибка MongoDB:', err);
});

export default connectDB;

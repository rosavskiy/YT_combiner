import mongoose from 'mongoose';

export async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yt_combiner');

    console.log(`✅ MongoDB подключена: ${conn.connection.host}`);
  } catch (error) {
    console.error('⚠️  MongoDB не подключена:', error.message);
    console.log('💡 Приложение будет работать без сохранения данных');
    console.log('💡 Для включения БД установите MongoDB или используйте MongoDB Atlas');
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

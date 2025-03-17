import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import routes from './routes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const connectDB = async () => {
  try {
      await mongoose.connect(process.env.MONGO_URI, {
          serverSelectionTimeoutMS: 5000  // ✅ Prevent long connection issues
      });
      console.log('✅ MongoDB Connected Successfully!');
  } catch (error) {
      console.error('❌ MongoDB Connection Failed:', error.message);
      process.exit(1);
  }
};

connectDB();
app.use('/api', routes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));


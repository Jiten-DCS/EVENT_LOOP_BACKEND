const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Mongoose connection options - MINIMAL & COMPATIBLE
    const options = {
      // Essential connection settings only
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
    
    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('📡 Mongoose connected to MongoDB');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('📴 Mongoose disconnected from MongoDB');
    });
    
    // Handle connection interruption in production
    if (process.env.NODE_ENV === 'production') {
      mongoose.connection.on('disconnected', () => {
        console.log('🔄 Attempting to reconnect to MongoDB...');
        setTimeout(() => {
          mongoose.connect(process.env.MONGO_URI, options);
        }, 5000);
      });
    }
    
    return conn;
    
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    
    // Exit process with failure if in production
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    
    throw err;
  }
};

module.exports = connectDB;
'use strict';

const mongoose = require('mongoose');

let connected = false;

async function connectMongo() {
  if (connected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in environment.');
  await mongoose.connect(uri);
  connected = true;
  console.log('[mongo] Connected to MongoDB Atlas');
}

mongoose.connection.on('error', (err) => {
  console.error('[mongo] Connection error:', err.message);
  connected = false;
});

module.exports = { connectMongo };

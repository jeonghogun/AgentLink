import { seedData } from './seed-data.js';

seedData()
  .then(() => {
    console.info('Seed data inserted successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to seed Firestore data', error);
    process.exit(1);
  });

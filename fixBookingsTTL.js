// // fixBookingsTTL.js
// const mongoose = require("mongoose");

// const MONGO_URI =
//     "mongodb+srv://jitenmohantyay:x89pceIGceXKHBYE@cluster0.stnhp2r.mongodb.net/eventloop";
// // ⬆️ Replace with your MongoDB URI

// async function removeTTLIndexes() {
//     try {
//         await mongoose.connect(MONGO_URI, {
//             useNewUrlParser: true,
//             useUnifiedTopology: true,
//         });

//         const db = mongoose.connection.db;
//         const collection = db.collection("bookings");

//         // Get all indexes
//         const indexes = await collection.indexes();
//         console.log("Current indexes:", indexes);

//         for (const index of indexes) {
//             if (index.expireAfterSeconds) {
//                 console.log(`Dropping TTL index: ${index.name}`);
//                 await collection.dropIndex(index.name);
//             }
//         }

//         console.log("✅ TTL indexes removed from bookings collection");
//         await mongoose.disconnect();
//     } catch (err) {
//         console.error("Error removing TTL indexes:", err);
//         process.exit(1);
//     }
// }

// removeTTLIndexes();

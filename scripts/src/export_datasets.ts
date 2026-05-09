import { db } from "@workspace/db";
import { usersTable, roomsTable, interactionsTable } from "@workspace/db";
import fs from "fs";
import path from "path";

async function exportDatasets() {
  console.log("Exporting datasets from database...");

  // Export users
  const users = await db.select().from(usersTable);
  const usersCsv = users.map(u => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName || '',
    email: u.email,
    phone: u.phone || '',
    role: u.role,
    isVerified: u.isVerified,
    verificationStatus: u.verificationStatus,
    profilePhoto: u.profilePhoto || '',
    bio: u.bio || '',
    preferredCity: u.preferredCity || '',
    passwordHash: u.passwordHash || '',
    createdAt: u.createdAt?.toISOString() || '',
  }));

  // Export rooms
  const rooms = await db.select().from(roomsTable);
  const roomsCsv = rooms.map(r => ({
    id: r.id,
    ownerId: r.ownerId,
    title: r.title,
    description: r.description || '',
    price: r.price,
    roomType: r.roomType,
    tenantType: r.tenantType,
    city: r.city,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    parking: r.parking,
    amenities: JSON.stringify(r.amenities), // array to string
    photos: JSON.stringify(r.photos),
    isVerified: r.isVerified,
    isAvailable: r.isAvailable,
    nearbyLandmarks: JSON.stringify(r.nearbyLandmarks),
    createdAt: r.createdAt?.toISOString() || '',
  }));

  // Export interactions
  const interactions = await db.select().from(interactionsTable);
  const interactionsCsv = interactions.map(i => ({
    id: i.id,
    userId: i.userId,
    roomId: i.roomId,
    type: i.type,
    createdAt: i.createdAt?.toISOString() || '',
  }));

  // Write to CSV
  const datasetsDir = path.join(__dirname, '../../services/ml/datasets');

  // Simple CSV writer
  function toCsv(data: any[]) {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(','));
    return [headers.join(','), ...rows].join('\n');
  }

  fs.writeFileSync(path.join(datasetsDir, 'users.csv'), toCsv(usersCsv));
  fs.writeFileSync(path.join(datasetsDir, 'rooms.csv'), toCsv(roomsCsv));
  fs.writeFileSync(path.join(datasetsDir, 'interactions.csv'), toCsv(interactionsCsv));

  console.log(`Exported ${users.length} users, ${rooms.length} rooms, ${interactions.length} interactions`);
}

exportDatasets().catch(console.error);
// Fixed hanger categories -- matches the CHECK constraint added in
// db/62-campus-reviews-events-fabric-categories-admin-realtime.sql.
// Shared between AdminFabricLibrary.tsx (create/edit + filter pills) and
// FabricLibrarySection.tsx (category badge on distributed hangers).
export const FABRIC_CATEGORIES = [
  'Knit', 'Woven', 'Denim', 'Non-Woven', 'Dyed', 'Printed', 'Embroidered', 'Blended', 'Other',
] as const;

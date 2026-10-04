export const CATEGORIES = [
  "electronics",
  "books",
  "bags",
  "bottles",
  "keys",
  "id_cards",
  "clothing",
  "accessories",
  "stationery",
  "other",
] as const;

export const COLORS = [
  "black",
  "white",
  "gray",
  "silver",
  "blue",
  "red",
  "green",
  "yellow",
  "orange",
  "pink",
  "purple",
  "brown",
  "multicolor",
  "other",
] as const;

export const LOCATIONS = [
  "main_gate",
  "library",
  "canteen",
  "computer_lab",
  "classroom_block",
  "laboratory_block",
  "auditorium",
  "sports_area",
  "parking_area",
  "hostel",
  "other",
] as const;

export const MATCH_THRESHOLD = 60;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const REPORT_IMAGE_BUCKET = "report-images";

export const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  electronics: "Electronics",
  books: "Books",
  bags: "Bags",
  bottles: "Bottles",
  keys: "Keys",
  id_cards: "ID Cards",
  clothing: "Clothing",
  accessories: "Accessories",
  stationery: "Stationery",
  other: "Other",
};

export const COLOR_LABELS: Record<(typeof COLORS)[number], string> = {
  black: "Black",
  white: "White",
  gray: "Gray",
  silver: "Silver",
  blue: "Blue",
  red: "Red",
  green: "Green",
  yellow: "Yellow",
  orange: "Orange",
  pink: "Pink",
  purple: "Purple",
  brown: "Brown",
  multicolor: "Multicolor",
  other: "Other",
};

export const LOCATION_LABELS: Record<(typeof LOCATIONS)[number], string> = {
  main_gate: "Main Gate",
  library: "Library",
  canteen: "Canteen",
  computer_lab: "Computer Lab",
  classroom_block: "Classroom Block",
  laboratory_block: "Laboratory Block",
  auditorium: "Auditorium",
  sports_area: "Sports Area",
  parking_area: "Parking Area",
  hostel: "Hostel",
  other: "Other",
};

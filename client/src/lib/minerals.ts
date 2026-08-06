import { MineralType } from "../api/types";

// Ordered list for <select> options; mirrors the MineralType enum in schema.prisma.
export const mineralTypes: MineralType[] = [
  "GOLD",
  "PLATINUM_GROUP_METALS",
  "DIAMOND",
  "COAL",
  "IRON_ORE",
  "CHROME",
  "MANGANESE",
  "COPPER",
  "ZINC",
  "NICKEL",
  "URANIUM",
  "COBALT",
  "LIMESTONE",
  "SAND_AND_AGGREGATE",
  "OTHER",
];

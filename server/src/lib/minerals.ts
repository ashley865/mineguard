import { z } from "zod";

// Mirrors the MineralType enum in schema.prisma. Kept in one place so the
// production and marketplace routes validate against the exact same commodity list.
export const mineralTypeEnum = z.enum([
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
]);

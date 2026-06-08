/**
 * Mineral seed data — pilot catalog for Phase 5.
 *
 * Iron Ore (Odisha), Limestone, Manganese Ore.
 * Seeded on module init if the minerals table is empty.
 */
export interface MineralSeed {
  name: string;
  category: string;
  hsnCode: string;
  defaultUnit: string;
  gradeParams: Record<string, { min: number; max: number; unit: string }>;
}

export const MINERAL_SEEDS: MineralSeed[] = [
  {
    name: 'Iron Ore',
    category: 'Metallic',
    hsnCode: '2601.11',
    defaultUnit: 'MT',
    gradeParams: {
      'Fe%': { min: 0, max: 100, unit: '%' },
      'moisture%': { min: 0, max: 20, unit: '%' },
      'silica%': { min: 0, max: 30, unit: '%' },
      'alumina%': { min: 0, max: 20, unit: '%' },
    },
  },
  {
    name: 'Limestone',
    category: 'Non-Metallic',
    hsnCode: '2521.00',
    defaultUnit: 'MT',
    gradeParams: {
      'CaCO3%': { min: 0, max: 100, unit: '%' },
      'MgO%': { min: 0, max: 30, unit: '%' },
      'silica%': { min: 0, max: 20, unit: '%' },
    },
  },
  {
    name: 'Manganese Ore',
    category: 'Metallic',
    hsnCode: '2602.00',
    defaultUnit: 'MT',
    gradeParams: {
      'Mn%': { min: 0, max: 100, unit: '%' },
      'Fe%': { min: 0, max: 50, unit: '%' },
      'P%': { min: 0, max: 5, unit: '%' },
    },
  },
  {
    name: 'Granite (Dimensional Stone)',
    category: 'Minor Mineral',
    hsnCode: '6802.93',
    defaultUnit: 'MT',
    gradeParams: {
      'density': { min: 2.5, max: 3.0, unit: 'g/cm³' },
      'waterAbsorption%': { min: 0, max: 1, unit: '%' },
    },
  },
  {
    name: 'Chromite',
    category: 'Metallic',
    hsnCode: '2610.00',
    defaultUnit: 'MT',
    gradeParams: {
      'Cr2O3%': { min: 0, max: 60, unit: '%' },
      'Fe%': { min: 0, max: 30, unit: '%' },
      'silica%': { min: 0, max: 15, unit: '%' },
    },
  },
];

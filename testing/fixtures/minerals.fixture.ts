export const IRON_ORE = {
  id: 'mineral_iron_ore_01',
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
} as const;

export const LIMESTONE = {
  id: 'mineral_limestone_01',
  name: 'Limestone',
  category: 'Non-Metallic',
  hsnCode: '2521.00',
  defaultUnit: 'MT',
  gradeParams: {
    'CaCO3%': { min: 0, max: 100, unit: '%' },
    'MgO%': { min: 0, max: 30, unit: '%' },
    'silica%': { min: 0, max: 30, unit: '%' },
  },
} as const;

export const MANGANESE_ORE = {
  id: 'mineral_manganese_01',
  name: 'Manganese Ore',
  category: 'Metallic',
  hsnCode: '2602.00',
  defaultUnit: 'MT',
  gradeParams: {
    'Mn%': { min: 0, max: 100, unit: '%' },
    'Fe%': { min: 0, max: 50, unit: '%' },
    'P%': { min: 0, max: 5, unit: '%' },
  },
} as const;

export const CHROMITE = {
  id: 'mineral_chromite_01',
  name: 'Chromite',
  category: 'Metallic',
  hsnCode: '2610.00',
  defaultUnit: 'MT',
  gradeParams: {
    'Cr2O3%': { min: 0, max: 100, unit: '%' },
    'Fe%': { min: 0, max: 50, unit: '%' },
    'silica%': { min: 0, max: 20, unit: '%' },
  },
} as const;

export const ALL_MINERALS = [IRON_ORE, LIMESTONE, MANGANESE_ORE, CHROMITE] as const;

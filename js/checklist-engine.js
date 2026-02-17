/**
 * Checklist Engine — the core business logic.
 * v2: Added client requirements dimension and equipment list builder.
 * Takes a set of job characteristics (+ client name) and produces
 * a deduplicated, categorised checklist by unioning all mapped items.
 */

let characteristicsData = null;
let checklistItemsData = null;
let characteristicMapData = null;
let clientRequirementsData = null;
let equipmentItemsData = null;
let equipmentMapData = null;

export async function loadData() {
  if (!characteristicsData) {
    const [chars, items, map, clientReqs, eqItems, eqMap] = await Promise.all([
      fetch('/data/characteristics.json').then(r => r.json()),
      fetch('/data/checklist-items.json').then(r => r.json()),
      fetch('/data/characteristic-map.json').then(r => r.json()),
      fetch('/data/client-requirements.json').then(r => r.json()),
      fetch('/data/equipment-items.json').then(r => r.json()),
      fetch('/data/equipment-map.json').then(r => r.json())
    ]);
    characteristicsData = chars;
    checklistItemsData = items;
    characteristicMapData = map;
    clientRequirementsData = clientReqs;
    equipmentItemsData = eqItems;
    equipmentMapData = eqMap;
  }
  return { characteristicsData, checklistItemsData, characteristicMapData,
           clientRequirementsData, equipmentItemsData, equipmentMapData };
}

/**
 * Build a deduplicated checklist from job characteristics + client.
 * @param {string[]} jobCharacteristicIds - Characteristic IDs from the job
 * @param {string} [clientName] - Client name for client-specific items
 * @returns {Object[]} Sorted array of checklist items
 */
export async function buildChecklist(jobCharacteristicIds, clientName) {
  const { checklistItemsData, characteristicMapData, clientRequirementsData } = await loadData();

  const allItemIds = new Set();

  // 1. Union characteristic-based items
  for (const charId of jobCharacteristicIds) {
    const itemIds = characteristicMapData.mappings[charId] || [];
    for (const id of itemIds) allItemIds.add(id);
  }

  // 2. Union client-specific items
  if (clientName && clientRequirementsData.mappings[clientName]) {
    for (const id of clientRequirementsData.mappings[clientName]) {
      allItemIds.add(id);
    }
  }

  // 3. Look up full item details
  const itemsMap = new Map(checklistItemsData.items.map(i => [i.id, i]));
  const checklist = [];
  for (const id of allItemIds) {
    const item = itemsMap.get(id);
    if (item) checklist.push({ ...item });
  }

  // 4. Sort by category, then priority
  checklist.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.priority - b.priority;
  });

  return checklist;
}

/**
 * Build a deduplicated equipment list from job characteristics.
 * @param {string[]} jobCharacteristicIds - Characteristic IDs from the job
 * @returns {Object[]} Sorted array of equipment items
 */
export async function buildEquipmentList(jobCharacteristicIds) {
  const { equipmentItemsData, equipmentMapData } = await loadData();

  const allItemIds = new Set();
  for (const charId of jobCharacteristicIds) {
    const itemIds = equipmentMapData.mappings[charId] || [];
    for (const id of itemIds) allItemIds.add(id);
  }

  const itemsMap = new Map(equipmentItemsData.items.map(i => [i.id, i]));
  const equipment = [];
  for (const id of allItemIds) {
    const item = itemsMap.get(id);
    if (item) equipment.push({ ...item });
  }

  // Sort by category, then label
  equipment.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.label.localeCompare(b.label);
  });

  return equipment;
}

/**
 * Group items by category.
 * @param {Object[]} items - Flat array of items with a category field
 * @returns {Object[]} Array of { category, items } objects
 */
export function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  return Array.from(groups, ([category, items]) => ({ category, items }));
}

/**
 * Resolve characteristic IDs to their labels.
 * @param {string[]} charIds - Array of characteristic IDs
 * @returns {Object[]} Array of { id, label, tagClass }
 */
export async function resolveCharacteristics(charIds) {
  const { characteristicsData } = await loadData();
  const resolved = [];
  for (const cat of characteristicsData.categories) {
    for (const ch of cat.characteristics) {
      if (charIds.includes(ch.id)) {
        resolved.push({ id: ch.id, label: ch.label, tagClass: cat.tagClass });
      }
    }
  }
  return resolved;
}

import { escapeHtml } from '../ui/html.js';

export function renderBlockButtons(blocks, selectedZone) {
  const allCount = blocks.reduce((sum, block) => sum + block.count, 0);
  return [{ id: '', label: 'Все', count: allCount }, ...blocks].map((block) => `
    <button class="blockButton ${selectedZone === block.id ? 'active' : ''}"
      data-zone="${escapeHtml(block.id)}" type="button">
      <strong>${escapeHtml(block.label)}</strong>
      <span>${block.count}</span>
    </button>
  `).join('');
}

export function renderFloorButtons(floors, selectedFloor) {
  const allCount = floors.reduce((sum, floor) => sum + floor.count, 0);
  return [{ id: '', label: 'Все', count: allCount }, ...floors].map((floor) => `
    <button class="floorButton ${selectedFloor === floor.id ? 'active' : ''}"
      data-floor="${escapeHtml(floor.id)}" type="button">
      <strong>${escapeHtml(
        floor.id
          ? (floor.label === 'Без этажа' ? floor.label : `Этаж ${floor.label}`)
          : 'Все'
      )}</strong>
      <span>${floor.count}</span>
    </button>
  `).join('');
}

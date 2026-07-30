import { escapeHtml } from '../ui/html.js';
import { formatRoute, splitWbStickers } from '../utils/tasks.js';

export function renderTaskCards(state) {
  return state.tasks.map((task, index) => {
    const stickers = splitWbStickers(task.wbSticker);
    const mainSticker = stickers[0] || task.wbSticker || '—';
    return `
      <button class="taskCard ${state.selectedToken === task.taskToken ? 'selected' : ''}"
        data-task-token="${escapeHtml(task.taskToken)}" type="button">
        <div class="cardHeader">
          <div>
            <span class="cardLabel">WB-стикер</span>
            <strong class="wbSticker">${escapeHtml(mainSticker)}</strong>
          </div>
          <span class="zoneBadge">${escapeHtml(task.zone || '—')}</span>
        </div>
        <div class="cardMx">
          <span>MX</span>
          <strong>${escapeHtml(task.mx || '—')}</strong>
        </div>
        <h3>${escapeHtml(task.itemName || 'Без наименования')}</h3>
        <div class="routeLine">${escapeHtml(formatRoute(task))}</div>
        <div class="cardFacts">
          ${task.itemId ? `<span>ID ${escapeHtml(task.itemId)}</span>` : ''}
          ${task.box ? `<span>BOX ${escapeHtml(task.box)}</span>` : ''}
          ${task.timeFilled ? `<span>${escapeHtml(task.timeFilled)}</span>` : ''}
          <span>${escapeHtml(task.statusSearch || 'Поиск')}</span>
          ${task.photoCount ? `<span class="photoFact">Фото ${task.photoCount}</span>` : ''}
        </div>
        <div class="routeIndex">Маршрут ${index + 1} из ${state.filteredCount}</div>
      </button>
    `;
  }).join('');
}

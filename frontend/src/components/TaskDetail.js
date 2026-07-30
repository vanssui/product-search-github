import { escapeHtml } from '../ui/html.js';
import { formatRoute, splitWbStickers } from '../utils/tasks.js';

export function buildTaskDetailView(task) {
  const badgesHtml = [
    task.zone && `<span class="zoneBadge">${escapeHtml(task.zone)}</span>`,
    task.statusSearch && `<span>${escapeHtml(task.statusSearch)}</span>`,
    task.itemStatus && `<span>${escapeHtml(task.itemStatus)}</span>`,
    task.photoCount && `<span class="photoFact">Фото ${task.photoCount}</span>`
  ].filter(Boolean).join('');

  const details = [
    ['WB-стикер', task.wbSticker],
    ['Товар / ID', task.itemId],
    ['BOX', task.box],
    ['Этаж', task.floor],
    ['Ряд', task.row],
    ['Место', task.place],
    ['Полка', task.shelf],
    ['Ячейка', task.cell],
    ['Время', task.timeFilled],
    ['ID сотрудника', task.employeeId || 'Свободно'],
    ['ID сборщика', task.pickerId],
    ['Действие', task.action],
    ['Комментарий', task.comment],
    ['Дата выгрузки', task.createdAt]
  ];

  return {
    source: task.zone || 'Задание',
    sticker: splitWbStickers(task.wbSticker)[0] || task.wbSticker || '—',
    name: task.itemName || 'Без наименования',
    mx: task.mx || '—',
    route: formatRoute(task),
    badgesHtml,
    gridHtml: details.map(([label, value]) => `
      <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd></div>
    `).join('')
  };
}

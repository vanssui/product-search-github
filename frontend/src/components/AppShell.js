export function renderAppShell() {
  return `
    <div class="appShell">
      <header class="appHeader">
        <div>
          <p class="brand">Поиск товаров</p>
          <h1>Активные задания</h1>
        </div>
        <div class="headerActions">
          <span class="connection" id="connection">Подключение…</span>
          <button class="employeeButton" id="employeeButton" type="button">Указать ID</button>
          <button class="iconButton" id="refreshButton" type="button" aria-label="Обновить">↻</button>
        </div>
      </header>

      <section class="filterPanel" aria-label="Фильтры заданий">
        <label class="searchBox">
          <span aria-hidden="true">⌕</span>
          <input id="searchInput" type="search" autocomplete="off"
            placeholder="WB-стикер, товар, MX или BOX">
        </label>
        <div class="blockGrid" id="blockGrid"></div>
        <div class="quickFilters">
          <button class="filterButton" id="myTasksButton" type="button">Мои задания</button>
          <button class="filterButton" id="photoFilterButton" type="button">С фото</button>
        </div>
        <div class="floorSection">
          <div class="sectionLabel">Этаж</div>
          <div class="floorGrid" id="floorGrid"></div>
        </div>
      </section>

      <section class="summaryBar">
        <div><strong id="filteredMetric">0</strong><span>в фильтре</span></div>
        <div><strong id="totalMetric">0</strong><span>в поиске</span></div>
        <div><strong id="floorMetric">0</strong><span>этажей</span></div>
        <div><strong id="photoMetric">0</strong><span>с фото</span></div>
        <p id="updatedText">Загрузка данных…</p>
      </section>

      <div class="workspace">
        <main class="catalogPane">
          <div id="notice"></div>
          <div class="catalogHeading">
            <div>
              <p class="sectionLabel" id="catalogEyebrow">Все блоки</p>
              <h2 id="catalogTitle">Задания</h2>
            </div>
            <span class="readOnlyBadge">Только чтение</span>
          </div>
          <div class="taskList" id="taskList" aria-live="polite"></div>
          <button class="loadMoreButton" id="loadMoreButton" type="button" hidden>
            Показать ещё
          </button>
        </main>

        <aside class="detailPane" id="detailPane" aria-label="Детали задания">
          <div class="detailEmpty" id="detailEmpty">
            <div class="emptyIcon">↗</div>
            <h2>Выберите задание</h2>
            <p>Карточка откроется здесь. На телефоне — отдельным удобным экраном.</p>
          </div>
          <article class="taskDetail" id="taskDetail" hidden>
            <header class="detailHeader">
              <div>
                <p class="sectionLabel" id="detailSource"></p>
                <h2 id="detailSticker"></h2>
              </div>
              <button class="iconButton" id="closeDetailButton" type="button" aria-label="Закрыть">×</button>
            </header>
            <h3 id="detailName"></h3>
            <div class="detailBadges" id="detailBadges"></div>
            <div class="mxHero">
              <span>MX</span>
              <strong id="detailMx"></strong>
              <small id="detailRoute"></small>
            </div>
            <dl class="detailGrid" id="detailGrid"></dl>
            <section class="photoPanel">
              <div class="photoHeader">
                <div><span>Фото задания</span><strong id="photoCountLabel">0</strong></div>
                <span>Загружаются только по нажатию</span>
              </div>
              <div class="photoList" id="photoList"></div>
            </section>
            <div class="readOnlyNotice">
              Данные подключены к production в безопасном режиме чтения.
              Операции записи будут включены только после отдельной проверки.
            </div>
            <div class="actionGrid">
              <button class="primaryAction" type="button" disabled>Взять</button>
              <button type="button" disabled>Освободить</button>
              <button type="button" disabled>Добавить фото</button>
              <button class="successAction" type="button" disabled>Найдено</button>
              <button class="dangerAction" type="button" disabled>Не найдено</button>
              <button class="primaryAction wide" type="button" disabled>Завершить</button>
            </div>
          </article>
        </aside>
      </div>
    </div>

    <div class="detailBackdrop" id="detailBackdrop" hidden></div>

    <div class="profileModal" id="profileModal" hidden>
      <form class="profileCard" id="profileForm">
        <p class="sectionLabel">Исполнитель</p>
        <h2>Укажите ID</h2>
        <p>ID нужен для фильтра «Мои задания» и будущих рабочих действий.</p>
        <label>ID сотрудника
          <input id="employeeInput" maxlength="64" autocomplete="username" placeholder="Например E017">
        </label>
        <div class="profileActions">
          <button type="button" id="cancelProfileButton">Отмена</button>
          <button class="primaryAction" type="submit">Сохранить</button>
        </div>
      </form>
    </div>

    <div class="photoViewer" id="photoViewer" hidden>
      <button class="photoViewerClose" id="photoViewerClose" type="button" aria-label="Закрыть">×</button>
      <div class="photoViewerBody" id="photoViewerBody"></div>
    </div>
  `;
}

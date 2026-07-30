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
          <button class="employeeButton" id="reportButton" type="button">Отчёт</button>
          <button class="employeeButton" id="idStatsButton" type="button">Статистика ID</button>
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
            <span class="readOnlyBadge" id="modeBadge">Проверка доступа…</span>
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
                <div class="photoActions">
                  <button type="button" id="pastePhotoButton">Вставить</button>
                  <button type="button" id="galleryPhotoButton">Галерея</button>
                  <button type="button" id="cameraPhotoButton">Камера</button>
                </div>
              </div>
              <input id="galleryPhotoInput" type="file" accept="image/*" hidden>
              <input id="cameraPhotoInput" type="file" accept="image/*" capture="environment" hidden>
              <div class="photoStatus" id="photoStatus"></div>
              <div class="photoList" id="photoList"></div>
            </section>
            <div class="detailMessage" id="detailMessage" aria-live="polite"></div>
            <div class="actionGrid">
              <button class="successAction" id="foundButton" type="button">Найдено</button>
              <button class="dangerAction" id="notFoundButton" type="button">Не найдено</button>
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
        <p>ID сотрудника записывается при результате «Найдено» или «Не найдено».</p>
        <label>ID сотрудника
          <input id="employeeInput" maxlength="64" autocomplete="username" placeholder="Например E017">
        </label>
        <div class="profileMessage" id="profileMessage"></div>
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

    <div class="utilityModal" id="reportModal" hidden>
      <section class="utilityCard" role="dialog" aria-modal="true" aria-labelledby="reportTitle">
        <header>
          <div>
            <p class="sectionLabel">Помощник отчёта</p>
            <h2 id="reportTitle">Отчёт по поиску</h2>
          </div>
          <button class="iconButton" id="reportCloseButton" type="button" aria-label="Закрыть">×</button>
        </header>
        <p>Вставьте строки из Google Sheets. Расчёт выполняется в браузере, как в исходном приложении.</p>
        <textarea id="reportInput" rows="9" placeholder="Вставьте TSV-строки"></textarea>
        <div class="utilityActions">
          <button id="reportClearButton" type="button">Очистить</button>
          <button id="reportCopyButton" type="button">Копировать</button>
          <button class="primaryAction" id="reportCalculateButton" type="button">Посчитать</button>
        </div>
        <div class="utilityMessage" id="reportMessage"></div>
        <pre class="utilityOutput" id="reportOutput"></pre>
      </section>
    </div>

    <div class="utilityModal" id="idStatsModal" hidden>
      <section class="utilityCard" role="dialog" aria-modal="true" aria-labelledby="idStatsTitle">
        <header>
          <div>
            <p class="sectionLabel">Статистика ID</p>
            <h2 id="idStatsTitle">Повторения сотрудников</h2>
          </div>
          <button class="iconButton" id="idStatsCloseButton" type="button" aria-label="Закрыть">×</button>
        </header>
        <div class="modeSwitch" id="idStatsModes">
          <button class="active" data-id-mode="all" type="button">Все ID</button>
          <button data-id-mode="found" type="button">Только найдено</button>
          <button data-id-mode="missing" type="button">Только не найдено</button>
        </div>
        <textarea id="idStatsInput" rows="9" placeholder="Вставьте ID или строки таблицы"></textarea>
        <div class="utilityActions">
          <button id="idStatsClearButton" type="button">Очистить</button>
          <button id="idStatsCopyButton" type="button">Копировать</button>
          <button class="primaryAction" id="idStatsCalculateButton" type="button">Посчитать</button>
        </div>
        <div class="utilityMessage" id="idStatsMessage"></div>
        <div class="idStatsSummary" id="idStatsSummary"></div>
        <div class="idStatsOutput" id="idStatsOutput"></div>
      </section>
    </div>

    <div class="loadingOverlay" id="loadingOverlay" hidden role="status" aria-live="polite">
      <div class="loadingBox">
        <span class="loadingSpinner" aria-hidden="true"></span>
        <strong id="loadingText">Загрузка…</strong>
      </div>
    </div>
    <div class="toastStack" id="toastStack" aria-live="polite"></div>
  `;
}

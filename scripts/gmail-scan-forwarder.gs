/**
 * Пересылка сканов накладных из Gmail в Lokmaco.
 *
 * Зачем это вообще нужно: Gmail не умеет вызывать вебхуки — он не может сам
 * постучаться на сайт. Поэтому забирать письма приходится изнутри почты.
 * Apps Script живёт в том же аккаунте, ему не нужны ни свой домен, ни
 * OAuth-приложение, ни пароль приложения — только один раз разрешить доступ.
 *
 * КАК ПОСТАВИТЬ
 *  1. script.google.com → «Новый проект», вставить этот файл целиком.
 *  2. Заменить ENDPOINT и SECRET на свои (секрет — тот же, что в переменной
 *     INBOUND_SCAN_SECRET на Vercel).
 *  3. Запустить forwardScans() руками — Google попросит разрешение на доступ
 *     к почте, согласиться.
 *  4. Часы слева → «Триггеры» → добавить триггер: forwardScans, по времени,
 *     «Ежеминутный таймер». Минута — минимум, который даёт Google.
 *  5. «Развернуть» → «Новое развёртывание» → тип «Веб-приложение»,
 *     запуск от своего имени, доступ «Все». Скопировать выданный адрес и
 *     положить его в переменную GMAIL_SCRIPT_URL на Vercel.
 *
 * Пятый шаг — ради кнопки «Проверить почту» на странице прихода: она зовёт
 * скрипт напрямую, и скан подтягивается сразу, не дожидаясь таймера. Ждать
 * минуту, стоя у принтера, — ровно то, чего мы избегаем.
 */

// Адрес сайта. На проде — https://<ваш-домен>/api/inbound/scan
var ENDPOINT = 'https://ВАШ-САЙТ/api/inbound/scan';

// Тот же секрет, что в INBOUND_SCAN_SECRET.
var SECRET = 'ВСТАВЬТЕ_СЕКРЕТ';

/**
 * От кого принимать сканы. Пустой массив — принимать от всех.
 *
 * Ящик приёма — qweeqw489@gmail.com, а шлёт сюда принтер с отдельного адреса.
 * Фильтр обязателен: без него «накладную» на этот ящик подкинет кто угодно, и
 * она встанет в очередь наравне с настоящими.
 *
 * Сюда же можно дописать личный адрес: тогда письмо с фотографией, посланное
 * себе с телефона, тоже станет сканом — запасной путь, если принтер недоступен.
 */
var ALLOWED_SENDERS = ['asil.aminjonov.bp@gmail.com'];

/** Ярлык на разобранных письмах. Нужен человеку — видеть, что скрипт их взял. */
var DONE_LABEL = 'lokmaco-отправлено';

/** Где помним уже отправленные письма. Ярлыком обойтись нельзя, см. ниже. */
var SEEN_KEY = 'lokmaco_seen_messages';

/** Сколько дней помнить отправленные письма. Больше окна поиска — с запасом. */
var SEEN_DAYS = 7;

/**
 * Письма, которые уже уехали на сайт.
 *
 * ⚠️ Считаем ПИСЬМАМИ, а не цепочками. Ярлык Gmail вешается на всю цепочку, а
 * принтер шлёт все сканы с одной и той же темой — Gmail складывает их в одну
 * цепочку. Из-за этого второй скан навсегда выпадал из поиска: на цепочке уже
 * висел ярлык, `-label:` её отсекал, и журнал показывал ноль писем при живом
 * письме в ящике.
 */
function loadSeen() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(SEEN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    Logger.log('память об отправленных не прочиталась, начинаем с чистой: ' + err);
    return {};
  }
}

function saveSeen(seen) {
  var edge = Date.now() - SEEN_DAYS * 24 * 60 * 60 * 1000;
  var fresh = {};
  for (var id in seen) {
    if (seen[id] > edge) fresh[id] = seen[id];
  }
  PropertiesService.getScriptProperties().setProperty(SEEN_KEY, JSON.stringify(fresh));
}

function forwardScans() {
  var label = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  var seen = loadSeen();
  var sent = 0;
  var skippedSeen = 0;

  // ⚠️ Намеренно без `is:unread`. Этот признак ненадёжен: письмо, посланное
  // с того же ящика, Gmail помечает прочитанным сразу, и скрипт молча ничего
  // не находил бы.
  //
  // ⚠️ И намеренно без `-label:`. Ярлык живёт на цепочке целиком, а сканы от
  // принтера идут одной темой и попадают в одну цепочку — второй скан такой
  // фильтр выкидывал вместе с первым. От дублей защищает список отправленных
  // писем (см. loadSeen), он считает письмами, а не цепочками.
  //
  // Окно в двое суток — чтобы после долгого простоя не разбирать всю почту.
  // ⚠️ `in:anywhere` обязателен. Письма от принтера Gmail охотно кладёт в
  // Спам: отправитель незнакомый, тема служебная, вложение картинкой. Без
  // этого куска поиск смотрит только обычную почту и честно находит ноль —
  // так и вышло при первом запуске.
  var query = 'has:attachment newer_than:2d in:anywhere';
  var threads = GmailApp.search(query, 0, 20);

  // Отчитываемся всегда, даже когда делать нечего. Молчаливый запуск не
  // отличить от сломанного: «Execution completed» и пустой журнал выглядят
  // одинаково и когда всё хорошо, и когда фильтр отсекает вообще всё.
  Logger.log('Запрос: ' + query);
  Logger.log('Найдено писем с вложениями: ' + threads.length);
  if (threads.length === 0) {
    Logger.log('Нечего отправлять. Это нормально, если скана ещё не было.');
    Logger.log('Если скан точно приходил — проверьте, что письмо не старше двух суток.');
    Logger.log('Поиск идёт и по Спаму тоже (in:anywhere). Подробности покажет diagnose().');
  }

  var skippedBySender = 0;
  var skippedNoImages = 0;

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      var from = message.getFrom();
      var msgId = message.getId();

      if (seen[msgId]) {
        skippedSeen++;
        return;
      }

      if (ALLOWED_SENDERS.length > 0 && !matchesSender(from)) {
        skippedBySender++;
        Logger.log('пропущено (чужой отправитель): ' + from);
        return;
      }

      var atts = message.getAttachments();
      var images = atts.filter(isImage);
      if (images.length === 0) {
        skippedNoImages++;
        atts.forEach(function (a) {
          Logger.log('пропущено вложение: ' + a.getName() + ' [' + a.getContentType() + '] ' +
            Math.round(a.getSize() / 1024) + ' KB — не распознано как картинка');
        });
        return;
      }

      var payload = {
        from: from,
        subject: message.getSubject(),
        attachments: images.map(function (a) {
          var mime = imageMime(a);
          var fname = a.getName() || 'scan';
          // Сайт проверяет и тип, и расширение — если имя без него, дописываем,
          // иначе вложение отобьётся уже на той стороне.
          if (!/\.(jpe?g|png|webp)$/i.test(fname)) {
            fname += mime === 'image/png' ? '.png' : '.jpg';
          }
          return { filename: fname, contentType: mime, content: Utilities.base64Encode(a.getBytes()) };
        }),
      };

      var res = UrlFetchApp.fetch(ENDPOINT + '?secret=' + encodeURIComponent(SECRET), {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      // ⚠️ Помечаем обработанным только когда сайт РЕАЛЬНО сохранил скан.
      // Раньше хватало ответа 200 — и письма, на которых сайт ответил
      // «принял, но сохранить не смог», навсегда выпадали из обработки:
      // ярлык стоит, скана нет, и следов не найти.
      var body = {};
      try { body = JSON.parse(res.getContentText()); } catch (parseErr) { body = {}; }
      var reallySaved = res.getResponseCode() === 200 && Number(body.saved) > 0;

      if (body.skipped) Logger.log('сайт пропустил вложения: ' + JSON.stringify(body.skipped));

      if (reallySaved) {
        // Письмо — в память (защита от дублей), ярлык — на цепочку (человеку
        // видно, что скрипт тут был). Поиск по ярлыку больше не фильтрует.
        seen[msgId] = Date.now();
        saveSeen(seen);
        thread.addLabel(label);
        // Вытаскиваем из спама: письма оттуда Gmail сам удаляет через 30 дней,
        // а нам скан нужен как подтверждение прихода. Заодно Gmail постепенно
        // перестанет считать этого отправителя спамом.
        try { thread.moveToInbox(); } catch (moveErr) { Logger.log('из спама не достали: ' + moveErr); }
        sent += Number(body.saved);
        Logger.log('сохранено на сайте: ' + message.getSubject() + ' → ' + res.getContentText());
      } else {
        // Ярлык не ставим: на следующем запуске попробуем ещё раз. Именно это
        // и нужно, когда сайт временно не может писать в хранилище.
        Logger.log('НЕ СОХРАНЕНО (' + res.getResponseCode() + '): ' + res.getContentText());
      }
    });
  });

  if (skippedBySender > 0) {
    Logger.log('Отсеяно по отправителю: ' + skippedBySender +
      '. Разрешены: ' + (ALLOWED_SENDERS.join(', ') || 'все'));
  }
  if (skippedNoImages > 0) Logger.log('Писем без картинок во вложениях: ' + skippedNoImages);
  if (skippedSeen > 0) Logger.log('Уже отправляли раньше, пропущено писем: ' + skippedSeen);
  Logger.log('ИТОГО отправлено сканов: ' + sent);

  return sent;
}

function matchesSender(from) {
  var lower = String(from).toLowerCase();
  return ALLOWED_SENDERS.some(function (allowed) {
    return lower.indexOf(String(allowed).toLowerCase()) !== -1;
  });
}

/**
 * Картинка ли это.
 *
 * ⚠️ По типу и имени судить нельзя. Почтовые шлюзы сплошь и рядом ставят
 * `application/octet-stream`, а имя приходит без расширения — так и вышло с
 * настоящим сканом: файл был JPEG, а скрипт его пропускал. Поэтому последнее
 * слово за содержимым: у JPEG первые байты FF D8 FF, у PNG — 89 50 4E 47.
 */
function isImage(attachment) {
  var type = String(attachment.getContentType() || '').toLowerCase();
  var name = String(attachment.getName() || '').toLowerCase();

  if (type.indexOf('image/') === 0) return true;
  if (/\.(jpe?g|png|webp)$/.test(name)) return true;

  try {
    var b = attachment.getBytes();
    if (b.length < 4) return false;
    // getBytes отдаёт знаковые байты: 0xFF приходит как -1.
    var u = [b[0] & 0xff, b[1] & 0xff, b[2] & 0xff, b[3] & 0xff];
    if (u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return true;               // JPEG
    if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return true; // PNG
  } catch (err) {
    Logger.log('не смогли заглянуть внутрь вложения: ' + err);
  }
  return false;
}

/** Определяем тип по содержимому — почтовый шлюз мог соврать. */
function imageMime(attachment) {
  var type = String(attachment.getContentType() || '').toLowerCase();
  if (type.indexOf('image/') === 0) return type.split(';')[0];
  try {
    var b = attachment.getBytes();
    var u = [b[0] & 0xff, b[1] & 0xff, b[2] & 0xff, b[3] & 0xff];
    if (u[0] === 0x89 && u[1] === 0x50) return 'image/png';
  } catch (err) { /* ниже отдадим jpeg */ }
  return 'image/jpeg';
}

/**
 * Разовая проверка связи. Запускать ПЕРВОЙ: она проверяет адрес и секрет,
 * не трогая почту. Ждём в журнале `200 {"ok":true,"saved":0,...}`.
 *
 * 403 — секрет не совпал с тем, что в переменной INBOUND_SCAN_SECRET.
 * 503 — переменная на сайте вообще не задана.
 * 404 — неверный адрес в ENDPOINT.
 */
function testConnection() {
  var res = UrlFetchApp.fetch(ENDPOINT + '?secret=' + encodeURIComponent(SECRET), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ from: 'тест', subject: 'проверка связи', attachments: [] }),
    muteHttpExceptions: true,
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}

/**
 * Забыть, какие письма уже отправляли, и снять ярлыки за неделю.
 *
 * Нужна ровно в одном случае: скан застрял на сайте или его удалили, а письмо
 * надо прогнать заново. Дальше forwardScans() возьмёт его как новое —
 * значит, скан приедет ещё раз, и лишний придётся убрать из очереди руками.
 */
function resetSeen() {
  PropertiesService.getScriptProperties().deleteProperty(SEEN_KEY);
  var label = GmailApp.getUserLabelByName(DONE_LABEL);
  if (label) {
    var threads = GmailApp.search('label:' + DONE_LABEL + ' newer_than:7d in:anywhere', 0, 50);
    threads.forEach(function (t) { t.removeLabel(label); });
    Logger.log('Снят ярлык с цепочек: ' + threads.length);
  }
  Logger.log('Память об отправленных письмах очищена — всё за двое суток уедет заново.');
}

/**
 * Точка входа для сайта: кнопка «Проверить почту» на странице прихода зовёт
 * этот адрес и получает скан немедленно.
 *
 * ⚠️ Веб-приложение открыто всем, кто знает ссылку, — иначе Google требует
 * вход в аккаунт, и сайт позвать его не сможет. Поэтому секрет обязателен:
 * без него ссылка сама по себе даёт запустить разбор почты.
 */
function doGet(e) {
  var given = (e && e.parameter && e.parameter.secret) || '';
  if (given !== SECRET) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'forbidden' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var sent = 0;
  try {
    sent = forwardScans();
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, sent: sent }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Диагностика: показывает, что скрипт ВИДИТ в почте, ничего не отправляя.
 *
 * Нужна, когда письмо в ящике есть, а `forwardScans` его «не находит».
 * Причин ровно четыре, и все они видны в выводе: письмо старше двух суток, на
 * нём уже висит ярлык обработки, отправитель не тот, либо вложение не
 * картинка (МФУ часто шлёт PDF, хотя в настройках выбран JPEG).
 *
 * Запустить, скопировать журнал целиком — по нему сразу понятно, что чинить.
 */
function diagnose() {
  var seen = loadSeen();
  Logger.log('=== ЧТО ВИДИТ СКРИПТ ===');
  Logger.log('Разрешённые отправители: ' + (ALLOWED_SENDERS.join(', ') || '(любые)'));
  Logger.log('Ярлык обработанных: ' + DONE_LABEL + ' (на поиск больше не влияет)');
  Logger.log('Помним отправленных писем: ' + Object.keys(seen).length);

  // Ищем ШИРЕ рабочего запроса: без фильтра по ярлыку и с запасом по сроку.
  // Задача не отправить, а понять, что вообще лежит в ящике.
  var threads = GmailApp.search('has:attachment newer_than:7d in:anywhere', 0, 10);
  Logger.log('Писем с вложениями за 7 дней (включая спам): ' + threads.length);

  threads.forEach(function (thread, i) {
    var labels = thread.getLabels().map(function (l) { return l.getName(); });
    thread.getMessages().forEach(function (m) {
      Logger.log('--- письмо ' + (i + 1) + ' ---');
      Logger.log('от:      ' + m.getFrom());
      Logger.log('тема:    ' + m.getSubject());
      Logger.log('дата:    ' + m.getDate());
      Logger.log('ярлыки:  ' + (labels.join(', ') || '(нет)'));
      Logger.log('в спаме: ' + (thread.isInSpam() ? 'ДА' : 'нет'));

      var atts = m.getAttachments();
      Logger.log('вложений: ' + atts.length);
      atts.forEach(function (a) {
        Logger.log('   file: ' + a.getName() + ' [' + a.getContentType() + '] ' +
          Math.round(a.getSize() / 1024) + ' KB ' +
          (isImage(a) ? '<- подходит' : '<- НЕ КАРТИНКА, будет пропущено'));
      });

      // Прямо говорим, возьмёт скрипт это письмо или нет и почему.
      var why = [];
      if (ALLOWED_SENDERS.length > 0 && !matchesSender(m.getFrom())) why.push('отправитель не в списке разрешённых');
      if (seen[m.getId()]) why.push('это письмо уже отправляли (' + new Date(seen[m.getId()]) + ')');
      if (atts.filter(isImage).length === 0) why.push('нет вложений-картинок');
      Logger.log(why.length === 0 ? 'ВЕРДИКТ: письмо будет отправлено' : 'ВЕРДИКТ: пропустим - ' + why.join('; '));
    });
  });
}

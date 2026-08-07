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

/** Ярлык, которым помечаем разобранные письма — единственная защита от дублей. */
var DONE_LABEL = 'lokmaco-отправлено';

function forwardScans() {
  var label = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  var sent = 0;

  // ⚠️ Намеренно без `is:unread`. Этот признак ненадёжен: письмо, посланное
  // с того же ящика, Gmail помечает прочитанным сразу, и скрипт молча ничего
  // не находил бы. Дублей не будет и так — от них защищает ярлык.
  //
  // Окно в двое суток — чтобы после долгого простоя не разбирать всю почту.
  var query = 'has:attachment newer_than:2d -label:' + DONE_LABEL;
  var threads = GmailApp.search(query, 0, 20);

  // Отчитываемся всегда, даже когда делать нечего. Молчаливый запуск не
  // отличить от сломанного: «Execution completed» и пустой журнал выглядят
  // одинаково и когда всё хорошо, и когда фильтр отсекает вообще всё.
  Logger.log('Запрос: ' + query);
  Logger.log('Найдено писем с вложениями: ' + threads.length);
  if (threads.length === 0) {
    Logger.log('Нечего отправлять. Это нормально, если скана ещё не было.');
    Logger.log('Если скан точно приходил — проверьте, что письмо не старше двух суток и на нём нет ярлыка «' + DONE_LABEL + '».');
  }

  var skippedBySender = 0;
  var skippedNoImages = 0;

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      var from = message.getFrom();

      if (ALLOWED_SENDERS.length > 0 && !matchesSender(from)) {
        skippedBySender++;
        Logger.log('пропущено (чужой отправитель): ' + from);
        return;
      }

      var images = message.getAttachments().filter(isImage);
      if (images.length === 0) {
        skippedNoImages++;
        return;
      }

      var payload = {
        from: from,
        subject: message.getSubject(),
        attachments: images.map(function (a) {
          return {
            filename: a.getName(),
            contentType: a.getContentType(),
            content: Utilities.base64Encode(a.getBytes()),
          };
        }),
      };

      var res = UrlFetchApp.fetch(ENDPOINT + '?secret=' + encodeURIComponent(SECRET), {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      if (res.getResponseCode() === 200) {
        thread.addLabel(label);
        sent += images.length;
        Logger.log('отправлено: ' + message.getSubject() + ' → ' + res.getContentText());
      } else {
        // Ярлык не ставим: на следующем запуске попробуем ещё раз.
        Logger.log('ОШИБКА ' + res.getResponseCode() + ': ' + res.getContentText());
      }
    });
  });

  if (skippedBySender > 0) {
    Logger.log('Отсеяно по отправителю: ' + skippedBySender +
      '. Разрешены: ' + (ALLOWED_SENDERS.join(', ') || 'все'));
  }
  if (skippedNoImages > 0) Logger.log('Писем без картинок во вложениях: ' + skippedNoImages);
  Logger.log('ИТОГО отправлено сканов: ' + sent);

  return sent;
}

function matchesSender(from) {
  var lower = String(from).toLowerCase();
  return ALLOWED_SENDERS.some(function (allowed) {
    return lower.indexOf(String(allowed).toLowerCase()) !== -1;
  });
}

function isImage(attachment) {
  var type = String(attachment.getContentType() || '').toLowerCase();
  var name = String(attachment.getName() || '').toLowerCase();
  if (type.indexOf('image/') === 0) return true;
  return /\.(jpe?g|png|webp)$/.test(name);
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

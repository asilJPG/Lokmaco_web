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
 *     каждые 5 минут.
 *
 * Дальше сканы приезжают на сайт сами, в раздел «Приход».
 */

// Адрес сайта. На проде — https://<ваш-домен>/api/inbound/scan
var ENDPOINT = 'https://ВАШ-САЙТ/api/inbound/scan';

// Тот же секрет, что в INBOUND_SCAN_SECRET.
var SECRET = 'ВСТАВЬТЕ_СЕКРЕТ';

/**
 * От кого принимать сканы. Пустой массив — принимать от всех.
 *
 * ⚠️ Заполните его, как только увидите, с какого адреса пишет принтер.
 * Пока список пуст, «накладную» на этот ящик может прислать кто угодно, и она
 * попадёт в очередь наравне с настоящими.
 */
var ALLOWED_SENDERS = [];

/** Ярлык, которым помечаем разобранные письма, чтобы не слать их дважды. */
var DONE_LABEL = 'lokmaco-отправлено';

function forwardScans() {
  var label = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);

  // Берём только непрочитанные с вложениями и без нашего ярлыка. Ярлык —
  // главная защита от повторной отправки: скрипт запускается по таймеру и
  // одно и то же письмо иначе улетало бы каждые пять минут.
  var threads = GmailApp.search('has:attachment is:unread -label:' + DONE_LABEL, 0, 20);

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      var from = message.getFrom();

      if (ALLOWED_SENDERS.length > 0 && !matchesSender(from)) {
        return;
      }

      var images = message.getAttachments().filter(isImage);
      if (images.length === 0) return;

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
        message.markRead();
        Logger.log('отправлено: ' + message.getSubject() + ' → ' + res.getContentText());
      } else {
        // Ярлык не ставим: на следующем запуске попробуем ещё раз.
        Logger.log('ОШИБКА ' + res.getResponseCode() + ': ' + res.getContentText());
      }
    });
  });
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

/** Разовая проверка связи: пишет в лог, что ответил сайт. */
function testConnection() {
  var res = UrlFetchApp.fetch(ENDPOINT + '?secret=' + encodeURIComponent(SECRET), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ from: 'тест', subject: 'проверка связи', attachments: [] }),
    muteHttpExceptions: true,
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}

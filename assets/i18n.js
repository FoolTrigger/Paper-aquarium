// Два языка: русский и английский.
//
// Язык берём из выбора человека (localStorage), а если выбора не было —
// из настроек его устройства. Ни угадываний по IP, ни отдельного адреса
// для каждого языка: у аквариума один адрес, и он должен открываться
// одинаково у всех, кому дали ссылку.
//
// Строки лежат в одном месте на все страницы: аквариум, съёмка, раскраски,
// управление и правила. Разъедутся по файлам — половина останется
// непереведённой, и заметишь это не ты, а тот, кому ты дал ссылку.
//
//   I18N.t('menu.feed.title')            — строка
//   I18N.t('home.fish', {n: 3})          — с подстановкой
//   I18N.plural(3, 'fish')               — рыбка / рыбки / рыбок
//   I18N.apply(root)                     — раскладывает переводы по data-t
//   I18N.set('en')                       — переключить и запомнить
//   I18N.mount(el)                       — нарисовать переключатель RU EN
//
// В разметке:
//   <b data-t="menu.feed.title"></b>     — текст
//   <input data-t-ph="home.code.hint">   — placeholder
//   <button data-t-title="menu.close">   — подсказка title
//   <img data-t-alt="cap.photo">         — подпись alt
(function () {
  'use strict';

  var KEY = 'aqua.lang';
  var LANGS = ['ru', 'en'];

  var DICT = {
    ru: {
      'lang.name': 'Русский',

      // ── главная ──
      'home.title': 'Мои аквариумы',
      'home.lead': 'Распечатай шаблон, раскрась фломастерами, сфотографируй — и рыбка поплывёт. У каждого ребёнка может быть свой аквариум.',
      'home.empty': 'Пока ни одного аквариума. Создай первый — это займёт секунду.',
      'home.new': 'Новый аквариум',
      'home.bycode.title': 'Открыть аквариум по коду',
      'home.bycode.hint': 'Код нужен только на новом устройстве — на этом аквариумы запоминаются сами. Подойдут и пять цифр из «Открыть на другом экране».',
      'home.pin.bad.title': 'Эти цифры не подошли',
      'home.pin.bad.text': 'Код из пяти цифр живёт 5 минут — возможно, он истёк. Попроси показать его заново: на телефоне «Открыть на другом экране» → «Код для телевизора».',
      'home.pin.many.title': 'Слишком много попыток',
      'home.pin.many.text': 'Подожди немного и попробуй ещё раз.',
      'home.bycode.placeholder': 'например, mk4dp7wq2f',
      'home.bycode.open': 'Открыть',
      'home.phone.btn': 'С телефона',
      'home.phone.title': 'Вход с телефона',
      'home.phone.desc': 'Наведите камеру смартфона на QR-код для входа в аквариум с телефона:',
      'home.phone.wifi': 'Телефон и компьютер должны быть в одной сети Wi-Fi',
      'qr.title': 'Вход с телефона — Paper Aquarium',
      'qr.back': '← На главную',
      'qr.lead': 'Отсканируйте QR-код камерой смартфона, чтобы открыть Paper Aquarium на телефоне.',
      'qr.copy': 'Скопировать',
      'qr.copied': 'Скопировано!',
      'qr.wifi.title': 'Важно: подключение к одной сети',
      'qr.wifi.step1': 'Телефон и компьютер должны быть в одной сети Wi-Fi.',
      'qr.wifi.step2': 'Наведите камеру смартфона на QR-код и коснитесь появившейся ссылки.',
      'qr.wifi.step3': 'Рисуйте рыбок, фотографируйте раскраски и кормите их прямо со смартфона!',
      'qr.ifaces': 'Выбрать адрес сети:',
      // Четыре шага для того, кто пришёл впервые: увидел рилс — а дальше что?
      'home.how.title': 'Как это работает',
      'home.how.s0': 'Создай аквариум',
      'home.how.s1': 'Распечатай раскраску',
      'home.how.s2': 'Раскрась фломастерами',
      'home.how.s3': 'Сфотографируй телефоном',
      'home.how.s4': 'Открой на большом экране по коду',
      'home.how.demo': '🐠 Посмотреть живой аквариум',
      'home.how.demo.sub': 'общая витрина — рыбки уже плавают',
      'home.card.kill': 'Убрать аквариум',
      'home.card.empty': 'тут пока пусто',
      'home.terms': 'Правила и данные ↗',
      'terms.title': 'Правила и данные',
      'terms.back': '← к аквариумам',
      'home.footer.important': 'Важно.',
      'home.footer.text': ' Аккаунтов нет: по коду аквариум смотрят, по паролю управляют, оба хранит этот браузер. Подробности — в правилах.',

      'home.create.title': 'Новый аквариум',
      'home.create.text': 'Назови, чтобы отличать в списке — например, по имени ребёнка.',
      'home.create.value': 'Аквариум',
      'home.create.ok': 'Создать',
      'home.created.title': 'Аквариум создан',
      'home.created.text': 'По коду аквариум открывают и смотрят, по паролю им управляют. На этом устройстве оба уже сохранены — они всегда под рукой в меню аквариума, записывать их прямо сейчас не обязательно. Но где-то сохранить стоит: почты и аккаунта тут нет, восстановить их будет негде.',
      'home.created.code': 'Код аквариума',
      'home.created.pass': 'Пароль',
      'home.created.ok': 'Сохранил, поплыли',
      'home.create.fail.title': 'Аквариум не создался',
      'home.create.fail.text': 'Похоже, сервер не отвечает. Проверь, запущен ли node server.js.',
      'home.remove.title': 'Убрать «{name}»?',
      'home.remove.text': 'Из списка — аквариум останется на сервере, вернёшь его по коду {code}. Совсем — {what} уедут в корзину на сервере, и по коду он больше не откроется.',
      'home.remove.whatEmpty': 'аквариум уедет',
      'home.remove.cancel': 'Отмена',
      'home.remove.forget': 'Убрать из моего списка',
      'home.remove.delete': 'Удалить аквариум совсем',
      'home.remove.pass.title': 'Пароль от «{name}»',
      'home.remove.pass.text': 'Удалить аквариум совсем можно только с паролем. Если пароля нет — убери аквариум из своего списка, он останется у хозяина.',
      'home.badcode.title': 'Код не подходит',
      'home.badcode.text': 'Код аквариума — это ровно 10 символов, буквы и цифры. Проверь, не потерялся ли знак.',

      // ── меню аквариума ──
      'menu.tank': 'Аквариум',
      'menu.copied': 'ссылка скопирована',
      'menu.pass': '🔑 пароль',
      'menu.pass.set': '🔓 задать пароль',
      'menu.pass.title': 'Пароль аквариума',
      'menu.rename.hint': 'Переименовать аквариум',
      'menu.close': 'Закрыть меню',
      'menu.back': '← назад',
      'menu.hint': 'нажми в любом месте — покажу меню',
      'menu.capture.title': 'Сфотографировать рыбку',
      'menu.capture.sub': 'раскрашенный лист оживает в аквариуме',
      'menu.pack.title': 'Запустить готовую рыбку',
      'menu.pack.sub': 'из набора, без раскрашивания',
      'menu.feed.title': 'Покормить',
      'menu.feed.sub': 'рыбки соберутся на корм',
      'menu.print.title': 'Раскраски для печати',
      'menu.print.sub': '12 видов рыбок на обычном листе A4',
      'menu.bg.title': 'Сменить фон',
      'menu.bg.sub': 'картинка, на фоне которой плавают рыбки',
      'menu.fish.title': 'Убрать рыбок',
      'menu.fish.sub': 'удалить лишних из аквариума',
      'menu.fish.sub.pass': 'удалить лишних — нужен пароль',
      'menu.decor.title': 'Эффекты и украшения',
      'menu.decor.sub': 'настройка графики для ТВ и слабых устройств',
      'menu.decor.hint': 'Отключи лишнее для повышения плавности (FPS)',
      'menu.decor.all_on': 'Включить всё',
      'menu.decor.all_off': 'Выключить всё (макс. FPS)',
      'menu.decor.weed': 'Водоросли',
      'menu.decor.reef': 'Кораллы и рифы',
      'menu.decor.bubbles': 'Пузырьки',
      'menu.decor.plankton': 'Планктон и пылинки',
      'menu.decor.rays': 'Лучи света',
      'menu.decor.caustics': 'Блики света (каустика)',
      'menu.decor.floor': 'Песчаное дно',
      'menu.home.title': 'Мои аквариумы',
      'menu.home.sub': 'другие аквариумы — и завести новый',
      'menu.picker.title': 'Кого запустить?',
      'menu.picker.sub': 'Рыбка из набора появится в аквариуме сразу',
      'menu.picker.drawing': 'рисую…',
      'menu.picker.failed': 'не вышло',
      'menu.picker.nopack': 'Набор не собран — запусти tools\\convert-pack.ps1',
      'menu.rename.title': 'Название аквариума',
      'menu.rename.text': 'Видно только тебе — в списке аквариумов и в заголовке этой страницы.',
      'menu.rename.ok': 'Сохранить',
      'menu.rename.fail': 'Не переименовалось',
      'menu.access.title': 'Доступ к аквариуму',
      'menu.access.text': 'По коду аквариум смотрят, по паролю им управляют. Оба сохранены в этом браузере — если почистить его данные, восстановить их будет негде.',
      'menu.access.done': 'Готово',
      'menu.access.change': 'Сменить пароль',
      'menu.newpass.title': 'Новый пароль аквариума',
      'menu.newpass.first': 'Пароль для аквариума',
      'menu.newpass.text': 'От 4 знаков. Цифры удобнее: их диктуют по телефону и набирают на пульте. Старый пароль перестанет работать на всех устройствах.',
      'menu.newpass.ph': 'новый пароль',
      'menu.newpass.short.title': 'Слишком короткий',
      'menu.newpass.short.text': 'Нужно хотя бы четыре знака.',
      'menu.newpass.saved.title': 'Пароль сохранён',
      'menu.newpass.saved.text': 'Запиши его: восстановить пароль негде. Код аквариума не менялся — по нему по-прежнему смотрят.',
      'menu.newpass.saved.field': 'Новый пароль',
      'menu.newpass.saved.ok': 'Записал',
      'menu.oldpass.title': 'Старый пароль',
      'menu.oldpass.text': 'Сменить пароль может тот, кто знает нынешний.',
      'menu.fail.title': 'Не вышло',
      'menu.fail.server': 'Сервер не отвечает.',
      'menu.fail.pass': 'Сервер не принял пароль.',
      'menu.link.title': 'Ссылка на аквариум',
      'tank.doctitle': 'Аквариум',
      'tank.frame.print': 'Раскраски для печати',
      'tank.frame.bg': 'Фон аквариума',
      'tank.frame.fish': 'Рыбки аквариума',
      'tank.frame.capture': 'Съёмка рыбки',
      'tank.crash': '<b>Сцена не запустилась</b><br>{msg}',
      'menu.link.text': 'Скопировать сам не смог — забери отсюда. По ней аквариум откроется на любом устройстве.',
      'menu.link.ok': 'Готово',
      // «Открыть на другом экране»: телефон снимает, большой экран показывает —
      // весь перенос между устройствами собран в одном пункте.
      'menu.share.title': 'Открыть на другом экране',
      'menu.share.sub': 'QR и ссылка: телевизор, планшет, второй телефон',
      'menu.share.hint': 'Наведи камеру телефона — аквариум откроется там',
      'menu.share.copy': 'Скопировать ссылку',
      'menu.share.copy.sub': 'отправь её в мессенджер — и открой где угодно',
      'menu.share.send': 'Отправить ссылку…',
      'menu.share.send.sub': 'через то, чем ты обычно делишься',
      'menu.share.pin': 'Код для телевизора',
      'menu.share.pin.sub': 'пять цифр — их легко набрать пультом',
      'menu.share.pin.text': 'Набери эти цифры на телевизоре — на главной странице, в поле «Открыть аквариум по коду». Код живёт 5 минут.',
      'menu.share.pin.fail': 'Код не выдался — попробуй ещё раз',
      // Витрина: общий аквариум для знакомства. Меню здесь урезано, чтобы
      // гость не отправил рыбку ребёнка в чужой аквариум.
      'demo.title': '🫧 Это витрина',
      'demo.text': 'Общий аквариум для знакомства — рыбки тут ничьи. Свои живут в собственном аквариуме: завести его — секунда, раскраски и съёмка будут там.',
      'demo.own': 'Завести свой аквариум',
      'demo.own.sub': 'печать, съёмка и свои рыбки — там',

      'tank.loading': 'Наполняю аквариум…',
      'tank.nofish': 'рыбок пока нет',
      'tank.notank': 'Аквариум не найден — возможно, его удалили или в коде опечатка.',
      'tank.tolist': 'К моим аквариумам →',
      'tank.noserver': 'Сервер недоступен. Запусти <code>node server.js</code> и обнови страницу.',
      'tank.nopick': 'Не выбран аквариум.',
      'tank.home': 'На главную →',

      // ── съёмка ──
      'cap.title': '🐠 Оживи свою рыбку!',
      'cap.sub': 'Раскрась рыбку на листе, сфотографируй — и она поплывёт в аквариуме',
      'cap.back': '← в аквариум',
      'cap.shoot': 'Сфотографировать лист',
      'cap.gallery': 'Выбрать из галереи или файл',
      'cap.hint': 'Положи лист на стол, чтобы все четыре чёрных квадрата попали в кадр',
      'cap.qr': 'Удобнее с телефона: наведи камеру на код — съёмка откроется там',
      'cap.searching': 'Ищу рыбку на фото…',
      'cap.reviving': 'рыбка оживает…',
      'cap.release': 'Выпустить в аквариум! 🌊',
      'cap.retake': 'Переснять',
      'cap.boost': 'Ярче цвета',
      'cap.done': 'Рыбка уплыла в аквариум!',
      'cap.done.sub': 'Посмотри на большой экран — она уже там',
      'cap.done.sub.embed': 'Закрой окно — она уже плавает',
      'cap.again': 'Сфотографировать ещё одну',
      'cap.retry': 'Попробовать ещё раз',
      'cap.sending': 'Рыбка плывёт в аквариум…',
      'cap.err.manifest': 'Не загрузился manifest.json — проверь, что сервер запущен.',
      'cap.err.photo': 'Не удалось открыть фото, попробуй ещё раз.',
      'cap.err.memory': 'Недостаточно памяти устройства для обработки этого фото. Попробуй режим «Навести камерой» или выбери фото меньшего размера.',
      'cap.itis': 'Это {name}!',
      'cap.photo': 'Твоя рыбка',
      'cap.err.nofish': 'Рыбка потерялась — сфотографируй лист заново.',
      'cap.err.status': 'Сервер ответил {code}',
      'cap.err.markers': 'Нашёл меток: {n} из 4. Сфотографируй весь лист целиком, при хорошем свете и без бликов — все четыре чёрных квадрата должны быть в кадре.',
      'cap.err.send': 'Не получилось отправить: {msg}',
      'cap.live': 'Навести камерой',
      'cap.live.hint': 'Наведи камеру на лист так, чтобы все четыре чёрных квадрата попали в кадр',
      'cap.live.found': 'Вижу рыбку… {pct}%',
      'cap.cancel': 'Отмена',
      'cap.namePlaceholder': 'Как назовём рыбку?',
      'cap.err.camera': 'Не получилось включить камеру — проверь разрешение в браузере или сфотографируй лист обычным способом.',

      // ── управление ──
      'adm.doctitle': 'Аквариум — управление рыбками',
      'adm.title': 'управление',
      'adm.tank': 'Аквариум',
      'adm.capture': 'Съёмка',
      'adm.print': 'Раскраски',
      'adm.home': 'Мои аквариумы',
      'adm.pass': 'Пароль:',
      'adm.pass.change': 'Сменить пароль',
      'adm.pass.show': 'Показать пароль',
      'adm.bg': 'Фон аквариума',
      'adm.bg.one': 'Фон {n}',
      'adm.bg.own': 'Свой фон',
      'adm.bg.add': 'свой фон',
      'adm.bg.busy': 'загружаю…',
      'adm.bg.del': 'Удалить этот фон',
      'adm.bg.del.title': 'Удалить фон?',
      'adm.bg.del.text': 'Файл будет стёрт безвозвратно — в отличие от рыбок, копии не остаётся.',
      'adm.bg.fail': 'Фон не загрузился',
      'adm.bg.err.read': 'не удалось прочитать файл',
      'adm.bg.err.img': 'это не картинка',
      'adm.fish.count': 'рыбок: {n}',
      'adm.fish.pack': 'из набора · ',
      'adm.fish.del': 'Удалить',
      'adm.fish.del.title': 'Удалить рыбку?',
      'adm.fish.del.pack': 'Она уплывёт из аквариума. Запустить такую же можно снова в любой момент.',
      'adm.fish.del.painted': 'Рисунок переедет в корзину на сервере — если что, его можно вернуть.',
      'adm.empty': 'В аквариуме пока нет нарисованных рыбок.',
      'adm.empty.sub': 'Раскрась лист и сфотографируй его с телефона — ссылка «Съёмка» наверху.',
      'adm.clear': 'Удалить всех рыбок',
      'adm.clear.title': 'Очистить аквариум?',
      'adm.clear.text': 'Из аквариума уплывут все рыбки — {n} шт. Рисунки переедут в корзину на сервере, вернуть их можно, но из списка они пропадут.',
      'adm.noserver': 'сервер недоступен — запусти node server.js',
      'adm.gate.title': '🔒 Управление под паролем',
      'adm.gate.text': 'Смотреть аквариум можно и без него — пароль нужен, чтобы менять фон, переименовывать и удалять рыбок.',
      'adm.gate.ph': 'пароль',
      'adm.gate.enter': 'Войти',
      'adm.gate.back': '← в аквариум',
      'adm.gate.bad': 'Пароль не подошёл.',
      'adm.gate.old': 'Пароль устарел — введи новый.',
      'adm.gate.many': 'Слишком много попыток, подожди минуту.',
      'adm.gate.wait': 'Слишком много попыток. Подожди {n} с.',
      'adm.gate.noserver': 'Сервер не отвечает.',
      'adm.gate.need': 'Нужен пароль аквариума.',

      // ── раскраски ──
      'print.title': 'Раскраски — шаблоны для печати',
      'print.home': '← мои аквариумы',
      'print.all': 'Печать всех',
      'print.pdf': 'Скачать PDF',
      'print.pdf.file': 'раскраски-аквариум.pdf',
      'print.one': 'Печать этого листа',
      'print.note': 'Печатай на обычной А4 в альбомной ориентации, масштаб 100% (без «вписать в страницу») — размеры меток важны для распознавания. Чёрные квадраты в углах не закрашивать!',
      'print.note2': 'Принтера рядом нет? Скачай все листы одним PDF (кнопка вверху) и отправь туда, где принтер найдётся. А пока запусти в аквариум готовую рыбку из меню.',
      'print.nomanifest': 'Не загрузился manifest.json — проверь, что сервер запущен.',

      // ── общее ──
      'pass.ask.title': 'Пароль аквариума',
      'pass.ask.text': 'Пароль спрашивают только на управление. Смотреть аквариум можно и без него.',
      'pass.ask.ph': 'например, 481902',
      'pass.ask.ok': 'Войти',
      'pass.bad.title': 'Пароль не подошёл',
      'pass.bad.text': 'Проверь пароль — тот, что показали при создании аквариума.',
      'pass.many.title': 'Слишком много попыток',
      'pass.many.text': 'Подожди {n} с и попробуй снова.',
      'modal.cancel': 'Отмена',
      'modal.delete': 'Удалить',
      'modal.ok': 'Понятно',
      'modal.save': 'Сохранить',
      'modal.copyHint': 'Нажми, чтобы скопировать',
      'modal.copied': 'скопировано'
    },

    en: {
      'lang.name': 'English',

      'home.title': 'My aquariums',
      'home.lead': 'Print a sheet, colour it with markers, take a photo — and the fish starts swimming. Every child can have their own aquarium.',
      'home.empty': 'No aquariums yet. Create the first one — it takes a second.',
      'home.new': 'New aquarium',
      'home.bycode.title': 'Open an aquarium by code',
      'home.bycode.hint': 'The code is only needed on a new device — this one remembers your aquariums. Five digits from “Open on another screen” work too.',
      'home.pin.bad.title': 'Those digits did not fit',
      'home.pin.bad.text': 'A five-digit code lives for 5 minutes — it may have expired. Ask for a fresh one: “Open on another screen” → “TV code” on the phone.',
      'home.pin.many.title': 'Too many attempts',
      'home.pin.many.text': 'Wait a little and try again.',
      'home.bycode.placeholder': 'for example, mk4dp7wq2f',
      'home.bycode.open': 'Open',
      'home.phone.btn': 'From phone',
      'home.phone.title': 'Connect from phone',
      'home.phone.desc': 'Point your phone camera at the QR code to open Paper Aquarium on your phone:',
      'home.phone.wifi': 'Phone and computer must be connected to the same Wi-Fi network',
      'qr.title': 'Connect from phone — Paper Aquarium',
      'qr.back': '← Back to home',
      'qr.lead': 'Scan the QR code with your smartphone camera to open Paper Aquarium on your phone.',
      'qr.copy': 'Copy link',
      'qr.copied': 'Copied!',
      'qr.wifi.title': 'Important: same network connection',
      'qr.wifi.step1': 'Phone and computer must be connected to the same Wi-Fi network.',
      'qr.wifi.step2': 'Point your smartphone camera at the QR code and tap the link.',
      'qr.wifi.step3': 'Draw fish, photograph coloring sheets, and feed them right from your phone!',
      'qr.ifaces': 'Select network address:',
      'home.how.title': 'How it works',
      'home.how.s0': 'Create an aquarium',
      'home.how.s1': 'Print a colouring sheet',
      'home.how.s2': 'Colour it with markers',
      'home.how.s3': 'Photograph it with a phone',
      'home.how.s4': 'Open on a big screen with a code',
      'home.how.demo': '🐠 Peek at a live aquarium',
      'home.how.demo.sub': 'a shared showcase — fish already swimming',
      'home.card.kill': 'Remove aquarium',
      'home.card.empty': 'empty so far',
      'home.terms': 'Terms and data ↗',
      'terms.title': 'Terms and Data',
      'terms.back': '← to the aquariums',
      'home.footer.important': 'Important.',
      'home.footer.text': ' No accounts: the code is for watching, the password is for managing, and this browser keeps both. Details — in the terms.',

      'home.create.title': 'New aquarium',
      'home.create.text': 'Give it a name so you can tell it apart in the list — your child’s name works well.',
      'home.create.value': 'Aquarium',
      'home.create.ok': 'Create',
      'home.created.title': 'Aquarium created',
      'home.created.text': 'The code opens the aquarium for watching, the password lets you manage it. Both are already saved on this device — they live in the aquarium menu, no need to write them down right now. Still, keep a copy somewhere: there is no email and no account here, so there is nowhere to recover them from.',
      'home.created.code': 'Aquarium code',
      'home.created.pass': 'Password',
      'home.created.ok': 'Saved, let’s go',
      'home.create.fail.title': 'Could not create the aquarium',
      'home.create.fail.text': 'The server is not responding. Check that node server.js is running.',
      'home.remove.title': 'Remove “{name}”?',
      'home.remove.text': 'From the list — the aquarium stays on the server, you can bring it back with the code {code}. For good — {what} move to the server’s bin, and the code stops working.',
      'home.remove.whatEmpty': 'the aquarium moves',
      'home.remove.cancel': 'Cancel',
      'home.remove.forget': 'Remove from my list',
      'home.remove.delete': 'Delete the aquarium for good',
      'home.remove.pass.title': 'Password for “{name}”',
      'home.remove.pass.text': 'Deleting an aquarium for good needs the password. Without it, just remove the aquarium from your list — it stays with its owner.',
      'home.badcode.title': 'That code does not fit',
      'home.badcode.text': 'An aquarium code is exactly 10 characters, letters and digits. Check whether one got lost.',

      'menu.tank': 'Aquarium',
      'menu.copied': 'link copied',
      'menu.pass': '🔑 password',
      'menu.pass.set': '🔓 set a password',
      'menu.pass.title': 'Aquarium password',
      'menu.rename.hint': 'Rename the aquarium',
      'menu.close': 'Close the menu',
      'menu.back': '← back',
      'menu.hint': 'tap anywhere — the menu will show up',
      'menu.capture.title': 'Photograph a fish',
      'menu.capture.sub': 'a coloured sheet comes alive in the aquarium',
      'menu.pack.title': 'Release a ready-made fish',
      'menu.pack.sub': 'from the set, no colouring needed',
      'menu.feed.title': 'Feed them',
      'menu.feed.sub': 'the fish will gather around the food',
      'menu.print.title': 'Colouring sheets to print',
      'menu.print.sub': '12 kinds of fish on a plain A4 sheet',
      'menu.bg.title': 'Change the background',
      'menu.bg.sub': 'the picture the fish swim against',
      'menu.fish.title': 'Remove fish',
      'menu.fish.sub': 'take the extra ones out of the aquarium',
      'menu.fish.sub.pass': 'take the extra ones out — password needed',
      'menu.decor.title': 'Effects & decorations',
      'menu.decor.sub': 'graphics settings for TV and low-end devices',
      'menu.decor.hint': 'Turn off effects to increase smoothness (FPS)',
      'menu.decor.all_on': 'Enable all',
      'menu.decor.all_off': 'Disable all (max FPS)',
      'menu.decor.weed': 'Seaweed',
      'menu.decor.reef': 'Corals & reef',
      'menu.decor.bubbles': 'Bubbles',
      'menu.decor.plankton': 'Plankton & dust',
      'menu.decor.rays': 'God rays',
      'menu.decor.caustics': 'Light caustics',
      'menu.decor.floor': 'Sand floor',
      'menu.home.title': 'My aquariums',
      'menu.home.sub': 'other aquariums — and starting a new one',
      'menu.picker.title': 'Who shall we release?',
      'menu.picker.sub': 'A fish from the set appears in the aquarium right away',
      'menu.picker.drawing': 'drawing…',
      'menu.picker.failed': 'did not work',
      'menu.picker.nopack': 'The set is not built — run tools\\convert-pack.ps1',
      'menu.rename.title': 'Aquarium name',
      'menu.rename.text': 'Only you see it — in the list of aquariums and in this page’s title.',
      'menu.rename.ok': 'Save',
      'menu.rename.fail': 'Renaming failed',
      'menu.access.title': 'Access to the aquarium',
      'menu.access.text': 'The code is for watching, the password is for managing. Both are saved in this browser — if you clear its data, there is nowhere to recover them from.',
      'menu.access.done': 'Done',
      'menu.access.change': 'Change the password',
      'menu.newpass.title': 'New aquarium password',
      'menu.newpass.first': 'Password for the aquarium',
      'menu.newpass.text': 'At least 4 characters. Digits are handier: they are easy to read out over the phone and to type on a TV remote. The old password stops working on every device.',
      'menu.newpass.ph': 'new password',
      'menu.newpass.short.title': 'Too short',
      'menu.newpass.short.text': 'Four characters at the very least.',
      'menu.newpass.saved.title': 'Password saved',
      'menu.newpass.saved.text': 'Write it down: there is nowhere to recover it from. The aquarium code has not changed — it still works for watching.',
      'menu.newpass.saved.field': 'New password',
      'menu.newpass.saved.ok': 'Written down',
      'menu.oldpass.title': 'Current password',
      'menu.oldpass.text': 'Only someone who knows the current password can change it.',
      'menu.fail.title': 'Did not work',
      'menu.fail.server': 'The server is not responding.',
      'menu.fail.pass': 'The server did not accept the password.',
      'menu.link.title': 'Link to the aquarium',
      'tank.doctitle': 'Aquarium',
      'tank.frame.print': 'Colouring sheets for printing',
      'tank.frame.bg': 'Aquarium background',
      'tank.frame.fish': 'Fish in the aquarium',
      'tank.frame.capture': 'Photographing a fish',
      'tank.crash': '<b>The scene did not start</b><br>{msg}',
      'menu.link.text': 'Could not copy it myself — take it from here. It opens the aquarium on any device.',
      'menu.link.ok': 'Done',
      'menu.share.title': 'Open on another screen',
      'menu.share.sub': 'QR and link: a TV, a tablet, another phone',
      'menu.share.hint': 'Point a phone camera here — the aquarium opens there',
      'menu.share.copy': 'Copy the link',
      'menu.share.copy.sub': 'send it to a messenger — and open it anywhere',
      'menu.share.send': 'Send the link…',
      'menu.share.send.sub': 'through whatever you usually share with',
      'menu.share.pin': 'TV code',
      'menu.share.pin.sub': 'five digits — easy to type with a remote',
      'menu.share.pin.text': 'Type these digits on the TV — on the home page, in the “Open an aquarium by code” field. The code lives for 5 minutes.',
      'menu.share.pin.fail': 'No code came — try again',
      'demo.title': '🫧 This is a showcase',
      'demo.text': 'A shared aquarium for a first look — the fish here belong to no one. Your own fish live in your own aquarium: starting one takes a second, and the sheets and shooting are there.',
      'demo.own': 'Start your own aquarium',
      'demo.own.sub': 'printing, shooting and your own fish live there',

      'tank.loading': 'Filling the aquarium…',
      'tank.nofish': 'no fish yet',
      'tank.notank': 'Aquarium not found — it may have been deleted, or the code has a typo.',
      'tank.tolist': 'To my aquariums →',
      'tank.noserver': 'The server is unreachable. Run <code>node server.js</code> and refresh the page.',
      'tank.nopick': 'No aquarium selected.',
      'tank.home': 'To the home page →',

      'cap.title': '🐠 Bring your fish to life!',
      'cap.sub': 'Colour the fish on the sheet, take a photo — and it will swim in the aquarium',
      'cap.back': '← to the aquarium',
      'cap.shoot': 'Photograph the sheet',
      'cap.gallery': 'Choose from gallery or file',
      'cap.hint': 'Put the sheet on a table so that all four black squares are in the frame',
      'cap.qr': 'Easier on a phone: point its camera at the code and the shooting opens there',
      'cap.searching': 'Looking for the fish in the photo…',
      'cap.reviving': 'the fish is coming alive…',
      'cap.release': 'Release into the aquarium! 🌊',
      'cap.retake': 'Retake',
      'cap.boost': 'Brighter colours',
      'cap.done': 'The fish has swum into the aquarium!',
      'cap.done.sub': 'Look at the big screen — it is already there',
      'cap.done.sub.embed': 'Close this window — it is already swimming',
      'cap.again': 'Photograph another one',
      'cap.retry': 'Try again',
      'cap.sending': 'The fish is swimming to the aquarium…',
      'cap.err.manifest': 'manifest.json did not load — check that the server is running.',
      'cap.err.photo': 'Could not open the photo, try again.',
      'cap.err.memory': 'Not enough device memory to process this photo. Try "Point the camera" mode or choose a smaller photo.',
      'cap.itis': 'It’s a {name}!',
      'cap.photo': 'Your fish',
      'cap.err.nofish': 'The fish got lost — photograph the sheet again.',
      'cap.err.status': 'The server answered {code}',
      'cap.err.markers': 'Found {n} markers out of 4. Photograph the whole sheet, in good light and without glare — all four black squares have to be in the frame.',
      'cap.err.send': 'Sending failed: {msg}',
      'cap.live': 'Point the camera',
      'cap.live.hint': 'Point the camera at the sheet so all four black squares are in the frame',
      'cap.live.found': 'Found it… {pct}%',
      'cap.cancel': 'Cancel',
      'cap.namePlaceholder': 'What should we name the fish?',
      'cap.err.camera': 'Could not turn on the camera — check the browser permission, or photograph the sheet the usual way.',

      'adm.doctitle': 'Aquarium — managing the fish',
      'adm.title': 'management',
      'adm.tank': 'Aquarium',
      'adm.capture': 'Camera',
      'adm.print': 'Colouring sheets',
      'adm.home': 'My aquariums',
      'adm.pass': 'Password:',
      'adm.pass.change': 'Change the password',
      'adm.pass.show': 'Show the password',
      'adm.bg': 'Aquarium background',
      'adm.bg.one': 'Background {n}',
      'adm.bg.own': 'Your own',
      'adm.bg.add': 'your own',
      'adm.bg.busy': 'uploading…',
      'adm.bg.del': 'Delete this background',
      'adm.bg.del.title': 'Delete the background?',
      'adm.bg.del.text': 'The file will be erased for good — unlike fish, no copy is kept.',
      'adm.bg.fail': 'The background did not upload',
      'adm.bg.err.read': 'could not read the file',
      'adm.bg.err.img': 'this is not a picture',
      'adm.fish.count': 'fish: {n}',
      'adm.fish.pack': 'from the set · ',
      'adm.fish.del': 'Delete',
      'adm.fish.del.title': 'Delete the fish?',
      'adm.fish.del.pack': 'It will swim away. You can release the same one again any time.',
      'adm.fish.del.painted': 'The drawing moves to the bin on the server — it can be brought back.',
      'adm.empty': 'No drawn fish in this aquarium yet.',
      'adm.empty.sub': 'Colour a sheet and photograph it with a phone — the “Camera” link is at the top.',
      'adm.clear': 'Delete all the fish',
      'adm.clear.title': 'Empty the aquarium?',
      'adm.clear.text': 'Every fish will swim away — {n} of them. The drawings move to the bin on the server; they can be brought back, but they disappear from this list.',
      'adm.noserver': 'server unreachable — run node server.js',
      'adm.gate.title': '🔒 Management needs a password',
      'adm.gate.text': 'Watching the aquarium does not — the password is for changing the background, renaming and removing fish.',
      'adm.gate.ph': 'password',
      'adm.gate.enter': 'Enter',
      'adm.gate.back': '← to the aquarium',
      'adm.gate.bad': 'That password does not fit.',
      'adm.gate.old': 'The password is out of date — enter the new one.',
      'adm.gate.many': 'Too many attempts, wait a minute.',
      'adm.gate.wait': 'Too many attempts. Wait {n} s.',
      'adm.gate.noserver': 'The server is not responding.',
      'adm.gate.need': 'The aquarium password is needed.',

      'print.title': 'Colouring sheets — ready to print',
      'print.home': '← my aquariums',
      'print.all': 'Print all',
      'print.pdf': 'Download PDF',
      'print.pdf.file': 'aquarium-colouring-sheets.pdf',
      'print.one': 'Print this sheet',
      'print.note': 'Print on plain A4 in landscape at 100% scale (not “fit to page”) — the marker size matters for recognition. Do not colour the black squares in the corners!',
      'print.note2': 'No printer around? Download all sheets as one PDF (button up top) and send it wherever a printer lives. Meanwhile, release a ready-made fish from the menu.',
      'print.nomanifest': 'manifest.json did not load — check that the server is running.',

      'pass.ask.title': 'Aquarium password',
      'pass.ask.text': 'The password is only asked for managing. Watching the aquarium needs none.',
      'pass.ask.ph': 'for example, 481902',
      'pass.ask.ok': 'Enter',
      'pass.bad.title': 'That password does not fit',
      'pass.bad.text': 'Check the password — the one shown when the aquarium was created.',
      'pass.many.title': 'Too many attempts',
      'pass.many.text': 'Wait {n} s and try again.',
      'modal.cancel': 'Cancel',
      'modal.delete': 'Delete',
      'modal.ok': 'Got it',
      'modal.save': 'Save',
      'modal.copyHint': 'Click to copy',
      'modal.copied': 'copied'
    }
  };

  // Множественное число. В русском три формы, в английском две.
  // Считаем сами: Intl.PluralRules есть не везде, где эта игра запускается,
  // а правил тут всего два языка.
  var PLURALS = {
    ru: { fish: ['рыбка', 'рыбки', 'рыбок'] },
    en: { fish: ['fish', 'fish', 'fish'] }
  };

  function pluralIndex(lang, n) {
    if (lang === 'en') return n === 1 ? 0 : 1;
    // русский: 1 — одна, 2–4 — две, остальное — много
    var t = n % 10, h = n % 100;
    if (t === 1 && h !== 11) return 0;
    if (t >= 2 && t <= 4 && (h < 12 || h > 14)) return 1;
    return 2;
  }

  function pick() {
    var saved;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* приватный режим */ }
    if (saved && DICT[saved]) return saved;

    // Настройки устройства: ru-RU → русский, остальное —
    // английский как язык по умолчанию для всех прочих.
    var list = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i]).slice(0, 2).toLowerCase();
      if (DICT[code]) return code;
      if (code === 'be' || code === 'uk' || code === 'kk') return 'ru';   // соседи по алфавиту
    }
    return 'en';
  }

  var lang = pick();

  function t(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]) || DICT.ru[key] || key;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, name) {
      return vars[name] === undefined ? m : vars[name];
    });
  }

  function plural(n, what) {
    var forms = (PLURALS[lang] || PLURALS.ru)[what];
    return n + ' ' + forms[pluralIndex(lang, n)];
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-t]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-t'));
    });
    root.querySelectorAll('[data-t-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-t-html'));
    });
    root.querySelectorAll('[data-t-ph]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-t-ph'));
    });
    root.querySelectorAll('[data-t-title]').forEach(function (el) {
      el.title = t(el.getAttribute('data-t-title'));
    });
    root.querySelectorAll('[data-t-alt]').forEach(function (el) {
      el.alt = t(el.getAttribute('data-t-alt'));
    });
    if (document.documentElement) document.documentElement.lang = lang;
  }

  function set(next) {
    if (!DICT[next] || next === lang) return;
    lang = next;
    try { localStorage.setItem(KEY, next); } catch (e) { /* приватный режим */ }
    apply(document);
    window.dispatchEvent(new CustomEvent('aqua:lang', { detail: next }));
  }

  // Переключатель: две коротких кнопки. Место занимает мало, а объяснять
  // ничего не надо — RU EN читается на любом из двух языков.
  function mount(host) {
    if (!host) return null;
    host.classList.add('langpick');
    host.textContent = '';
    LANGS.forEach(function (code) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = code.toUpperCase();
      b.title = DICT[code]['lang.name'];
      b.dataset.lang = code;
      b.setAttribute('aria-pressed', code === lang ? 'true' : 'false');
      b.onclick = function () { set(code); };
      host.appendChild(b);
    });
    var paint = function () {
      host.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false');
      });
    };
    window.addEventListener('aqua:lang', paint);
    return host;
  }

  // Соседние вкладки и врезки внутри меню аквариума: язык поменяли в одном
  // месте — меняется везде, где открыт тот же сайт.
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || !e.newValue || e.newValue === lang) return;
    lang = e.newValue;
    apply(document);
    window.dispatchEvent(new CustomEvent('aqua:lang', { detail: lang }));
  });

  window.I18N = {
    get lang() { return lang; },
    t: t,
    plural: plural,
    apply: apply,
    set: set,
    mount: mount,
    langs: LANGS
  };

  // Раскладываем переводы, как только разметка готова.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { apply(document); });
  } else {
    apply(document);
  }
})();

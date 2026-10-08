# Развертывание «Аквариума с раскрасками» на VPS

Пошаговое руководство по установке и настройке проекта на собственном виртуальном сервере (VPS/VDS).

---

## Содержание

1. [Требования к серверу](#1-требования-к-серверу)
2. [Почему для камеры обязателен HTTPS](#2-почему-для-камеры-обязателен-https)
3. [Способ 1: Node.js + Systemd + Nginx (Рекомендуемый)](#3-способ-1-nodejs--systemd--nginx-рекомендуемый)
   - [Шаг 1: Установка зависимостей](#шаг-1-установка-зависимостей)
   - [Шаг 2: Клонирование и настройка прав](#шаг-2-клонирование-и-настройка-прав)
   - [Шаг 3: Настройка службы systemd](#шаг-3-настройка-службы-systemd)
   - [Шаг 4: Настройка Nginx и SSL](#шаг-4-настройка-nginx-и-ssl)
     - [Вариант А: Сертификат выдан на IP-адрес](#вариант-а-сертификат-выдан-на-ip-адрес)
     - [Вариант Б: Бесплатный Let's Encrypt для домена](#вариант-б-бесплатный-lets-encrypt-для-домена)
4. [Способ 2: Развертывание через Docker Compose](#4-способ-2-развертывание-через-docker-compose)
5. [Безопасность и ограничение доступа](#5-безопасность-и-ограничение-доступа)
   - [Как запретить посторонним создавать новые аквариумы](#как-запретить-посторонним-создавать-новые-аквариумы)
   - [Защита окна администратора](#защита-окна-администратора)
   - [Квоты на диск и память](#квоты-на-диск-и-память)
6. [Файрвол (UFW)](#6-файрвол-ufw)
7. [Обновление, логи и резервное копирование](#7-обновление-логи-и-резервное-копирование)

---

## 1. Требования к серверу

Благодаря архитектуре без внешних npm-зависимостей проект крайне нетребователен к ресурсам:

- **Процессор:** 1 vCPU
- **Оперативная память:** от 1 ГБ RAM (потребление Node.js обычно < 50 МБ)
- **Диск:** от 10 ГБ SSD (зависит от количества сохранённых детских рисунков)
- **ОС:** Ubuntu 22.04 / 24.04 LTS или Debian 11 / 12
- **Порты:** 80 (HTTP) и 443 (HTTPS) открыты наружу; порт 8000 используется локально

---

## 2. Почему для камеры обязателен HTTPS

В современных мобильных браузерах (Chrome на Android, Safari на iOS, Firefox) API доступа к камере (`navigator.mediaDevices.getUserMedia`) относится к категории **Secure Contexts**.

- По незащищённому протоколу `http://` браузер **наглухо блокирует камеру** при обращении по внешнему IP или домену (исключение сделано только для `localhost`).
- Чтобы дети могли фотографировать раскраски прямо со смартфонов и отправлять рыбок в аквариум, **сервер обязан работать по HTTPS**.

---

## 3. Способ 1: Node.js + Systemd + Nginx (Рекомендуемый)

Этот способ обеспечивает максимальную производительность, минимальное потребление памяти и простоту сопровождения.

### Шаг 1: Установка зависимостей

Подключитесь к VPS по SSH и установите Node.js 20 LTS, Git и Nginx:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx

# Установка Node.js 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка версий
node -v   # v20.x.x
nginx -v  # nginx/1.x.x
```

### Шаг 2: Клонирование и настройка прав

Клонируем репозиторий в каталог `/opt/paper-aquarium`:

```bash
sudo git clone https://github.com/your-username/paper-aquarium.git /opt/paper-aquarium
cd /opt/paper-aquarium

# Создаём каталог для данных и назначаем владельца www-data
sudo mkdir -p /opt/paper-aquarium/data
sudo chown -R www-data:www-data /opt/paper-aquarium/data
```

> **Примечание:** В проект уже входят **7 готовых 3D-моделей рыбок с анимацией плавания** в папке `assets/models/pack/`. Дополнительно ничего скачивать или компилировать не нужно.

### Шаг 3: Настройка службы systemd

Создадим systemd-сервис для автозапуска приложения и его перезапуска в случае сбоя:

```bash
sudo nano /etc/systemd/system/paper-aquarium.service
```

Вставьте следующее содержимое:

```ini
[Unit]
Description=Paper Aquarium Node.js Service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/paper-aquarium
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

# Переменные окружения и лимиты
Environment=NODE_ENV=production
Environment=PORT=8000
# Разрешить максимум 1 аквариум (если делаете только для себя/семьи)
Environment=AQUA_MAX_TANKS=1
# Лимит диска под рисунки в мегабайтах (например, 1 ГБ)
Environment=AQUA_MAX_DATA_MB=1024

[Install]
WantedBy=multi-user.target
```

Сохраните файл (`Ctrl+O`, `Enter`, затем `Ctrl+X`) и запустите службу:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now paper-aquarium
sudo systemctl status paper-aquarium
```

---

### Шаг 4: Настройка Nginx и SSL

#### Вариант А: Сертификат выдан на IP-адрес

Если вы используете SSL-сертификат, выписанный непосредственно на публичный IP-адрес вашего сервера (например, от ZeroSSL, Sectigo или публичного CA):

1. Скопируйте файлы сертификата и приватного ключа на сервер (например, через `scp`):
   - Цепочка сертификатов: `/etc/ssl/certs/ip_cert.crt`
   - Приватный ключ: `/etc/ssl/private/ip_cert.key`

2. Установите строгие права доступа на приватный ключ:
   ```bash
   sudo chmod 600 /etc/ssl/private/ip_cert.key
   ```

3. Создайте конфигурацию Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/aquarium
   ```

   Вставьте конфигурацию (замените `123.45.67.89` на ваш реальный IP-адрес):

   ```nginx
   server {
       listen 80;
       server_name 123.45.67.89;

       # Перенаправление всего HTTP-трафика на HTTPS
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name 123.45.67.89;

       ssl_certificate /etc/ssl/certs/ip_cert.crt;
       ssl_certificate_key /etc/ssl/private/ip_cert.key;

       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;
       ssl_prefer_server_ciphers on;

       # Максимальный размер загружаемого фото/видео (для фонов и съёмки)
       client_max_body_size 25M;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;

           # Поддержка WebSocket и Server-Sent Events (SSE)
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";

           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;

           # Отключаем буферизацию для мгновенной доставки событий появления рыбок
           proxy_buffering off;
           proxy_read_timeout 86400s;
       }
   }
   ```

4. Активируйте сайт и перезапустите Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/aquarium /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

#### Вариант Б: Бесплатный Let's Encrypt для домена

Если у вас есть домен (например, `aquarium.example.com`), направленный A-записью на IP сервера:

1. Создайте базовую конфигурацию Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/aquarium
   ```
   ```nginx
   server {
       listen 80;
       server_name aquarium.example.com;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

2. Активируйте и выпустите сертификат через Certbot:
   ```bash
   sudo ln -s /etc/nginx/sites-available/aquarium /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d aquarium.example.com
   ```
   Certbot автоматически настроит HTTPS и автообновление сертификата.

---

## 4. Способ 2: Развертывание через Docker Compose

Если вы предпочитаете Docker:

1. Установите Docker и Docker Compose:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```

2. Перейдите в каталог проекта:
   ```bash
   cd /opt/paper-aquarium
   cp .env.example .env
   nano .env   # Укажите нужные лимиты
   ```

3. Подготовьте права на папку данных:
   ```bash
   mkdir -p data
   sudo chown -R 1000:1000 data
   ```

4. Запустите:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

---

## 5. Безопасность и ограничение доступа

### Как запретить посторонним создавать новые аквариумы

Если вы запустили сервер и дали ссылку друзьям, по умолчанию на главной странице (`/`) любой посетитель видит кнопку «Новое аквариум» и поле ввода названия.

Чтобы исключить создание лишних аквариумов и защитить сервер от спама:

#### Способ 1: Ограничить количество аквариумов системным лимитом (Рекомендуется)
В файле сервиса `/etc/systemd/system/paper-aquarium.service` (или в файле `.env` для Docker) установите:
```ini
Environment=AQUA_MAX_TANKS=1
```
После создания вашего первого аквариума сервер будет возвращать ошибку `403 limit reached` при любой попытке создать ещё один аквариум через API.

#### Способ 2: Автоматический редирект с главной страницы в Nginx
Вы можете сделать так, чтобы при открытии корня сайта (`/`) посетителя сразу перенаправляло в ваш готовый аквариум, минуя главную витрину:

Добавьте в блок `server` вашего Nginx:
```nginx
location = / {
    return 302 /t/mk4dp7wq2f;  # укажите 10-значный код вашего аквариума
}
```
Тогда любой, кто просто зайдёт на `https://ваш-ip/`, сразу окажется внутри аквариума и не увидит форму создания нового.

---

### Защита окна администратора

1. **Как работает встроенная защита:**
   - Каждое действие в панели управления (`/admin.html`): удаление рыбки, очистка аквариума, смена фона, удаление аквариума — требует пароль администратора.
   - Пароль проверяется сервером по криптографическому алгоритму **scrypt с уникальной солью**. В открытом виде пароль на сервере не хранится.
   - Защита от перебора (брутфорса): после нескольких неверных попыток ввода сервер включает экспоненциальную временную задержку (`429 Too Many Requests`).

2. **Дополнительное ограничение доступа к админке в Nginx:**
   Если вы хотите, чтобы вход в панель администратора был доступен только с вашего домашнего IP-адреса:

   ```nginx
   location /admin.html {
       allow 95.165.12.34;   # ваш домашний статический IP
       deny all;

       proxy_pass http://127.0.0.1:8000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   }
   ```

---

### Квоты на диск и память

Сервер имеет встроенные защитные переменные окружения, предотвращающие исчерпание ресурсов:

| Переменная | По умолчанию | Описание |
|---|---|---|
| `AQUA_MAX_TANKS` | `200` | Максимальное число аквариумов на сервере |
| `AQUA_TANKS_PER_HOUR` | `5` | Лимит создания аквариумов с одного IP в час |
| `AQUA_MAX_FISH` | `40` | Максимум рыбок в одном аквариуме (старые уплывают) |
| `AQUA_MAX_BG` | `8` | Лимит пользовательских фонов на аквариум |
| `AQUA_MAX_DATA_MB` | `2000` | Максимальный объём папки `data/` в МБ |

Все эти параметры можно задать в секции `[Service]` в файле `paper-aquarium.service` вида:
```ini
Environment=AQUA_MAX_DATA_MB=1024
```

---

## 6. Файрвол (UFW)

Настройте файрвол Ubuntu для защиты сервера от несанкционированного доступа:

```bash
# Разрешаем SSH (чтобы не потерять доступ!)
sudo ufw allow OpenSSH

# Разрешаем HTTP и HTTPS для Nginx
sudo ufw allow 'Nginx Full'

# Включаем файрвол
sudo ufw enable
sudo ufw status
```
Прямой доступ к порту 8000 снаружи открывать не нужно — весь трафик должен идти только через безопасный Nginx-прокси (порт 443).

---

## 7. Обновление, логи и резервное копирование

### Просмотр логов в реальном времени

```bash
# Логи службы аквариума
sudo journalctl -u paper-aquarium -f -n 100

# Логи ошибок Nginx
sudo tail -f /var/log/nginx/error.log
```

### Обновление кода из репозитория

```bash
cd /opt/paper-aquarium
sudo git pull origin main
sudo systemctl restart paper-aquarium
```

### Резервное копирование данных

Все аквариумы, рисунки и настройки хранятся в каталоге `/opt/paper-aquarium/data`.

Для создания резервной копии достаточно одной команды:
```bash
sudo tar -czf /var/backups/aquarium-data-$(date +%F).tar.gz -C /opt/paper-aquarium data
```

Рекомендуется периодически скачивать архив с резервной копией на домашний компьютер:
```bash
scp user@your-server-ip:/var/backups/aquarium-data-*.tar.gz ~/backups/
```

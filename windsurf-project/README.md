# YouTube MP3 Downloader

Node.js приложение для скачивания MP3 с YouTube через RapidAPI.

## Установка

```bash
npm install
```

## Использование

### Через командную строку:

```bash
# Базовое использование (сохраняет в ./downloads)
node index.js "https://www.youtube.com/watch?v=VIDEO_ID"

# С указанием директории для сохранения
node index.js "https://www.youtube.com/watch?v=VIDEO_ID" ./music
```

### Как модуль:

```javascript
const { downloadYouTubeMp3 } = require('./index.js');

(async () => {
  try {
    const savedPath = await downloadYouTubeMp3(
      'https://www.youtube.com/watch?v=VIDEO_ID',
      './downloads'
    );
    console.log('Saved to:', savedPath);
  } catch (error) {
    console.error('Error:', error);
  }
})();
```

## API

### `downloadYouTubeMp3(videoUrl, outputDir)`

- `videoUrl` - URL видео на YouTube
- `outputDir` - директория для сохранения (по умолчанию: `./downloads`)
- Возвращает: `Promise<string>` - путь к сохраненному файлу

### `getDownloadUrl(videoUrl)`

Получает URL для скачивания от API.

### `downloadMp3(downloadUrl, outputPath)`

Скачивает MP3 по полученному URL.

## Структура проекта

```
youtube-mp3-downloader/
├── package.json
├── index.js
├── README.md
└── downloads/          # Сюда сохраняются MP3 файлы
```

## Примечания

- API ключ уже встроен в код
- Каждый `downloadUrl` можно использовать только один раз
- Максимальное время ожидания: 120 секунд

"""
Парсер YouTube видео: субтитры, таймкоды, транскрипт
Интеграция с Google Sheets для хранения данных
"""

import os
import sys
import json
from youtube_transcript_api import YouTubeTranscriptApi
import requests
from io import BytesIO
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.credentials import Credentials
from google.oauth2 import service_account
import yt_dlp
from typing import Any, Dict, List, Optional, cast

class VideoParser:
    def __init__(self, google_credentials_path=None):
        """
        Инициализация парсера
        
        Args:
            google_credentials_path: Путь к JSON файлу с credentials для Google Sheets API
        """
        self.google_credentials_path = google_credentials_path
        self.sheets_service = None
        # Подхватываем cookies.txt рядом со скриптом (если есть)
        self.cookies_file = os.path.join(os.path.dirname(__file__), 'cookies.txt')
        
        if google_credentials_path and os.path.exists(google_credentials_path):
            self._init_google_sheets()
    
    def _init_google_sheets(self):
        """Инициализация Google Sheets API"""
        try:
            SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
            creds = service_account.Credentials.from_service_account_file(
                self.google_credentials_path, scopes=SCOPES
            )
            self.sheets_service = build('sheets', 'v4', credentials=creds)
            print("[OK] Google Sheets API инициализирован")
        except Exception as e:
            print(f"[ERR] Ошибка инициализации Google Sheets: {e}")
            self.sheets_service = None
    
    def get_video_info(self, video_id: str) -> Optional[Dict[str, Any]]:
        """
        Получить базовую информацию о видео
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            dict: Информация о видео
        """
        try:
            ydl_opts: Dict[str, Any] = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
                # Важно: не пытаться подбирать недоступные форматы при download=False
                'skip_download': True,               # алиас simulate=True
                'ignore_no_formats_error': True,     # не падать, если формат не найден
                'format': 'best/bestvideo+bestaudio',# безопасный формат на случай потребности
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android']
                    }
                }
            }
            if os.path.exists(self.cookies_file):
                ydl_opts['cookiefile'] = self.cookies_file
            
            with yt_dlp.YoutubeDL(cast(Any, ydl_opts)) as ydl:
                info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
                
                return {
                    'video_id': video_id,
                    'title': info.get('title'),
                    'description': info.get('description'),
                    'duration': info.get('duration'),
                    'channel': info.get('channel'),
                    'channel_id': info.get('channel_id'),
                    'upload_date': info.get('upload_date'),
                    'view_count': info.get('view_count'),
                    'like_count': info.get('like_count'),
                    'categories': info.get('categories', []),
                    'tags': info.get('tags', []),
                }
        except Exception as e:
            print(f"[ERR] Ошибка получения информации о видео: {e}")
            return None
    
    def get_chapters(self, video_id: str) -> List[Dict[str, Any]]:
        """
        Извлечь таймкоды (chapters) из видео
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            list: Список таймкодов с названиями
        """
        try:
            ydl_opts: Dict[str, Any] = {
                'quiet': True,
                'no_warnings': True,
                'skip_download': True,
                'ignore_no_formats_error': True,
                'format': 'best/bestvideo+bestaudio',
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android']
                    }
                }
            }
            if os.path.exists(self.cookies_file):
                ydl_opts['cookiefile'] = self.cookies_file
            
            with yt_dlp.YoutubeDL(cast(Any, ydl_opts)) as ydl:
                info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
                chapters = info.get('chapters', [])
                
                if chapters:
                    return [
                        {
                            'start_time': ch.get('start_time'),
                            'end_time': ch.get('end_time'),
                            'title': ch.get('title'),
                        }
                        for ch in chapters
                    ]
                
                # Если нет chapters, попробовать извлечь из description
                description = info.get('description', '')
                return self._parse_chapters_from_description(description)
                
        except Exception as e:
            print(f"[ERR] Ошибка получения таймкодов: {e}")
            return []
    
    def _parse_chapters_from_description(self, description):
        """Парсинг таймкодов из описания видео"""
        import re
        chapters = []
        
        # Паттерны для таймкодов: 00:00, 0:00:00, etc.
        patterns = [
            r'(\d{1,2}):(\d{2})\s*-?\s*(.+)',  # 0:00 - Title
            r'(\d{1,2}):(\d{2}):(\d{2})\s*-?\s*(.+)',  # 0:00:00 - Title
        ]
        
        lines = description.split('\n')
        for line in lines:
            for pattern in patterns:
                match = re.match(pattern, line.strip())
                if match:
                    groups = match.groups()
                    if len(groups) == 3:  # MM:SS format
                        minutes, seconds, title = groups
                        start_time = int(minutes) * 60 + int(seconds)
                    elif len(groups) == 4:  # HH:MM:SS format
                        hours, minutes, seconds, title = groups
                        start_time = int(hours) * 3600 + int(minutes) * 60 + int(seconds)
                    
                    chapters.append({
                        'start_time': start_time,
                        'title': title.strip(),
                    })
                    break
        
        return chapters
    
    def get_transcript(self, video_id, languages=['en', 'ru'], translate_to: str | None = None):
        """
        Получить транскрипт (автогенерируемые или ручные субтитры)
        
        Args:
            video_id: YouTube video ID
            languages: Список предпочитаемых языков
            
        Returns:
            dict: Транскрипт с временными метками
        """
        try:
            # Попытка получить транскрипт через официальные API субтитров
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            # 1) Ручные субтитры
            for lang in languages:
                try:
                    transcript = transcript_list.find_manually_created_transcript([lang])
                    return {
                        'language': lang,
                        'type': 'manual',
                        'segments': transcript.fetch(),
                        'source': 'youtube_transcript_api'
                    }
                except Exception:
                    pass

            # 2) Автогенерируемые (YouTube)
            for lang in languages:
                try:
                    transcript = transcript_list.find_generated_transcript([lang])
                    return {
                        'language': lang,
                        'type': 'generated',
                        'segments': transcript.fetch(),
                        'source': 'youtube_transcript_api'
                    }
                except Exception:
                    pass

            # 3) Перевод доступных субтитров на нужный язык
            if translate_to:
                try:
                    first = None
                    try:
                        first = transcript_list.find_transcript(['en'])
                    except Exception:
                        pass
                    if not first:
                        for tr in transcript_list:
                            first = tr
                            break
                    if first:
                        translated = first.translate(translate_to)
                        return {
                            'language': translate_to,
                            'type': 'translated',
                            'segments': translated.fetch(),
                            'source': 'youtube_transcript_api'
                        }
                except Exception:
                    pass

            # 4) Фолбэк через yt-dlp: получить ссылки на субтитры и скачать текст без видео
            print("[INFO] Фолбэк: пытаемся получить субтитры через yt-dlp")
            via_ytdlp = self._get_subtitles_via_ytdlp(video_id, languages)
            if via_ytdlp:
                return via_ytdlp

            print(f"[WARN] Транскрипт не найден для языков: {languages}")
            return None

        except Exception as e:
            print(f"[ERR] Ошибка получения транскрипта: {e}")
            # Попробуем фолбэк даже при общей ошибке
            try:
                via_ytdlp = self._get_subtitles_via_ytdlp(video_id, languages)
                if via_ytdlp:
                    return via_ytdlp
            except Exception:
                pass
            return None

    def _parse_vtt(self, vtt_text: str) -> List[Dict[str, Any]]:
        """Мини-парсер WebVTT -> список сегментов {start, duration, text}."""
        def parse_ts(ts: str) -> float:
            # 00:00:05.123 или 00:05.123
            parts = ts.replace(',', '.').split(':')
            if len(parts) == 3:
                h, m, s = parts
                return int(h) * 3600 + int(m) * 60 + float(s)
            if len(parts) == 2:
                m, s = parts
                return int(m) * 60 + float(s)
            try:
                return float(parts[0])
            except Exception:
                return 0.0

        segments: List[Dict[str, Any]] = []
        blocks = vtt_text.split('\n\n')
        for block in blocks:
            lines = [ln.strip('\ufeff').strip() for ln in block.splitlines() if ln.strip()]
            if len(lines) < 2:
                continue
            # возможная первая строка — ID, поэтому ищем стрелку в любой из первых двух строк
            time_line = None
            for i in range(min(2, len(lines))):
                if '-->' in lines[i]:
                    time_line = lines[i]
                    text_lines = lines[i+1:]
                    break
            if not time_line:
                continue
            try:
                start_s, end_s = [s.strip() for s in time_line.split('-->')[:2]]
                start = parse_ts(start_s)
                end = parse_ts(end_s)
                text = ' '.join(text_lines).strip()
                if text:
                    segments.append({'start': start, 'duration': max(0.0, end - start), 'text': text})
            except Exception:
                continue
        return segments

    def _get_subtitles_via_ytdlp(self, video_id: str, languages: List[str]):
        """Попробовать достать ручные/авто субтитры через yt-dlp без скачивания видео."""
        try:
            ydl_opts: Dict[str, Any] = {
                'quiet': True,
                'no_warnings': True,
                'skip_download': True,
                'ignore_no_formats_error': True,
                'extractor_args': { 'youtube': { 'player_client': ['android'] }},
            }
            if os.path.exists(self.cookies_file):
                ydl_opts['cookiefile'] = self.cookies_file

            with yt_dlp.YoutubeDL(cast(Any, ydl_opts)) as ydl:
                info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)

            # В info есть две структуры с URL субтитров
            subs = info.get('subtitles') or {}
            auto = info.get('automatic_captions') or {}

            def try_download(lang_map, label: str):
                for lang in languages:
                    tracks = lang_map.get(lang)
                    if not tracks:
                        continue
                    # выбрать предпочтительно vtt
                    # список вида [{ext:'vtt', url:'...'}, ...]
                    track = None
                    for t in tracks:
                        if t.get('ext') == 'vtt':
                            track = t
                            break
                    if not track:
                        track = tracks[0]
                    try:
                        resp = requests.get(track['url'], timeout=20)
                        if resp.ok and resp.text:
                            segs = self._parse_vtt(resp.text)
                            if segs:
                                return {
                                    'language': lang,
                                    'type': 'manual' if label == 'manual' else 'generated',
                                    'segments': segs,
                                    'source': 'yt_dlp',
                                    'raw_format': track.get('ext', 'vtt')
                                }
                    except Exception:
                        continue
                return None

            # Сначала ручные
            data = try_download(subs, 'manual')
            if data:
                return data
            # Потом авто
            data = try_download(auto, 'auto')
            if data:
                return data
            return None
        except Exception as e:
            print(f"[WARN] yt-dlp subtitles fallback failed: {e}")
            return None
    
    def get_full_text(self, transcript):
        """
        Объединить все сегменты транскрипта в единый текст
        
        Args:
            transcript: Транскрипт от get_transcript()
            
        Returns:
            str: Полный текст
        """
        if not transcript or 'segments' not in transcript:
            return ""
        
        return " ".join([seg['text'] for seg in transcript['segments']])

    @staticmethod
    def _format_duration_hhmm(seconds: int) -> str:
        """Преобразовать длительность в секунду в формат ЧЧ:ММ (без секунд)."""
        if not seconds or seconds < 0:
            return "00:00"
        minutes_total = int(seconds) // 60
        hours = minutes_total // 60
        minutes = minutes_total % 60
        return f"{hours:02d}:{minutes:02d}"

    @staticmethod
    def _format_hhmmss(seconds: int) -> str:
        try:
            sec = int(seconds or 0)
        except Exception:
            sec = 0
        hh = sec // 3600
        mm = (sec % 3600) // 60
        ss = sec % 60
        return f"{hh:02d}:{mm:02d}:{ss:02d}"

    @staticmethod
    def _format_date_ddmmyyyy(yyyymmdd: str) -> str:
        if not yyyymmdd or len(str(yyyymmdd)) < 8:
            return ""
        s = str(yyyymmdd)
        return f"{s[6:8]}.{s[4:6]}.{s[0:4]}"
    
    def parse_video(self, video_id, languages=['en', 'ru', 'uk', 'de', 'fr', 'es'], translate_to: str | None = None):
        """
        Полный парсинг видео: информация + таймкоды + транскрипт
        
        Args:
            video_id: YouTube video ID
            languages: Список предпочитаемых языков для транскрипта
            
        Returns:
            dict: Полные данные о видео
        """
        print(f"[PARSE] Парсинг видео: {video_id}")
        print("STEP: info")
        print("PROGRESS: 10")

        # 1. Базовая информация
        info = self.get_video_info(video_id)
        if not info:
            return None
        print("PROGRESS: 20")

        # 2. Таймкоды
        print("STEP: chapters")
        chapters = self.get_chapters(video_id)
        print(f"  [INFO] Найдено таймкодов: {len(chapters)}")
        print("PROGRESS: 50")

        # 3. Транскрипт/субтитры
        print("STEP: transcript")
        transcript = self.get_transcript(video_id, languages, translate_to=translate_to)
        if transcript:
            print(f"  [TRANSCRIPT] Получен: {transcript['language']} ({transcript['type']})")
            full_text = self.get_full_text(transcript)
        else:
            # Попробуем распознать речь через OpenAI Whisper API, если доступно
            use_asr = os.environ.get('ENABLE_ASR_IF_NO_CAPTIONS', '1') not in ('0', 'false', 'no')
            api_key = os.environ.get('OPENAI_API_KEY')
            if use_asr and api_key:
                print("[INFO] Субтитров нет — пробуем OpenAI Whisper API")
                try:
                    asr_data = self._transcribe_via_openai_whisper(video_id, api_key)
                    if asr_data:
                        transcript = asr_data
                        full_text = self.get_full_text(transcript)
                    else:
                        full_text = ""
                except Exception as e:
                    print(f"[WARN] Whisper ASR failed: {e}")
                    full_text = ""
            else:
                full_text = ""
        print("PROGRESS: 80")

        return {
            'info': info,
            'chapters': chapters,
            'transcript': transcript,
            'full_text': full_text,
        }

    def _get_best_audio_url(self, video_id: str) -> Optional[str]:
        try:
            ydl_opts: Dict[str, Any] = {
                'quiet': True,
                'no_warnings': True,
                'skip_download': True,
                'ignore_no_formats_error': True,
                'format': 'bestaudio/best',
                'extractor_args': { 'youtube': { 'player_client': ['android'] }},
            }
            if os.path.exists(self.cookies_file):
                ydl_opts['cookiefile'] = self.cookies_file
            with yt_dlp.YoutubeDL(cast(Any, ydl_opts)) as ydl:
                info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
                # у аудио формата должен быть direct url
                url = info.get('url')
                if not url:
                    # иногда нужный урл в entries/formats
                    fmts = info.get('formats') or []
                    audio = None
                    for f in fmts:
                        if f.get('acodec') and f.get('vcodec') in (None, 'none') and f.get('url'):
                            audio = f
                    if audio:
                        url = audio.get('url')
                return url
        except Exception:
            return None

    def _transcribe_via_openai_whisper(self, video_id: str, api_key: str):
        """Распознать речь без скачивания видео на диск: забираем аудио поток и отправляем в OpenAI Whisper API."""
        try:
            try:
                from openai import OpenAI
            except Exception:
                print("[WARN] Библиотека openai не установлена — пропускаем ASR")
                return None

            audio_url = self._get_best_audio_url(video_id)
            if not audio_url:
                return None

            # Качаем в память. Важно: большие видео могут занять много RAM — ограничим до ~100 МБ
            max_bytes = int(os.environ.get('ASR_MAX_BYTES', 100 * 1024 * 1024))
            bio = BytesIO()
            with requests.get(audio_url, stream=True, timeout=30) as r:
                r.raise_for_status()
                for chunk in r.iter_content(chunk_size=1024 * 256):
                    if not chunk:
                        continue
                    bio.write(chunk)
                    if bio.tell() > max_bytes:
                        print("[WARN] Достигнут лимит ASR_MAX_BYTES, обрезаем аудио")
                        break
            bio.seek(0)

            client = OpenAI(api_key=api_key)
            resp = client.audio.transcriptions.create(
                model=os.environ.get('ASR_MODEL', 'whisper-1'),
                file=('audio.mp3', bio),
                response_format='verbose_json'
            )

            # resp содержит text и segments
            segments = []
            for seg in getattr(resp, 'segments', []) or []:
                segments.append({'start': seg.get('start', 0.0), 'duration': float(seg.get('end', 0.0)) - float(seg.get('start', 0.0)), 'text': seg.get('text', '')})

            if not segments and getattr(resp, 'text', None):
                segments = [{'start': 0.0, 'duration': 0.0, 'text': resp.text}]

            if not segments:
                return None

            return {
                'language': getattr(resp, 'language', 'auto'),
                'type': 'asr_openai',
                'segments': segments,
                'source': 'openai_whisper'
            }
        except Exception as e:
            print(f"[ERR] OpenAI Whisper error: {e}")
            return None
    
    def save_to_google_sheets(self, spreadsheet_id, data, sheet_name='Videos'):
        """
        Сохранить данные парсинга в Google Sheets
        
        Args:
            spreadsheet_id: ID Google Sheets документа
            data: Данные от parse_video()
            sheet_name: Название листа
            
        Returns:
            bool: Успех операции
        """
        if not self.sheets_service:
            print("[ERR] Google Sheets API не инициализирован")
            return False
        
        try:
            info = data['info']
            chapters = data['chapters']
            transcript = data.get('transcript')
            # Для таблицы: длительность теперь в формате ЧЧ:ММ:СС
            duration_hhmmss = self._format_hhmmss(info.get('duration') or 0)
            has_subs = 'да' if transcript and transcript.get('segments') else 'нет'
            subs_lang = transcript.get('language') if transcript else ''
            url = f"https://www.youtube.com/watch?v={info['video_id']}"
            # теги или категории — в одну ячейку, первые 10
            tags = info.get('tags') or info.get('categories') or []
            tags_str = ', '.join(tags[:10]) if isinstance(tags, list) else str(tags)
            status = 'OK' if info else 'ERROR'
            upload_date = self._format_date_ddmmyyyy(info.get('upload_date', ''))

            # Таймкоды строкой построчно: HH:MM:SS — Title
            chapters_lines = []
            for ch in chapters or []:
                t = self._format_hhmmss(int(ch.get('start_time') or 0))
                title = ch.get('title') or ''
                chapters_lines.append(f"{t} — {title}")
            chapters_multiline = "\n".join(chapters_lines)

            # Новая схема колонок:
            # A:Video ID, B:URL, C:Название, D:Канал, E:Дата (ДД.ММ.ГГГГ), F:Длительность (ЧЧ:ММ:СС),
            # G:Таймкоды (список), H:Субтитры (да/нет), I:Язык субтитров, J:Теги/Категории, K:Статус
            values = [[
                info['video_id'],
                url,
                info.get('title', ''),
                info.get('channel', ''),
                upload_date,
                duration_hhmmss,
                chapters_multiline,
                has_subs,
                subs_lang,
                tags_str,
                status,
            ]]
            
            body = {'values': values}
            
            # Вставить данные
            try:
                result = self.sheets_service.spreadsheets().values().append(
                    spreadsheetId=spreadsheet_id,
                    range=f'{sheet_name}!A1',  # Универсально: допишет справа столько колонок, сколько дадим
                    valueInputOption='RAW',
                    body=body
                ).execute()
            except HttpError as e:
                raise
            
            print(f"[OK] Данные сохранены в Google Sheets: {result.get('updates').get('updatedCells')} ячеек")
            return True
            
        except HttpError as e:
            print(f"[ERR] Ошибка Google Sheets API: {e}")
            return False
        except Exception as e:
            print(f"[ERR] Ошибка сохранения в Google Sheets: {e}")
            return False
    
    def create_sheets_template(self, spreadsheet_id, sheet_name='Videos'):
        """
        Создать шаблон таблицы с заголовками
        
        Args:
            spreadsheet_id: ID Google Sheets документа
            sheet_name: Название листа
        """
        if not self.sheets_service:
            print("[ERR] Google Sheets API не инициализирован")
            return False
        
        try:
            headers = [[
                'Video ID',
                'URL',
                'Название',
                'Канал',
                'Дата публикации',
                'Длительность (ЧЧ:ММ:СС)',
                'Таймкоды (список)',
                'Субтитры',
                'Язык субтитров',
                'Теги/Категории',
                'Статус',
            ]]
            
            body = {'values': headers}
            
            result = self.sheets_service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f'{sheet_name}!A1:K1',
                valueInputOption='RAW',
                body=body
            ).execute()
            
            print(f"[OK] Шаблон создан: {result.get('updatedCells')} ячеек")
            return True
            
        except Exception as e:
            print(f"[ERR] Ошибка создания шаблона: {e}")
            return False


def main():
    """Пример использования"""
    import argparse
    
    parser = argparse.ArgumentParser(description='YouTube Video Parser')
    parser.add_argument('video_id', nargs='?', default=None, help='YouTube Video ID')
    parser.add_argument('--credentials', help='Path to Google Sheets credentials JSON')
    parser.add_argument('--spreadsheet', help='Google Sheets Spreadsheet ID')
    parser.add_argument('--languages', nargs='+', default=['en', 'ru', 'uk', 'de', 'fr', 'es'], help='Preferred languages for transcript')
    parser.add_argument('--translate-to', default='ru', help='Auto-translate transcript to this language if not found in preferred languages')
    parser.add_argument('--init-template', action='store_true', help='Initialize or update Google Sheets header row to the latest schema and exit')
    parser.add_argument('--sheet-name', default='Videos', help='Sheet name to use (default: Videos)')
    
    args = parser.parse_args()

    # Инициализация парсера
    parser_instance = VideoParser(args.credentials)

    # Режим инициализации шаблона таблицы
    if args.init_template:
        if not args.spreadsheet:
            print("[ERR] Spreadsheet ID is required for --init-template")
            sys.exit(2)
        ok = parser_instance.create_sheets_template(args.spreadsheet, sheet_name=args.sheet_name)
        sys.exit(0 if ok else 1)

    if not args.video_id:
        print("[ERR] VIDEO_ID is required when not using --init-template")
        sys.exit(2)
    
    # Парсинг видео
    data = parser_instance.parse_video(args.video_id, args.languages, translate_to=args.translate_to)
    
    if data:
        print(f"\n[OK] Парсинг завершен!")
        print(f"  Название: {data['info']['title']}")
        print(f"  Таймкодов: {len(data['chapters'])}")
        print(f"  Текст: {len(data['full_text'])} символов")
        
        # Сохранить в JSON
        output_file = f"{args.video_id}_parsed.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  [SAVE] Сохранено в: {output_file}")
        
        # Сохранить в Google Sheets если указан spreadsheet
        if args.spreadsheet and parser_instance.sheets_service:
            print("STEP: sheets")
            if parser_instance.save_to_google_sheets(args.spreadsheet, data):
                print("PROGRESS: 95")
    else:
        print("[ERR] Не удалось распарсить видео")
        sys.exit(1)


if __name__ == '__main__':
    main()

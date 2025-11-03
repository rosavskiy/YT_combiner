"""
Downloader сервис для скачивания YouTube видео
Использует yt-dlp для максимальной совместимости
"""

import os
import json
import sys
from pathlib import Path
import yt_dlp
from typing import Any, Dict, List, Optional, Callable, cast


class VideoDownloader:
    def __init__(self, download_dir='downloads'):
        """
        Инициализация загрузчика
        
        Args:
            download_dir: Директория для сохранения видео
        """
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(exist_ok=True)
        # Путь к cookies.txt (если присутствует рядом со скриптом)
        self.cookies_file = (Path(__file__).parent / 'cookies.txt')
        # Предупреждение о старой версии yt-dlp
        try:
            ver = getattr(yt_dlp, '__version__', '0')
            # Очень грубая проверка: если год < 2025, советуем обновить
            if isinstance(ver, str) and ver[:4].isdigit() and int(ver[:4]) < 2025:
                print(f"[WARN] yt-dlp version {ver} may be outdated. Consider updating to latest to avoid YouTube changes.")
        except Exception:
            pass
    
    def get_video_formats(self, video_id: str) -> List[Dict[str, Any]]:
        """
        Получить доступные форматы видео
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            list: Список доступных форматов
        """
        try:
            ydl_opts: Dict[str, Any] = {
                'quiet': True,
                'no_warnings': True,
            }
            if self.cookies_file.exists():
                ydl_opts['cookiefile'] = str(self.cookies_file)
            
            with yt_dlp.YoutubeDL(cast(Any, ydl_opts)) as ydl:
                info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
                
                formats: List[Dict[str, Any]] = []
                formats_list = info.get('formats') or []
                for f in formats_list:
                    if f.get('vcodec') != 'none' and f.get('acodec') != 'none':  # Видео + аудио
                        formats.append({
                            'format_id': f.get('format_id'),
                            'ext': f.get('ext'),
                            'resolution': f.get('resolution'),
                            'height': f.get('height'),
                            'width': f.get('width'),
                            'fps': f.get('fps'),
                            'filesize': f.get('filesize'),
                            'vcodec': f.get('vcodec'),
                            'acodec': f.get('acodec'),
                            'url': f.get('url'),
                        })
                
                # Сортировать по высоте (качеству)
                formats.sort(key=lambda x: x.get('height', 0) if x.get('height') else 0, reverse=True)
                return formats
                
        except Exception as e:
            print(f"[ERR] Ошибка получения форматов: {e}")
            return []

    def get_formats_debug(self, video_id: str) -> Dict[str, Any]:
        """Вернуть подробную диагностику доступных форматов и requested_formats.

        Returns:
            dict: { success, video_id, title, duration, uploader, webpage_url, formats: [...], requested_formats: [...] }
        """
        try:
            base_opts: Dict[str, Any] = {
                'quiet': True,
                'no_warnings': True,
                'noplaylist': True,
                'ignore_no_formats_error': True,
            }
            if self.cookies_file.exists():
                base_opts['cookiefile'] = str(self.cookies_file)

            # Первый проход: общая информация и formats
            with yt_dlp.YoutubeDL(cast(Any, base_opts)) as ydl:
                info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)

            if not info:
                return { 'success': False, 'video_id': video_id, 'error': 'Failed to extract info' }

            formats_list = info.get('formats') or []
            def map_fmt(f: Dict[str, Any]) -> Dict[str, Any]:
                vcodec = f.get('vcodec')
                acodec = f.get('acodec')
                return {
                    'format_id': f.get('format_id'),
                    'ext': f.get('ext'),
                    'height': f.get('height'),
                    'width': f.get('width'),
                    'fps': f.get('fps'),
                    'filesize': f.get('filesize'),
                    'vcodec': vcodec,
                    'acodec': acodec,
                    'has_url': bool(f.get('url')),
                    'is_progressive': (vcodec != 'none' and acodec != 'none'),
                    'is_video_only': (vcodec != 'none' and acodec == 'none'),
                    'is_audio_only': (vcodec == 'none' and acodec != 'none'),
                    'format_note': f.get('format_note'),
                    'tbr': f.get('tbr'),
                    'abr': f.get('abr'),
                    'vbr': f.get('vbr'),
                }

            mapped_formats = [map_fmt(f) for f in formats_list]
            mapped_formats.sort(key=lambda x: (x.get('height') or 0, x.get('tbr') or 0), reverse=True)

            # Второй проход: принудительно запросим bestvideo+bestaudio, чтобы получить requested_formats
            req_info = None
            try:
                opts2 = dict(base_opts)
                opts2['format'] = 'bestvideo*+bestaudio*/bestvideo+bestaudio/best'
                with yt_dlp.YoutubeDL(cast(Any, opts2)) as y2:
                    req_info = y2.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
            except Exception as e:
                req_info = {'error': str(e)}

            def map_req(r: Dict[str, Any]) -> Dict[str, Any]:
                if not isinstance(r, dict):
                    return {'note': 'not a dict'}
                return {
                    'format_id': r.get('format_id'),
                    'ext': r.get('ext'),
                    'height': r.get('height'),
                    'width': r.get('width'),
                    'vcodec': r.get('vcodec'),
                    'acodec': r.get('acodec'),
                    'has_url': bool(r.get('url')),
                }

            requested = []
            if req_info and isinstance(req_info, dict):
                rf = req_info.get('requested_formats')
                if isinstance(rf, list):
                    requested = [map_req(x) for x in rf]

            return {
                'success': True,
                'video_id': video_id,
                'title': info.get('title'),
                'duration': info.get('duration'),
                'uploader': info.get('uploader'),
                'webpage_url': info.get('webpage_url'),
                'formats': mapped_formats,
                'requested_formats': requested,
            }
        except Exception as e:
            print(f"[ERR] Ошибка диагностики форматов: {e}")
            return { 'success': False, 'video_id': video_id, 'error': str(e) }
    
    def download_video(
        self,
        video_id: str,
        quality: str = 'highest',
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> Dict[str, Any]:
        """
        Скачать видео в указанном качестве
        
        Args:
            video_id: YouTube video ID
            quality: Качество - 'highest', '1080', '720', '480', '360' или format_id
            progress_callback: Функция для отслеживания прогресса
            
        Returns:
            dict: Информация о скачанном файле
        """
        try:
            import shutil
            has_ffmpeg = shutil.which('ffmpeg') is not None or shutil.which('ffmpeg.exe') is not None

            # Форматы: сначала пробуем прогрессивные (muxed), затем fallback на объединение видео+аудио (если есть ffmpeg)
            if quality == 'highest':
                prog_fmt = 'best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]'
                merge_fmt = 'bestvideo*+bestaudio*/bestvideo+bestaudio/best'
            elif quality in ['1080', '720', '480', '360']:
                prog_fmt = (
                    f"best[height<={quality}][ext=mp4][vcodec!=none][acodec!=none]/"
                    f"best[height<={quality}][vcodec!=none][acodec!=none]"
                )
                merge_fmt = (
                    f"bestvideo*[height<={quality}]+bestaudio*/bestvideo[height<={quality}]+bestaudio/"
                    f"best[height<={quality}]"
                )
            else:
                prog_fmt = quality
                merge_fmt = quality

            # База опций
            base_opts: Dict[str, Any] = {
                'outtmpl': str(self.download_dir / '%(id)s_%(title)s.%(ext)s'),
                'quiet': False,
                'no_warnings': False,
                'noplaylist': True,
                'extractor_retries': 3,
                'retries': 3,
                'concurrent_fragment_downloads': 1,
                'geo_bypass': True,
                'geo_bypass_country': 'US',
                'http_headers': {
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
                },
                'extractor_args': { 'youtube': { 'po_token_sources': ['auto', 'web'], 'player_skip': ['webpage'] } },
            }
            if self.cookies_file.exists():
                base_opts['cookiefile'] = str(self.cookies_file)

            if progress_callback:
                base_opts['progress_hooks'] = [progress_callback]

            # Попробуем разные клиенты YouTube (иногда помогает обойти nsig и 400)
            client_variants = [
                None,
                ['android'],
                ['web'],
                ['ios'],
                ['tv'],
                ['android', 'web'],
            ]

            last_err: Optional[str] = None

            # 1) Попытка прогрессивного формата
            for clients in client_variants:
                opts = dict(base_opts)
                opts['format'] = prog_fmt
                if clients:
                    opts['extractor_args'] = { 'youtube': { 'player_client': clients, 'po_token_sources': ['auto'] } }
                try:
                    with yt_dlp.YoutubeDL(cast(Any, opts)) as ydl:
                        info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=True)
                        filename = ydl.prepare_filename(info)
                        filesize = os.path.getsize(filename) if os.path.exists(filename) else 0
                        return {
                            'success': True,
                            'video_id': video_id,
                            'title': info.get('title'),
                            'filename': filename,
                            'filesize': filesize,
                            'duration': info.get('duration'),
                            'resolution': f"{info.get('width')}x{info.get('height')}",
                            'format': info.get('format'),
                            'ext': info.get('ext'),
                        }
                except Exception as e1:
                    last_err = str(e1)
                    continue

            # 2) Фолбэк: объединение bestvideo+bestaudio (если есть ffmpeg)
            if has_ffmpeg:
                for clients in client_variants:
                    opts = dict(base_opts)
                    opts['format'] = merge_fmt
                    opts['merge_output_format'] = 'mp4'
                    if clients:
                        opts['extractor_args'] = { 'youtube': { 'player_client': clients, 'po_token_sources': ['auto'] } }
                    try:
                        with yt_dlp.YoutubeDL(cast(Any, opts)) as ydl:
                            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=True)
                            filename = ydl.prepare_filename(info)
                            # Если итоговый контейнер mp4 — имя может уже быть mp4
                            if not filename.lower().endswith('.mp4'):
                                mp4 = filename.rsplit('.', 1)[0] + '.mp4'
                                if os.path.exists(mp4):
                                    filename = mp4
                            filesize = os.path.getsize(filename) if os.path.exists(filename) else 0
                            return {
                                'success': True,
                                'video_id': video_id,
                                'title': info.get('title'),
                                'filename': filename,
                                'filesize': filesize,
                                'duration': info.get('duration'),
                                'resolution': f"{info.get('width')}x{info.get('height')}",
                                'format': info.get('format'),
                                'ext': 'mp4',
                            }
                    except Exception as e2:
                        last_err = str(e2)
                        continue

            # Если ничего не получилось
            raise RuntimeError(last_err or 'Requested format is not available')

        except Exception as e:
            print(f"[ERR] Ошибка скачивания: {e}")
            return {
                'success': False,
                'error': str(e),
                'video_id': video_id,
            }

    def get_direct_progressive_url(self, video_id: str, quality: str = 'highest') -> Dict[str, Any]:
        """Получить прямой URL на прогрессивный (видео+аудио) формат для прямой загрузки пользователем.

        Args:
            video_id: YouTube video ID
            quality: 'highest' | '1080' | '720' | '480' | '360'
        Returns:
            dict: { success, video_id, title, url, ext, height, width, filesize, format_id }
        """
        try:
            base_opts: Dict[str, Any] = {
                'quiet': True,
                'no_warnings': True,
                'noplaylist': True,
                'geo_bypass': True,
                'geo_bypass_country': 'US',
                    'http_headers': {
                        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                    },
            }
            if self.cookies_file.exists():
                base_opts['cookiefile'] = str(self.cookies_file)

            # Попробуем несколько конфигураций client-ов, т.к. некоторые ролики требуют специфичных клиентов
            client_variants = [
                None,
                ['web'],
                ['android'],
                ['android', 'web'],
                ['ios'],
                ['tv'],
            ]

            last_error: Optional[str] = None
            info = None
            for clients in client_variants:
                ydl_opts = dict(base_opts)
                if clients:
                    ydl_opts['extractor_args'] = { 'youtube': { 'player_client': clients } }
                # Игнорируем ошибки форматов, если вдруг нет нужных
                ydl_opts['ignore_no_formats_error'] = True
                try:
                    with yt_dlp.YoutubeDL(cast(Any, ydl_opts)) as ydl:
                        info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
                        if info:
                            break
                except Exception as e1:
                    last_error = str(e1)
                    continue

            if not info:
                return { 'success': False, 'error': last_error or 'Failed to extract info', 'video_id': video_id }

            title = info.get('title') or video_id
            formats_list = info.get('formats') or []

            # Фильтр прогрессивных (видео+аудио), у которых есть прямой url
            progressive = [
                f for f in formats_list
                if (f.get('vcodec') != 'none' and f.get('acodec') != 'none' and f.get('url'))
            ]

            # Функция соответствия по качеству
            def height_ok(fh: Optional[int], q: str) -> bool:
                if not fh:
                    return False
                if q == 'highest':
                    return True
                try:
                    return int(fh) <= int(q)
                except Exception:
                    return True

            def pick_best(cands):
                if not cands:
                    return None
                # Сначала mp4, затем прочее; по высоте убыв.
                cands.sort(key=lambda f: (f.get('ext') == 'mp4', f.get('height') or 0), reverse=True)
                return cands[0]

            candidates = [f for f in progressive if height_ok(f.get('height'), quality)]
            best = pick_best(candidates) or pick_best(progressive)

            # Если прогрессивных нет — пробуем запросить общий 'best' без скачивания и взять url, если он единственный
            if not best:
                try:
                    ydl_opts2 = dict(base_opts)
                    ydl_opts2['format'] = 'best[ext=mp4][vcodec!=none][acodec!=none]/best[acodec!=none]/best'
                    ydl_opts2['ignore_no_formats_error'] = True
                    with yt_dlp.YoutubeDL(cast(Any, ydl_opts2)) as ydl2:
                        info2 = ydl2.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
                        if info2 and info2.get('url'):
                            return {
                                'success': True,
                                'video_id': video_id,
                                'title': info2.get('title') or title,
                                'url': info2.get('url'),
                                'ext': info2.get('ext') or 'mp4',
                                'height': info2.get('height'),
                                'width': info2.get('width'),
                                'filesize': info2.get('filesize'),
                                'format_id': info2.get('format_id'),
                            }
                except Exception as e2:
                    last_error = str(e2)

            if not best:
                return { 'success': False, 'error': last_error or 'No progressive formats found', 'video_id': video_id }

            return {
                'success': True,
                'video_id': video_id,
                'title': title,
                'url': best.get('url'),
                'ext': best.get('ext'),
                'height': best.get('height'),
                'width': best.get('width'),
                'filesize': best.get('filesize'),
                'format_id': best.get('format_id'),
            }
        except Exception as e:
            print(f"[ERR] Ошибка получения прямого URL: {e}")
            return { 'success': False, 'error': str(e), 'video_id': video_id }

    def get_best_av_urls(self, video_id: str, quality: str = 'highest') -> Dict[str, Any]:
        """Получить лучшие раздельные потоки видео и аудио (для последующего mux-а).

        Returns:
            dict: { success, video_id, title, video: {url, ext, height, width, vcodec, filesize}, audio: {url, ext, acodec, filesize} }
        """
        try:
            base_opts: Dict[str, Any] = {
                'quiet': True,
                'no_warnings': True,
                'noplaylist': True,
                'extractor_retries': 2,
                'ignore_no_formats_error': True,
                'geo_bypass': True,
                'geo_bypass_country': 'US',
                    'http_headers': {
                        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                    },
            }
            if self.cookies_file.exists():
                base_opts['cookiefile'] = str(self.cookies_file)

            # 1) Попробуем, как есть, получить раздельные форматы из formats
            client_variants = [None, ['web'], ['android'], ['android', 'web'], ['ios'], ['tv']]
            last_error = None
            info = None
            for clients in client_variants:
                ydl_opts = dict(base_opts)
                if clients:
                    ydl_opts['extractor_args'] = { 'youtube': { 'player_client': clients } }
                try:
                    with yt_dlp.YoutubeDL(cast(Any, ydl_opts)) as ydl:
                        info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
                        if info:
                            break
                except Exception as e1:
                    last_error = str(e1)
                    continue

            if not info:
                return { 'success': False, 'error': last_error or 'Failed to extract info', 'video_id': video_id }

            title = info.get('title') or video_id
            formats_list = info.get('formats') or []

            videos = [f for f in formats_list if f.get('vcodec') != 'none' and f.get('acodec') == 'none' and f.get('url')]
            audios = [f for f in formats_list if f.get('acodec') != 'none' and f.get('vcodec') == 'none' and f.get('url')]

            def height_ok(fh, q):
                if not fh:
                    return False
                if q == 'highest':
                    return True
                try:
                    return int(fh) <= int(q)
                except Exception:
                    return True

            cand_v = [f for f in videos if height_ok(f.get('height'), quality)] or videos
            cand_v.sort(key=lambda f: ((f.get('ext') == 'mp4') or ('avc' in str(f.get('vcodec','')) or 'h264' in str(f.get('vcodec',''))), f.get('height') or 0), reverse=True)
            best_v = cand_v[0] if cand_v else None

            audios.sort(key=lambda f: ((f.get('ext') == 'm4a') or ('aac' in str(f.get('acodec','')) or 'mp4a' in str(f.get('acodec',''))), f.get('abr') or 0), reverse=True)
            best_a = audios[0] if audios else None

            if best_v and best_a:
                return {
                    'success': True,
                    'video_id': video_id,
                    'title': title,
                    'video': {
                        'url': best_v.get('url'),
                        'ext': best_v.get('ext'),
                        'height': best_v.get('height'),
                        'width': best_v.get('width'),
                        'vcodec': best_v.get('vcodec'),
                        'filesize': best_v.get('filesize'),
                    },
                    'audio': {
                        'url': best_a.get('url'),
                        'ext': best_a.get('ext'),
                        'acodec': best_a.get('acodec'),
                        'filesize': best_a.get('filesize'),
                    }
                }

            # 2) Фолбэк через выбор формата 'bestvideo+bestaudio' и чтение requested_formats
            try:
                ydl_opts2 = dict(base_opts)
                ydl_opts2['format'] = 'bestvideo*+bestaudio*/bestvideo+bestaudio/best'
                with yt_dlp.YoutubeDL(cast(Any, ydl_opts2)) as ydl2:
                    info2 = ydl2.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
                    req = info2.get('requested_formats') or []
                    if len(req) >= 2 and req[0].get('url') and req[1].get('url'):
                        v = req[0] if req[0].get('vcodec') != 'none' else req[1]
                        a = req[1] if v is req[0] else req[0]
                        return {
                            'success': True,
                            'video_id': video_id,
                            'title': info2.get('title') or title,
                            'video': {
                                'url': v.get('url'),
                                'ext': v.get('ext'),
                                'height': v.get('height'),
                                'width': v.get('width'),
                                'vcodec': v.get('vcodec'),
                                'filesize': v.get('filesize'),
                            },
                            'audio': {
                                'url': a.get('url'),
                                'ext': a.get('ext'),
                                'acodec': a.get('acodec'),
                                'filesize': a.get('filesize'),
                            }
                        }
            except Exception as e3:
                last_error = str(e3)

            return { 'success': False, 'error': last_error or 'No separate A/V formats found', 'video_id': video_id }
        except Exception as e:
            print(f"[ERR] Ошибка получения A/V URL: {e}")
            return { 'success': False, 'error': str(e), 'video_id': video_id }
    
    def download_audio_only(
        self,
        video_id: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> Dict[str, Any]:
        """
        Скачать только аудио дорожку
        
        Args:
            video_id: YouTube video ID
            progress_callback: Функция для отслеживания прогресса
            
        Returns:
                'extractor_retries': 2,
                'ignore_no_formats_error': True,
        """
        try:
            import shutil
            has_ffmpeg = shutil.which('ffmpeg') is not None or shutil.which('ffmpeg.exe') is not None

            ydl_opts: Dict[str, Any] = {
                'format': 'bestaudio[ext=m4a]/bestaudio',
                'outtmpl': str(self.download_dir / '%(id)s_%(title)s.%(ext)s'),
                'quiet': False,
            }
            if self.cookies_file.exists():
                ydl_opts['cookiefile'] = str(self.cookies_file)
            ydl_opts['extractor_args'] = {
                'youtube': {
                    'player_client': ['android']
                }
            }
            # Если есть ffmpeg, конвертируем в mp3. Иначе оставляем исходный контейнер (m4a/webm)
            if has_ffmpeg:
                ydl_opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }]
            
            if progress_callback:
                ydl_opts['progress_hooks'] = [progress_callback]
            
            with yt_dlp.YoutubeDL(cast(Any, ydl_opts)) as ydl:
                info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=True)
                
                filename = ydl.prepare_filename(info)
                # Если конвертировали, имя файла станет .mp3
                if has_ffmpeg:
                    filename = filename.rsplit('.', 1)[0] + '.mp3'
                
                filesize = os.path.getsize(filename) if os.path.exists(filename) else 0
                
                return {
                    'success': True,
                    'video_id': video_id,
                    'title': info.get('title'),
                    'filename': filename,
                    'filesize': filesize,
                    'duration': info.get('duration'),
                    'format': 'mp3' if has_ffmpeg else info.get('acodec', 'audio'),
                    'ext': 'mp3' if has_ffmpeg else info.get('ext', 'm4a'),
                }
                
        except Exception as e:
            print(f"[ERR] Ошибка скачивания аудио: {e}")
            return {
                'success': False,
                'error': str(e),
                'video_id': video_id,
            }
    
    def get_download_progress(self, d: Dict[str, Any]) -> None:
        """
        Callback для прогресса скачивания (использовать с progress_hooks)
        
        Args:
            d: dict с информацией о прогрессе от yt-dlp
        """
        if d['status'] == 'downloading':
            try:
                percent = d.get('_percent_str', '0%').strip()
                speed = d.get('_speed_str', 'N/A').strip()
                eta = d.get('_eta_str', 'N/A').strip()
                
                print(f"  [DL] {percent} | Speed: {speed} | ETA: {eta}")
            except:
                pass
        elif d['status'] == 'finished':
            print(f"  [OK] Скачивание завершено, обработка...")


def main():
    """Пример использования"""
    import argparse
    
    parser = argparse.ArgumentParser(description='YouTube Video Downloader')
    parser.add_argument('video_id', help='YouTube Video ID')
    parser.add_argument('--quality', default='highest', help='Quality: highest, 1080, 720, 480, 360')
    parser.add_argument('--audio-only', action='store_true', help='Download audio only')
    parser.add_argument('--list-formats', action='store_true', help='List available formats')
    parser.add_argument('--output-dir', default='downloads', help='Output directory')
    parser.add_argument('--direct-url', action='store_true', help='Print direct progressive URL JSON and exit')
    parser.add_argument('--best-av-urls', action='store_true', help='Print best separate video/audio URLs JSON and exit')
    parser.add_argument('--formats-json', action='store_true', help='Print detailed formats JSON and exit')
    parser.add_argument('--yt-dlp-version', action='store_true', help='Print yt-dlp version JSON and exit')
    parser.add_argument('--env-dump', action='store_true', help='Print environment info (python, yt_dlp path/version, cookies) and exit')
    
    args = parser.parse_args()
    
    downloader = VideoDownloader(download_dir=args.output_dir)
    
    if args.formats_json:
        result = downloader.get_formats_debug(args.video_id)
        try:
            print(json.dumps(result, ensure_ascii=False))
        except Exception:
            pass
        sys.exit(0 if result.get('success') else 1)

    if args.yt_dlp_version:
        ver = getattr(yt_dlp, '__version__', 'unknown')
        try:
            print(json.dumps({ 'success': True, 'yt_dlp_version': ver }, ensure_ascii=False))
        except Exception:
            pass
        sys.exit(0)

    if args.env_dump:
        try:
            ver = getattr(yt_dlp, '__version__', 'unknown')
            yfile = getattr(yt_dlp, '__file__', None)
        except Exception:
            ver = 'unknown'
            yfile = None
        info = {
            'success': True,
            'python_executable': sys.executable,
            'yt_dlp_version': ver,
            'yt_dlp_file': yfile,
            'has_cookies': downloader.cookies_file.exists(),
        }
        try:
            print(json.dumps(info, ensure_ascii=False))
        except Exception:
            pass
        sys.exit(0)

    if args.list_formats:
        print(f"[INFO] Получение доступных форматов для {args.video_id}...")
        formats = downloader.get_video_formats(args.video_id)
        print(f"\n[INFO] Найдено форматов: {len(formats)}\n")
        for i, fmt in enumerate(formats[:10], 1):  # Первые 10
            print(f"{i}. {fmt['resolution']} | {fmt['ext']} | {fmt.get('filesize', 'N/A')} bytes")
    
    elif args.direct_url:
        result = downloader.get_direct_progressive_url(args.video_id, args.quality)
        if result.get('success'):
            try:
                print(json.dumps(result, ensure_ascii=False))
            except Exception:
                pass
            sys.exit(0)
        else:
            print(f"\n[ERR] Ошибка: {result.get('error')}")
            sys.exit(1)

    elif args.best_av_urls:
        result = downloader.get_best_av_urls(args.video_id, args.quality)
        try:
            print(json.dumps(result, ensure_ascii=False))
        except Exception:
            pass
        sys.exit(0 if result.get('success') else 1)

    elif args.audio_only:
        print(f"[AUDIO] Скачивание аудио: {args.video_id}")
        result = downloader.download_audio_only(args.video_id, downloader.get_download_progress)
        
        if result['success']:
            print(f"\n[OK] Успешно скачано!")
            print(f"  Файл: {result['filename']}")
            print(f"  Размер: {result['filesize'] / 1024 / 1024:.2f} MB")
            # Вывести JSON для машинного парсинга
            try:
                print(json.dumps(result, ensure_ascii=False))
            except Exception:
                pass
        else:
            print(f"\n[ERR] Ошибка: {result.get('error')}")
            sys.exit(1)
    
    else:
        print(f"[DL] Скачивание видео: {args.video_id} (качество: {args.quality})")
        result = downloader.download_video(args.video_id, args.quality, downloader.get_download_progress)
        
        if result['success']:
            print(f"\n[OK] Успешно скачано!")
            print(f"  Название: {result['title']}")
            print(f"  Файл: {result['filename']}")
            print(f"  Размер: {result['filesize'] / 1024 / 1024:.2f} MB")
            print(f"  Разрешение: {result['resolution']}")
            # Вывести JSON для машинного парсинга
            try:
                print(json.dumps(result, ensure_ascii=False))
            except Exception:
                pass
        else:
            print(f"\n[ERR] Ошибка: {result.get('error')}")
            sys.exit(1)


if __name__ == '__main__':
    main()

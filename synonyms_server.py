"""
Python-бэкенд для динамической синонимизации через navec + pymorphy3.

Запуск:
    python synonyms_server.py [--port 5000] [--host 127.0.0.1]

API:
    GET  /status          → {"ok": true, "vocab": N}
    POST /synset          → {"word": "работа", "threshold": 0.6, "topn": 20}
                          ← {"synset": ["работа", "труд", ...], "source": "navec"}
    POST /synset_batch    → {"words": [...], "threshold": 0.6, "topn": 20}
                          ← {"synsets": {"работа": [...], ...}}

Детерминизм гарантирован: при одинаковом threshold результат всегда одинаков.
Синсеты отсортированы алфавитно — кодирование/декодирование предсказуемо.
"""

import json
import re
import os
import argparse
import numpy as np
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from collections import defaultdict

# ─── Конфигурация ────────────────────────────────────────────────────────────

NAVEC_PATH   = "data/navec_hudlit_v1_12B_500K_300d_100q.tar"
FREQ_PATH    = "data/dictionaries/frequency/freqrnc2011.csv"
FREQ_100K    = "data/dictionaries/frequency/100_000_russian_wordlist.txt"
SYNONYMS_JSON = "data/synonyms.json"

MIN_FREQ     = 0.05   # минимальная частотность для кандидатов
MIN_WORD_LEN = 3
MAX_WORD_LEN = 20
DEFAULT_TOPN = 20
DEFAULT_THRESHOLD = 0.50

RUSSIAN_RE   = re.compile(r'^[а-яёА-ЯЁ]+$')
ALLOWED_POS  = {'NOUN', 'VERB', 'ADJF', 'ADJS', 'ADVB', 'INFN', 'PRTF', 'PRTS'}


# ─── Загрузка данных ─────────────────────────────────────────────────────────

class SynonymEngine:
    def __init__(self):
        self.navec       = None
        self.words_list  = []
        self.mat_norm    = None
        self.ru_ids      = None    # индексы русских частотных слов в матрице
        self.ru_words    = []      # соответствующие слова
        self.ru_mat      = None    # подматрица русских слов
        self.freq        = {}
        self.morph       = None
        self.pos_cache   = {}
        self.static_syns = {}      # статический словарь synonyms.json
        self._cache      = {}      # кэш результатов (word, threshold) → synset

    def load(self):
        self._load_freq()
        self._load_morph()
        self._load_navec()
        self._load_static()
        print("✅ SynonymEngine готов")

    def _load_freq(self):
        import csv
        print("Загружаем частотный словарь...")
        try:
            with open(FREQ_PATH, encoding='utf-8') as f:
                reader = csv.DictReader(f, delimiter='\t')
                for row in reader:
                    lemma = row.get('Lemma', '').strip().lower()
                    try:
                        ipm = float(row.get('Freq(ipm)', 0))
                    except ValueError:
                        ipm = 0.0
                    if lemma and ipm > 0:
                        self.freq[lemma] = max(self.freq.get(lemma, 0), ipm)
        except Exception as e:
            print(f"  Ошибка freqrnc2011: {e}")
        try:
            with open(FREQ_100K, encoding='utf-8') as f:
                for line in f:
                    parts = line.strip().split('\t')
                    if len(parts) >= 2:
                        word = parts[0].strip().lower()
                        try:
                            count = float(parts[1].strip())
                        except ValueError:
                            continue
                        if word not in self.freq and count > 0:
                            self.freq[word] = count / 500_000
        except Exception as e:
            print(f"  Ошибка 100K: {e}")
        print(f"  Частот: {len(self.freq):,}")

    def _load_morph(self):
        try:
            import pymorphy3
            self.morph = pymorphy3.MorphAnalyzer()
            print("pymorphy3 OK")
        except ImportError:
            print("WARN: pymorphy3 не найден, POS-фильтрация отключена")

    def _load_navec(self):
        try:
            from navec import Navec
            print(f"Загружаем navec из {NAVEC_PATH}...")
            self.navec = Navec.load(NAVEC_PATH)
            self.words_list = list(self.navec.vocab.words)
            print(f"  Словарь: {len(self.words_list):,} слов")

            print("  Распаковываем матрицу...")
            mat = self.navec.pq.unpack()  # (N, 300)
            norms = np.linalg.norm(mat, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            self.mat_norm = mat / norms

            # Строим подматрицу русских частотных слов
            ru_ids = []
            ru_words = []
            for i, word in enumerate(self.words_list):
                wl = word.lower()
                if (RUSSIAN_RE.match(wl)
                        and MIN_WORD_LEN <= len(wl) <= MAX_WORD_LEN
                        and self.freq.get(wl, 0) >= MIN_FREQ):
                    ru_ids.append(i)
                    ru_words.append(wl)
            self.ru_ids   = np.array(ru_ids)
            self.ru_words = ru_words
            self.ru_mat   = self.mat_norm[self.ru_ids]
            print(f"  Русских частотных: {len(ru_words):,}")
        except Exception as e:
            print(f"  Ошибка navec: {e}")

    def _load_static(self):
        if os.path.exists(SYNONYMS_JSON):
            try:
                with open(SYNONYMS_JSON, encoding='utf-8') as f:
                    raw = json.load(f)
                n = lambda s: s.replace('ё', 'е')
                for key, synset in raw.items():
                    norm_synset = sorted(set(n(w) for w in synset))
                    if len(norm_synset) >= 2:
                        self.static_syns[n(key)] = norm_synset
                print(f"Статический словарь: {len(self.static_syns):,} слов")
            except Exception as e:
                print(f"  Ошибка synonyms.json: {e}")

    def _get_pos(self, word):
        if not self.morph:
            return None
        if word in self.pos_cache:
            return self.pos_cache[word]
        parses = self.morph.parse(word)
        pos = parses[0].tag.POS if parses else None
        self.pos_cache[word] = pos
        return pos

    def _normalize(self, s):
        return s.replace('ё', 'е').replace('Ё', 'Е')

    def get_synset(self, word, threshold=DEFAULT_THRESHOLD, topn=DEFAULT_TOPN):
        """
        Найти синсет для слова. Возвращает (synset_list, source_str).
        source: 'navec' | 'static' | None
        Результат всегда детерминирован при одинаковом threshold.
        """
        wl = self._normalize(word.lower().strip())
        cache_key = (wl, threshold, topn)
        if cache_key in self._cache:
            return self._cache[cache_key]

        # 1. Пробуем navec
        if self.navec is not None and wl in {self.words_list[i].lower() for i in self.ru_ids[:100]}:
            pass  # быстрая проверка через поиск ниже

        if self.navec is not None:
            try:
                # Получаем вектор слова
                wl_raw = word.lower().strip()
                # Ищем в словаре navec: пробуем варианты (с/без ё, разный регистр)
                word_ids = self.navec.vocab.word_ids
                navec_word = None
                for variant in [wl_raw, wl_raw.capitalize(),
                                 wl_raw.replace('е', 'ё'), wl_raw.replace('е', 'ё').capitalize()]:
                    if variant in word_ids:
                        navec_word = variant
                        break

                if navec_word is not None:
                    word_id = self.navec.vocab.word_ids[navec_word]
                    vec = self.mat_norm[word_id]

                    # Косинусное сходство со всеми русскими частотными словами
                    sims = self.ru_mat @ vec
                    top_n_idx = min(topn * 3, len(self.ru_words))
                    top_local = np.argpartition(sims, -top_n_idx)[-top_n_idx:]
                    top_local = top_local[np.argsort(sims[top_local])[::-1]]

                    word_pos = self._get_pos(wl)
                    candidates = []
                    for local_i in top_local:
                        sim = sims[local_i]
                        if sim < threshold:
                            break
                        cand = self.ru_words[local_i]
                        if not RUSSIAN_RE.match(cand):
                            continue
                        cand_pos = self._get_pos(cand)
                        if word_pos and cand_pos and cand_pos != word_pos:
                            continue
                        candidates.append(self._normalize(cand))
                        if len(candidates) >= topn:
                            break

                    candidates = list(dict.fromkeys(candidates))
                    if len(candidates) >= 2:
                        synset = sorted(candidates)
                        result = (synset, 'navec')
                        self._cache[cache_key] = result
                        return result
            except Exception as e:
                print(f"  navec get_synset error for '{word}': {e}")

        # 2. Фоллбэк: статический словарь
        if wl in self.static_syns:
            result = (self.static_syns[wl], 'static')
            self._cache[cache_key] = result
            return result

        result = (None, None)
        self._cache[cache_key] = result
        return result

    def get_synset_batch(self, words, threshold=DEFAULT_THRESHOLD, topn=DEFAULT_TOPN):
        """Батчевый запрос синсетов — эффективнее для списка слов."""
        result = {}
        if not words:
            return result

        # Нормализуем все слова
        norm_words = [self._normalize(w.lower().strip()) for w in words]

        # Сначала проверяем кэш и статический словарь
        need_navec = []
        need_navec_idx = []
        for i, (orig, wl) in enumerate(zip(words, norm_words)):
            cache_key = (wl, threshold, topn)
            if cache_key in self._cache:
                cached = self._cache[cache_key]
                if cached[0]:
                    result[orig] = {'synset': cached[0], 'source': cached[1]}
            elif wl in self.static_syns:
                synset = self.static_syns[wl]
                result[orig] = {'synset': synset, 'source': 'static'}
                self._cache[cache_key] = (synset, 'static')
            else:
                need_navec.append((i, orig, wl))
                need_navec_idx.append(i)

        if not need_navec or self.navec is None:
            return result

        # Батчевый navec поиск
        # Собираем вектора всех запрашиваемых слов
        query_vecs = []
        valid_queries = []
        word_ids = self.navec.vocab.word_ids
        for i, orig, wl in need_navec:
            navec_word = None
            for variant in [wl, orig.lower(),
                            wl.replace('е', 'ё'), orig.lower().replace('е', 'ё'),
                            wl.capitalize(), orig.lower().capitalize()]:
                if variant in word_ids:
                    navec_word = variant
                    break
            if navec_word:
                word_id = self.navec.vocab.word_ids[navec_word]
                query_vecs.append(self.mat_norm[word_id])
                valid_queries.append((i, orig, wl))

        if not query_vecs:
            return result

        # Батчевая матрица сходства: (Q, M)
        Q_mat = np.stack(query_vecs)  # (Q, 300)
        sims_batch = Q_mat @ self.ru_mat.T  # (Q, M)

        top_n_idx = min(topn * 3, len(self.ru_words))
        for q_i, (i, orig, wl) in enumerate(valid_queries):
            sims_row = sims_batch[q_i]
            top_local = np.argpartition(sims_row, -top_n_idx)[-top_n_idx:]
            top_local = top_local[np.argsort(sims_row[top_local])[::-1]]

            word_pos = self._get_pos(wl)
            candidates = []
            for local_i in top_local:
                sim = sims_row[local_i]
                if sim < threshold:
                    break
                cand = self.ru_words[local_i]
                cand_pos = self._get_pos(cand)
                if word_pos and cand_pos and cand_pos != word_pos:
                    continue
                candidates.append(self._normalize(cand))
                if len(candidates) >= topn:
                    break

            candidates = list(dict.fromkeys(candidates))
            if len(candidates) >= 2:
                synset = sorted(candidates)
                result[orig] = {'synset': synset, 'source': 'navec'}
                self._cache[(wl, threshold, topn)] = (synset, 'navec')
            elif wl in self.static_syns:
                synset = self.static_syns[wl]
                result[orig] = {'synset': synset, 'source': 'static'}
                self._cache[(wl, threshold, topn)] = (synset, 'static')

        return result


# ─── HTTP сервер ─────────────────────────────────────────────────────────────

engine = SynonymEngine()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Отключаем лишние логи

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode('utf-8'))

    def do_OPTIONS(self):
        self._send_json({})

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/status':
            self._send_json({
                'ok': True,
                'navec': engine.navec is not None,
                'morph': engine.morph is not None,
                'vocab': len(engine.ru_words),
                'static_entries': len(engine.static_syns),
            })
        else:
            self._send_json({'error': 'Not found'}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            data = self._read_json()
        except Exception:
            self._send_json({'error': 'Invalid JSON'}, 400)
            return

        if path == '/synset':
            word      = data.get('word', '').strip()
            threshold = float(data.get('threshold', DEFAULT_THRESHOLD))
            topn      = int(data.get('topn', DEFAULT_TOPN))

            if not word:
                self._send_json({'error': 'word is required'}, 400)
                return

            threshold = max(0.0, min(1.0, threshold))
            topn      = max(2, min(50, topn))

            synset, source = engine.get_synset(word, threshold, topn)
            if synset:
                self._send_json({'synset': synset, 'source': source, 'word': word})
            else:
                self._send_json({'synset': None, 'source': None, 'word': word})

        elif path == '/synset_batch':
            words     = data.get('words', [])
            threshold = float(data.get('threshold', DEFAULT_THRESHOLD))
            topn      = int(data.get('topn', DEFAULT_TOPN))

            if not isinstance(words, list):
                self._send_json({'error': 'words must be array'}, 400)
                return

            threshold = max(0.0, min(1.0, threshold))
            topn      = max(2, min(50, topn))

            synsets = engine.get_synset_batch(words, threshold, topn)
            self._send_json({'synsets': synsets})

        else:
            self._send_json({'error': 'Not found'}, 404)


# ─── Точка входа ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Synonym server для лингвистической стеганографии')
    parser.add_argument('--port', type=int, default=5000)
    parser.add_argument('--host', default='127.0.0.1')
    args = parser.parse_args()

    print("=" * 60)
    print("Synonym Server (navec + pymorphy3)")
    print("=" * 60)
    engine.load()

    server = HTTPServer((args.host, args.port), Handler)
    print(f"\n🚀 Сервер запущен: http://{args.host}:{args.port}")
    print("  GET  /status       — статус сервера")
    print("  POST /synset       — синсет для одного слова")
    print("  POST /synset_batch — синсеты для списка слов")
    print("Ctrl+C для остановки")
    print("=" * 60)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер остановлен.")


if __name__ == '__main__':
    main()

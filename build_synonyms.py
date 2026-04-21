"""
Сборка словаря синонимов для лингвистической стеганографии.

## Принцип

Для каждого слова W хранится его КАНОНИЧЕСКИЙ синсет — полный упорядоченный
(алфавитно) список синонимов. Этот список одинаков для всех слов синсета.

  Пример:
    "большой"   -> ["большой", "великий", "громадный", "крупный", "огромный"]
    "крупный"   -> ["большой", "великий", "громадный", "крупный", "огромный"]

  Encode: слово W -> найти synset -> взять synset[index] -> вставить
  Decode: слово W -> найти synset -> найти позицию W -> это и есть index

## Источники синонимов (приоритет)

1. navec (word2vec косинусная близость) — дистрибутивная семантика
2. RuWordNet (SQLite) — лингвистические синонимы (фоллбэк)

## Настройка порога

Параметр --threshold (0.0-1.0) определяет минимальную косинусную близость.
По умолчанию: 0.6 (умеренно близкие слова).
Более высокий порог = меньше синонимов, лучше качество текста.
Более низкий порог = больше синонимов, больше ёмкость.
"""

import json
import csv
import re
import os
import sys
import sqlite3
import argparse
import numpy as np
from collections import defaultdict

# ─── Пути ────────────────────────────────────────────────────────────────────

NAVEC_PATH  = "data/navec_hudlit_v1_12B_500K_300d_100q.tar"
DB_PATH     = "python-ruwordnet-master/ruwordnet/static/ruwordnet-2021.db"
FREQ_PATH   = "data/dictionaries/frequency/freqrnc2011.csv"
FREQ_100K   = "data/dictionaries/frequency/100_000_russian_wordlist.txt"
OUT_PATH    = "data/synonyms.json"

# ─── Параметры качества ───────────────────────────────────────────────────────

MIN_FREQ          = 0.1    # минимальная частотность ipm
MIN_VARIANTS      = 2      # минимум синонимов в группе
MAX_VARIANTS      = 8      # максимум (слишком широкие синсеты смешивают значения)
DEFAULT_THRESHOLD = 0.60   # косинусная близость по умолчанию
TOPN              = 30     # кандидатов для каждого слова из navec
MIN_WORD_LEN      = 3      # минимальная длина слова
MAX_WORD_LEN      = 20     # максимальная длина слова

# Только русский алфавит (навек содержит много мусора)
RUSSIAN_RE = re.compile(r'^[а-яёА-ЯЁ]+$')


# ─── Частотный словарь ────────────────────────────────────────────────────────

def load_frequency():
    """Загрузить частотный словарь. Возвращает {лемма_lower: ipm}"""
    freq = {}

    print("Загружаем частотный словарь freqrnc2011.csv...")
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
                    freq[lemma] = max(freq.get(lemma, 0), ipm)
        print(f"  Загружено из freqrnc2011: {len(freq):,} слов")
    except Exception as e:
        print(f"  Ошибка freqrnc2011: {e}")

    print("Загружаем 100_000_russian_wordlist.txt...")
    try:
        with open(FREQ_100K, encoding='utf-8') as f:
            count_added = 0
            for line in f:
                parts = line.strip().split('\t')
                if len(parts) >= 2:
                    word = parts[0].strip().lower()
                    try:
                        count = float(parts[1].strip())
                    except ValueError:
                        continue
                    if word not in freq and count > 0:
                        freq[word] = count / 500_000
                        count_added += 1
        print(f"  Добавлено из 100K: {count_added:,} слов")
    except Exception as e:
        print(f"  Ошибка 100K: {e}")

    print(f"  Итого частот: {len(freq):,}")
    return freq


def get_freq(word, freq_dict):
    w = word.lower().strip()
    return freq_dict.get(w, 0)


# ─── Валидация слов ───────────────────────────────────────────────────────────

def is_valid_word(w):
    """Слово подходит для стеганографии: только русские буквы, разумная длина"""
    if not w:
        return False
    wl = w.lower()
    if not RUSSIAN_RE.match(wl):
        return False
    if len(wl) < MIN_WORD_LEN or len(wl) > MAX_WORD_LEN:
        return False
    return True


def normalize_yo(s):
    """ё → е для нормализации"""
    return s.replace('ё', 'е').replace('Ё', 'Е')


# ─── navec: основной источник синонимов ──────────────────────────────────────

def load_navec():
    """Загрузить navec и вернуть (navec_obj, words_list, matrix_normalized)"""
    print(f"\nЗагружаем navec из {NAVEC_PATH}...")
    try:
        from navec import Navec
        n = Navec.load(NAVEC_PATH)
        words_list = list(n.vocab.words)
        print(f"  Словарь navec: {len(words_list):,} слов")

        print("  Распаковываем векторную матрицу...")
        # pq.unpack() → (N, dim) — полная матрица векторов
        mat = n.pq.unpack()  # shape: (N, 300)
        print(f"  Матрица: {mat.shape}")

        # Нормализуем строки для косинусного сходства
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        mat_norm = mat / norms

        return n, words_list, mat_norm
    except Exception as e:
        print(f"  Ошибка загрузки navec: {e}")
        return None, [], None


def load_antonym_words():
    """
    Загружает множество пар слов-антонимов из RuWordNet для navec-фильтрации.
    Возвращает set frozenset({word_a, word_b}) — пары антонимов.
    """
    if not os.path.exists(DB_PATH):
        return set(), set()
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT left_id, right_id FROM antonymy_relation")
        antonym_pairs = c.fetchall()
        c.execute("SELECT synset_id, name FROM sense")
        raw_senses = c.fetchall()
        conn.close()
    except Exception:
        return set(), set()

    synset_to_words = defaultdict(set)
    for synset_id, name in raw_senses:
        word = normalize_yo(name.strip().lower())
        if is_valid_word(word):
            synset_to_words[synset_id].add(word)

    antonym_pairs_words = set()
    antonym_words = set()
    for left_id, right_id in antonym_pairs:
        for w_left in synset_to_words.get(left_id, set()):
            for w_right in synset_to_words.get(right_id, set()):
                antonym_pairs_words.add(frozenset({w_left, w_right}))
                antonym_words.add(w_left)
                antonym_words.add(w_right)

    print(f"  Антоним-пар (слова): {len(antonym_pairs_words):,}, слов-антонимов: {len(antonym_words):,}")
    return antonym_pairs_words, antonym_words


def build_navec_synsets(navec_obj, words_list, mat_norm, freq_dict, threshold, morph, antonym_pairs_words=None):
    """
    Для каждого частотного русского слова из navec найти ближайших соседей.
    Возвращает dict: {лемма: sorted_canonical_synset}
    """
    print(f"\nСтроим синсеты из navec (порог={threshold})...")

    # Индекс: слово → row_id в матрице
    word2id = {w: i for i, w in enumerate(words_list)}

    # Отбираем целевые слова: русские, частотные, нужной длины
    target_words = []
    for word in words_list:
        wl = word.lower()
        if not is_valid_word(wl):
            continue
        if get_freq(wl, freq_dict) < MIN_FREQ:
            continue
        target_words.append(wl)

    print(f"  Целевых слов (русских, частотных): {len(target_words):,}")

    # Строим подматрицу только из русских частотных слов
    # → экономим память и время при поиске соседей
    ru_ids = []
    ru_words = []
    for word in words_list:
        wl = word.lower()
        if is_valid_word(wl) and get_freq(wl, freq_dict) >= MIN_FREQ:
            idx = word2id.get(word)
            if idx is not None:
                ru_ids.append(idx)
                ru_words.append(wl)

    ru_ids = np.array(ru_ids)
    ru_mat = mat_norm[ru_ids]  # (M, 300) — только русские частотные
    print(f"  Русских частотных в navec: {len(ru_words):,}")

    # POS-фильтрация через pymorphy3
    morph_cache = {}
    def get_pos(word):
        if word in morph_cache:
            return morph_cache[word]
        parses = morph.parse(word)
        pos = parses[0].tag.POS if parses else None
        morph_cache[word] = pos
        return pos

    # Допустимые POS
    ALLOWED_POS = {'NOUN', 'VERB', 'ADJF', 'ADJS', 'ADVB', 'INFN', 'PRTF', 'PRTS'}

    # Строим синсеты: для каждого слова ищем косинусно близких
    # Используем батчевое матричное умножение для скорости
    synset_map = {}  # frozenset → canonical_list (дедупликация синсетов)
    result = {}

    batch_size = 500
    total = len(ru_words)
    processed = 0

    for batch_start in range(0, total, batch_size):
        batch_end = min(batch_start + batch_size, total)
        batch_words = ru_words[batch_start:batch_end]
        batch_vecs = ru_mat[batch_start:batch_end]  # (B, 300)

        # Косинусная матрица: (B, M)
        sims_batch = batch_vecs @ ru_mat.T

        for local_i, (word, sims_row) in enumerate(zip(batch_words, sims_batch)):
            # Фильтруем кандидатов
            word_pos = get_pos(word)
            if word_pos not in ALLOWED_POS:
                continue

            # Топ-TOPN кандидатов
            top_idx = np.argpartition(sims_row, -TOPN)[-TOPN:]
            top_idx = top_idx[np.argsort(sims_row[top_idx])[::-1]]

            candidates = []
            for idx in top_idx:
                sim = sims_row[idx]
                if sim < threshold:
                    continue
                cand = ru_words[idx]
                if not is_valid_word(cand):
                    continue
                cand_pos = get_pos(cand)
                if cand_pos != word_pos:
                    continue
                candidates.append(normalize_yo(cand.lower()))

            # Дедупликация и обрезка
            candidates = list(dict.fromkeys(candidates))
            if len(candidates) < MIN_VARIANTS:
                continue

            # ── Антоним-фильтр для navec ──────────────────────────────────────
            # Удаляем из кандидатов известные антонимы слова word
            if antonym_pairs_words:
                word_norm = normalize_yo(word.lower())
                filtered_candidates = []
                for cand in candidates:
                    pair = frozenset({word_norm, cand})
                    if pair in antonym_pairs_words:
                        continue  # это антоним — пропускаем
                    filtered_candidates.append(cand)
                candidates = filtered_candidates

            if len(candidates) < MIN_VARIANTS:
                continue
            if len(candidates) > MAX_VARIANTS:
                candidates = candidates[:MAX_VARIANTS]

            # Канонический синсет (алфавитный порядок)
            canonical = sorted(candidates)
            key = frozenset(canonical)

            # Дедупликация синсетов
            if key not in synset_map:
                synset_map[key] = canonical

            canonical = synset_map[key]
            for w in canonical:
                if w not in result or len(canonical) > len(result[w]):
                    result[w] = canonical

        processed += len(batch_words)
        if processed % 5000 == 0 or processed == total:
            print(f"  Обработано: {processed:,}/{total:,}, синсетов: {len(synset_map):,}")

    print(f"  navec синсетов: {len(synset_map):,}, слов: {len(result):,}")
    return result


# ─── RuWordNet: фоллбэк ───────────────────────────────────────────────────────

def load_ruwordnet_synsets(freq_dict):
    """
    Загрузить синсеты из RuWordNet с фильтрацией антонимов.
    Возвращает {лемма: sorted_synset}
    """
    print(f"\nЗагружаем RuWordNet из {DB_PATH}...")

    if not os.path.exists(DB_PATH):
        print("  RuWordNet не найден, пропускаем.")
        return {}

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        c.execute("SELECT id, part_of_speech FROM synset WHERE part_of_speech IN ('N','V','A','Noun','Verb','Adj','Adv')")
        synsets = {row[0]: row[1] for row in c.fetchall()}

        c.execute("SELECT synset_id, name FROM sense")
        raw_senses = c.fetchall()

        # Загружаем антонимы: пары синсетов которые являются антонимами друг друга
        c.execute("SELECT left_id, right_id FROM antonymy_relation")
        antonym_pairs = c.fetchall()
        conn.close()

        print(f"  Синсетов: {len(synsets):,}, смыслов: {len(raw_senses):,}, антоним-пар: {len(antonym_pairs):,}")
    except Exception as e:
        print(f"  Ошибка RuWordNet: {e}")
        return {}

    # Строим множество антонимных синсет-пар (двунаправленно)
    antonym_synsets = set()  # synset_id → set of antonym synset_ids
    antonym_map = defaultdict(set)
    for left_id, right_id in antonym_pairs:
        antonym_map[left_id].add(right_id)
        antonym_map[right_id].add(left_id)
    print(f"  Антонимных синсетов: {len(antonym_map):,}")

    # Строим карту: слово → список его синсет-ID
    synset_words = defaultdict(list)
    word_to_synsets = defaultdict(set)
    for synset_id, name in raw_senses:
        if synset_id not in synsets:
            continue
        word = normalize_yo(name.strip().lower())
        if not is_valid_word(word):
            continue
        synset_words[synset_id].append(word)
        word_to_synsets[word].add(synset_id)

    # Строим множество слов-антонимов для быстрой проверки
    # Слово A является антонимом слова B если они в антонимных синсетах
    def get_antonym_words(synset_id):
        """Получить все слова из антонимных синсетов данного синсета"""
        antonym_words = set()
        for ant_synset_id in antonym_map.get(synset_id, set()):
            for word in synset_words.get(ant_synset_id, []):
                antonym_words.add(word)
        return antonym_words

    result = {}
    ok = 0
    antonym_filtered = 0

    for synset_id, words in synset_words.items():
        words = list(dict.fromkeys(words))
        freq_words = [w for w in words if get_freq(w, freq_dict) >= MIN_FREQ]
        if len(freq_words) < MIN_VARIANTS:
            continue
        if len(freq_words) > MAX_VARIANTS:
            freq_words.sort(key=lambda w: get_freq(w, freq_dict), reverse=True)
            freq_words = freq_words[:MAX_VARIANTS]
        freq_words = [w for w in freq_words if is_valid_word(w)]
        if len(freq_words) < MIN_VARIANTS:
            continue

        # ── Антоним-фильтр ────────────────────────────────────────────────────
        # Получаем все антонимные слова для этого синсета
        antonyms = get_antonym_words(synset_id)
        # Проверяем что в синсете нет взаимных антонимов
        # (это случается при ошибках разметки RuWordNet)
        filtered_words = []
        for w in freq_words:
            if w in antonyms:
                antonym_filtered += 1
                continue  # исключаем слово-антоним из синсета
            filtered_words.append(w)

        if len(filtered_words) < MIN_VARIANTS:
            continue

        canonical = sorted(filtered_words)
        for word in canonical:
            if word not in result or len(canonical) > len(result[word]):
                result[word] = canonical
        ok += 1

    print(f"  RuWordNet синсетов: {ok:,}, слов: {len(result):,}")
    print(f"  Антоним-фильтр: исключено {antonym_filtered:,} слов из синсетов")
    return result


# ─── Слияние источников ───────────────────────────────────────────────────────

def merge_sources(navec_syns, rwn_syns):
    """
    Объединяем navec (приоритет) и RuWordNet (фоллбэк).
    Слова из RuWordNet добавляются только если их нет в navec.
    """
    result = dict(navec_syns)
    added = 0
    for word, synset in rwn_syns.items():
        if word not in result:
            result[word] = synset
            added += 1
    print(f"\nСлияние: navec={len(navec_syns):,}, +RuWordNet={added:,}, итого={len(result):,}")
    return result


# ─── Финальная валидация ──────────────────────────────────────────────────────

def validate(synonyms):
    """
    Убираем невалидные записи.
    КРИТИЧЕСКИ ВАЖНО: каждое слово должно быть ровно в ОДНОМ синсете.
    Если слово W присутствует в синсете S, то synonyms[W] == S для всех W в S.
    Иначе декодирование сломается: decode(encode(text)) != indices.
    """
    # Сначала чистим синсеты
    clean = {}
    for key, synset in synonyms.items():
        if not is_valid_word(key):
            continue
        if key not in synset:
            continue
        valid_synset = [w for w in synset if is_valid_word(w)]
        valid_synset = sorted(set(valid_synset))
        if len(valid_synset) < MIN_VARIANTS:
            continue
        clean[key] = valid_synset

    # Затем гарантируем консистентность: каждое слово → один синсет
    # Если слово W встречается в нескольких синсетах, оставляем только первый (navec приоритет)
    word_to_synset = {}  # слово → канонический tuple синсета
    synset_to_words = {}  # tuple синсета → список слов

    for key, synset in clean.items():
        canon = tuple(synset)
        if key not in word_to_synset:
            word_to_synset[key] = canon
        else:
            # Конфликт: слово уже в другом синсете — оставляем первый (навек приоритет)
            pass

    # Строим финальный словарь: для каждого синсета берём только слова без конфликтов
    final = {}
    for key, canon in word_to_synset.items():
        synset = list(canon)
        # Проверяем что все члены синсета указывают на тот же синсет
        consistent = True
        for member in synset:
            if member in word_to_synset and word_to_synset[member] != canon:
                consistent = False
                break
        if not consistent:
            # Оставляем только ключ сам по себе — исключаем из синсетирования
            continue
        final[key] = synset

    # Финальная проверка: все члены синсета должны быть в словаре
    result = {}
    for key, synset in final.items():
        # Проверяем что все члены синсета есть в final
        all_present = all(m in final for m in synset)
        if not all_present:
            # Оставляем только те члены которые есть в словаре
            filtered = [m for m in synset if m in final]
            if len(filtered) < MIN_VARIANTS:
                continue
            filtered = sorted(set(filtered))
            if key not in filtered:
                continue
            result[key] = filtered
        else:
            result[key] = synset

    return result


# ─── Главная функция ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Сборка словаря синонимов для стеганографии')
    parser.add_argument('--threshold', type=float, default=DEFAULT_THRESHOLD,
                        help=f'Косинусная близость navec (0.0-1.0, по умолчанию {DEFAULT_THRESHOLD})')
    parser.add_argument('--no-navec', action='store_true',
                        help='Не использовать navec (только RuWordNet)')
    parser.add_argument('--no-rwn', action='store_true',
                        help='Не использовать RuWordNet (только navec)')
    parser.add_argument('--output', default=OUT_PATH,
                        help=f'Путь к выходному файлу (по умолчанию {OUT_PATH})')
    args = parser.parse_args()

    print("=" * 60)
    print("Сборка детерминированного словаря синонимов")
    print(f"  Порог косинусной близости: {args.threshold}")
    print(f"  Источники: navec={'да' if not args.no_navec else 'нет'}, RuWordNet={'да' if not args.no_rwn else 'нет'}")
    print("=" * 60)

    # Загружаем частоты
    freq = load_frequency()

    # Загружаем pymorphy3
    print("\nИнициализируем pymorphy3...")
    try:
        import pymorphy3
        morph = pymorphy3.MorphAnalyzer()
        print("  pymorphy3 OK")
    except ImportError:
        print("  pymorphy3 не найден, POS-фильтрация недоступна")
        morph = None

    navec_syns = {}
    rwn_syns = {}

    # Загружаем антонимы из RuWordNet заранее (нужны и для navec и для RuWordNet)
    print("\nЗагружаем антонимы из RuWordNet...")
    antonym_pairs_words, antonym_words_set = load_antonym_words()

    # navec
    if not args.no_navec:
        if morph is None:
            print("ПРЕДУПРЕЖДЕНИЕ: без pymorphy3 POS-фильтрация отключена!")
        navec_obj, words_list, mat_norm = load_navec()
        if navec_obj is not None:
            navec_syns = build_navec_synsets(
                navec_obj, words_list, mat_norm, freq, args.threshold, morph,
                antonym_pairs_words=antonym_pairs_words
            )

    # RuWordNet
    if not args.no_rwn:
        rwn_syns = load_ruwordnet_synsets(freq)

    # Слияние
    merged = merge_sources(navec_syns, rwn_syns)

    # Валидация
    print("\nВалидируем словарь...")
    synonyms = validate(merged)
    print(f"  После валидации: {len(synonyms):,} слов")

    # Статистика
    total = len(synonyms)
    total_synsets = len({tuple(v) for v in synonyms.values()})
    sizes = [len(v) for v in synonyms.values()]
    avg_size = sum(sizes) / len(sizes) if sizes else 0
    dist = {}
    for s in sizes:
        dist[s] = dist.get(s, 0) + 1

    print(f"\n{'=' * 60}")
    print(f"ИТОГ:")
    print(f"  Слов в словаре:       {total:,}")
    print(f"  Уникальных синсетов:  {total_synsets:,}")
    print(f"  Средний размер:       {avg_size:.2f}")
    print(f"  Распределение по размеру:")
    for size in sorted(dist)[:8]:
        print(f"    {size} вар.: {dist[size]:,} слов")

    # Примеры
    print(f"\n  Примеры:")
    examples = ['большой', 'хороший', 'плохой', 'быстро', 'говорить', 'дом', 'человек', 'работа', 'красивый', 'думать']
    for ex in examples:
        if ex in synonyms:
            syn = synonyms[ex]
            idx = syn.index(ex)
            print(f"    '{ex}' [idx={idx}]: {syn}")

    # Проверка детерминированности
    print(f"\n  Проверка детерминированности:")
    test_pairs = [('большой', 'огромный'), ('хороший', 'отличный'), ('говорить', 'сказать')]
    for w1, w2 in test_pairs:
        if w1 in synonyms and w2 in synonyms:
            same = synonyms[w1] == synonyms[w2]
            print(f"    {w1} <-> {w2}: {'✅ одинаковый синсет' if same else '❌ разные синсеты'}")

    # Сохраняем
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(synonyms, f, ensure_ascii=False, indent=2)

    size_mb = os.path.getsize(args.output) / 1024 / 1024
    print(f"\n  Сохранено: {args.output} ({size_mb:.1f} MB)")
    print("=" * 60)


if __name__ == '__main__':
    main()

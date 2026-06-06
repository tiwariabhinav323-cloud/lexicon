import React, { useEffect, useMemo, useState } from "react";
import {
  vocabularyWords,
  idioms,
  phrasalVerbs,
  oneWordSubstitutions,
} from "./data/lexiconData";

const BAD_TEXT = [
  "youtube",
  "youtu.be",
  "telegram",
  "facebook",
  "whatsapp",
  "instagram",
  "twitter",
  "currentmudde",
  "thepadaku",
  "support@",
  "@noteshub",
  "noteshub",
  "inspectorbaba",
  "download app",
  "join telegram",
  "follow us",
  "channel",
  "playlist",
  "flipkart",
  "copyright",
  "official website",
  "social media",
  "www.",
  "https",
  "http",
  "t.me",
  "nimisha",
  "bansal",
];

const normalize = (text = "") =>
  String(text)
    .toLowerCase()
    .replace(/[“”‘’]/g, "'")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (text = "") =>
  String(text)
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");

const isBadText = (text = "") => {
  const low = String(text).toLowerCase();
  if (!low.trim()) return true;
  if (BAD_TEXT.some((bad) => low.includes(bad))) return true;
  if (/https?:|www\.|\.com|\.in|\.me|@/.test(low)) return true;
  return false;
};

const cleanMeaning = (meaning = "") =>
  String(meaning)
    .replace(/\s+/g, " ")
    .replace(/^Definition:\s*/i, "")
    .replace(/,?\s*Definition:\s*/i, " — ")
    .trim();

const splitInputWords = (text = "") =>
  String(text)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const uniqueWords = (arr = []) => {
  const seen = new Set();

  return arr
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const key = normalize(item);
      if (!key || seen.has(key) || isBadText(item)) return false;
      if (item.length > 80) return false;
      seen.add(key);
      return true;
    });
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const getDailyItems = (items, count, multiplier = 1) => {
  if (!items?.length) return [];
  const dayNumber = Math.floor(Date.now() / 86400000);
  const startIndex = (dayNumber * multiplier) % items.length;

  return Array.from({ length: Math.min(count, items.length) }, (_, i) =>
    items[(startIndex + i) % items.length]
  );
};

async function fetchWithTimeout(url, ms = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeItem, setActiveItem] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [completedDaily, setCompletedDaily] = useState([]);
  const [myWords, setMyWords] = useState([]);
  const [newWord, setNewWord] = useState("");
  const [weakWords, setWeakWords] = useState([]);
  const [masteredWords, setMasteredWords] = useState([]);
  const [activePanel, setActivePanel] = useState("words");

  const [customData, setCustomData] = useState({});
  const [customForm, setCustomForm] = useState({
    meaning: "",
    synonyms: "",
    antonyms: "",
    example: "",
    note: "",
  });

  const cleanItem = (item, fallbackType = "Word") => ({
    ...item,
    word: String(item?.word || "").trim(),
    type: item?.type || fallbackType,
    meaning: cleanMeaning(item?.meaning || ""),
    synonyms: uniqueWords(item?.synonyms || []),
    antonyms: uniqueWords(item?.antonyms || []),
    example: String(item?.example || "").trim(),
  });

  const banks = useMemo(() => {
    const cleanVocab = (vocabularyWords || [])
      .map((x) => cleanItem(x, "Vocabulary"))
      .filter((x) => x.word && !isBadText(x.word));

    const cleanOWS = (oneWordSubstitutions || [])
      .map((x) => cleanItem(x, "One Word Substitution"))
      .filter((x) => x.word && !isBadText(x.word));

    const cleanIdioms = (idioms || [])
      .map((x) => cleanItem(x, "Idiom"))
      .filter((x) => x.word && !isBadText(x.word));

    const cleanPhrasals = (phrasalVerbs || [])
      .map((x) => cleanItem(x, "Phrasal Verb"))
      .filter((x) => x.word && !isBadText(x.word));

    const combined = [
      ...cleanVocab,
      ...cleanOWS,
      ...cleanIdioms,
      ...cleanPhrasals,
    ];

    return { cleanVocab, cleanOWS, cleanIdioms, cleanPhrasals, combined };
  }, []);

  const itemMap = useMemo(() => {
    const map = new Map();

    banks.combined.forEach((item) => {
      const key = normalize(item.word);
      if (key && !map.has(key)) map.set(key, item);
    });

    return map;
  }, [banks]);

  const dailyWords = useMemo(() => getDailyItems(banks.cleanVocab, 10, 1), [banks]);
  const dailyIdioms = useMemo(() => getDailyItems(banks.cleanIdioms, 5, 3), [banks]);
  const dailyPhrasals = useMemo(() => getDailyItems(banks.cleanPhrasals, 5, 5), [banks]);
  const dailyOWS = useMemo(() => getDailyItems(banks.cleanOWS, 5, 7), [banks]);

  useEffect(() => {
    const today = getTodayKey();

    const savedWords = localStorage.getItem("lexicon_myWords");
    const savedWeak = localStorage.getItem("lexicon_weakWords");
    const savedMastered = localStorage.getItem("lexicon_masteredWords");
    const savedDone = localStorage.getItem(`lexicon_completedDaily_${today}`);
    const savedCustom = localStorage.getItem("lexicon_customData");

    if (savedWords) setMyWords(JSON.parse(savedWords));
    if (savedWeak) setWeakWords(JSON.parse(savedWeak));
    if (savedMastered) setMasteredWords(JSON.parse(savedMastered));
    if (savedDone) setCompletedDaily(JSON.parse(savedDone));
    if (savedCustom) setCustomData(JSON.parse(savedCustom));

    if (banks.cleanVocab.length > 0) {
      searchItem(banks.cleanVocab[0].word);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banks]);

  useEffect(() => {
    localStorage.setItem("lexicon_myWords", JSON.stringify(myWords));
  }, [myWords]);

  useEffect(() => {
    localStorage.setItem("lexicon_weakWords", JSON.stringify(weakWords));
  }, [weakWords]);

  useEffect(() => {
    localStorage.setItem("lexicon_masteredWords", JSON.stringify(masteredWords));
  }, [masteredWords]);

  useEffect(() => {
    localStorage.setItem("lexicon_customData", JSON.stringify(customData));
  }, [customData]);

  useEffect(() => {
    localStorage.setItem(
      `lexicon_completedDaily_${getTodayKey()}`,
      JSON.stringify(completedDaily)
    );
  }, [completedDaily]);

  const isVocabularyType = (item) => {
    const type = normalize(item?.type);
    return !["idiom", "phrasal verb", "one word substitution"].includes(type);
  };

  const findInLocalBank = (query) => {
    const key = normalize(query);
    if (!key) return null;

    const hyphenless = key.replace(/-/g, " ");

    return (
      itemMap.get(key) ||
      banks.combined.find(
        (item) => normalize(item.word).replace(/-/g, " ") === hyphenless
      ) ||
      banks.combined.find((item) => normalize(item.word).startsWith(key)) ||
      banks.combined.find((item) => normalize(item.word).includes(key)) ||
      null
    );
  };

  const getCachedRelated = (key) => {
    try {
      const cached = localStorage.getItem(`lexicon_related_${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const setCachedRelated = (key, value) => {
    try {
      localStorage.setItem(`lexicon_related_${key}`, JSON.stringify(value));
    } catch {}
  };

  const fetchDictionaryMeaning = async (query) => {
    try {
      const res = await fetchWithTimeout(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`,
        3500
      );

      if (!res.ok) return null;

      const data = await res.json();
      const root = data?.[0];
      const firstMeaning = root?.meanings?.[0];
      const firstDef = firstMeaning?.definitions?.[0];

      const allSynonyms = [];
      const allAntonyms = [];

      root?.meanings?.forEach((meaning) => {
        allSynonyms.push(...(meaning?.synonyms || []));
        allAntonyms.push(...(meaning?.antonyms || []));

        meaning?.definitions?.forEach((def) => {
          allSynonyms.push(...(def?.synonyms || []));
          allAntonyms.push(...(def?.antonyms || []));
        });
      });

      return {
        word: root?.word || query,
        type: firstMeaning?.partOfSpeech || "Vocabulary",
        meaning: firstDef?.definition || "Meaning not available.",
        example: firstDef?.example || "",
        synonyms: uniqueWords(allSynonyms),
        antonyms: uniqueWords(allAntonyms),
      };
    } catch {
      return null;
    }
  };

  const fetchRelatedWords = async (query) => {
    const key = normalize(query);
    const cached = getCachedRelated(key);
    if (cached) return cached;

    try {
      const [synRes, meaningLikeRes, antRes] = await Promise.all([
        fetchWithTimeout(
          `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(query)}&max=20`,
          3500
        ),
        fetchWithTimeout(
          `https://api.datamuse.com/words?ml=${encodeURIComponent(query)}&max=20`,
          3500
        ),
        fetchWithTimeout(
          `https://api.datamuse.com/words?rel_ant=${encodeURIComponent(query)}&max=20`,
          3500
        ),
      ]);

      const [synData, meaningLikeData, antData] = await Promise.all([
        synRes.json(),
        meaningLikeRes.json(),
        antRes.json(),
      ]);

      const result = {
        synonyms: uniqueWords([
          ...synData.map((item) => item.word),
          ...meaningLikeData.map((item) => item.word),
        ]),
        antonyms: uniqueWords(antData.map((item) => item.word)),
      };

      setCachedRelated(key, result);
      return result;
    } catch {
      return { synonyms: [], antonyms: [] };
    }
  };

  const getCustomForWord = (word) => customData[normalize(word)] || null;

  const applyCustomData = (base) => {
    const custom = getCustomForWord(base.word);

    if (!custom) return base;

    return {
      ...base,
      custom,
      synonyms: uniqueWords([...(base.synonyms || []), ...(custom.synonyms || [])]),
      antonyms: uniqueWords([...(base.antonyms || []), ...(custom.antonyms || [])]),
    };
  };

  const mergeEverything = (base, dictionaryData, relatedData) => {
    if (!isVocabularyType(base)) {
      return applyCustomData({
        ...base,
        word: titleCase(base.word || searchQuery),
        meaning: cleanMeaning(base.meaning || "Meaning not available."),
        synonyms: [],
        antonyms: [],
      });
    }

    return applyCustomData({
      ...base,
      word: titleCase(base.word || searchQuery),
      meaning: cleanMeaning(base.meaning || dictionaryData?.meaning || "Meaning not available."),
      example: base.example || dictionaryData?.example || "",
      synonyms: uniqueWords([
        ...(base.synonyms || []),
        ...(dictionaryData?.synonyms || []),
        ...(relatedData?.synonyms || []),
      ]),
      antonyms: uniqueWords([
        ...(base.antonyms || []),
        ...(dictionaryData?.antonyms || []),
        ...(relatedData?.antonyms || []),
      ]),
    });
  };

  const searchItem = async (wordText) => {
    const query = String(wordText || "").trim();
    if (!query) return;

    setErrorMessage("");
    setIsLoading(true);

    const localItem = findInLocalBank(query);

    if (localItem) {
      setActiveItem(applyCustomData(localItem));
    } else {
      setActiveItem(null);
    }

    try {
      if (localItem && !isVocabularyType(localItem)) {
        setActiveItem(mergeEverything(localItem, null, null));
        return;
      }

      const [dictionaryData, relatedData] = await Promise.all([
        fetchDictionaryMeaning(query),
        fetchRelatedWords(query),
      ]);

      const base = localItem || dictionaryData;

      if (!base) {
        setErrorMessage(
          "Word not found in your bank or live dictionary. Check spelling or internet connection."
        );
        return;
      }

      setActiveItem(mergeEverything(base, dictionaryData, relatedData));
    } finally {
      setIsLoading(false);
    }
  };

  const addMyWord = () => {
    const word = newWord.trim();
    if (!word) return;

    setMyWords((prev) =>
      prev.some((w) => normalize(w) === normalize(word)) ? prev : [...prev, word]
    );

    setNewWord("");
  };

  const removeMyWord = (word) => {
    setMyWords((prev) => prev.filter((w) => w !== word));
  };

  const toggleDone = (word) => {
    setCompletedDaily((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    );
  };

  const addWeak = (word) => {
    setWeakWords((prev) =>
      prev.some((w) => normalize(w) === normalize(word)) ? prev : [...prev, word]
    );
  };

  const addMastered = (word) => {
    setMasteredWords((prev) =>
      prev.some((w) => normalize(w) === normalize(word)) ? prev : [...prev, word]
    );
  };

  const randomItem = () => {
    if (!banks.cleanVocab.length) return;
    const item = banks.cleanVocab[Math.floor(Math.random() * banks.cleanVocab.length)];
    searchItem(item.word);
  };

  const saveCustomInput = () => {
    if (!activeItem?.word) return;

    const key = normalize(activeItem.word);

    const old = customData[key] || {
      meanings: [],
      synonyms: [],
      antonyms: [],
      examples: [],
      notes: [],
    };

    const updated = {
      meanings: uniqueWords([...old.meanings, customForm.meaning].filter(Boolean)),
      synonyms: uniqueWords([...old.synonyms, ...splitInputWords(customForm.synonyms)]),
      antonyms: uniqueWords([...old.antonyms, ...splitInputWords(customForm.antonyms)]),
      examples: uniqueWords([...old.examples, customForm.example].filter(Boolean)),
      notes: uniqueWords([...old.notes, customForm.note].filter(Boolean)),
    };

    setCustomData((prev) => ({
      ...prev,
      [key]: updated,
    }));

    setActiveItem((prev) =>
      applyCustomData({
        ...prev,
        custom: updated,
      })
    );

    setCustomForm({
      meaning: "",
      synonyms: "",
      antonyms: "",
      example: "",
      note: "",
    });
  };

  const clearCustomForActive = () => {
    if (!activeItem?.word) return;

    const key = normalize(activeItem.word);

    setCustomData((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    setActiveItem((prev) => {
      const copy = { ...prev };
      delete copy.custom;
      return copy;
    });
  };

  const panelItems = {
    words: dailyWords,
    idioms: dailyIdioms,
    phrasals: dailyPhrasals,
    ows: dailyOWS,
  };

  const panelTitles = {
    words: "Daily 10 Words",
    idioms: "Daily 5 Idioms",
    phrasals: "Daily 5 Phrasal Verbs",
    ows: "Daily 5 One Word",
  };

  const showSynAnt = activeItem && isVocabularyType(activeItem);
  const custom = activeItem?.custom;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 selection:bg-cyan-500/30">
      <header className="max-w-7xl mx-auto mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/40">
            <span className="text-white font-black text-2xl">L</span>
          </div>

          <div>
            <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 via-indigo-300 to-violet-300 bg-clip-text text-transparent">
              Lexicon
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Your personal vocabulary vault.
            </p>
          </div>
        </div>

        <button
          onClick={randomItem}
          className="bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-full text-sm font-bold h-fit"
        >
          Random
        </button>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchItem(searchQuery);
            }}
            className="bg-slate-900/80 border border-slate-700 rounded-2xl p-2 flex gap-2 shadow-xl shadow-black/30"
          >
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search word, idiom, phrasal verb or OWS..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none text-white"
            />

            <button className="bg-indigo-600 hover:bg-indigo-500 px-6 rounded-xl font-bold">
              Search
            </button>
          </form>

          {isLoading && (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center text-slate-400">
              Searching...
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-950/40 border border-red-700 text-red-300 rounded-2xl p-5">
              {errorMessage}
            </div>
          )}

          {activeItem && (
            <article className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 shadow-xl shadow-black/30 space-y-6">
              <div className="border-b border-slate-700 pb-5 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                  <h2 className="text-5xl font-black capitalize text-white">
                    {activeItem.word}
                  </h2>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs uppercase">
                      {activeItem.type || "Word"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => addWeak(activeItem.word)}
                    className="bg-amber-600/20 border border-amber-600 text-amber-300 px-3 py-2 rounded-xl text-sm font-bold"
                  >
                    Hard
                  </button>

                  <button
                    onClick={() => addMastered(activeItem.word)}
                    className="bg-green-600/20 border border-green-600 text-green-300 px-3 py-2 rounded-xl text-sm font-bold"
                  >
                    Mastered
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm uppercase tracking-widest text-cyan-300 font-bold mb-2">
                  Meaning
                </h3>

                <p className="text-xl text-slate-200 leading-relaxed">
                  {activeItem.meaning || "Meaning not available."}
                </p>

                {activeItem.example && (
                  <p className="mt-4 text-slate-400 italic border-l-4 border-cyan-500 pl-4">
                    “{activeItem.example}”
                  </p>
                )}
              </div>

              {showSynAnt && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-950 border border-emerald-800 rounded-2xl p-4">
                    <h3 className="text-emerald-300 font-bold mb-3">Synonyms</h3>

                    {activeItem.synonyms?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeItem.synonyms.map((word, index) => (
                          <button
                            key={index}
                            onClick={() => searchItem(word)}
                            className="bg-emerald-500/10 border border-emerald-700 text-emerald-300 px-3 py-1 rounded-full text-sm"
                          >
                            {word}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">No synonyms found.</p>
                    )}
                  </div>

                  <div className="bg-slate-950 border border-rose-800 rounded-2xl p-4">
                    <h3 className="text-rose-300 font-bold mb-3">Antonyms</h3>

                    {activeItem.antonyms?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeItem.antonyms.map((word, index) => (
                          <button
                            key={index}
                            onClick={() => searchItem(word)}
                            className="bg-rose-500/10 border border-rose-700 text-rose-300 px-3 py-1 rounded-full text-sm"
                          >
                            {word}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">No antonyms found.</p>
                    )}
                  </div>
                </div>
              )}

              {custom && (
                <div className="bg-slate-950 border border-cyan-800 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center gap-3">
                    <h3 className="text-cyan-300 font-bold">Your Additions</h3>
                    <button
                      onClick={clearCustomForActive}
                      className="text-red-400 text-xs hover:text-red-300"
                    >
                      Clear
                    </button>
                  </div>

                  {custom.meanings?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase mb-1">Meanings</p>
                      {custom.meanings.map((x, i) => (
                        <p key={i} className="text-sm text-slate-300">
                          • {x}
                        </p>
                      ))}
                    </div>
                  )}

                  {custom.synonyms?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase mb-1">
                        Your Synonyms
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {custom.synonyms.map((x, i) => (
                          <span
                            key={i}
                            className="bg-emerald-500/10 border border-emerald-700 text-emerald-300 px-3 py-1 rounded-full text-sm"
                          >
                            {x}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {custom.antonyms?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase mb-1">
                        Your Antonyms
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {custom.antonyms.map((x, i) => (
                          <span
                            key={i}
                            className="bg-rose-500/10 border border-rose-700 text-rose-300 px-3 py-1 rounded-full text-sm"
                          >
                            {x}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {custom.examples?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase mb-1">Examples</p>
                      {custom.examples.map((x, i) => (
                        <p key={i} className="text-sm text-slate-300 italic">
                          “{x}”
                        </p>
                      ))}
                    </div>
                  )}

                  {custom.notes?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase mb-1">Notes</p>
                      {custom.notes.map((x, i) => (
                        <p key={i} className="text-sm text-slate-300">
                          • {x}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-violet-300 font-bold">Add Your Input</h3>

                <textarea
                  value={customForm.meaning}
                  onChange={(e) =>
                    setCustomForm({ ...customForm, meaning: e.target.value })
                  }
                  placeholder="Extra meaning..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none min-h-[70px]"
                />

                {showSynAnt && (
                  <div className="grid md:grid-cols-2 gap-3">
                    <input
                      value={customForm.synonyms}
                      onChange={(e) =>
                        setCustomForm({ ...customForm, synonyms: e.target.value })
                      }
                      placeholder="Synonyms, comma separated"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
                    />

                    <input
                      value={customForm.antonyms}
                      onChange={(e) =>
                        setCustomForm({ ...customForm, antonyms: e.target.value })
                      }
                      placeholder="Antonyms, comma separated"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
                    />
                  </div>
                )}

                <input
                  value={customForm.example}
                  onChange={(e) =>
                    setCustomForm({ ...customForm, example: e.target.value })
                  }
                  placeholder="Example sentence..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
                />

                <textarea
                  value={customForm.note}
                  onChange={(e) =>
                    setCustomForm({ ...customForm, note: e.target.value })
                  }
                  placeholder="Personal note / memory trick..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none min-h-[70px]"
                />

                <button
                  onClick={saveCustomInput}
                  className="bg-cyan-600 hover:bg-cyan-500 px-5 py-2 rounded-xl text-sm font-bold"
                >
                  Save My Input
                </button>
              </div>
            </article>
          )}
        </section>

        <aside className="space-y-5">
          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-5 shadow-xl shadow-black/30">
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                ["words", "Words"],
                ["idioms", "Idioms"],
                ["phrasals", "Phrasals"],
                ["ows", "OWS"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActivePanel(key)}
                  className={`rounded-xl px-3 py-2 text-sm font-bold border ${
                    activePanel === key
                      ? "bg-yellow-400 text-slate-950 border-yellow-300"
                      : "bg-slate-950 text-slate-300 border-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <h3 className="font-bold text-lg text-yellow-300 mb-1">
              {panelTitles[activePanel]}
            </h3>

            <p className="text-xs text-slate-400 mb-4">
              Changes automatically every day.
            </p>

            <div className="space-y-3">
              {panelItems[activePanel].map((item, index) => {
                const done = completedDaily.includes(item.word);

                return (
                  <div
                    key={index}
                    onClick={() => searchItem(item.word)}
                    className="bg-slate-950 border border-slate-800 hover:border-yellow-500 rounded-xl p-3 cursor-pointer"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white">{item.word}</h4>

                        <p className="text-xs text-slate-400 line-clamp-2">
                          {item.meaning}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDone(item.word);
                        }}
                        className={`h-fit px-2 py-1 rounded-lg text-xs ${
                          done
                            ? "bg-green-700 text-white"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {done ? "Done" : "Mark"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-5 shadow-xl shadow-black/30">
            <h3 className="font-bold text-lg text-cyan-300 mb-3">
              My Word Vault
            </h3>

            <div className="flex gap-2 mb-3">
              <input
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addMyWord();
                }}
                placeholder="Add your word..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
              />

              <button
                onClick={addMyWord}
                className="bg-cyan-600 hover:bg-cyan-500 px-4 rounded-xl text-sm font-bold"
              >
                Add
              </button>
            </div>

            <div className="space-y-2">
              {myWords.length === 0 && (
                <p className="text-xs text-slate-500">No saved words yet.</p>
              )}

              {myWords.map((word, index) => (
                <div
                  key={index}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm flex justify-between items-center"
                >
                  <span
                    onClick={() => searchItem(word)}
                    className="cursor-pointer hover:text-cyan-300"
                  >
                    {word}
                  </span>

                  <button
                    onClick={() => removeMyWord(word)}
                    className="text-red-400 text-xs hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/80 border border-amber-700/60 rounded-2xl p-4">
              <p className="text-amber-300 font-bold">Hard</p>
              <p className="text-2xl font-black">{weakWords.length}</p>
            </div>

            <div className="bg-slate-900/80 border border-green-700/60 rounded-2xl p-4">
              <p className="text-green-300 font-bold">Mastered</p>
              <p className="text-2xl font-black">{masteredWords.length}</p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
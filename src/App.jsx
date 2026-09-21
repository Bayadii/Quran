import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bookmark, BookmarkCheck, BookOpen, ChevronRight, CirclePlay, Filter, Headphones, Home as HomeIcon, LoaderCircle, Pause, RotateCcw, Search, X } from 'lucide-react'
import { getDoas, getJuz, getSurah, getSurahs } from './api'

const STORAGE_KEYS = { bookmarks: 'senja-quran-bookmarks', lastRead: 'senja-quran-last-read' }

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return value ?? fallback
  } catch {
    return fallback
  }
}

function App() {
  const [screen, setScreen] = useState('home')
  const [libraryTab, setLibraryTab] = useState('surah')
  const [surahs, setSurahs] = useState([])
  const [bookmarks, setBookmarks] = useState(() => readStorage(STORAGE_KEYS.bookmarks, []))
  const [lastRead, setLastRead] = useState(() => readStorage(STORAGE_KEYS.lastRead, null))
  const [reader, setReader] = useState(null)
  const [readerLoading, setReaderLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [doas, setDoas] = useState([])

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(bookmarks)) }, [bookmarks])
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.lastRead, JSON.stringify(lastRead)) }, [lastRead])

  const pushNavigation = (state) => window.history.pushState({ quran: true, ...state }, '', window.location.href)

  useEffect(() => {
    const currentState = window.history.state
    if (!currentState?.quran) window.history.replaceState({ quran: true, screen: 'home' }, '', window.location.href)
    window.history.pushState({ quran: true, screen: 'home', guard: true }, '', window.location.href)

    const handlePopState = event => {
      const nextState = event.state
      if (!nextState?.quran) return
      setError('')
      if (nextState.screen === 'home') {
        setScreen('home')
      } else if (nextState.screen === 'library') {
        setScreen('library')
        setLibraryTab(nextState.tab || 'surah')
      } else if (nextState.screen === 'doa') {
        setScreen('doa')
      } else if (nextState.screen === 'reader' && nextState.reader) {
        setScreen('reader')
        openReader(nextState.reader.type, nextState.reader.number, nextState.reader.verse, false)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const openLibrary = async (tab = 'surah', addHistory = true) => {
    if (addHistory) pushNavigation({ screen: 'library', tab })
    setScreen('library')
    setLibraryTab(tab)
    setError('')
    if (tab === 'surah' && !surahs.length) {
      setReaderLoading(true)
      try { setSurahs(await getSurahs()) } catch (caught) { setError(caught.message) } finally { setReaderLoading(false) }
    }
  }

  const openDoa = async (addHistory = true) => {
    if (addHistory) pushNavigation({ screen: 'doa' })
    setScreen('doa')
    setError('')
    if (doas.length) return
    setReaderLoading(true)
    try { setDoas(await getDoas()) } catch (caught) { setError(caught.message) } finally { setReaderLoading(false) }
  }

  const openReader = async (type, number, verseNumber = null, addHistory = true) => {
    if (addHistory) pushNavigation({ screen: 'reader', reader: { type, number, verse: verseNumber } })
    setScreen('reader')
    setReaderLoading(true)
    setError('')
    try {
      const data = type === 'surah' ? await getSurah(number) : await getJuz(number)
      let availableSurahs = surahs
      if (type === 'surah' && availableSurahs.length === 0) {
        availableSurahs = await getSurahs()
        setSurahs(availableSurahs)
      }
      const normalized = type === 'surah'
          ? { ...data, audioFull: normalizeAudio(data.audioFull), ayat: data.ayat.map(ayah => normalizeAyah({ ...ayah, surahNumber: data.nomor, surahName: data.namaLatin })) }
        : normalizeJuz(data, number)
      const nextSurah = type === 'surah' ? availableSurahs.find(item => item.nomor === number + 1) : null
      setReader({ type, number, ...normalized, nextSurah, initialVerse: verseNumber })
      setLastRead({ type, number, verse: verseNumber, surahName: normalized.namaLatin || `Juz ${number}`, surahNumber: type === 'surah' ? number : normalized.surahNumber })
    } catch (caught) { setError(caught.message) } finally { setReaderLoading(false) }
  }

  const goBack = () => window.history.back()
  const changeLibraryTab = tab => {
    setLibraryTab(tab)
    pushNavigation({ screen: 'library', tab })
  }
  const toggleBookmark = (ayah) => {
    const key = `${ayah.surahNumber}-${ayah.verseNumber}`
    setBookmarks(current => current.some(item => item.key === key)
      ? current.filter(item => item.key !== key)
      : [{ ...ayah, key, savedAt: Date.now() }, ...current])
  }

  return (
    <div className="app-shell">
      {screen === 'home' && <Home lastRead={lastRead} onRead={() => openLibrary()} onDoa={openDoa} onContinue={() => lastRead && openReader(lastRead.type, lastRead.number, lastRead.verse)} />}
      {screen === 'library' && <Library tab={libraryTab} setTab={changeLibraryTab} surahs={surahs} bookmarks={bookmarks} lastRead={lastRead} search={search} setSearch={setSearch} loading={readerLoading} error={error} onBack={goBack} onReader={openReader} onBookmark={toggleBookmark} />}
      {screen === 'doa' && <DoaPage doas={doas} loading={readerLoading} error={error} onBack={goBack} />}
      {screen === 'reader' && <Reader reader={reader} loading={readerLoading} error={error} bookmarks={bookmarks} lastRead={lastRead} onBack={goBack} onBookmark={toggleBookmark} onProgress={setLastRead} onNext={openReader} />}
    </div>
  )
}

function Home({ lastRead, onRead, onDoa, onContinue }) {
  return <main className="home-page page-padding">
    <section className="home-copy"><p className="home-bismillah">بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ</p></section>
    <div className="home-actions">
      <button className="action-card primary-action" onClick={onRead}><span className="action-icon"><BookOpen size={22} /></span><strong>Baca Al-Qur'an</strong><ChevronRight size={20} /></button>
      <button className="action-card" onClick={onContinue} disabled={!lastRead}><span className="action-icon"><RotateCcw size={21} /></span><strong>Lanjutkan Membaca Al-Qur'an</strong><ChevronRight size={20} /></button>
      <button className="action-card" onClick={onDoa}><span className="action-icon"><Filter size={21} /></span><strong>Doa</strong><ChevronRight size={20} /></button>
    </div>
  </main>
}

function DoaPage({ doas, loading, error, onBack }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [tag, setTag] = useState('')
  const groups = useMemo(() => [...new Set(doas.map(doa => doa.grup).filter(Boolean))], [doas])
  const tags = useMemo(() => [...new Set(doas.flatMap(doa => Array.isArray(doa.tag) ? doa.tag : []))], [doas])
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return doas.filter(doa => {
      const searchable = [doa.nama, doa.grup, doa.ar, doa.tr, doa.idn, ...(doa.tag || [])].filter(Boolean).join(' ').toLowerCase()
      return (!normalizedQuery || searchable.includes(normalizedQuery)) && (!group || doa.grup === group) && (!tag || (doa.tag || []).includes(tag))
    })
  }, [doas, group, query, tag])

  return <main className="doa-page">
    <header className="topbar"><button className="icon-button" onClick={onBack} aria-label="Kembali"><ArrowLeft size={20} /></button><span className="topbar-title">Doa</span></header>
    <section className="doa-content page-padding">
      <div className="doa-heading"><span className="section-eyebrow"></span><h1>Kumpulan Doa</h1><p></p></div>
      <div className="doa-filters">
        <label className="search-box doa-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari doa..." />{query && <button onClick={() => setQuery('')} aria-label="Hapus pencarian"><X size={16} /></button>}</label>
        <label className="filter-field"><span>Kategori</span><select value={group} onChange={event => setGroup(event.target.value)}><option value="">Semua kategori</option>{groups.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="filter-field"><span>Tag</span><select value={tag} onChange={event => setTag(event.target.value)}><option value="">Semua tag</option>{tags.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      {loading && <Loading label="Menyiapkan daftar doa" />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && <><div className="doa-result-count">{filtered.length} doa</div><div className="doa-list">{filtered.map(doa => <DoaItem key={doa.id} doa={doa} />)}</div>{filtered.length === 0 && <div className="empty-state"><Filter size={22} /><strong>Doa tidak ditemukan</strong><p>Coba ubah kata pencarian atau filter.</p></div>}</>}
    </section>
  </main>
}

function DoaItem({ doa }) {
  return <article className="doa-item"><div className="doa-item-top"><span className="doa-number">{String(doa.id).padStart(3, '0')}</span><div><h2>{doa.nama}</h2><small>{doa.grup}</small></div></div><p className="doa-arabic">{doa.ar}</p><p className="doa-latin">{doa.tr}</p><p className="doa-translation">{doa.idn}</p>{doa.tag?.length > 0 && <div className="doa-tags">{doa.tag.map(item => <span key={item}>#{item}</span>)}</div>}{doa.tentang && <details><summary>Referensi</summary><p>{doa.tentang}</p></details>}</article>
}

function Library({ tab, setTab, surahs, bookmarks, lastRead, search, setSearch, loading, error, onBack, onReader, onBookmark }) {
  const filtered = useMemo(() => surahs.filter(item => `${item.namaLatin} ${item.arti} ${item.nomor}`.toLowerCase().includes(search.toLowerCase())), [surahs, search])
  return <main className="library-page">
    <header className="topbar"><button className="icon-button" onClick={onBack} aria-label="Kembali"><ArrowLeft size={20} /></button><span className="topbar-title">Baca Al-Qur'an</span></header>
    <nav className="tabs page-padding" aria-label="Navigasi bacaan">{[['surah', 'Surah'], ['bookmark', 'Bookmark']].map(([id, label]) => <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>{label}{id === 'bookmark' && bookmarks.length > 0 && <sup>{bookmarks.length}</sup>}</button>)}</nav>
    <section className="library-content page-padding">
      {tab === 'surah' && <><div className="search-box"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama surah..." />{search && <button onClick={() => setSearch('')}><X size={16} /></button>}</div>{loading && <Loading label="Menyiapkan daftar surah" />}{error && <ErrorMessage message={error} />}{!loading && !error && <div className="surah-list">{filtered.map(surah => <SurahRow key={surah.nomor} surah={surah} onClick={() => onReader('surah', surah.nomor)} />)}</div>}</>}
      {tab === 'bookmark' && <BookmarkList bookmarks={bookmarks} lastRead={lastRead} onContinue={() => lastRead && onReader(lastRead.type, lastRead.number, lastRead.verse)} onReader={onReader} onBookmark={onBookmark} />}
    </section>
    <div className="mobile-nav"><button onClick={onBack}><HomeIcon size={18} />Beranda</button><button className="selected"><BookOpen size={18} />Baca</button></div>
  </main>
}

function SurahRow({ surah, onClick }) {
  return <button className="surah-row" onClick={onClick}><span className="surah-number">{String(surah.nomor).padStart(2, '0')}</span><span className="surah-info"><strong>{surah.namaLatin}</strong><small>{surah.arti} · {surah.jumlahAyat} ayat</small></span><span className="arabic-name">{surah.nama}</span><ChevronRight size={17} /></button>
}

function JuzList({ onClick }) {
  return <div className="juz-grid">{Array.from({ length: 30 }, (_, index) => index + 1).map(number => <button className="juz-card" key={number} onClick={() => onClick(number)}><span className="juz-number">{String(number).padStart(2, '0')}</span><span><strong>Juz {number}</strong><small>{juzThemes[number - 1]}</small></span><ChevronRight size={16} /></button>)}</div>
}

function BookmarkList({ bookmarks, lastRead, onContinue, onReader, onBookmark }) {
  return <div className="bookmark-view">{lastRead ? <button className="last-read-card" onClick={onContinue}><span className="mini-label"><RotateCcw size={13} /> TERAKHIR DIBACA</span><strong>{lastRead.surahName}</strong><span>Ayat {lastRead.verse} · lanjutkan dari sini <ChevronRight size={15} /></span></button> : <div className="empty-last"><RotateCcw size={19} /><span>Belum ada bacaan terakhir</span></div>}<div className="section-label"><span>AYAT TERSIMPAN</span><small>{bookmarks.length} ayat</small></div>{bookmarks.length === 0 ? <div className="empty-state"><Bookmark size={22} /><strong>Belum ada bookmark</strong><p>Tekan ikon bookmark pada ayat yang ingin kamu simpan.</p></div> : <div className="bookmark-list">{bookmarks.map(item => <BookmarkItem key={item.key} item={item} onClick={() => onReader('surah', item.surahNumber, item.verseNumber)} onRemove={() => onBookmark(item)} />)}</div>}</div>
}

function BookmarkItem({ item, onClick, onRemove }) {
  return <div className="bookmark-item"><button onClick={onClick}><span className="item-ref">{item.surahName} · {item.verseNumber}</span><span className="bookmark-arabic">{item.arabic}</span><span className="bookmark-translation">{item.translation}</span></button><button className="remove-bookmark" onClick={onRemove} aria-label="Hapus bookmark"><BookmarkCheck size={18} /></button></div>
}

function Reader({ reader, loading, error, bookmarks, lastRead, onBack, onBookmark, onProgress, onNext }) {
  const containerRef = useRef(null)
  const fullAudioRef = useRef(null)
  const [activeAudio, setActiveAudio] = useState(null)
  useEffect(() => {
    if (!reader || !containerRef.current) return
    const selector = reader.initialVerse === null ? '.bismillah' : `[data-verse="${reader.initialVerse}"]`
    const target = containerRef.current.querySelector(selector) || containerRef.current
    setTimeout(() => target.scrollIntoView({ block: 'start' }), 80)
  }, [reader])
  useEffect(() => { const root = containerRef.current; if (!root || !reader) return; const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { const verse = Number(entry.target.dataset.verse); onProgress({ type: reader.type, number: reader.number, verse, surahName: reader.namaLatin || `Juz ${reader.number}`, surahNumber: reader.type === 'surah' ? reader.number : entry.target.dataset.surah }) } }), { rootMargin: '-20% 0px -65% 0px' }); root.querySelectorAll('[data-verse]').forEach(item => observer.observe(item)); return () => observer.disconnect() }, [reader, onProgress])
  if (loading) return <div className="reader-page"><ReaderHeader title="Memuat bacaan" onBack={onBack} /><Loading label="Menyiapkan ayat" /></div>
  if (error) return <div className="reader-page"><ReaderHeader title="Bacaan" onBack={onBack} /><ErrorMessage message={error} /></div>
  if (!reader) return null
  const title = reader.type === 'surah' ? reader.namaLatin : `Juz ${reader.number}`
  const toggleFullAudio = () => {
    if (!fullAudioRef.current) return
    if (activeAudio === 'full') {
      fullAudioRef.current.pause()
      setActiveAudio(null)
      return
    }
    document.querySelectorAll('audio').forEach(audio => audio.pause())
    fullAudioRef.current.currentTime = 0
    fullAudioRef.current.play()
    setActiveAudio('full')
  }
  return <main className="reader-page"><ReaderHeader title={title} subtitle={reader.type === 'surah' ? `${reader.arti} · ${reader.jumlahAyat} ayat` : 'Kumpulan ayat Al-Qur’an'} onBack={onBack} audioAvailable={Boolean(reader.audioFull)} audioPlaying={activeAudio === 'full'} onAudio={toggleFullAudio} /><div className="reading-column" ref={containerRef}>{reader.type === 'surah' && reader.number !== 9 && <div className="bismillah">بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ</div>}{reader.ayat.map((ayah, index) => <Ayah key={`${ayah.surahNumber}-${ayah.verseNumber}-${index}`} ayah={ayah} isBookmarked={bookmarks.some(item => item.key === `${ayah.surahNumber}-${ayah.verseNumber}`)} audioPlaying={activeAudio === `${ayah.surahNumber}-${ayah.verseNumber}`} setAudioPlaying={setActiveAudio} onBookmark={onBookmark} />)}{reader.nextSurah && <button className="next-surah" onClick={() => onNext('surah', reader.nextSurah.nomor)}><span>Surat selanjutnya</span><strong>{reader.nextSurah.namaLatin}</strong><ChevronRight size={18} /></button>}</div>{reader.audioFull && <audio ref={fullAudioRef} src={reader.audioFull} onEnded={() => setActiveAudio(null)} />}</main>
}

function ReaderHeader({ title, subtitle, onBack, audioAvailable, audioPlaying, onAudio }) { return <header className="reader-header"><button className="icon-button" onClick={onBack} aria-label="Kembali"><ArrowLeft size={20} /></button><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{audioAvailable && <button className={audioPlaying ? 'icon-button audio-active' : 'icon-button'} onClick={onAudio} aria-label={audioPlaying ? 'Jeda audio surat' : 'Putar surat dari awal'}>{audioPlaying ? <Pause size={19} /> : <Headphones size={19} />}</button>}</header> }

function Ayah({ ayah, isBookmarked, audioPlaying, setAudioPlaying, onBookmark }) {
  const audioRef = useRef(null)
  const toggleAudio = () => { if (!ayah.audio) return; if (audioPlaying) { audioRef.current?.pause(); setAudioPlaying(null) } else { document.querySelectorAll('audio').forEach(audio => audio.pause()); audioRef.current?.play(); setAudioPlaying(`${ayah.surahNumber}-${ayah.verseNumber}`) } }
  return <article className="ayah" data-verse={ayah.verseNumber} data-surah={ayah.surahNumber}><div className="ayah-top"><span className="ayah-number">{ayah.verseNumber}</span><div className="ayah-actions"><button className={audioPlaying ? 'ayah-action playing' : 'ayah-action'} onClick={toggleAudio} aria-label="Putar audio"><CirclePlay size={17} />{audioPlaying ? 'Pause' : 'Putar'}</button><button className={isBookmarked ? 'ayah-action bookmarked' : 'ayah-action'} onClick={() => onBookmark(ayah)} aria-label="Simpan bookmark">{isBookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}</button></div></div><p className="arabic-text">{ayah.arabic}</p><p className="latin-text">{ayah.latin}</p><p className="translation">{ayah.translation}</p>{ayah.audio && <audio ref={audioRef} src={ayah.audio} onEnded={() => setAudioPlaying(null)} />}</article>
}

function Loading({ label }) { return <div className="loading-state"><LoaderCircle className="spin" size={22} /><span>{label}...</span></div> }
function ErrorMessage({ message }) { return <div className="error-state"><strong>Belum berhasil dimuat</strong><p>{message}</p></div> }

function normalizeJuz(data, number) {
  const ayat = Array.isArray(data) ? data : data.ayat || data.verses || []
  return { namaLatin: `Juz ${number}`, surahNumber: ayat[0]?.surah?.nomor || ayat[0]?.surahNumber, ayat: ayat.map(normalizeAyah) }
}

function normalizeAyah(ayah) {
  const audio = normalizeAudio(ayah.audio)
  return { surahNumber: ayah.surahNumber || ayah.surah?.nomor || 1, surahName: ayah.surah?.namaLatin || ayah.surahName || '', verseNumber: ayah.nomorAyat || ayah.verseNumber || ayah.nomor, arabic: ayah.teksArab || ayah.arabic || '', latin: ayah.teksLatin || ayah.latin || '', translation: ayah.teksIndonesia || ayah.translation || '', audio }
}

function normalizeAudio(audio) {
  return typeof audio === 'string' ? audio : audio?.['05'] || Object.values(audio || {})[0]
}

const juzThemes = ['Awal wahyu', 'Keluarga Imran', 'Kisah para nabi', 'An-Nisa', 'Al-Maidah', 'Al-Anam', 'Al-Araf', 'Al-Anfal', 'At-Taubah', 'Yunus', 'Hud', 'Yusuf', 'Ibrahim', 'Al-Hijr', 'Al-Isra', 'Al-Kahf', 'Al-Anbiya', 'Al-Muminun', 'Al-Furqan', 'An-Naml', 'Al-Ankabut', 'Yasin', 'Az-Zumar', 'Fussilat', 'Al-Jasiyah', 'Al-Ahqaf', 'Adz-Dzariyat', 'Al-Mujadilah', 'Al-Mulk', 'An-Naba']

export default App
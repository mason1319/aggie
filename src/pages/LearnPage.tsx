import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, CircleAlert,
  Ear, Image, Keyboard, RotateCcw, Sparkles, Trophy, Volume2, X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { courses } from '../data/courses'
import { getMediaAsset, getMediaBinding, getProgress, savePracticeResult, saveProgress } from '../lib/storage'
import type { MediaAsset, PracticeMode, ProgressState } from '../types'

const modeLabels: Record<PracticeMode, { label: string; icon: typeof Image }> = {
  image: { label: '看图选词', icon: Image },
  listen: { label: '听音选词', icon: Ear },
  spell: { label: '拼写练习', icon: Keyboard },
}

function speak(text: string, onUnsupported: () => void) {
  if (!('speechSynthesis' in window)) {
    onUnsupported()
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.82
  window.speechSynthesis.speak(utterance)
}

function playMedia(asset: MediaAsset | undefined, fallbackText: string, onUnsupported: () => void) {
  if (!asset) {
    speak(fallbackText, onUnsupported)
    return
  }
  const audio = new Audio(asset.dataUrl)
  audio.onerror = () => speak(fallbackText, onUnsupported)
  void audio.play().catch(() => speak(fallbackText, onUnsupported))
}

export function LearnPage() {
  const [progress, setProgress] = useState<ProgressState>(() => getProgress())
  const [mode, setMode] = useState<PracticeMode | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [spellAnswer, setSpellAnswer] = useState('')
  const [speechWarning, setSpeechWarning] = useState(false)

  const course = courses.find((item) => item.id === progress.courseId) ?? courses[1]
  const unit = course.units.find((item) => item.id === progress.unitId) ?? course.units[0]
  const currentIndex = Math.min(progress.currentItemIndex, unit.items.length - 1)
  const currentItem = unit.items[currentIndex]
  const masteredInUnit = unit.items.filter((item) => progress.learnedItemIds.includes(item.id)).length
  const unitPercent = Math.round((masteredInUnit / unit.items.length) * 100)
  const mediaBinding = getMediaBinding(currentItem.id)
  const wordAudioAsset = getMediaAsset(mediaBinding.wordAudioAssetId)
  const sentenceAudioAsset = getMediaAsset(mediaBinding.sentenceAudioAssetId)

  const options = useMemo(() => {
    const others = unit.items.filter((item) => item.id !== currentItem.id).slice(0, 3)
    return [currentItem, ...others].sort((a, b) => a.word.localeCompare(b.word))
  }, [currentItem, unit.items])

  const updateProgress = (next: ProgressState) => {
    setProgress(next)
    saveProgress(next)
  }

  const selectCourse = (courseId: string) => {
    const nextCourse = courses.find((item) => item.id === courseId) ?? courses[0]
    updateProgress({ ...progress, courseId, unitId: nextCourse.units[0].id, currentItemIndex: 0 })
    setMode(null)
    setFeedback(null)
  }

  const selectUnit = (unitId: string) => {
    updateProgress({ ...progress, unitId, currentItemIndex: 0 })
    setMode(null)
    setFeedback(null)
  }

  const move = (direction: number) => {
    const nextIndex = (currentIndex + direction + unit.items.length) % unit.items.length
    updateProgress({ ...progress, currentItemIndex: nextIndex })
    setFeedback(null)
    setSpellAnswer('')
  }

  const markLearned = () => {
    const learnedItemIds = progress.learnedItemIds.includes(currentItem.id)
      ? progress.learnedItemIds
      : [...progress.learnedItemIds, currentItem.id]
    const nextIndex = (currentIndex + 1) % unit.items.length
    updateProgress({ ...progress, learnedItemIds, currentItemIndex: nextIndex })
    setFeedback(null)
    setSpellAnswer('')
  }

  const answer = (value: string) => {
    const correct = value.trim().toLowerCase() === currentItem.word.toLowerCase()
    const wrongItemIds = correct
      ? progress.wrongItemIds.filter((id) => id !== currentItem.id)
      : Array.from(new Set([...progress.wrongItemIds, currentItem.id]))
    const learnedItemIds = correct
      ? Array.from(new Set([...progress.learnedItemIds, currentItem.id]))
      : progress.learnedItemIds
    const nextProgress = {
      ...progress,
      wrongItemIds,
      learnedItemIds,
      practiceCount: progress.practiceCount + 1,
      correctCount: progress.correctCount + (correct ? 1 : 0),
    }
    updateProgress(nextProgress)
    savePracticeResult({
      itemId: currentItem.id,
      mode: mode ?? 'spell',
      correct,
      answer: value,
      createdAt: new Date().toISOString(),
    })
    setFeedback(correct ? 'correct' : 'wrong')
  }

  const startMode = (nextMode: PracticeMode) => {
    setMode(nextMode)
    setFeedback(null)
    setSpellAnswer('')
    if (nextMode === 'listen') playMedia(wordAudioAsset, currentItem.word, () => setSpeechWarning(true))
  }

  return (
    <div className="learn-page">
      <header className="learn-header">
        <Link to="/" className="brand">
          <span className="brand-mark"><BookOpen size={22} /></span>
          <span><strong>Aggie学习体验</strong><small>每天进步一点点</small></span>
        </Link>
        <div className="learn-stats">
          <span><Trophy size={17} /> 已掌握 <strong>{progress.learnedItemIds.length}</strong></span>
          <span><CircleAlert size={17} /> 错词 <strong>{progress.wrongItemIds.length}</strong></span>
        </div>
        <Link className="button button-small button-ghost" to="/"><ArrowLeft size={17} /> 返回官网</Link>
      </header>

      {speechWarning && (
        <div className="speech-warning"><CircleAlert size={17} /> 当前浏览器不支持语音播放，请更换现代浏览器体验。<button onClick={() => setSpeechWarning(false)}><X size={16} /></button></div>
      )}

      <div className="learn-layout">
        <aside className="course-sidebar">
          <div className="sidebar-heading"><span>选择课程</span><strong>5大体系</strong></div>
          <div className="course-select-list">
            {courses.map((item) => (
              <button className={item.id === course.id ? 'active' : ''} onClick={() => selectCourse(item.id)} key={item.id}>
                <span className={`sidebar-course-icon tone-${item.tone}`}>{item.icon}</span>
                <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          <div className="wrong-book">
            <div><RotateCcw size={19} /><strong>错词本</strong></div>
            <p>练错的单词会自动收集，方便后续重点复习。</p>
            <span>{progress.wrongItemIds.length} 个待复习</span>
          </div>
        </aside>

        <main className="learn-main">
          <div className="learn-title-row">
            <div><span className="mini-label">{course.title}</span><h1>{unit.title}</h1><p>{unit.subtitle}</p></div>
            <div className="unit-select">
              <label htmlFor="unit">学习单元</label>
              <select id="unit" value={unit.id} onChange={(event) => selectUnit(event.target.value)}>
                {course.units.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
              </select>
            </div>
          </div>

          <div className="learn-progress">
            <div><span>本单元进度</span><strong>{masteredInUnit} / {unit.items.length}</strong></div>
            <div className="progress-track"><i style={{ width: `${unitPercent}%` }} /></div>
          </div>

          <div className="study-grid">
            <section className="study-card">
              <div className="study-card-top">
                <span>单词 {currentIndex + 1} / {unit.items.length}</span>
                <div className="study-audio-meta">
                  {wordAudioAsset && <span className="audio-badge">真人录音</span>}
                  <button className="audio-button" onClick={() => playMedia(wordAudioAsset, currentItem.word, () => setSpeechWarning(true))}>
                    <Volume2 size={21} /> {wordAudioAsset ? '播放真人发音' : '播放发音'}
                  </button>
                </div>
              </div>
              <div className="study-content">
                <div className="study-word-block">
                  <h2>{currentItem.word}</h2>
                  <p>{currentItem.phonetic}</p>
                  <strong>{currentItem.meaning}</strong>
                </div>
                <div className="study-illustration" style={{ background: currentItem.color }}>
                  <span>{currentItem.illustration}</span>
                  <small>图片联想记忆</small>
                </div>
              </div>
              <div className="sentence-card">
                <div className="sentence-audio-wrap">
                  {sentenceAudioAsset && <span className="audio-badge tiny">句子录音</span>}
                  <button onClick={() => playMedia(sentenceAudioAsset, currentItem.sentence, () => setSpeechWarning(true))}><Volume2 size={18} /></button>
                </div>
                <div><strong>{currentItem.sentence}</strong><span>{currentItem.sentenceMeaning}</span></div>
              </div>
              <div className="study-actions">
                <button className="round-nav" aria-label="上一个单词" onClick={() => move(-1)}><ChevronLeft /></button>
                <button className="button button-primary" onClick={markLearned}><Check size={18} /> 我学会了</button>
                <button className="round-nav" aria-label="下一个单词" onClick={() => move(1)}><ChevronRight /></button>
              </div>
            </section>

            <section className="practice-panel">
              <div className="practice-heading"><div><Sparkles size={20} /><strong>趣味练习</strong></div><span>及时巩固，记得更牢</span></div>
              <div className="practice-modes">
                {(Object.keys(modeLabels) as PracticeMode[]).map((item) => {
                  const Icon = modeLabels[item].icon
                  return <button className={mode === item ? 'active' : ''} onClick={() => startMode(item)} key={item}><Icon size={18} />{modeLabels[item].label}</button>
                })}
              </div>

              {!mode && (
                <div className="practice-empty">
                  <span>🎯</span><h3>选择一种练习方式</h3><p>用不同方法反复遇见这个单词。</p>
                </div>
              )}

              {mode === 'image' && (
                <div className="practice-question">
                  <div className="question-visual" style={{ background: currentItem.color }}>{currentItem.illustration}</div>
                  <h3>图片对应哪个单词？</h3>
                  <div className="answer-grid">
                    {options.map((item) => <button disabled={feedback !== null} onClick={() => answer(item.word)} key={item.id}>{item.word}</button>)}
                  </div>
                </div>
              )}

              {mode === 'listen' && (
                <div className="practice-question">
                  <button className="big-listen-button" onClick={() => speak(currentItem.word, () => setSpeechWarning(true))}><Volume2 size={30} /></button>
                  <h3>听一听，选择正确单词</h3>
                  <div className="answer-grid">
                    {options.map((item) => <button disabled={feedback !== null} onClick={() => answer(item.word)} key={item.id}>{item.word}</button>)}
                  </div>
                </div>
              )}

              {mode === 'spell' && (
                <div className="practice-question">
                  <div className="spell-meaning">{currentItem.meaning}</div>
                  <h3>请拼写这个单词</h3>
                  <form onSubmit={(event) => { event.preventDefault(); answer(spellAnswer) }}>
                    <input value={spellAnswer} onChange={(event) => setSpellAnswer(event.target.value)} placeholder="输入英文单词" autoFocus />
                    <button className="button button-primary" disabled={!spellAnswer.trim() || feedback !== null}>提交答案</button>
                  </form>
                </div>
              )}

              {feedback && (
                <div className={`feedback ${feedback}`}>
                  {feedback === 'correct' ? <><Check size={20} /><span><strong>回答正确！</strong>这个单词已经加入已掌握列表。</span></> : <><X size={20} /><span><strong>再试一次。</strong>正确答案是 {currentItem.word}，已加入错词本。</span></>}
                  <button onClick={() => move(1)}>下一词 <ArrowRight size={16} /></button>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

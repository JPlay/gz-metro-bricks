#!/usr/bin/env python3
"""厦门地铁闽南语报站片段（lang=nan）。读 voice-jobs.json（node tools/audio/export_jobs.mjs 导出）里 lang=='nan' 的条目。
合成：cosyvoice-v3.5-flash 克隆音色 + 指令「请用厦门闽南话…」（JPlay 选定，见 gz-shots-polish/minnan-test-r2/README.txt）。
质检：paraformer-realtime-v2（普通话 ASR）转写；如果几乎和普通话原文一样（相似度 >= TH），说明念成了普通话 → 重合成，最多重试 3 次，留最“不像普通话”的一版。
响度：与其它片段同一条 ffmpeg 链（loudnorm I=-19 TP=-2.5 LRA=6，24 kHz mono 64 kbps）。
密钥只从环境变量 DASHSCOPE_API_KEY 读取，不打印。结果记在 tools/audio/minnan-cache.json（id → fp / 相似度 / ASR 文本 / 尝试次数）。
用法：DASHSCOPE_API_KEY=… python3 tools/audio/generate_minnan.py [--only 子串] [--force]
"""
import os, sys, json, re, hashlib, subprocess, tempfile, pathlib, difflib, argparse, concurrent.futures, time
import dashscope
from dashscope.audio.tts_v2 import SpeechSynthesizer, AudioFormat
from dashscope.audio.asr import Recognition
ROOT = pathlib.Path(__file__).resolve().parents[2]; OUT = ROOT / 'assets/audio'
MODEL = 'cosyvoice-v3.5-flash'
VOICE = 'cosyvoice-v3.5-flash-ljv35f-eb898fe35c044e0e89ff3e553b701375'
INSTR = '请用厦门闽南话，以地铁广播播音员的平稳语调播报。'
TH = 0.7; TRIES = 4
CACHE_P = ROOT / 'tools/audio/minnan-cache.json'
FILTER = 'silenceremove=start_periods=1:start_duration=0.025:start_threshold=-48dB,highpass=f=145,lowpass=f=6500,loudnorm=I=-19:TP=-2.5:LRA=6,afade=t=in:d=0.018'
han = lambda t: re.sub(r'[^\u4e00-\u9fff0-9A-Za-z]', '', t or '')
def sim(a, b): return difflib.SequenceMatcher(None, han(a), han(b)).ratio()
def fp(j): return hashlib.sha256(json.dumps([MODEL, VOICE, INSTR, j['text']], ensure_ascii=False).encode()).hexdigest()
def synth(text):
    for a in range(4):
        try:
            s = SpeechSynthesizer(model=MODEL, voice=VOICE, format=AudioFormat.MP3_24000HZ_MONO_256KBPS, instruction=INSTR)
            d = s.call(text)
            if d: return d
        except Exception: pass
        time.sleep(2 ** a)
    raise RuntimeError('synthesis failed')
def encode(data, path):
    with tempfile.NamedTemporaryFile(suffix='.mp3') as t:
        t.write(data); t.flush()
        p = subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', t.name, '-af', FILTER, '-ar', '24000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', str(path)], capture_output=True)
        if p.returncode: raise RuntimeError('encode failed')
def asr(path):
    with tempfile.NamedTemporaryFile(suffix='.wav') as w:
        subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', str(path), '-ar', '16000', '-ac', '1', w.name], check=True)
        for a in range(3):
            try:
                r = Recognition(model='paraformer-realtime-v2', format='wav', sample_rate=16000, callback=None, language_hints=['zh']).call(w.name)
                return ''.join(s['text'] for s in (r.get_sentence() or []))
            except Exception: time.sleep(2 ** a)
        return ''
def job(j):
    path = OUT / j['file']; best = None; tmpdir = pathlib.Path(tempfile.mkdtemp())
    for k in range(TRIES):
        cand = tmpdir / f'{k}.mp3'; encode(synth(j['text']), cand)
        heard = asr(cand); r = sim(heard, j['text'])
        if best is None or r < best[0]: best = (r, heard, cand)
        if r < TH: break
    path.parent.mkdir(parents=True, exist_ok=True); best[2].replace(path)
    return j['id'], {'fp': fp(j), 'model': MODEL, 'voice': VOICE, 'sim': round(best[0], 3), 'asr': best[1], 'tries': k + 1, 'flag': best[0] >= TH}
if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--only', default=''); ap.add_argument('--force', action='store_true'); ap.add_argument('--workers', type=int, default=4); a = ap.parse_args()
    key = os.environ.get('DASHSCOPE_API_KEY')
    if not key: raise SystemExit('DASHSCOPE_API_KEY is missing from the process environment')
    dashscope.api_key = key
    jobs = [j for j in json.loads((ROOT / 'tools/audio/voice-jobs.json').read_text()) if j['lang'] == 'nan' and a.only in j['id']]
    cache = json.loads(CACHE_P.read_text()) if CACHE_P.exists() else {}
    todo = [j for j in jobs if a.force or not ((OUT / j['file']).exists() and cache.get(j['id'], {}).get('fp') == fp(j))]
    print(f'nan jobs {len(jobs)}, to generate {len(todo)}', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
        for n, f in enumerate(concurrent.futures.as_completed([pool.submit(job, j) for j in todo]), 1):
            try: jid, e = f.result()
            except Exception as ex: print('FAILED', ex, flush=True); continue
            cache[jid] = e; CACHE_P.write_text(json.dumps(cache, ensure_ascii=False, indent=1) + '\n')
            print(f"{n}/{len(todo)} {jid} sim={e['sim']} tries={e['tries']}{' FLAG' if e['flag'] else ''} | {e['asr']}", flush=True)
    fl = [k for k, v in cache.items() if v.get('flag')]
    print('flagged', len(fl), fl, flush=True)

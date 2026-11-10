#!/usr/bin/env python3
"""厦门地铁闽南语报站片段（lang=nan）。读 voice-jobs.json（node tools/audio/export_jobs.mjs 导出）里 lang=='nan' 的条目。
合成：cosyvoice-v3.5-flash 克隆音色 + 指令「请用厦门闽南话…」（JPlay 选定，见 gz-shots-polish/minnan-test-r2/README.txt）。
质检：paraformer-realtime-v2（普通话 ASR）转写；如果几乎和普通话原文一样（相似度 >= TH），说明念成了普通话 → 重合成，最多重试 3 次，留最“不像普通话”的一版。
响度：与其它片段同一条 ffmpeg 链（loudnorm I=-19 TP=-2.5 LRA=6，24 kHz mono 64 kbps）。
密钥只从环境变量 DASHSCOPE_API_KEY 读取，不打印。结果记在 tools/audio/minnan-cache.json（id → fp / 相似度 / ASR 文本 / 尝试次数）。
用法：DASHSCOPE_API_KEY=… python3 tools/audio/generate_minnan.py [--only 子串] [--force]
重录被标记（偏普通话）的片段：… generate_minnan.py --improve ids.json [--tries 8]
  —— 同一克隆女声、同一模型；轮流用 INSTR_STRONG（「地道厦门腔闽南话」）和原指令，每次换随机种子（seed，原来固定 0，重试常常出一样的音）；
     留 ASR 相似度最低的一版，只有比现有版本低至少 0.02、ASR 不为空、时长在原版 0.6–1.6 倍之间才替换。缓存里记下所用指令 / 种子。
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
INSTR_STRONG = '请用地道厦门腔闽南话（白话音，不要用普通话发音）播报，女声，地铁广播播音员平稳中性的语调。'
CACHE_P = ROOT / 'tools/audio/minnan-cache.json'
FILTER = 'silenceremove=start_periods=1:start_duration=0.025:start_threshold=-48dB,highpass=f=145,lowpass=f=6500,loudnorm=I=-19:TP=-2.5:LRA=6,afade=t=in:d=0.018'
han = lambda t: re.sub(r'[^\u4e00-\u9fff0-9A-Za-z]', '', t or '')
def sim(a, b): return difflib.SequenceMatcher(None, han(a), han(b)).ratio()
def fp(j, instr=None): return hashlib.sha256(json.dumps([MODEL, VOICE, instr or INSTR, j['text']], ensure_ascii=False).encode()).hexdigest()
def synth(text, instr=None, seed=0):
    for a in range(4):
        try:
            s = SpeechSynthesizer(model=MODEL, voice=VOICE, format=AudioFormat.MP3_24000HZ_MONO_256KBPS, instruction=instr or INSTR, seed=seed)
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
def duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(path)], capture_output=True, text=True)
    return float(r.stdout or 0)
def improve(j, old, tries, salt=''):
    """重录一条被标记的片段：轮流强 / 原指令 + 随机种子，留最不像普通话的一版；不比原来好就不动原文件。"""
    import random
    path = OUT / j['file']; d0 = duration(path); best = None; tmpdir = pathlib.Path(tempfile.mkdtemp()); rng = random.Random(j['id'] + salt)
    for k in range(tries):
        instr = INSTR_STRONG if k % 2 == 0 else INSTR; seed = rng.randint(1, 65535)
        cand = tmpdir / f'{k}.mp3'
        try: encode(synth(j['text'], instr, seed), cand)
        except Exception: continue
        heard = asr(cand); r = sim(heard, j['text']); d = duration(cand)
        if not han(heard) or not (0.6 * d0 <= d <= 1.6 * d0): continue
        if best is None or r < best[0]: best = (r, heard, cand, instr, seed)
        if r < TH - 0.15: break
    o = old.get('sim', 1.0)
    if best is None or best[0] > o - 0.02: return j['id'], None, (o, best[0] if best else None)
    best[2].replace(path)
    e = {'fp': fp(j, best[3]), 'model': MODEL, 'voice': VOICE, 'sim': round(best[0], 3), 'asr': best[1], 'tries': k + 1, 'flag': best[0] >= TH, 'seed': best[4], 'prev_sim': old.get('prev_sim', o)}
    if best[3] != INSTR: e['instr'] = best[3]
    return j['id'], e, (o, best[0])
if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--only', default=''); ap.add_argument('--force', action='store_true'); ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--improve', default=''); ap.add_argument('--tries', type=int, default=8); ap.add_argument('--salt', default=''); a = ap.parse_args()
    key = os.environ.get('DASHSCOPE_API_KEY')
    if not key: raise SystemExit('DASHSCOPE_API_KEY is missing from the process environment')
    dashscope.api_key = key
    jobs = [j for j in json.loads((ROOT / 'tools/audio/voice-jobs.json').read_text()) if j['lang'] == 'nan' and a.only in j['id']]
    cache = json.loads(CACHE_P.read_text()) if CACHE_P.exists() else {}
    if a.improve:
        ids = json.loads(pathlib.Path(a.improve).read_text()); byid = {j['id']: j for j in jobs}
        with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
            futs = {pool.submit(improve, byid[i], cache.get(i, {}), a.tries, a.salt): i for i in ids if i in byid}
            for f in concurrent.futures.as_completed(futs):
                try: jid, e, (o, b) = f.result()
                except Exception as ex: print('FAILED', futs[f], ex, flush=True); continue
                if e: cache[jid] = e; CACHE_P.write_text(json.dumps(cache, ensure_ascii=False, indent=1) + '\n')
                print(f"{jid} before={o} best={b} {'REPLACED' if e else 'kept'}{' FLAG' if e and e['flag'] else ''}{' | ' + e['asr'] if e else ''}", flush=True)
        raise SystemExit(0)
    # 记录里带 instr 的片段（--improve 换过指令）按它自己的指令比对，不会被默认流程重录回去
    todo = [j for j in jobs if a.force or not ((OUT / j['file']).exists() and cache.get(j['id'], {}).get('fp') == fp(j, cache.get(j['id'], {}).get('instr')))]
    print(f'nan jobs {len(jobs)}, to generate {len(todo)}', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
        for n, f in enumerate(concurrent.futures.as_completed([pool.submit(job, j) for j in todo]), 1):
            try: jid, e = f.result()
            except Exception as ex: print('FAILED', ex, flush=True); continue
            cache[jid] = e; CACHE_P.write_text(json.dumps(cache, ensure_ascii=False, indent=1) + '\n')
            print(f"{n}/{len(todo)} {jid} sim={e['sim']} tries={e['tries']}{' FLAG' if e['flag'] else ''} | {e['asr']}", flush=True)
    fl = [k for k, v in cache.items() if v.get('flag')]
    print('flagged', len(fl), fl, flush=True)

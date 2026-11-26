#!/usr/bin/env python3
"""Generate the bundled announcement clips (dev tool, not loaded by the app).
Needs: pip install edge-tts, and ffmpeg. Output: audio/<lang>/<id>.mp3 (mono, 24 kbps)."""
import asyncio, os, subprocess, sys, edge_tts
VOICE = {'ar': 'ar-EG-SalmaNeural', 'en': 'en-US-AriaNeural'}
AR_U = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة']
AR_U_C = ['', 'واحد', 'اثنا', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة']
AR_TEENS = {10: 'عشرة', 11: 'أحد عشر', 12: 'اثنا عشر', 13: 'ثلاثة عشر', 14: 'أربعة عشر', 15: 'خمسة عشر', 16: 'ستة عشر', 17: 'سبعة عشر', 18: 'ثمانية عشر', 19: 'تسعة عشر'}
AR_T = {2: 'عشرون', 3: 'ثلاثون', 4: 'أربعون', 5: 'خمسون', 6: 'ستون', 7: 'سبعون', 8: 'ثمانون', 9: 'تسعون'}
AR_H = {1: 'مئة', 2: 'مئتان', 3: 'ثلاثمئة', 4: 'أربعمئة', 5: 'خمسمئة', 6: 'ستمئة', 7: 'سبعمئة', 8: 'ثمانمئة', 9: 'تسعمئة'}
AR_LETTERS = dict(zip('أبتثجحخدذرزسشصضطظعغفقكلمنهوي', 'ألف باء تاء ثاء جيم حاء خاء دال ذال راء زاي سين شين صاد ضاد طاء ظاء عين غين فاء قاف كاف لام ميم نون هاء واو ياء'.split()))
def ar99(n):
    if n < 10: return AR_U[n]
    if n < 20: return AR_TEENS[n]
    t, u = divmod(n, 10)
    return AR_T[t] if u == 0 else AR_U[u] + ' و' + AR_T[t]
EN_U = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
EN_T = {2: 'twenty', 3: 'thirty', 4: 'forty', 5: 'fifty', 6: 'sixty', 7: 'seventy', 8: 'eighty', 9: 'ninety'}
def en99(n):
    if n < 20: return EN_U[n]
    t, u = divmod(n, 10)
    return EN_T[t] if u == 0 else EN_T[t] + ' ' + EN_U[u]
clips = {'ar': {}, 'en': {}}
clips['ar'].update({'call': 'الرقم', 'go': 'تفضل الآن', 'zero': 'صفر'})
clips['en'].update({'call': 'Number', 'go': 'please proceed.', 'zero': 'zero'})
for n in range(1, 100):
    clips['ar']['n%d' % n] = ar99(n)
    clips['ar']['a%d' % n] = 'و' + ar99(n)       # "and" tail after hundreds
    clips['en']['n%d' % n] = en99(n)
for h in range(1, 10):
    clips['ar']['n%d' % (h * 100)] = AR_H[h]
    clips['en']['n%d' % (h * 100)] = EN_U[h] + ' hundred'
for k, v in AR_LETTERS.items(): clips['ar']['L' + k] = v
for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
    clips['en']['L' + c] = c.lower() if c != 'A' else 'ay'
    clips['ar']['L' + c] = clips['en']['L' + c]   # Latin letters spoken in English in the Arabic UI
async def one(lang, cid, text, sem):
    out = 'audio/%s/%s.mp3' % (lang, cid)
    if os.path.exists(out): return
    async with sem:
        raw = '/tmp/raw-%s-%s.mp3' % (lang, cid)
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, VOICE['en' if cid.startswith('L') and cid[1].isascii() else lang]).save(raw); break
            except Exception as e:
                await asyncio.sleep(2 + attempt)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=1:stop_threshold=-45dB:stop_duration=0.05,loudnorm=I=-18', '-ac', '1', '-ar', '24000', '-b:a', '24k', out], check=True)
        os.remove(raw)
async def main():
    sem = asyncio.Semaphore(6)
    await asyncio.gather(*[one(l, c, tx, sem) for l, d in clips.items() for c, tx in d.items()])
asyncio.run(main())

"""Fixed-exposure front projections of measured/reduced-model volumes.

These are scientific comparison videos, not a recording of a VR headset.
Requires numpy, Pillow and ffmpeg. Run export-flame-model.mjs first.
"""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
from pathlib import Path
import argparse,gzip,json,subprocess
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from build_flame_data import abel_matrix

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--test',default='21088A1')
parser.add_argument('--model-prefix',type=Path)
args=parser.parse_args()
base=ROOT/'app/public/psi159'/args.test
meta=json.loads((base/'lut-index.json').read_text())
prefix=args.model_prefix or Path(f'/private/tmp/flame-model-{args.test}')
model_meta=json.loads(Path(str(prefix)+'.json').read_text())
if model_meta['timesMs']!=meta['timesMs']:raise ValueError('Comparison clocks differ')
times=np.array(meta['timesMs'])/1000
shape=(meta['frames'],meta['z'],meta['r'])
a=abel_matrix(meta['r']).astype(np.float32)
measured=np.frombuffer(gzip.decompress((base/meta['file']).read_bytes()),dtype='<f2').reshape(shape)
model=np.fromfile(str(prefix)+'.bin',dtype='<f2').reshape(shape)
projections=[(f.astype(np.float32).reshape(-1,meta['r'])@a.T).reshape(shape) for f in [measured,model]]
font_path='/System/Library/Fonts/Supplemental/Arial.ttf'
font=ImageFont.truetype(font_path,15) if Path(font_path).exists() else ImageFont.load_default()
small=ImageFont.truetype(font_path,12) if Path(font_path).exists() else font

def image_at(t,paired=True):
    upper=int(np.clip(np.searchsorted(times,t),1,len(times)-1));lower=upper-1
    fraction=float(np.clip((t-times[lower])/(times[upper]-times[lower]),0,1))
    result=Image.new('RGB',(640,370),(5,7,11));draw=ImageDraw.Draw(result)
    for i,p in enumerate(projections):
        v=(1-fraction)*p[lower]+fraction*p[upper]
        full=np.concatenate([v[:,::-1],v],axis=1)
        linear=1-np.exp(-2*full[:,:,None]*np.array([.08,.25,1.]))
        srgb=np.where(linear<=.0031308,12.92*linear,1.055*np.power(linear,1/2.4)-.055)
        im=Image.fromarray(np.clip(srgb*255,0,255).astype(np.uint8)).resize((320,320),Image.Resampling.BILINEAR)
        result.paste(im,(i*320,25))
        draw.text((i*320+8,4),['INTNS reconstruction','Reduced 1D hot-flame model'][i],font=font,fill=(220,230,240))
    quality=meta['quality'][upper if fraction>=.5 else lower]
    if quality.get('inferredFromPrior') or quality.get('saturatedFraction',0)>.01:
        draw.text((8,329),'Limited frame: spherical inference / saturation',font=small,fill=(255,150,90))
    draw.text((8,350),f'{args.test}  t={t:06.2f}s | fixed exposure | emission projections; hardware omitted',font=small,fill=(160,180,200))
    return result

fps=20
command=['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','640x370','-r',str(fps),'-i','-','-an','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart','-t',str(times[-1]),str(ROOT/'flame-simulation.mp4')]
proc=subprocess.Popen(command,stdin=subprocess.PIPE)
try:
    for t in np.arange(0,times[-1],1/fps):proc.stdin.write(image_at(min(t,times[-1])).tobytes())
finally:proc.stdin.close()
if proc.wait()!=0:raise RuntimeError('ffmpeg export failed')
# A real-time excerpt; its on-image clock states the omitted pre-ignition time.
start=meta['ignitionMs']/1000;end=min(times[-1],meta['extinctionMs']/1000+1)
frames=[image_at(t).resize((400,232)) for t in np.arange(start,end,.5)]
frames[0].save(ROOT/'flame-simulation.gif',save_all=True,append_images=frames[1:],duration=500,loop=0,optimize=True)
sheet=Image.new('RGB',(960,740),(5,7,11))
for i,t in enumerate([35.,52.,70.]):
    frame=image_at(t)
    sheet.paste(frame.crop((0,0,320,345)),(i*320,0))
    sheet.paste(frame.crop((320,0,640,345)),(i*320,370))
    d=ImageDraw.Draw(sheet)
    d.text((i*320+8,348),f'INTNS: {t:.0f}s',font=font,fill='white')
    d.text((i*320+8,718),f'Model: {t:.0f}s',font=font,fill='white')
sheet.save(ROOT/'flame-simulation-sheet.png')
print('Exported comparison video, real-time GIF excerpt and contact sheet')

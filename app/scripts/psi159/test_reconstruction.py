"""Independent forward-model checks of the masked reconstruction."""
import sys
import unittest
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_flame_data import Reconstructor, abel_matrix, detect_flow_interval

CONFIG = {"z":128,"r":64,"domainRadiusPixels":560,"displayCounts":6000}
TEST = {"centerPixels":[692,380]}
class ReconstructionTest(unittest.TestCase):
    def setUp(self):
        self.rec = Reconstructor(CONFIG, TEST)
        self.y = 0.5 - (np.arange(128)+0.5)/128
        self.r = (np.arange(64)+0.5)/64*0.5
        self.valid = np.ones((1040,1392),np.float32)
        self.valid[328:516,:] = 0
    def source(self, radius, amplitude=1):
        rho=np.hypot(self.y[:,None],self.r[None,:])
        field=amplitude*np.exp(-((rho-radius)/0.023)**2)
        projection=field @ abel_matrix(64).T
        full=np.concatenate([projection[:,::-1],projection],axis=1)*6000
        square=Image.fromarray(full.astype(np.float32)).resize((1120,1120),Image.Resampling.BILINEAR)
        camera=Image.new('F',(1392,1040));camera.paste(square,(132,-180))
        return np.asarray(camera),field,projection
    def test_flow_clock_ignores_short_instrument_transients(self):
        times=np.arange(0,10,.01)
        flow=np.where(((times>1)&(times<1.2))|((times>3)&(times<8)),5.,0.)
        result=detect_flow_interval(times.tolist(),flow.tolist())
        self.assertLess(abs(result['flowOnMs']-3000),300)
        self.assertLess(abs(result['flowOffMs']-8000),300)
    def test_fixed_grid_preserves_growth_and_hidden_shell(self):
        peaks=[]
        for radius in [0.20,0.32]:
            raw,truth,projection=self.source(radius)
            result,quality=self.rec.reconstruct(raw,np.zeros_like(raw),self.valid,iterations=64)
            peaks.append(self.r[np.argmax(result[64])])
            self.assertLess(abs(peaks[-1]-radius),0.025)
            hidden_error=np.linalg.norm((result @ self.rec.a.T)[61:75]-projection[61:75])/np.linalg.norm(projection[61:75])
            self.assertLess(hidden_error,0.25)
            self.assertLess(quality['projectionNrmse'],0.10)
        self.assertGreater(peaks[1]-peaks[0],0.08)
    def test_linear_radiometry_and_dark_floor(self):
        fields=[]
        for amplitude in [0.25,0.5]:
            raw,_,_=self.source(0.3,amplitude)
            field,_=self.rec.reconstruct(raw,np.zeros_like(raw),self.valid)
            fields.append(field)
        self.assertTrue(np.allclose(fields[1],fields[0]*2,rtol=0.002,atol=1e-6))
        dark=np.zeros((1040,1392),np.float32)
        result,_=self.rec.reconstruct(dark,dark,self.valid)
        self.assertEqual(float(result.max()),0)
    def test_inconsistent_projection_is_flagged_and_does_not_become_a_disk(self):
        raw,_,_=self.source(0.3)
        raw=raw.copy();raw[:,550:835]*=0.01
        field,quality=self.rec.reconstruct(raw,np.zeros_like(raw),self.valid)
        self.assertTrue(quality['inferredFromPrior'])
        self.assertGreater(float(field.max()),0)
        self.assertTrue(np.allclose(field,field[::-1],rtol=0.002,atol=1e-6))
if __name__=='__main__':unittest.main()

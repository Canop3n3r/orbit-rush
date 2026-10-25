import sys, json
from PIL import Image
import numpy as np
a = np.asarray(Image.open(sys.argv[1]).convert('L'), dtype=np.float32) / 255
if len(sys.argv) < 3: print(json.dumps({'diff': 0})); sys.exit()
b = np.asarray(Image.open(sys.argv[2]).convert('L'), dtype=np.float32) / 255
d = np.abs(a - b) > 0.03
print(json.dumps({'diff': float(d.mean())}))

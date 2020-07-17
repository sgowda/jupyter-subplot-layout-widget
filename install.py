try:
    from jupyter_core.paths import jupyter_data_dir                                                                             
except ImportError:
    raise ImportError("Could not import jupyter paths, is it installed?")

import os, platform

try:
    jupyter_data_dir()
except:
    raise Exception("Could not find jupyter data directory!")

nbext_path = os.path.join(jupyter_data_dir(), 'nbextensions')

if not os.path.exists(nbext_path):
    raise Exception("Could not find jupyter-contrib-nbextensions install path, is it installed?")

print("Installing to %s using symbolic link (shortcut).\nYou may have to run as administrator if on windows or depending on your jupyter installation" % nbext_path)

extension_name = os.path.abspath('.').split('/')[-1]

# make symlink
os.symlink(os.path.abspath('.'), os.path.join(nbext_path, extension_name), target_is_directory=True)
